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

function setup() {
  const socket = new SocketMock();
  const packets = [];
  const emit = socket.emit.bind(socket);
  socket.emit = (name, response) => {
    packets.push(structuredClone(response));
    return emit(name, structuredClone(response));
  };
  const server = new ViewDb();
  const collection = projectedCollection(server, 'items');
  new Remote.Server(server, socket);
  const remote = new ViewDb(new Remote.Client(new Remote.SocketClient(socket.socketClient)));
  return { remote, collection, packets };
}

describe('Projected delta eligibility and observer indexes', () => {
  it('delivers full changed-only updates and correct sorted indexes without exposing a projected-out identity', async () => {
    const { remote, collection, packets } = setup();
    collection.insert([
      { _id: 'a', version: 1, rank: 1, title: 'A', secret: 'hidden' },
      { _id: 'b', version: 1, rank: 2, title: 'B', secret: 'hidden' }
    ]);
    const changes = [];
    const handle = remote
      .collection('items')
      .find({})
      .sort({ rank: 1 })
      .limit(2)
      .project({ _id: 0, version: 1, rank: 1, title: 1 })
      .observe({
        changed(previous, document, index) {
          changes.push({ document, index });
        }
      });
    try {
      await until(() => packets.some((packet) => packet.p?.changes?.[0]?.s));
      const seed = packets.find((packet) => packet.p?.changes?.[0]?.s).p.changes[0].s.r;
      expect(seed).toEqual([
        { version: 1, rank: 1, title: 'A' },
        { version: 1, rank: 2, title: 'B' }
      ]);
      collection.save({ _id: 'b', version: 2, rank: 2, title: 'B updated', secret: 'hidden' });
      await until(() => changes.length === 1);
      expect(changes[0]).toEqual({ document: { version: 2, rank: 2, title: 'B updated' }, index: 1 });
      collection.save({ _id: 'b', version: 3, rank: 0, title: 'B first', secret: 'hidden' });
      await until(() => changes.length === 2);
      expect(changes[1]).toEqual({ document: { version: 3, rank: 0, title: 'B first' }, index: 0 });
      expect(packets.some((packet) => packet.p?.changes?.some((change) => change.d))).toBe(false);
      for (const packet of packets) {
        for (const change of packet.p?.changes || []) {
          for (const document of change.i?.r || change.s?.r || [change.c?.n || change.a?.e || change.r?.e || change.m?.e].filter(Boolean)) {
            expect(document).not.toHaveProperty('_id');
            expect(document).not.toHaveProperty('secret');
          }
        }
      }
    } finally {
      handle.stop();
    }
  });

  it('keeps version-excluded changes full without revealing hidden fields', async () => {
    const { remote, collection, packets } = setup();
    collection.insert({ _id: 'a', version: 1, title: 'before', secret: 'hidden' });
    let seed;
    const changes = [];
    const handle = remote
      .collection('items')
      .find({})
      .project({ version: 0, secret: 0 })
      .observe({
        init(documents) {
          seed = documents;
        },
        changed(previous, document) {
          changes.push(document);
        }
      });
    try {
      await until(() => seed !== undefined);
      expect(seed).toEqual([{ _id: 'a', title: 'before' }]);
      collection.save({ _id: 'a', version: 2, title: 'after', secret: 'hidden' });
      await until(() => changes.length === 1);
      expect(changes).toEqual([{ _id: 'a', title: 'after' }]);
      expect(packets.some((packet) => packet.p?.changes?.some((change) => change.d))).toBe(false);
    } finally {
      handle.stop();
    }
  });
});
