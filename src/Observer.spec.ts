import _ from 'lodash';
import ViewDb from '.';

describe('Observe', function () {
  it('#observe with insert', function (done) {
    const store = new ViewDb();
    store.open().then(function () {
      const cursor = store.collection('dollhouse').find({});
      const handle = cursor.observe({
        added: function (x) {
          expect(x._id).toBe('echo');
          handle.stop();
          done();
        }
      });
      store.collection('dollhouse').insert({_id: 'echo'});
    });
  });
  it('#observe with query and insert', function (done) {
    const store = new ViewDb();
    store.open().then(function () {
      store.collection('dollhouse').insert({_id: 'echo'});
      const cursor = store.collection('dollhouse').find({_id: 'echo2'});
      const handle = cursor.observe({
        added: function (x) {
          expect(x._id).toBe('echo2');
          handle.stop();
          done();
        }
      });
      store.collection('dollhouse').insert({_id: 'echo2'});
    });
  });
  it('#observe with query and update', function (done) {
    const store = new ViewDb();
    store.open().then(function () {
      const cursor = store.collection('dollhouse').find({_id: 'echo'});
      const handle = cursor.observe({
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

      store.collection('dollhouse').insert({_id: 'echo', age: 10}, function () {
        store.collection('dollhouse').save({_id: 'echo', age: 100});
      });
    });
  });
  it('#observe with query and skip', function (done) {
    const store = new ViewDb();
    store.open().then(function () {
      store.collection('dollhouse').insert({_id: 'echo'});
      store.collection('dollhouse').insert({_id: 'echo2'});
      store.collection('dollhouse').insert({_id: 'echo3'});
      const cursor = store.collection('dollhouse').find({});
      let skip = 0;
      cursor.limit(1);
      const realDone = _.after(3, function () {
        cursor.toArray(function (err, res) {
          expect(res?.length).toBe(0);
          handle.stop();
          done();
        });
      });
      const handle = cursor.observe({
        added: function () {
          cursor.skip(++skip);
          realDone();
        }
      });
    });
  });
  it('#observe with no results', function (done) {
    const store = new ViewDb();
    store.open().then(function () {
      const cursor = store.collection('dollhouse').find({});
      const handle = cursor.observe({
        init: function (coll) {
          expect(coll?.length).toBe(0);
          handle.stop();
          done();
        }
      });
    });
  });
  it('#observe with init after one insert', function (done) {
    const store = new ViewDb();
    store.collection('dollhouse').insert({_id: 'echo'}, function () {
      store.open().then(function () {
        const cursor = store.collection('dollhouse').find({});
        const handle = cursor.observe({
          init: function (coll) {
            expect(coll?.length).toBe(1);
            handle.stop();
            done();
          }
        });
      });
    });
  });
  it('#observe with one insert after init', function (done) {
    const store = new ViewDb();
    store.open().then(function () {
      const cursor = store.collection('dollhouse').find({});
      const handle = cursor.observe({
        init: function (coll) {
          expect(coll?.length).toBe(0);
        },
        added: function (a) {
          expect(a._id).toBe('echo');
          handle.stop();
          done();
        }
      });
    });
    setTimeout(function () {
      store.collection('dollhouse').insert({_id: 'echo'});
    }, 5);
  });
});
