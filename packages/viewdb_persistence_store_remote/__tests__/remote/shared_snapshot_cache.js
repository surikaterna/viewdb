var should = require('should');
var SharedSnapshotCache = require('../../dist/server/sharedSnapshotCache').SharedSnapshotCache;
var ViewDbSocketServer = require('../../dist/server/server');

describe('Remote shared snapshot cache', function () {
  afterEach(function () {
    ViewDbSocketServer.configureDeltaCache({});
  });

  it('shares exact snapshots while keeping each consumer baseline independent', function () {
    var cache = new SharedSnapshotCache();
    var consumerA = {};
    var consumerB = {};
    var consumerC = {};
    var v1 = { _id: 'doc', version: 1, value: 'first', nested: { safe: true } };
    cache.seed(consumerA, 1, 'items', v1);
    cache.seed(consumerB, 1, 'items', v1);
    cache.stats().should.deepEqual({ size: 1, bytes: Buffer.byteLength(JSON.stringify(v1)) });

    cache.seed(consumerB, 1, 'items', { _id: 'doc', version: 2, value: 'second', nested: { safe: true } });
    cache.seed(consumerB, 1, 'items', v1);
    cache.get(consumerA, 1, 'items', 'doc').version.should.equal(1);
    cache.get(consumerB, 1, 'items', 'doc').version.should.equal(2);

    cache.seed(consumerC, 1, 'items', { _id: 'doc', version: 2, value: 'different authoritative contents' });
    cache.get(consumerC, 1, 'items', 'doc').document.value.should.equal('different authoritative contents');
    cache.stats().size.should.equal(3);

    cache.seed(consumerC, 1, 'items', { _id: 'doc', version: 2, value: 'projected only' });
    cache.get(consumerC, 1, 'items', 'doc').document.value.should.equal('projected only');
    cache.stats().size.should.equal(4);
    cache.seed({}, 1, 'other-items', v1);
    cache.seed({}, 2, 'items', v1);
    cache.stats().size.should.equal(6);

    var shared = cache.get(consumerA, 1, 'items', 'doc').document;
    Object.isFrozen(shared).should.equal(true);
    Object.isFrozen(shared.nested).should.equal(true);
    v1.nested.safe.should.equal(true);
    v1.nested.safe = false;
    shared.nested.safe.should.equal(true);
  });

  it('clears one consumer without affecting another and evicts snapshots independently of references', function () {
    var cache = new SharedSnapshotCache();
    var consumerA = {};
    var consumerB = {};
    var doc = { _id: 'shared', version: 1, payload: 'snapshot' };
    cache.seed(consumerA, 1, 'items', doc);
    cache.seed(consumerB, 1, 'items', doc);
    var heldSnapshot = cache.get(consumerB, 1, 'items', 'shared').document;

    cache.clear(consumerA);
    should(cache.get(consumerA, 1, 'items', 'shared')).equal(undefined);
    cache.get(consumerB, 1, 'items', 'shared').document.should.equal(heldSnapshot);
    cache.stats().size.should.equal(1);

    cache.configure({ maxEntries: 0 });
    cache.stats().should.deepEqual({ size: 0, bytes: 0 });
    heldSnapshot.payload.should.equal('snapshot');
    should(cache.get(consumerB, 1, 'items', 'shared')).equal(undefined);
  });

  it('bounds consumer metadata independently of the shared snapshot budget', function () {
    var cache = new SharedSnapshotCache();
    var consumer = {};
    for (var index = 0; index < 2049; index++) {
      cache.seed(consumer, 1, 'items', { _id: String(index), version: 1 });
    }
    cache.stats().size.should.equal(2049);
    should(cache.get(consumer, 1, 'items', '0')).equal(undefined);
    cache.get(consumer, 1, 'items', '2048').version.should.equal(1);
    cache.configure({ maxBytes: 1 });
    cache.stats().should.deepEqual({ size: 0, bytes: 0 });
    should(cache.get(consumer, 1, 'items', '2048')).equal(undefined);
  });

  it('resizes and disables the process cache through the Server static API', function () {
    ViewDbSocketServer.configureDeltaCache({ maxEntries: 1 });
    ViewDbSocketServer.configureDeltaCache({ maxBytes: 0 });
    ViewDbSocketServer.getDeltaCacheStats().should.deepEqual({ size: 0, bytes: 0 });
    ViewDbSocketServer.configureDeltaCache.bind(null, { maxBytes: -1 }).should.throw(RangeError);
  });
  it('ignores legacy per-request cache budgets', function () {
    var SocketMock = require('socket.io-mock');
    ViewDbSocketServer.configureDeltaCache({ maxBytes: 1024 * 1024, maxEntries: 1 });
    var socketServer = new SocketMock();
    var socketClient = socketServer.socketClient;
    var observerOptions;
    var seed = { _id: 'request-budget', version: 1, value: 'before', payload: new Array(500).join('x') };
    var cursor = {
      sort: function () {
        return this;
      },
      limit: function () {
        return this;
      },
      skip: function () {
        return this;
      },
      project: function () {
        return this;
      },
      close: function (callback) {
        callback(null);
      },
      observe: function (options) {
        observerOptions = options;
        options.init([seed]);
        return { stop: function () {} };
      }
    };
    var fakeViewDb = {
      collection: function () {
        return {
          find: function () {
            return cursor;
          }
        };
      }
    };
    var responses = [];
    new ViewDbSocketServer(fakeViewDb, socketServer);
    socketClient.on('/vdb/response', function (response) {
      responses.push(response);
    });
    socketClient.emit('/vdb/request', {
      i: 'request-budget',
      p: {
        id: 'request-budget',
        collection: 'request-budget-documents',
        observe: { _id: seed._id },
        deltaVersion: 1,
        deltaCache: { maxBytes: 0, maxEntries: 0 },
        events: { i: false, a: false, r: false, c: true, m: false }
      }
    });
    ViewDbSocketServer.getDeltaCacheStats().size.should.equal(1);
    observerOptions.changed(null, { _id: seed._id, version: 2, value: 'after', payload: seed.payload }, 0);
    responses
      .some(function (response) {
        return response.i === 'request-budget' && response.p && response.p.changes && response.p.changes[0].d;
      })
      .should.equal(true);
  });
});
