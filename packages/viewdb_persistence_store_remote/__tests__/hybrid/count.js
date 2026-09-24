var assert = require('node:assert/strict');
var ViewDb = require('viewdb');
var SocketMock = require('socket.io-mock');
var ViewDbSocketServer = require('../../dist/server/server');
var Client = require('../../dist/client/rr_client');
var RemoteStore = require('../../dist/client/store');
var HybridStore = require('../..').Hybrid;

describe('Hybrid cursor count', function () {
  var hybrid, local, remote;
  beforeEach(function () {
    var socketServer = new SocketMock();
    var server = new ViewDb();
    new ViewDbSocketServer(server, socketServer);
    remote = new ViewDb(new RemoteStore(new Client(socketServer.socketClient)));
    local = new ViewDb();
    hybrid = new ViewDb(new HybridStore(local, remote, { localFirst: false }));

    var serverCollection = server.collection('items');
    serverCollection.insert({ _id: 1, category: 'match' });
    serverCollection.insert({ _id: 2, category: 'other' });
    serverCollection.insert({ _id: 3, category: 'match' });
    serverCollection.insert({ _id: 4, category: 'match' });
    serverCollection.insert({ _id: 5, category: 'match' });
    local.collection('items').insert({ _id: 6, category: 'match' });
  });

  function count(cursor, options) {
    return new Promise(function (resolve, reject) {
      var callback = function (err, result) {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      };
      if (options === undefined) {
        cursor.count(callback);
      } else {
        cursor.count(options, callback);
      }
    });
  }

  it('counts a filtered query on a cache miss', async function () {
    var result = await count(hybrid.collection('items').find({ category: 'match' }));
    assert.equal(result, 4);
  });

  it('applies cursor skip and limit to the remote count', async function () {
    var result = await count(hybrid.collection('items').find({ category: 'match' }).skip(1).limit(2));
    assert.equal(result, 2);
  });

  it('uses explicit skip and limit options when the cursor has no bounds', async function () {
    var collection = hybrid.collection('items');
    assert.equal(await count(collection.find({ category: 'match' }), { skip: 2 }), 2);
    assert.equal(await count(collection.find({ category: 'match' }), { limit: 3 }), 3);
  });

  it('waits for the remote count when explicit bounds cannot be applied locally', async function () {
    var localFirstHybrid = new ViewDb(new HybridStore(local, remote));
    assert.equal(await count(localFirstHybrid.collection('items').find({ category: 'match' }), { skip: 2 }), 2);
  });

  it('gives cursor skip and limit precedence over explicit options', async function () {
    var result = await count(hybrid.collection('items').find({ category: 'match' }).skip(1).limit(2), { skip: 3, limit: 4 });
    assert.equal(result, 2);
  });
});
