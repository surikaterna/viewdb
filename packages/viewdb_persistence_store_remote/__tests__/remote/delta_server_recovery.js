var should = require('should');
var ViewDb = require('viewdb');
var ViewDbSocketServer = require('../../dist/server/server');
var SocketMock = require('socket.io-mock');
var projectedCollection = require('./delta_query_fixture.cjs');

describe('Shared remote observers and recovery access', function () {
  afterEach(function () {
    ViewDbSocketServer.configureDeltaCache({ maxBytes: 256 * 1024 * 1024, maxEntries: 65536 });
  });
  it('delivers isolated full and delta changes to mixed consumers sharing one observer', function () {
    return new Promise(function (resolve, reject) {
      var socketServer = new SocketMock();
      var socketClient = socketServer.socketClient;
      var remote = new ViewDb();
      new ViewDbSocketServer(remote, socketServer);
      var collection = remote.collection('delta_server_shared');
      collection.insert({ _id: 'shared', version: 1, value: 'before', payload: new Array(300).join('x') });
      var handles = 0;
      var seeds = 0;
      var legacyChanged = false;
      var deltaChanged = false;
      var updated = false;
      var timeout = setTimeout(function () {
        reject(new Error('mixed shared changes not received'));
      }, 3000);
      socketClient.on('/vdb/response', function (response) {
        if (response.i === 'legacy-consumer' && response.p && response.p.handle) {
          handles++;
          startDeltaConsumer();
        } else if (response.i === 'delta-consumer' && response.p && response.p.handle) {
          handles++;
        } else if (response.i === 'delta-consumer' && response.p && response.p.changes) {
          if (response.p.changes[0].s) seeds++;
          if (response.p.changes[0].d) {
            response.p.changes[0].d.version.should.equal(2);
            deltaChanged = true;
          }
        } else if (response.i === 'legacy-consumer' && response.p && response.p.changes && response.p.changes[0].c) {
          response.p.changes[0].c.n.version.should.equal(2);
          legacyChanged = true;
        }
        if (!updated && handles === 2 && seeds > 0) {
          updated = true;
          collection.save({ _id: 'shared', version: 2, value: 'after', payload: 'x'.repeat(299) });
        }
        if (legacyChanged && deltaChanged) {
          clearTimeout(timeout);
          remote._getObserverStats().sharedObserverCount.should.equal(1);
          resolve();
        }
      });
      function startDeltaConsumer() {
        if (handles !== 1) return;
        socketClient.emit('/vdb/request', {
          i: 'delta-consumer',
          p: {
            id: 'delta-consumer',
            collection: 'delta_server_shared',
            observe: { _id: 'shared' },
            deltaVersion: 1,
            events: { i: false, a: false, r: false, c: true, m: false }
          }
        });
      }
      socketClient.emit('/vdb/request', {
        i: 'legacy-consumer',
        p: { id: 'legacy-consumer', collection: 'delta_server_shared', observe: { _id: 'shared' }, events: { i: false, a: false, r: false, c: true, m: false } }
      });
    });
  });

  it('falls back to a full change after the process-wide cache evicts the document baseline', function () {
    ViewDbSocketServer.configureDeltaCache({ maxBytes: 256 * 1024 * 1024, maxEntries: 1 });
    return new Promise(function (resolve, reject) {
      var socketServer = new SocketMock();
      var socketClient = socketServer.socketClient;
      var remote = new ViewDb();
      new ViewDbSocketServer(remote, socketServer);
      var collection = remote.collection('delta_server_eviction');
      collection.insert({ _id: 'a', version: 1, value: 'one' });
      collection.insert({ _id: 'b', version: 1, value: 'two' });
      var timeout = setTimeout(function () {
        reject(new Error('full changed event not received'));
      }, 3000);
      socketClient.on('/vdb/response', function (response) {
        if (response.i !== 'eviction-observer' || !response.p || !response.p.changes) return;
        var change = response.p.changes[0];
        if (change.s)
          setTimeout(function () {
            collection.save({ _id: 'a', version: 2, value: 'updated' });
          }, 10);
        if (!change.c) return;
        clearTimeout(timeout);
        change.c.n._id.should.equal('a');
        change.c.n.version.should.equal(2);
        resolve();
      });
      socketClient.emit('/vdb/request', {
        i: 'eviction-observer',
        p: {
          id: 'eviction-observer',
          collection: 'delta_server_eviction',
          observe: {},
          deltaVersion: 1,
          events: { i: false, a: false, r: false, c: true, m: false }
        }
      });
    });
  });

  it('recovers only documents in the registered projected result window', function () {
    return new Promise(function (resolve, reject) {
      var socketServer = new SocketMock();
      var socketClient = socketServer.socketClient;
      var remote = new ViewDb();
      new ViewDbSocketServer(remote, socketServer, function (_collection, query, callback) {
        callback(query);
      });
      projectedCollection(remote, 'delta_server_recovery');
      remote.collection('delta_server_recovery').insert({ _id: 'visible', title: 'public', secret: 'hidden' });
      remote.collection('delta_server_recovery').insert({ _id: 'outside', title: 'outside', secret: 'hidden' });
      var documentRecovered = false;
      var snapshotRecovered = false;
      var snapshotStarted = false;
      var handleReady = false;
      var initReady = false;
      var recoveryStarted = false;
      function recoverWhenReady() {
        if (handleReady && initReady && !recoveryStarted) {
          recoveryStarted = true;
          socketClient.emit('/vdb/request', { i: 'document', p: { 'observe.document': { h: 'recovery-observer', documentId: 'visible' } } });
        }
      }
      socketClient.on('/vdb/response', function (response) {
        if (response.i === 'recovery' && response.p && response.p.handle) {
          handleReady = true;
          recoverWhenReady();
        } else if (response.i === 'recovery' && response.p && response.p.changes) {
          initReady = true;
          recoverWhenReady();
        } else if (response.i === 'document' && response.p) {
          response.p.visible.should.equal(true);
          response.p.document.title.should.equal('public');
          should(response.p.document.secret).equal(undefined);
          response.p.sequence.should.be.a.Number();
          documentRecovered = true;
          if (!snapshotStarted) {
            snapshotStarted = true;
            socketClient.emit('/vdb/request', { i: 'snapshot', p: { 'observe.snapshot': { h: 'recovery-observer' } } });
          }
        } else if (response.i === 'snapshot' && response.p) {
          response.p.documents.length.should.equal(1);
          response.p.documents[0]._id.should.equal('visible');
          response.p.documents[0].title.should.equal('public');
          should(response.p.documents[0].secret).equal(undefined);
          response.p.sequence.should.be.a.Number();
          snapshotRecovered = true;
        }
        if (documentRecovered && snapshotRecovered) {
          socketClient.emit('/vdb/request', { i: 'stop', p: { 'observe.stop': { h: 'recovery-observer' } } });
          resolve();
        }
      });
      socketClient.emit('/vdb/request', {
        i: 'recovery',
        p: {
          id: 'recovery-observer',
          collection: 'delta_server_recovery',
          observe: {},
          project: { title: 1 },
          limit: 1,
          deltaVersion: 1,
          events: { i: true, a: true, r: true, c: true, m: true }
        }
      });
    });
  });

  it('reconciles a sort/skip/limit boundary change as full projected structural events', function () {
    return new Promise(function (resolve, reject) {
      var socketServer = new SocketMock();
      var socketClient = socketServer.socketClient;
      var remote = new ViewDb();
      new ViewDbSocketServer(remote, socketServer);
      var collection = projectedCollection(remote, 'delta_server_window');
      collection.insert({ _id: 'a', rank: 3, title: 'A', secret: 'hidden' });
      collection.insert({ _id: 'b', rank: 2, title: 'B', secret: 'hidden' });
      collection.insert({ _id: 'c', rank: 1, title: 'C', secret: 'hidden' });
      var timeout = setTimeout(function () {
        reject(new Error('window reconciliation events not received'));
      }, 3000);
      var sawRemoval = false;
      var sawAddition = false;
      socketClient.on('/vdb/response', function (response) {
        if (response.i !== 'window-observer' || !response.p || !response.p.changes) return;
        response.p.changes.forEach(function (change) {
          if (change.i) {
            change.i.r.length.should.equal(1);
            change.i.r[0]._id.should.equal('b');
            setTimeout(function () {
              collection.save({ _id: 'b', rank: 4, title: 'B updated', secret: 'hidden' });
            }, 10);
          }
          if (change.r) {
            change.r.e._id.should.equal('b');
            should(change.r.e.secret).equal(undefined);
            sawRemoval = true;
            if (sawAddition) {
              clearTimeout(timeout);
              resolve();
            }
          }
          if (change.a) {
            change.a.e._id.should.equal('a');
            should(change.a.e.secret).equal(undefined);
            sawAddition = true;
            if (sawRemoval) {
              clearTimeout(timeout);
              resolve();
            }
          }
        });
      });
      socketClient.emit('/vdb/request', {
        i: 'window-observer',
        p: {
          id: 'window-observer',
          collection: 'delta_server_window',
          observe: {},
          sort: { rank: -1 },
          skip: 1,
          limit: 1,
          project: { title: 1, rank: 1 },
          deltaVersion: 1,
          events: { i: true, a: true, r: true, c: true, m: true }
        }
      });
    });
  });
  it('denies recovery outside authorization and rejects handles owned by another socket', function () {
    return new Promise(function (resolve, reject) {
      var remote = new ViewDb();
      remote.collection('delta_server_security').insert({ _id: 'allowed', tenant: 'A', version: 1 });
      remote.collection('delta_server_security').insert({ _id: 'denied', tenant: 'B', version: 1 });
      function authorize(_collection, _query, callback) {
        callback({ tenant: 'A' });
      }
      var firstServer = new SocketMock();
      var secondServer = new SocketMock();
      new ViewDbSocketServer(remote, firstServer, authorize);
      new ViewDbSocketServer(remote, secondServer, authorize);
      var firstClient = firstServer.socketClient;
      var secondClient = secondServer.socketClient;
      var initialized = false;
      var deniedResult = false;
      var crossSocketDenied = false;
      var staleHandleDenied = false;
      var stopRequested = false;
      var timeout = setTimeout(function () {
        reject(new Error('recovery access checks not received'));
      }, 3000);
      firstClient.on('/vdb/response', function (response) {
        if (response.i === 'secure-observer' && response.p && response.p.changes) {
          initialized = true;
          firstClient.emit('/vdb/request', { i: 'denied-document', p: { 'observe.document': { h: 'secure-observer', documentId: 'denied' } } });
          secondClient.emit('/vdb/request', { i: 'cross-socket', p: { 'observe.snapshot': { h: 'secure-observer' } } });
        } else if (response.i === 'denied-document' && response.p) {
          response.p.visible.should.equal(false);
          deniedResult = true;
          if (!stopRequested) {
            stopRequested = true;
            firstClient.emit('/vdb/request', { i: 'stop', p: { 'observe.stop': { h: 'secure-observer' } } });
            firstClient.emit('/vdb/request', { i: 'stopped-handle', p: { 'observe.snapshot': { h: 'secure-observer' } } });
          }
        } else if (response.i === 'stopped-handle' && response.e) {
          response.e.code.should.equal('OBSERVER_NOT_FOUND');
          staleHandleDenied = true;
        }
        if (deniedResult && crossSocketDenied && staleHandleDenied) {
          clearTimeout(timeout);
          initialized.should.equal(true);
          resolve();
        }
      });
      secondClient.on('/vdb/response', function (response) {
        if (response.i !== 'cross-socket' || !response.e) return;
        response.e.code.should.equal('OBSERVER_NOT_FOUND');
        crossSocketDenied = true;
        if (deniedResult) {
          clearTimeout(timeout);
          resolve();
        }
      });
      firstClient.emit('/vdb/request', {
        i: 'secure-observer',
        p: {
          id: 'secure-observer',
          collection: 'delta_server_security',
          observe: {},
          deltaVersion: 1,
          events: { i: true, a: true, r: true, c: true, m: true }
        }
      });
    });
  });
});
