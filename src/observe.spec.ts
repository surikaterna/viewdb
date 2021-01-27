import 'should';
import _ from 'lodash';
import ViewDb from '.';

describe('Observe', function () {
  it('#observe with insert', function (done) {
    var store = new ViewDb();
    store.open().then(function () {
      var cursor = store.collection('dollhouse').find({});
      var handle = cursor.observe({
        added: function (x: any) {
          x._id.should.equal('echo');
          handle.stop();
          done();
        }
      });
      store.collection('dollhouse').insert({ _id: 'echo' });
    });
  });
  it('#observe with query and insert', function (done) {
    var store = new ViewDb();
    store.open().then(function () {
      store.collection('dollhouse').insert({ _id: 'echo' });
      var cursor = store.collection('dollhouse').find({ _id: 'echo2' });
      cursor.observe({
        added: function (x: any) {
          x._id.should.equal('echo2');
          done();
        }
      });
      store.collection('dollhouse').insert({ _id: 'echo2' });
    });
  });
  it('#observe with query and update', function (done) {
    var store = new ViewDb();
    store.open().then(function () {
      var cursor = store.collection('dollhouse').find({ _id: 'echo' });
      var handle = cursor.observe({
        added: function (x: any) {
          x.age.should.equal(10);
          x._id.should.equal('echo');
        }, changed: function (o: any, n: any) {
          o.age.should.equal(10);
          n.age.should.equal(100);
          handle.stop();
          done();
        }
      });

      store.collection('dollhouse').insert({ _id: 'echo', age: 10 }, function () {
        store.collection('dollhouse').save({ _id: 'echo', age: 100 });
      });
    });
  });
  it('#observe with query and skip', function (done) {
    var store = new ViewDb();
    store.open().then(function () {
      store.collection('dollhouse').insert({ _id: 'echo' });
      store.collection('dollhouse').insert({ _id: 'echo2' });
      store.collection('dollhouse').insert({ _id: 'echo3' });
      var cursor = store.collection('dollhouse').find({});
      var skip = 0;
      cursor.limit(1);
      var realDone = _.after(3, function () {
        cursor.toArray(function (_err: any, res: any) {
          res.length.should.equal(0);
          handle.stop();
          done();
        })
      });
      var handle = cursor.observe({
        added: function (_x: any) {
          cursor.skip(++skip);
          realDone();
        }
      });
    });
  });
  it('#observe with no results', function (done) {
    var store = new ViewDb();
    store.open().then(function () {
      var cursor = store.collection('dollhouse').find({});
      var handle = cursor.observe({
        init: function (coll: any) {
          coll.length.should.equal(0);
          handle.stop();
          done();
        }
      });
    });
  });
  it('#observe with init after one insert', function (done) {
    var store = new ViewDb();
    store.collection('dollhouse').insert({ _id: 'echo' }, function () {
      store.open().then(function () {
        var cursor = store.collection('dollhouse').find({});
        var handle = cursor.observe({
          init: function (coll: any) {
            coll.length.should.equal(1);
            handle.stop();
            done();
          }
        });
      });
    });
  });
  it('#observe with one insert after init', function (done) {
    var store = new ViewDb();
    store.open().then(function () {
      var cursor = store.collection('dollhouse').find({});
      var handle = cursor.observe({
        init: function (coll: any) {
          coll.length.should.equal(0);
        },
        added: function (a: any) {
          a._id.should.equal('echo');
          handle.stop();
          done();
        }
      });
    });
    setTimeout(function () {
      store.collection('dollhouse').insert({ _id: 'echo' });
    }, 5);
  });
});
