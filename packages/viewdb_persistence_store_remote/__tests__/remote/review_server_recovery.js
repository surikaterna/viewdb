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
      id: 'cache-seed',
      request: { i: 'cache-seed', p: {} },
      socket: { emit: function () {} },
      events: { c: true },
      ready: true,
      delta: true,
      collection: 'review_cache_seed',
      namespace: 987654,
      sequence: 0
    };
    var payload = 'x'.repeat(1200);
    deltaDelivery.cacheDocument(null, consumer, { _id: 'seed', version: 1, value: 'before', payload: payload });
    should(deltaDelivery.cacheDocument(null, consumer, { _id: 'seed', version: 1, value: undefined, payload: payload })).equal(undefined);
    var change = deltaDelivery.changedFor(null, consumer, { _id: 'seed', version: 2, value: 'after', payload: payload }, 0);
    should(change.d).equal(undefined);
    change.c.n.version.should.equal(2);
  });

  it('rebinds a restricted recovery to its own limited observer without affecting other consumers', function () {
    return new Promise(function (resolve, reject) {
      var rows = [
        { _id: 'tenant-a', tenant: 'A', rank: 1, version: 1 },
        { _id: 'tenant-b', tenant: 'B', rank: 2, version: 1 }
      ];
      var observers = [];
      var firstSocket = new SocketMock();
      var secondSocket = new SocketMock();
      var remote = fakeViewDb(
        function () {
          return rows;
        },
        function (options, query) {
          observers.push({ options: options, query: query });
        }
      );
      var restrictSecondRecovery = false;
      new ViewDbSocketServer(remote, firstSocket);
      new ViewDbSocketServer(remote, secondSocket, function (_collection, query, callback) {
        callback(restrictSecondRecovery ? { tenant: 'B' } : query);
      });
      var firstClient = firstSocket.socketClient;
      var secondClient = secondSocket.socketClient;
      var startedSecond = false;
      var snapshotDone = false;
      var firstSawOldUpdate = false;
      var authorizedUpdateSeen = false;
      var unauthorizedSecondUpdate = false;
      var cleanupStarted = false;
      var timeout = setTimeout(function () {
        reject(new Error('restricted recovery did not rebind and retain authorized window updates'));
      }, 3000);
      firstClient.on('/vdb/response', function (response) {
        if (response.i !== 'first' || !response.p || !response.p.changes) return;
        response.p.changes.forEach(function (change) {
          if (change.i) change.i.r[0].tenant.should.equal('A');
          if (change.c && change.c.n._id === 'tenant-a' && change.c.n.version === 2) firstSawOldUpdate = true;
        });
      });
      secondClient.on('/vdb/response', function (response) {
        if (response.i === 'second' && response.p && response.p.changes) {
          var change = response.p.changes[0];
          if (change.i && !startedSecond) {
            change.i.r[0].tenant.should.equal('A');
            startedSecond = true;
            restrictSecondRecovery = true;
            secondClient.emit('/vdb/request', {
              i: 'document-recovery',
              p: { 'observe.document': { h: 'shared-observer', documentId: 'tenant-a' } }
            });
          } else if (snapshotDone) {
            response.p.changes.forEach(function (event) {
              var document = event.a ? event.a.e : event.r ? event.r.e : event.c ? event.c.n : event.d && event.d.row ? event.d.row : undefined;
              if (document && document.tenant !== 'B') unauthorizedSecondUpdate = true;
              if (event.a && event.a.e._id === 'tenant-b-new') authorizedUpdateSeen = true;
            });
            if (authorizedUpdateSeen && !cleanupStarted) {
              cleanupStarted = true;
              unauthorizedSecondUpdate.should.equal(false);
              firstSawOldUpdate.should.equal(true);
              remote._vdbSharedObservers.size.should.equal(2);
              secondClient.emit('/vdb/request', { i: 'stop-second', p: { 'observe.stop': { h: 'shared-observer' } } });
              setTimeout(function () {
                remote._vdbSharedObservers.size.should.equal(1);
                firstClient.emit('/vdb/request', { i: 'stop-first', p: { 'observe.stop': { h: 'shared-observer' } } });
                setTimeout(function () {
                  remote._vdbSharedObservers.size.should.equal(0);
                  clearTimeout(timeout);
                  resolve();
                }, 0);
              }, 0);
            }
          }
        } else if (response.i === 'document-recovery' && response.p) {
          response.p.visible.should.equal(false);
          secondClient.emit('/vdb/request', { i: 'snapshot-recovery', p: { 'observe.snapshot': { h: 'shared-observer' } } });
        } else if (response.i === 'snapshot-recovery' && response.p) {
          response.p.documents.length.should.equal(1);
          response.p.documents[0]._id.should.equal('tenant-b');
          response.p.rowKeys.length.should.equal(1);
          snapshotDone = true;
          var oldObserver = observers.find(function (entry) {
            return Object.keys(entry.query).length === 0;
          }).options;
          var targetObserver = observers.find(function (entry) {
            return entry.query.tenant === 'B';
          }).options;
          var oldRow = rows[0];
          var changedOldRow = { _id: 'tenant-a', tenant: 'A', rank: 1, version: 2 };
          rows[0] = changedOldRow;
          oldObserver.changed(oldRow, changedOldRow, 0);
          var newlyVisible = { _id: 'tenant-b-new', tenant: 'B', rank: 0, version: 1 };
          rows.unshift(newlyVisible);
          targetObserver.added(newlyVisible, 0);
        }
      });
      firstClient.emit('/vdb/request', {
        i: 'first',
        p: {
          id: 'shared-observer',
          collection: 'review_authorized_recovery',
          observe: {},
          sort: { rank: 1 },
          limit: 1,
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
          sort: { rank: 1 },
          limit: 1,
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

  it('commits a delayed window snapshot after an in-flight removal', function () {
    return new Promise(function (resolve, reject) {
      var documents = [{ _id: 'vanishing-row', rank: 1, value: 'before' }];
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
        30
      );
      new ViewDbSocketServer(remote, socketServer);
      var recoveryRequested = false;
      var removalSequence;
      var timeout = setTimeout(function () {
        reject(new Error('window recovery did not wait for pending removal'));
      }, 3000);
      socketClient.on('/vdb/response', function (response) {
        if (response.i === 'window-observer' && response.p && response.p.changes) {
          var change = response.p.changes[0];
          if (change.i && !recoveryRequested) {
            recoveryRequested = true;
            socketClient.emit('/vdb/request', {
              i: 'window-snapshot',
              p: { 'observe.snapshot': { h: 'window-observer' } }
            });
            setTimeout(function () {
              documents = [];
              options.removed({ _id: 'vanishing-row', rank: 1, value: 'before' }, 0);
            }, 5);
          } else if (change.r) removalSequence = response.p.sequence;
        } else if (response.i === 'window-snapshot' && response.p) {
          response.p.documents.length.should.equal(0);
          should(removalSequence).equal(response.p.sequence);
          response.p.rowKeys.length.should.equal(0);
          clearTimeout(timeout);
          socketClient.emit('/vdb/request', { i: 'stop-window', p: { 'observe.stop': { h: 'window-observer' } } });
          resolve();
        }
      });
      socketClient.emit('/vdb/request', {
        i: 'window-observer',
        p: {
          id: 'window-observer',
          collection: 'review_delayed_window_recovery',
          observe: {},
          sort: { rank: 1 },
          limit: 1,
          deltaVersion: 1
        }
      });
    });
  });

  it('caps retries for a window that stays dirty during every read', function () {
    return new Promise(function (resolve, reject) {
      var documents = [{ _id: 'dirty-row', rank: 1, value: 'same' }];
      var options;
      var dirty = false;
      var socketServer = new SocketMock();
      var socketClient = socketServer.socketClient;
      var remote = fakeViewDb(
        function () {
          return documents;
        },
        function (observerOptions) {
          options = observerOptions;
        },
        0,
        function () {
          if (dirty) options.moved(documents[0], 0, 0);
        }
      );
      new ViewDbSocketServer(remote, socketServer);
      var initialQueries;
      var started = false;
      var timeout = setTimeout(function () {
        reject(new Error('endless dirty observer was not failed after bounded retries'));
      }, 3000);
      socketClient.on('/vdb/response', function (response) {
        if (response.i !== 'dirty-window') return;
        if (response.p && response.p.changes && response.p.changes[0].i && !started) {
          started = true;
          initialQueries = remote.queryCount;
          dirty = true;
          options.moved(documents[0], 0, 0);
        } else if (response.e) {
          response.e.code.should.equal('RECOVERY_FAILED');
          (remote.queryCount - initialQueries).should.equal(3);
          dirty = false;
          clearTimeout(timeout);
          socketClient.emit('/vdb/request', { i: 'stop-dirty', p: { 'observe.stop': { h: 'dirty-window' } } });
          resolve();
        }
      });
      socketClient.emit('/vdb/request', {
        i: 'dirty-window',
        p: {
          id: 'dirty-window',
          collection: 'review_endless_dirty_window',
          observe: {},
          sort: { rank: 1 },
          limit: 1
        }
      });
    });
  });

  it('uses primary reads to stabilize a window despite a lagging secondary preference', function () {
    return new Promise(function (resolve, reject) {
      var secondaryRows = [{ _id: 'row', rank: 1, version: 1, value: 'stale' }];
      var primaryRows = [{ _id: 'row', rank: 1, version: 2, value: 'primary' }];
      var socketServer = new SocketMock();
      var socketClient = socketServer.socketClient;
      var remote = fakeViewDb(function (preference) {
        return preference === 'primary' ? primaryRows : secondaryRows;
      });
      new ViewDbSocketServer(remote, socketServer, undefined, undefined, 'secondary');
      var timeout = setTimeout(function () {
        reject(new Error('stable observer did not read from the primary'));
      }, 3000);
      socketClient.on('/vdb/response', function (response) {
        if (response.i !== 'primary-window' || !response.p || !response.p.changes) return;
        var initial = response.p.changes[0].i;
        if (!initial) return;
        initial.r[0].value.should.equal('primary');
        should(remote.readPreferences.indexOf('primary') >= 0).equal(true);
        clearTimeout(timeout);
        socketClient.emit('/vdb/request', { i: 'stop-primary', p: { 'observe.stop': { h: 'primary-window' } } });
        resolve();
      });
      socketClient.emit('/vdb/request', {
        i: 'primary-window',
        p: {
          id: 'primary-window',
          collection: 'review_primary_window_recovery',
          observe: {},
          sort: { rank: 1 },
          limit: 1,
          deltaVersion: 1
        }
      });
    });
  });

  it('emits stable opaque row keys for projected rows and recovery snapshots', function () {
    return new Promise(function (resolve, reject) {
      var oldRow = { _id: 'private-row-id', rank: 1, version: 1, value: 'before' };
      var rows = [oldRow];
      var options;
      var socketServer = new SocketMock();
      var socketClient = socketServer.socketClient;
      var remote = fakeViewDb(
        function () {
          return rows;
        },
        function (observerOptions) {
          options = observerOptions;
        }
      );
      new ViewDbSocketServer(remote, socketServer);
      var rowKey;
      var requestedSnapshot = false;
      var timeout = setTimeout(function () {
        reject(new Error('projected observer row key was not preserved'));
      }, 3000);
      socketClient.on('/vdb/response', function (response) {
        if (response.i === 'opaque-row-observer' && response.p && response.p.changes) {
          var change = response.p.changes[0];
          if (change.i) {
            should(change.i.r[0]._id).equal(undefined);
            change.i.rowKeys.length.should.equal(1);
            rowKey = change.i.rowKeys[0];
            rowKey.should.not.equal('private-row-id');
            if (!requestedSnapshot) {
              requestedSnapshot = true;
              socketClient.emit('/vdb/request', {
                i: 'opaque-row-snapshot',
                p: { 'observe.snapshot': { h: 'opaque-row-observer' } }
              });
            }
          } else if (change.c || change.d) {
            var eventRowKey = change.d ? change.rowKey : change.c.rowKey;
            eventRowKey.should.equal(rowKey);
            clearTimeout(timeout);
            socketClient.emit('/vdb/request', { i: 'stop-opaque-row', p: { 'observe.stop': { h: 'opaque-row-observer' } } });
            resolve();
          }
        } else if (response.i === 'opaque-row-snapshot' && response.p) {
          response.p.rowKeys.length.should.equal(1);
          response.p.rowKeys[0].should.equal(rowKey);
          rows = [{ _id: 'private-row-id', rank: 1, version: 2, value: 'after' }];
          options.changed(oldRow, rows[0], 0);
        }
      });
      socketClient.emit('/vdb/request', {
        i: 'opaque-row-observer',
        p: {
          id: 'opaque-row-observer',
          collection: 'review_projected_row_keys',
          observe: {},
          sort: { rank: 1 },
          limit: 1,
          project: { _id: 0, value: 1, version: 1 },
          deltaVersion: 1
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

function fakeViewDb(readRows, onObserve, delay, onRead) {
  var queryCount = 0;
  var readPreferences = [];
  return {
    get queryCount() {
      return queryCount;
    },
    get readPreferences() {
      return readPreferences;
    },
    collection: function () {
      return {
        find: function (query) {
          var projection;
          var readPreference;
          var sortOptions;
          var limitCount;
          var skipCount = 0;
          var currentRows = function () {
            var rows = matchingRows(readRows(readPreference), query);
            if (sortOptions) {
              var sortKeys = Object.keys(sortOptions);
              rows.sort(function (left, right) {
                for (var index = 0; index < sortKeys.length; index++) {
                  var key = sortKeys[index];
                  if (left[key] === right[key]) continue;
                  var order = sortOptions[key] === -1 ? -1 : 1;
                  return left[key] < right[key] ? -order : order;
                }
                return 0;
              });
            }
            rows = rows.slice(skipCount, limitCount === undefined ? undefined : skipCount + limitCount);
            return rows.map(function (row) {
              return projectRow(row, projection);
            });
          };
          var cursor = {
            setReadPreference: function (value) {
              readPreference = value;
              readPreferences.push(value);
              return cursor;
            },
            sort: function (value) {
              sortOptions = value;
              return cursor;
            },
            limit: function (value) {
              limitCount = value;
              return cursor;
            },
            skip: function (value) {
              skipCount = value;
              return cursor;
            },
            project: function (value) {
              projection = value;
              return cursor;
            },
            toArray: function (callback) {
              queryCount++;
              var rows = currentRows();
              if (onRead) onRead(rows, readPreference);
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
              if (onObserve) onObserve(observerOptions, query, readPreference);
              observerOptions.init(currentRows());
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
