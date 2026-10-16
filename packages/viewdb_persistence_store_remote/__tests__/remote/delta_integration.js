const ViewDb = require('viewdb');
const Remote = require('../../dist');
const ViewDbSocketServer = require('../../dist/server/server');
const SocketMock = require('socket.io-mock');
function doc(id, version, rank, value = version) {
  return { _id: id, version, rank, nested: { values: [value, { retained: true }] }, padding: 'x'.repeat(2048) };
}

function tracking(result, changes, withInit = true) {
  const options = {
    added(document, index) {
      result.splice(index, 0, document);
    },
    removed(document, index) {
      expect(result[index]._id).toBe(document._id);
      result.splice(index, 1);
    },
    moved(document, oldIndex, newIndex) {
      result.splice(oldIndex, 1);
      result.splice(newIndex, 0, document);
    },
    changed(previous, document, index) {
      result[index] = document;
      changes.push(structuredClone(document));
    }
  };
  if (withInit) options.init = (documents) => result.splice(0, result.length, ...documents);
  return options;
}

function setup(options) {
  const socket = new SocketMock();
  const packets = [];
  const requests = [];
  let intercept = () => false;
  const emit = socket.emit.bind(socket);
  socket.emit = (name, response) => {
    if (name === '/vdb/response') {
      packets.push(structuredClone(response));
      if (intercept(response, () => emit(name, structuredClone(response)))) return;
    }
    return emit(name, structuredClone(response));
  };
  socket.on('/vdb/request', (request) => requests.push(structuredClone(request)));
  const server = new ViewDb();
  new Remote.Server(server, socket);
  const client = new Remote.SocketClient(socket.socketClient, options);
  const remote = new ViewDb(new Remote.Client(client));
  const hybrid = new ViewDb(new Remote.Hybrid(new ViewDb(), remote, { throttleObserveRefresh: 0, cacheReads: false }));
  return {
    server,
    remote,
    hybrid,
    client,
    packets,
    requests,
    intercept(callback) {
      intercept = callback;
    }
  };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

async function until(predicate) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await settle();
  }
  expect(predicate()).toBe(true);
}

describe('Negotiated remote and hybrid deltas', () => {
  afterEach(() => {
    ViewDbSocketServer.configureDeltaCache({ maxBytes: 256 * 1024 * 1024, maxEntries: 65536 });
  });
  it.each([true, false])('reconciles hybrid movement during recovery with init callback=%s', async (withInit) => {
    const harness = setup();
    const collection = harness.server.collection('items');
    collection.insert([doc('a', 1, 1), doc('b', 1, 2)]);
    const result = [];
    const changes = [];
    let inits = 0;
    const options = tracking(result, changes, withInit);
    if (withInit) {
      const init = options.init;
      options.init = (documents) => {
        inits++;
        init(documents);
      };
    }
    const handle = harness.hybrid.collection('items').find({}).sort({ rank: 1 }).observe(options);
    try {
      await until(() => result.length === 2);
      let delayed;
      harness.intercept((response, release) => {
        const delta = response.p?.changes?.[0]?.d;
        if (delta?.documentId === 'a' && delta.version === 2) return true;
        if (response.p?.visible === true) {
          delayed = release;
          return true;
        }
        return false;
      });
      collection.save(doc('a', 2, 1));
      await settle();
      collection.save(doc('a', 3, 1));
      await until(() => delayed !== undefined);
      expect(result).toEqual([doc('a', 1, 1), doc('b', 1, 2)]);
      collection.save(doc('a', 4, 3));
      await settle();
      harness.intercept(() => false);
      delayed();
      await until(() => result[1]?._id === 'a' && result[1]?.version === 4);
      expect(result).toEqual([doc('b', 1, 2), doc('a', 4, 3)]);
      expect(inits).toBe(withInit ? 1 : 0);
      expect(harness.requests.some((request) => request.p['observe.snapshot'])).toBe(true);
      collection.save(doc('a', 5, 3));
      await until(() => result[1]?.version === 5);
      expect(result[1]).toEqual(doc('a', 5, 3));
      expect(changes.at(-1)).toEqual(doc('a', 5, 3));
    } finally {
      handle.stop();
    }
  });

  it('recovers a client-evicted baseline through the real server and keeps callback mutations private', async () => {
    const harness = setup({ deltaCache: { maxEntries: 1 } });
    const collection = harness.server.collection('items');
    collection.insert([doc('a', 1, 1), doc('b', 1, 2)]);
    const seen = [];
    let initialized = false;
    const handle = harness.remote
      .collection('items')
      .find({})
      .observe({
        init(documents) {
          documents[0].nested.values[0] = 'mutated';
          initialized = true;
        },
        changed(previous, document) {
          seen.push(structuredClone(document));
          document.nested.values[0] = 'mutated';
        }
      });
    try {
      await until(() => initialized);
      collection.save(doc('a', 2, 1));
      await until(() => seen.at(-1)?.version === 2);
      expect(seen.at(-1)).toEqual(doc('a', 2, 1));
      expect(harness.requests.filter((request) => request.p['observe.document']).length).toBe(1);
      collection.save(doc('a', 3, 1));
      await until(() => seen.at(-1)?.version === 3);
      expect(seen.at(-1)).toEqual(doc('a', 3, 1));
      expect(harness.requests.filter((request) => request.p['observe.document']).length).toBe(1);
    } finally {
      handle.stop();
    }
  });

  it('keeps legacy full-document callbacks when the process-wide server cache is disabled', async () => {
    const harness = setup();
    ViewDbSocketServer.configureDeltaCache({ maxBytes: 0 });
    const collection = harness.server.collection('items');
    collection.insert(doc('a', 1, 1));
    let initialized = false;
    let latest;
    const handle = harness.remote
      .collection('items')
      .find({})
      .observe({
        init() {
          initialized = true;
        },
        changed(previous, document) {
          latest = document;
        }
      });
    try {
      await until(() => initialized);
      collection.save(doc('a', 2, 1));
      await until(() => latest?.version === 2);
      expect(latest).toEqual(doc('a', 2, 1));
      expect(harness.packets.some((packet) => packet.p?.changes?.some((change) => change.d))).toBe(false);
      expect(harness.packets.some((packet) => packet.p?.changes?.some((change) => change.c?.n.version === 2))).toBe(true);
    } finally {
      handle.stop();
    }
  });
});
