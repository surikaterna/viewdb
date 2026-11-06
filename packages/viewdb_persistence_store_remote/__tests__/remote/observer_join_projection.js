const ViewDb = require('viewdb');
const Remote = require('../../dist');
const SocketMock = require('socket.io-mock');
const projectedCollection = require('./delta_query_fixture.cjs');

async function until(predicate) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  expect(predicate()).toBe(true);
}

function connect(viewdb, legacy = false) {
  const socket = new SocketMock();
  const packets = [];
  const emit = socket.emit.bind(socket);
  socket.emit = (name, response) => {
    packets.push(structuredClone(response));
    return emit(name, structuredClone(response));
  };
  const socketClient = socket.socketClient;
  if (legacy) {
    const clientEmit = socketClient.emit.bind(socketClient);
    socketClient.emit = (name, request) => {
      if (name === '/vdb/request' && request.p) delete request.p.deltaVersion;
      return clientEmit(name, request);
    };
  }
  new Remote.Server(viewdb, socket);
  const remote = new ViewDb(new Remote.Client(new Remote.SocketClient(socketClient)));
  return { remote, packets };
}

describe('Remote observer join initialization and projected delta eligibility', () => {
  it('uses full updates for large projections that hide _id', async () => {
    const viewdb = new ViewDb();
    const collection = projectedCollection(viewdb, 'items');
    const { remote, packets } = connect(viewdb);
    collection.insert({ _id: 'large', version: 1, title: 'before', payload: new Array(4000).join('x') });
    const changes = [];
    const handle = remote
      .collection('items')
      .find({})
      .project({ _id: 0, version: 1, title: 1, payload: 1 })
      .observe({
        changed(_previous, document) {
          changes.push(document);
        }
      });
    try {
      await until(() => packets.some((packet) => packet.p?.changes?.[0]?.s));
      collection.save({ _id: 'large', version: 2, title: 'after', payload: new Array(4000).join('x') });
      await until(() => changes.length === 1);
      expect(changes[0]).toEqual({ version: 2, title: 'after', payload: new Array(4000).join('x') });
      expect(packets.some((packet) => packet.p?.changes?.some((change) => change.d))).toBe(false);
      expect(
        packets
          .flatMap((packet) => packet.p?.changes || [])
          .every((change) => {
            const document = change.s?.r?.[0] || change.c?.n || change.a?.e || change.r?.e || change.m?.e;
            return !document || !Object.prototype.hasOwnProperty.call(document, '_id');
          })
      ).toBe(true);
    } finally {
      handle.stop();
    }
  });

  it('initializes joining windowed consumers from the committed snapshot during reconciliation', async () => {
    const viewdb = new ViewDb();
    const collection = projectedCollection(viewdb, 'items');
    collection.insert([
      { _id: 'a', rank: 1, value: 'committed' },
      { _id: 'b', rank: 2, value: 'second' }
    ]);
    const collectionFind = collection.find.bind(collection);
    let holdNext = false;
    let releaseQuery;
    collection.find = function (query) {
      const cursor = collectionFind(query);
      if (!holdNext) return cursor;
      holdNext = false;
      const toArray = cursor.toArray.bind(cursor);
      cursor.toArray = function (callback) {
        toArray((error, documents) => {
          releaseQuery = () => callback(error, documents);
        });
      };
      return cursor;
    };
    const initialConnection = connect(viewdb);
    const joiningLegacy = connect(viewdb, true);
    const joiningDelta = connect(viewdb);
    let initialReady;
    const initial = initialConnection.remote
      .collection('items')
      .find({ rank: { $gt: 0 } })
      .sort({ rank: 1 })
      .limit(2)
      .observe({
        init(documents) {
          initialReady = documents;
        }
      });
    let legacy;
    let delta;
    try {
      await until(() => initialReady !== undefined);
      holdNext = true;
      collection.save({ _id: 'a', rank: -1, value: 'outside window' });
      await until(() => releaseQuery !== undefined);

      const deferredInitializations = [];
      const nativeSetTimeout = global.setTimeout;
      global.setTimeout = function (callback, delay) {
        if (delay === 0) {
          deferredInitializations.push(callback);
          return { unref() {} };
        }
        return nativeSetTimeout.apply(global, arguments);
      };
      let legacyReady;
      let deltaReady;
      const legacyResult = [];
      const deltaResult = [];
      legacy = joiningLegacy.remote
        .collection('items')
        .find({ rank: { $gt: 0 } })
        .sort({ rank: 1 })
        .limit(2)
        .observe({
          init(documents) {
            legacyReady = true;
            legacyResult.splice(0, legacyResult.length, ...documents);
          },
          added(document, index) {
            legacyResult.splice(index, 0, document);
          },
          removed(_document, index) {
            legacyResult.splice(index, 1);
          },
          changed(_previous, document, index) {
            legacyResult[index] = document;
          },
          moved(document, oldIndex, newIndex) {
            legacyResult.splice(oldIndex, 1);
            legacyResult.splice(newIndex, 0, document);
          }
        });
      delta = joiningDelta.remote
        .collection('items')
        .find({ rank: { $gt: 0 } })
        .sort({ rank: 1 })
        .limit(2)
        .observe({
          init(documents) {
            deltaReady = true;
            deltaResult.splice(0, deltaResult.length, ...documents);
          },
          added(document, index) {
            deltaResult.splice(index, 0, document);
          },
          removed(_document, index) {
            deltaResult.splice(index, 1);
          },
          changed(_previous, document, index) {
            deltaResult[index] = document;
          },
          moved(document, oldIndex, newIndex) {
            deltaResult.splice(oldIndex, 1);
            deltaResult.splice(newIndex, 0, document);
          }
        });
      try {
        await until(() => deferredInitializations.length === 2);
        releaseQuery();
        const committed = [{ _id: 'b', rank: 2, value: 'second' }];
        expect(deferredInitializations.length).toBe(2);
        global.setTimeout = nativeSetTimeout;
        deferredInitializations.forEach((initialize) => {
          initialize();
        });
        await until(() => legacyResult.length === 1 && deltaResult.length === 1);
        expect(legacyResult).toEqual(committed);
        expect(deltaResult).toEqual(committed);
      } finally {
        global.setTimeout = nativeSetTimeout;
      }
    } finally {
      if (legacy) legacy.stop();
      if (delta) delta.stop();
      initial.stop();
    }
  });
});
