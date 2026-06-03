var should = require('should');
var ViewDb = require('viewdb');
var _ = require('lodash');
var ViewDbSocketServer = require('../../dist/server/server');
var Store = require('../../dist/client/store');
var Client = require('../../dist/client/rr_client');
var SocketMock = require('socket.io-mock');
var HybridStore = require('../..').Hybrid;

describe('Observe-Update Remote', function () {
  var clientRemote, serverViewdb, socketServer, socketClient, clientStore, client, clientLocal, hybrid;
  beforeEach(
    () =>
      new Promise((resolve, reject) => {
        socketServer = new SocketMock();
        socketClient = socketServer.socketClient;
        client = new Client(socketClient);
        serverViewdb = new ViewDb();
        var vdbSocketServer = new ViewDbSocketServer(serverViewdb, socketServer);

        clientLocal = new ViewDb(); // client local viewdb (typically IndexedDb)
        clientStore = new Store(client);
        clientRemote = new ViewDb(clientStore); // client remote viewdb
        hybrid = new ViewDb(new HybridStore(clientLocal, clientRemote, { throttleObserveRefresh: 0 }));

        resolve();
      })
  );
  it('#viewdb server+hybrid setup should work', () =>
    new Promise((resolve, reject) => {
      var id = 1,
        called = 0;
      serverViewdb.collection('dollhouse').insert({ _id: id });
      hybrid
        .collection('dollhouse')
        .find({ _id: id })
        .toArray(function (err, res) {
          if (called === 0) {
            called++;
          } else {
            resolve();
          }
        });
    }));
  it('#old docs should be removed on updateQuery', () =>
    new Promise((resolve, reject) => {
      var id = 1;
      serverViewdb.collection('dollhouse').insert({ _id: id });
      var hybridCursor = hybrid.collection('dollhouse').find({ _id: id });
      var realDone = _.after(6, resolve);

      var handle = hybridCursor.observe({
        init: function () {
          realDone(); // 1 call
        },
        added: function (x) {
          realDone(); // 3 calls
          x._id.should.equal(id);
          if (x._id === 3) {
            handle.stop();
          } else {
            hybridCursor.updateQuery({ _id: ++id });
            serverViewdb.collection('dollhouse').insert({ _id: id });
          }
        },
        removed: function (x) {
          realDone(); // 2 calls
        }
      });
      serverViewdb.collection('dollhouse').insert({ _id: 'echo2' });
    }));
  it('#update query from client', () =>
    new Promise((resolve, reject) => {
      var id = 1;
      serverViewdb.collection('dollhouse').insert({ _id: id });
      var hybridCursor = hybrid.collection('dollhouse').find({ _id: id });

      var handle = hybridCursor.observe({
        added: function (x) {
          x._id.should.equal(id);
          if (x._id === 3) {
            handle.stop();
            resolve();
          } else {
            hybridCursor.updateQuery({ _id: ++id });
            serverViewdb.collection('dollhouse').insert({ _id: id });
          }
        }
      });
      serverViewdb.collection('dollhouse').insert({ _id: 'echo2' });
    }));
  it('#observe-update with update from server $in query', () =>
    new Promise((resolve, reject) => {
      serverViewdb.collection('dollhouse').insert({ _id: 1 });
      var realDone = _.after(2, resolve);
      var hybridCursor = hybrid.collection('dollhouse').find({ _id: { $in: [1, 2] } });

      var handle = hybridCursor.observe({
        added: function (x) {
          if (x._id === 3) {
            handle.stop();
            realDone();
          } else {
            hybridCursor.updateQuery({ _id: { $in: [2, 3] } });
            serverViewdb.collection('dollhouse').insert({ _id: 3 });
          }
        },
        removed: function (x) {
          x._id.should.equal(1);
          realDone();
        }
      });
    }));

  it('#server duplicate observe id stops previous consumer', () => {
    var stoppedHandles = [];
    var socket = createSocket();
    var viewdb = createObserveOnlyViewDb(stoppedHandles);
    new ViewDbSocketServer(viewdb, socket);

    socket.trigger('/vdb/request', observeRequest(1, 'same-id', { _id: 'old' }));
    socket.trigger('/vdb/request', observeRequest(2, 'same-id', { _id: 'new' }));

    stoppedHandles.should.deepEqual(['old']);
    viewdb._getObserverStats().sharedObserverCount.should.equal(1);
    viewdb._getObserverStats().totalConsumerCount.should.equal(1);
  });

  it('#server stop before async observe decorator registration prevents late observe', () => {
    var decoratorCallback;
    var stoppedHandles = [];
    var socket = createSocket();
    var viewdb = createObserveOnlyViewDb(stoppedHandles);
    var decorator = function (collection, query, cb) {
      decoratorCallback = cb;
    };
    new ViewDbSocketServer(viewdb, socket, decorator);

    socket.trigger('/vdb/request', observeRequest(1, 'pending-id', { _id: 'pending' }));
    socket.trigger('/vdb/request', { i: 2, p: { 'observe.stop': { h: 'pending-id' } } });
    decoratorCallback({ _id: 'pending' });

    viewdb.observeCalls.should.equal(0);
    socket.emittedResponses.length.should.equal(0);
    stoppedHandles.should.deepEqual([]);
  });

  it('#real client stop before async observe decorator registration cancels server observer', () =>
    new Promise((resolve, reject) => {
      var decoratorCallback;
      var localSocketServer = new SocketMock();
      var localClient = new Client(localSocketServer.socketClient);
      var localClientStore = new Store(localClient);
      var localRemote = new ViewDb();
      var localClientVdb = new ViewDb(localClientStore);
      var decorator = function (collection, query, cb) {
        decoratorCallback = cb;
      };
      new ViewDbSocketServer(localRemote, localSocketServer, decorator);

      var handle = localClientVdb.collection('dollhouse').find({ _id: 'pending' }).observe({
        init: function () {
          reject(new Error('stopped observer should not receive init'));
        }
      });
      handle.stop();

      setTimeout(function () {
        if (!decoratorCallback) {
          reject(new Error('observe decorator was not called'));
          return;
        }
        decoratorCallback({ _id: 'pending' });

        setTimeout(function () {
          var stats = localRemote._getObserverStats();
          stats.sharedObserverCount.should.equal(0);
          stats.totalConsumerCount.should.equal(0);
          resolve();
        }, 10);
      }, 0);
    }));
});

function observeRequest(index, id, query) {
  return {
    i: index,
    p: {
      id: id,
      collection: 'dollhouse',
      observe: query
    }
  };
}

function createSocket() {
  var handlers = {};
  return {
    emittedResponses: [],
    on: function (event, callback) {
      handlers[event] = callback;
    },
    emit: function (event, payload) {
      if (event === '/vdb/response') {
        this.emittedResponses.push(payload);
      }
    },
    trigger: function (event, payload) {
      handlers[event](payload);
    }
  };
}

function createObserveOnlyViewDb(stoppedHandles) {
  var viewdb = {
    observeCalls: 0,
    collection: function () {
      return {
        find: function (query) {
          return createObserveOnlyCursor(viewdb, query, stoppedHandles);
        }
      };
    }
  };
  return viewdb;
}

function createObserveOnlyCursor(viewdb, query, stoppedHandles) {
  return {
    observe: function () {
      viewdb.observeCalls++;
      return {
        stop: function () {
          stoppedHandles.push(query._id);
        }
      };
    },
    close: function (callback) {
      callback(null);
    }
  };
}
