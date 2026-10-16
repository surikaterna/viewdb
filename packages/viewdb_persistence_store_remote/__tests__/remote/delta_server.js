var should = require('should');
var ViewDb = require('viewdb');
var ViewDbSocketServer = require('../../dist/server/server');
var SocketMock = require('socket.io-mock');
var applyPatch = require('fast-json-patch').applyPatch;

describe('Remote server delta delivery', function () {
  it('uses a private seed and emits a changed-only delta after changed(null, document, index)', function () {
    return new Promise(function (resolve, reject) {
      var socketServer = new SocketMock();
      var socketClient = socketServer.socketClient;
      var seed = { _id: 'doc', version: 1, details: { label: 'before' }, values: [1, 2], payload: new Array(300).join('x') };
      var target = { _id: 'doc', version: 2, details: { label: 'after' }, values: [1, 3], payload: seed.payload };
      var observerOptions;
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
      new ViewDbSocketServer(fakeViewDb, socketServer);
      var timeout = setTimeout(function () {
        reject(new Error('delta event not received'));
      }, 3000);
      socketClient.on('/vdb/response', function (response) {
        if (response.i !== 'observer-request' || !response.p || !response.p.changes) return;
        var change = response.p.changes[0];
        if (change.s) change.s.r[0].details.label = 'caller mutation';
        if (!change.d) return;
        clearTimeout(timeout);
        change.d.documentId.should.equal('doc');
        change.d.baseVersion.should.equal(1);
        change.d.version.should.equal(2);
        var reconstructed = applyPatch(JSON.parse(JSON.stringify(seed)), change.d.patch).newDocument;
        JSON.stringify(reconstructed).should.equal(JSON.stringify(target));
        resolve();
      });
      socketClient.emit('/vdb/request', {
        i: 'observer-request',
        p: {
          id: 'observer',
          collection: 'delta_server_docs',
          observe: { _id: 'doc' },
          deltaVersion: 1,
          events: { i: false, a: false, r: false, c: true, m: false }
        }
      });
      observerOptions.changed(null, target, 0);
    });
  });

  it('uses full changes for equal, decreasing, invalid, and oversized versions', function () {
    return new Promise(function (resolve, reject) {
      var socketServer = new SocketMock();
      var socketClient = socketServer.socketClient;
      var seed = { _id: 'versions', version: 1, value: 'start', payload: new Array(400).join('x') };
      var observerOptions;
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
      new ViewDbSocketServer(fakeViewDb, socketServer);
      var fullEvents = [];
      var timeout = setTimeout(function () {
        reject(new Error('version fallback changes not received'));
      }, 3000);
      socketClient.on('/vdb/response', function (response) {
        if (response.i !== 'version-observer' || !response.p || !response.p.changes) return;
        var change = response.p.changes[0];
        if (!change.c) return;
        should(change.d).equal(undefined);
        fullEvents.push(change.c.n);
        if (fullEvents.length === 4) {
          clearTimeout(timeout);
          fullEvents
            .map(function (document) {
              return document.version;
            })
            .should.eql([1, 0, 2, 'invalid']);
          resolve();
        }
      });
      socketClient.emit('/vdb/request', {
        i: 'version-observer',
        p: {
          id: 'version-observer',
          collection: 'delta_server_versions',
          observe: { _id: 'versions' },
          deltaVersion: 1,
          events: { i: false, a: false, r: false, c: true, m: false }
        }
      });
      observerOptions.changed(null, { _id: 'versions', version: 1, value: 'equal', payload: seed.payload }, 0);
      observerOptions.changed(null, { _id: 'versions', version: 0, value: 'decreasing', payload: seed.payload }, 0);
      observerOptions.changed(null, { _id: 'versions', version: 2, value: 'large patch', payload: new Array(400).join('y') }, 0);
      observerOptions.changed(null, { _id: 'versions', version: 'invalid', value: 'invalid version', payload: seed.payload }, 0);
    });
  });
  it('reconciles an update received while the initial observer query is pending', function () {
    return new Promise(function (resolve, reject) {
      var socketServer = new SocketMock();
      var socketClient = socketServer.socketClient;
      var observerOptions;
      var initial = { _id: 'race', version: 2, value: 'queued update', payload: 'x'.repeat(1024) };
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
        toArray: function (callback) {
          callback(null, [initial]);
        },
        close: function (callback) {
          callback(null);
        },
        observe: function (options) {
          observerOptions = options;
          return { stop: function () {} };
        }
      };
      var target = { _id: 'race', version: 3, value: 'after init', payload: initial.payload };
      var fakeViewDb = {
        collection: function () {
          return {
            find: function () {
              return cursor;
            }
          };
        }
      };
      new ViewDbSocketServer(fakeViewDb, socketServer);
      var gotSeed = false;
      var timeout = setTimeout(function () {
        reject(new Error('init race delta not received'));
      }, 3000);
      socketClient.on('/vdb/response', function (response) {
        if (response.i !== 'init-race' || !response.p || !response.p.changes) return;
        var change = response.p.changes[0];
        if (change.s) {
          change.s.r[0].version.should.equal(2);
          change.s.r[0].value.should.equal('queued update');
          gotSeed = true;
        }
        if (change.d) {
          gotSeed.should.equal(true);
          change.d.baseVersion.should.equal(2);
          change.d.version.should.equal(3);
          var reconstructed = applyPatch(JSON.parse(JSON.stringify(initial)), change.d.patch).newDocument;
          JSON.stringify(reconstructed).should.equal(JSON.stringify(target));
          clearTimeout(timeout);
          resolve();
        }
      });
      socketClient.emit('/vdb/request', {
        i: 'init-race',
        p: {
          id: 'init-race',
          collection: 'delta_server_init_race',
          observe: { _id: 'race' },
          deltaVersion: 1,
          events: { i: false, a: false, r: false, c: true, m: false }
        }
      });
      observerOptions.changed(null, initial, 0);
      observerOptions.init([initial]);
      observerOptions.changed(null, target, 0);
    });
  });
  it('keeps masked negotiated changes full so the client baseline can advance', function () {
    return new Promise(function (resolve, reject) {
      var socketServer = new SocketMock();
      var socketClient = socketServer.socketClient;
      var observerOptions;
      var seed = { _id: 'masked', version: 1, value: 'before' };
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
      new ViewDbSocketServer(fakeViewDb, socketServer);
      var timeout = setTimeout(function () {
        reject(new Error('masked full baseline event not received'));
      }, 3000);
      socketClient.on('/vdb/response', function (response) {
        if (response.i !== 'masked-observer' || !response.p || !response.p.changes) return;
        var change = response.p.changes[0];
        if (!change.c) return;
        should(change.d).equal(undefined);
        change.c.n.version.should.equal(2);
        clearTimeout(timeout);
        resolve();
      });
      socketClient.emit('/vdb/request', {
        i: 'masked-observer',
        p: {
          id: 'masked-observer',
          collection: 'delta_server_masked',
          observe: { _id: 'masked' },
          deltaVersion: 1,
          events: { i: false, a: false, r: false, c: false, m: false }
        }
      });
      observerOptions.changed(null, { _id: 'masked', version: 2, value: 'after' }, 0);
    });
  });
});
