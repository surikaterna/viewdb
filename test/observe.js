var ViewDb = require('..');
var _ = require('lodash');

describe('Observe', () => {
  it('#observe with insert', done => {
    var store = new ViewDb();
    store.open().then(function () {
      var cursor = store.collection('dollhouse').find({});
      var handle = cursor.observe({
        added: function (x) {
          expect(x._id).toBe('echo');
          handle.stop();
          done();
        }
      });
      store.collection('dollhouse').insert({ _id: 'echo' });
    });
  });
  it('#observe with query and insert', done => {
    var store = new ViewDb();
    store.open().then(function () {
      store.collection('dollhouse').insert({ _id: 'echo' });
      var cursor = store.collection('dollhouse').find({ _id: 'echo2' });
      var handle = cursor.observe({
        added: function (x) {
          expect(x._id).toBe('echo2');
          done();
        }
      });
      store.collection('dollhouse').insert({ _id: 'echo2' });
    });
  });
  it('#observe with query and update', done => {
    var store = new ViewDb();
    store.open().then(function () {
      var cursor = store.collection('dollhouse').find({ _id: 'echo' });
      var handle = cursor.observe({
        added: function (x) {
          expect(x.age).toBe(10);
          expect(x._id).toBe('echo');
        }, changed: function (o, n) {
          expect(o.age).toBe(10);
          expect(n.age).toBe(100);
          handle.stop();
          done();
        }
      });

      store.collection('dollhouse').insert({ _id: 'echo', age: 10 }, function () {
        store.collection('dollhouse').save({ _id: 'echo', age: 100 });
      });
    });
  });
  it('#observe with query and skip', done => {
    var store = new ViewDb();
    store.open().then(function () {
      store.collection('dollhouse').insert({ _id: 'echo' });
      store.collection('dollhouse').insert({ _id: 'echo2' });
      store.collection('dollhouse').insert({ _id: 'echo3' });
      var cursor = store.collection('dollhouse').find({});
      var skip = 0;
      cursor.limit(1);
      var realDone = _.after(3, function () {
        cursor.toArray(function (err, res) {
          expect(res.length).toBe(0);
          handle.stop();
          done();
        })
      });
      var handle = cursor.observe({
        added: function (x) {
          cursor.skip(++skip);
          realDone();
        }
      });
    });
  });
  it('#observe with no results', done => {
    var store = new ViewDb();
    store.open().then(function () {
      var cursor = store.collection('dollhouse').find({});
      var handle = cursor.observe({
        init: function (coll) {
          expect(coll.length).toBe(0);
          handle.stop();
          done();
        }
      });
    });
  });
  it('#observe with init after one insert', done => {
    var store = new ViewDb();
    store.collection('dollhouse').insert({ _id: 'echo' }, function () {
      store.open().then(function () {
        var cursor = store.collection('dollhouse').find({});
        var handle = cursor.observe({
          init: function (coll) {
            expect(coll.length).toBe(1);
            handle.stop();
            done();
          }
        });
      });
    });
  });
  it('#observe with one insert after init', done => {
    var store = new ViewDb();
    store.open().then(function () {
      var cursor = store.collection('dollhouse').find({});
      var handle = cursor.observe({
        init: function (coll) {
          expect(coll.length).toBe(0);
        },
        added: function (a) {
          expect(a._id).toBe('echo');
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
