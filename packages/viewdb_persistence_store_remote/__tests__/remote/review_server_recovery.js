var should = require('should');
var deltaDelivery = require('../../dist/server/deltaDelivery');
var ViewDbSocketServer = require('../../dist/server/server');
var SocketMock = require('socket.io-mock');

describe('Server observer recovery review regressions', function () {
  afterEach(function () {
    ViewDbSocketServer.configureDeltaCache({ maxBytes: 256 * 1024 * 1024, maxEntries: 65536 });
  });

  it('invalidates a baseline when an unsupported document reaches the cache seed path', function () {
    var consumer = {
      request: { i: 'cache-seed', p: {} },
      socket: { emit: function () {} },
      events: { c: true },
      ready: true,
      delta: true,
      collection: 'review_cache_seed',
      namespace: 987654,
      sequence: 0,
      readPreference: undefined
    };
    var payload = 'x'.repeat(1200);
    deltaDelivery.cacheDocument(null, consumer, { _id: 'seed', version: 1, value: 'before', payload: payload });
    should(deltaDelivery.cacheDocument(null, consumer, { _id: 'seed', version: 1, value: undefined, payload: payload })).equal(undefined);
    var change = deltaDelivery.changedFor(null, consumer, { _id: 'seed', version: 2, value: 'after', payload: payload }, 0);
    should(change.d).equal(undefined);
    change.c.n.version.should.equal(2);
  });

  it('uses each requesting socket decorator for document and snapshot recovery', function () {
    return new Promise(function (resolve, reject) {
      var rows = [
        { _id: 'tenant-a', tenant: 'A', version: 1 },
        { _id: 'tenant-b', tenant: 'B', version: 1 }
      ];
      var firstSocket = new SocketMock();
      var secondSocket = new SocketMock();
      var remote = fakeViewDb(function (query) {
        return matchingRows(rows, query);
      });
      var restrictSecondRecovery = false;
      new ViewDbSocketServer(remote, firstSocket, function (_collection, query, callback) {
        callback(query);
      });
      new ViewDbSocketServer(remote, secondSocket, function (_collection, query, callback) {
        callback(restrictSecondRecovery ? { tenant: 'B' } : query);
      });
      var firstClient = firstSocket.socketClient;
      var secondClient = secondSocket.socketClient;
      var startedSecond = false;
      var requestedSnapshot = false;
      var timeout = setTimeout(function () {
        reject(new Error('per-consumer recovery authorization was not applied'));
      }, 3000);
      secondClient.on('/vdb/response', function (response) {
        if (response.i === 'second' && response.p && response.p.changes && !startedSecond) {
          startedSecond = true;
          restrictSecondRecovery = true;
          setTimeout(function () {
            secondClient.emit('/vdb/request', {
              i: 'document-recovery',
              p: { 'observe.document': { h: 'shared-observer', documentId: 'tenant-a' } }
            });
          }, 0);
        } else if (response.i === 'document-recovery' && response.p) {
          response.p.visible.should.equal(false);
          requestedSnapshot = true;
          secondClient.emit('/vdb/request', { i: 'snapshot-recovery', p: { 'observe.snapshot': { h: 'shared-observer' } } });
        } else if (response.i === 'snapshot-recovery' && response.p) {
          requestedSnapshot.should.equal(true);
          response.p.documents.length.should.equal(1);
          response.p.documents[0]._id.should.equal('tenant-b');
          clearTimeout(timeout);
          firstClient.emit('/vdb/request', { i: 'stop-first', p: { 'observe.stop': { h: 'shared-observer' } } });
          secondClient.emit('/vdb/request', { i: 'stop-second', p: { 'observe.stop': { h: 'shared-observer' } } });
          resolve();
        }
      });
      firstClient.emit('/vdb/request', {
        i: 'first',
        p: {
          id: 'shared-observer',
          collection: 'review_authorized_recovery',
          observe: {},
          deltaVersion: 1,
          events: { i: true, a: true, r: true, c: true, m: true }
        }
      });
      secondClient.emit('/vdb/request', {
        i: 'second',
        p: {
          id: 'shared-observer',
          collection: 'review_authorized_recovery',
          observe: {},
          deltaVersion: 1,
          events: { i: true, a: true, r: true, c: true, m: true }
        }
      });
    });
  });

  it('serializes only the requested recovery row and sends JSON wire values for snapshots', function () {
    return new Promise(function (resolve, reject) {
      var rows = [
        { _id: 'safe', version: 1, value: 'requested' },
        { _id: 'unrelated', version: 1, stamp: new Date('2024-02-03T04:05:06.000Z'), omitted: undefined }
      ];
      var socketServer = new SocketMock();
      var socketClient = socketServer.socketClient;
      var remote = fakeViewDb(function () {
        return rows;
      });
      new ViewDbSocketServer(remote, socketServer);
      var documentDone = false;
      var recoveryStarted = false;
      var timeout = setTimeout(function () {
        reject(new Error('document and snapshot recovery serialization failed'));
      }, 3000);
      socketClient.on('/vdb/response', function (response) {
        if (response.i === 'serialization-observer' && response.p && response.p.changes && !recoveryStarted) {
          recoveryStarted = true;
          socketClient.emit('/vdb/request', {
            i: 'document-recovery',
            p: { 'observe.document': { h: 'serialization-observer', documentId: 'safe' } }
          });
        } else if (response.i === 'document-recovery' && response.p) {
          response.p.visible.should.equal(true);
          response.p.document.value.should.equal('requested');
          should(response.p.document).not.have.property('_id');
          documentDone = true;
          socketClient.emit('/vdb/request', { i: 'snapshot-recovery', p: { 'observe.snapshot': { h: 'serialization-observer' } } });
        } else if (response.i === 'snapshot-recovery' && response.p) {
          documentDone.should.equal(true);
          response.p.documents.length.should.equal(2);
          var unrelated = response.p.documents.find(function (document) {
            return document.stamp !== undefined;
          });
          unrelated.stamp.should.equal('2024-02-03T04:05:06.000Z');
          should(unrelated).not.have.property('omitted');
          response.p.documents.forEach(function (document) {
            should(document).not.have.property('_id');
          });
          clearTimeout(timeout);
          socketClient.emit('/vdb/request', { i: 'stop', p: { 'observe.stop': { h: 'serialization-observer' } } });
          resolve();
        }
      });
      socketClient.emit('/vdb/request', {
        i: 'serialization-observer',
        p: {
          id: 'serialization-observer',
          collection: 'review_serialization_recovery',
          observe: {},
          project: { _id: 0, version: 1, value: 1, stamp: 1, omitted: 1 },
          deltaVersion: 1,
          events: { i: true, a: true, r: true, c: true, m: true }
        }
      });
    });
  });

  it('invalidates unsupported same-version baselines before the next delta candidate', function () {
    return new Promise(function (resolve, reject) {
      var seed = { _id: 'baseline', version: 1, value: 'before', payload: 'x'.repeat(1200) };
      var options;
      var socketServer = new SocketMock();
      var socketClient = socketServer.socketClient;
      var remote = fakeViewDb(
        function () {
          return [seed];
        },
        function (observerOptions) {
          options = observerOptions;
        }
      );
      new ViewDbSocketServer(remote, socketServer);
      var changes = [];
      var timeout = setTimeout(function () {
        reject(new Error('unsupported full update was not followed by a baseline-safe full update'));
      }, 3000);
      socketClient.on('/vdb/response', function (response) {
        if (response.i !== 'baseline-observer' || !response.p || !response.p.changes) return;
        var change = response.p.changes[0];
        if (change.s) {
          options.changed(null, { _id: 'baseline', version: 1, value: undefined, payload: seed.payload }, 0);
        } else if (change.c || change.d) {
          changes.push(change);
          if (changes.length === 1) {
            should(changes[0].c).not.equal(undefined);
            should(changes[0].d).equal(undefined);
            options.changed(null, { _id: 'baseline', version: 2, value: 'after', payload: seed.payload }, 0);
          } else {
            should(changes[1].c).not.equal(undefined);
            should(changes[1].d).equal(undefined);
            clearTimeout(timeout);
            socketClient.emit('/vdb/request', { i: 'stop', p: { 'observe.stop': { h: 'baseline-observer' } } });
            resolve();
          }
        }
      });
      socketClient.emit('/vdb/request', {
        i: 'baseline-observer',
        p: {
          id: 'baseline-observer',
          collection: 'review_unsupported_baseline',
          observe: { _id: 'baseline' },
          deltaVersion: 1,
          events: { i: false, a: false, r: false, c: true, m: false }
        }
      });
    });
  });

  it('coalesces window callbacks into bounded reconciliations and delivers the latest row', function () {
    return new Promise(function (resolve, reject) {
      var documents = [{ _id: 'row', version: 1, rank: 1, value: 'before' }];
      var options;
      var socketServer = new SocketMock();
      var socketClient = socketServer.socketClient;
      var remote = fakeViewDb(
        function () {
          return documents;
        },
        function (observerOptions) {
          options = observerOptions;
        },
        15
      );
      new ViewDbSocketServer(remote, socketServer);
      var initialized = false;
      var timeout = setTimeout(function () {
        reject(new Error('coalesced reconciliation did not deliver final row state'));
      }, 3000);
      socketClient.on('/vdb/response', function (response) {
        if (response.i !== 'window-observer' || !response.p || !response.p.changes) return;
        var changes = response.p.changes;
        if (!initialized && changes[0].i) {
          initialized = true;
          remote.queryCount.should.equal(1);
          documents = [{ _id: 'row', version: 2, rank: 1, value: 'after' }];
          for (var index = 0; index < 12; index++) options.moved(documents[0], 0, 0);
        } else {
          var change = changes[0];
          if (!change.c) return;
          change.c.n.version.should.equal(2);
          change.c.n.value.should.equal('after');
          (remote.queryCount <= 3).should.equal(true);
          clearTimeout(timeout);
          socketClient.emit('/vdb/request', { i: 'stop', p: { 'observe.stop': { h: 'window-observer' } } });
          resolve();
        }
      });
      socketClient.emit('/vdb/request', {
        i: 'window-observer',
        p: {
          id: 'window-observer',
          collection: 'review_window_recovery',
          observe: {},
          sort: { rank: 1 },
          limit: 1,
          events: { i: true, a: true, r: true, c: true, m: true }
        }
      });
    });
  });
});

