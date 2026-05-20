import should from 'should';
import _ from 'lodash';
import { ViewDB as ViewDb } from 'viewdb';
import { Client as ViewDbRemoteClient } from '../../';
import { SocketClient } from '../../';
import { Hybrid as HybridStore } from '../..';

describe('Observe-Update', function () {
  var local = null;
  var remote = null;
  var hybrid = null;

  beforeEach(
    () =>
      new Promise((resolve, reject) => {
        local = new ViewDb();
        var socketIoMock = {
          emit: function () {},
          on: function () {}
        };
        remote = new ViewDbRemoteClient(new SocketClient(socketIoMock));
        hybrid = new ViewDb(new HybridStore(local, remote, { throttleObserveRefresh: 0 }));
        hybrid.open().then(function () {
          resolve();
        });
      })
  );

  it('#observe-update with update query', () =>
    new Promise((resolve, reject) => {
      var id = 1;
      local.collection('dollhouse').insert({ _id: id });
      var cursor = hybrid.collection('dollhouse').find({ _id: id });

      var handle = cursor.observe({
        added: function (x) {
          x._id.should.equal(id);
          if (x._id === 3) {
            handle.stop();
            resolve();
          } else {
            cursor.updateQuery({ _id: ++id });
            local.collection('dollhouse').insert({ _id: id });
          }
        }
      });
      local.collection('dollhouse').insert({ _id: 'echo2' });
    }));
  it('#observe-update with update $in query', () =>
    new Promise((resolve, reject) => {
      local.collection('dollhouse').insert({ _id: 1 });
      var realDone = _.after(2, resolve);
      var cursor = hybrid.collection('dollhouse').find({ _id: { $in: [1, 2] } });

      var handle = cursor.observe({
        added: function (x) {
          if (x._id === 3) {
            handle.stop();
            realDone();
          } else {
            cursor.updateQuery({ _id: { $in: [2, 3] } });
            local.collection('dollhouse').insert({ _id: 3 });
          }
        },
        removed: function (x) {
          x._id.should.equal(1);
          realDone();
        }
      });
    }));
});
