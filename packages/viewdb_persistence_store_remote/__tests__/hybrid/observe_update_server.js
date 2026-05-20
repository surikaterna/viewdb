import should from 'should';
import { ViewDB as ViewDb } from 'viewdb';
import _ from 'lodash';
import ViewDbSocketServer from '../../src/server/server';
import Store from '../../src/client/store';
import Client from '../../src/client/rr_client';
import SocketMock from 'socket.io-mock';
import { Hybrid as HybridStore } from '../..';

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
});