function fakeViewDb(readRows, onObserve, delay) {
  var queryCount = 0;
  return {
    get queryCount() {
      return queryCount;
    },
    collection: function () {
      return {
        find: function (query) {
          var projection;
          var cursor = {
            setReadPreference: function () {
              return cursor;
            },
            sort: function () {
              return cursor;
            },
            limit: function () {
              return cursor;
            },
            skip: function () {
              return cursor;
            },
            project: function (value) {
              projection = value;
              return cursor;
            },
            toArray: function (callback) {
              queryCount++;
              var rows = matchingRows(readRows(), query).map(function (row) {
                return projectRow(row, projection);
              });
              if (delay)
                setTimeout(function () {
                  callback(null, rows);
                }, delay);
              else callback(null, rows);
            },
            close: function (callback) {
              callback(null);
            },
            observe: function (observerOptions) {
              if (onObserve) onObserve(observerOptions);
              observerOptions.init(
                matchingRows(readRows(), query).map(function (row) {
                  return projectRow(row, projection);
                })
              );
              return { stop: function () {} };
            }
          };
          return cursor;
        }
      };
    }
  };
}

function matchingRows(rows, query) {
  var expected = query || {};
  return rows.filter(function (row) {
    return Object.keys(expected).every(function (key) {
      return row[key] === expected[key];
    });
  });
}

function projectRow(row, projection) {
  if (!projection) return row;
  var included = Object.keys(projection).filter(function (key) {
    return key !== '_id' && (projection[key] === 1 || projection[key] === true);
  });
  if (!included.length) return row;
  var projected = {};
  included.forEach(function (key) {
    if (key in row) projected[key] = row[key];
  });
  if (projection._id !== 0 && projection._id !== false && '_id' in row) projected._id = row._id;
  return projected;
}
