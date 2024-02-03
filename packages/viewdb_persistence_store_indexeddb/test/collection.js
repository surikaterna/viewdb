var should = require('should');

var Store = require('../lib/store');
var Collection = require('../lib/collection');
var getDb = require('./util');

describe('Collection', function () {
  var store;
  beforeEach(function (done) {
    var idb = getDb();
    store = new Store(idb);
    done();
  });
  afterEach(function (done) {
    if (store) {
      store.close().then(function () {
        // destroy the world by t bruun
        var idb = store._idb;
        idb._databases.clear();
        done();
      });
    }
  });
  //store.delete() }).then(function () {
  // console.log('deleted 2');

  it('#find with empty array should return 0 docs', function (done) {

    store.open().then(function () {
      store.collection('dollhouse').find({}).toArray(function (err, results) {
        results.length.should.equal(0);
        done();
      });
    });
  });
  it('#insert two documents with same key should throw', function (done) {
    store.open().then(function () {
      store.collection('dollhouse').insert({ _id: 'echo' });
      store.collection('dollhouse').insert({ _id: 'echo' }, function (err, result) {
        if (err) {
          done();
        } else {
          done(new Error('should have thrown unique constraint'));
        }
      });
    });
  });
  it('#insert two documents with same key but in different collections should work', function (done) {
    store.open().then(function () {
      store.collection('dollhouse').insert({ _id: 'echo' });
      store.collection('dollhouse2').insert({ _id: 'echo' }, function (err, result) {
        if (err) {
          console.log(err);
          done(new Error('should not have thrown unique constraint'));
        } else {
          done();
        }
      });
    });
  });

  it('#update documents already existing', function (done) {
    store.open().then(function () {
      store.collection('dollhouse').insert({ _id: 'echo' });
      store.collection('dollhouse').save({ _id: 'echo', version: 2 });
      store.collection('dollhouse').find({}).toArray(function (err, results) {
        results.length.should.equal(1);
        results[0].version.should.equal(2);
        done();
      });
    });
  });
  it('#find {} should return single inserted document', function (done) {
    store.open().then(function () {
      store.collection('dollhouse').insert({ _id: 'echo' });
      store.collection('dollhouse').find({}).toArray(function (err, results) {
        results.length.should.equal(1);
        done();
      });
    });
  });
  it('#find {} should return multiple inserted documents', function (done) {
    store.open().then(function () {
      store.collection('dollhouse').insert({ _id: 'echo' });
      store.collection('dollhouse').insert({ _id: 'sierra' });
      store.collection('dollhouse').find({}).toArray(function (err, results) {
        results.length.should.equal(2);
        done();
      });
    });
  });
  it('#find {_id:"echo"} should return correct document', function (done) {
    store.open().then(function () {
      store.collection('dollhouse').insert({ _id: 'echo' });
      store.collection('dollhouse').insert({ _id: 'sierra' });
      store.collection('dollhouse').find({ _id: 'echo' }).toArray(function (err, results) {
        results.length.should.equal(1);
        results[0]._id.should.equal('echo');
        done();
      });
    });
  });
  it('#find with complex key {"name.first":"echo"} should return correct document', function (done) {
    store.open().then(function () {
      var promises = [
        store.collection('dollhouse').insert({ _id: 'echo', name: { first: 'ECHO', last: "TV" } }),
        store.collection('dollhouse').insert({ _id: 'sierra', name: { first: 'SIERRA', last: "TV" } })
      ];
      Promise.all(promises).then(function () {


        return store.collection('dollhouse').find({ "name.first": 'ECHO' }).toArray(function (err, results) {
          results.length.should.equal(1);
          results[0]._id.should.equal('echo');
          done();
        });
      }).catch(function (err) {
        console.log('Got fish', err);
      })
    });
  });
  it('#drop should remove all documents', function (done) {
    store.open().then(function () {
      store.collection('dollhouse').insert({ _id: 'echo' });
      store.collection('dollhouse').drop();

      store.collection('dollhouse').find({}).toArray(function (err, results) {
        results.length.should.equal(0);
        done();
      });
    });
  });
  it('#sort should sort on a property', function (done) {
    store.open().then(function () {
      store.collection('dollhouse').insert({ _id: 'alpha' });
      store.collection('dollhouse').insert({ _id: 'beta' });
      store.collection('dollhouse').insert({ _id: 'cosworth' });
      store.collection('dollhouse').insert({ _id: 'dingo' });

      store.collection('dollhouse').find({}).sort({_id: 1}).toArray(function (err, results) {
        results[0]._id.should.equal('alpha');
        done();
      });
    });
  });
  it('#sort should sort on a property, descending', function (done) {
    store.open().then(function () {
      store.collection('dollhouse').insert({ _id: 'alpha' });
      store.collection('dollhouse').insert({ _id: 'beta' });
      store.collection('dollhouse').insert({ _id: 'cosworth' });
      store.collection('dollhouse').insert({ _id: 'dingo' });

      store.collection('dollhouse').find({}).sort({_id: -1}).toArray(function (err, results) {
        results[0]._id.should.equal('dingo');
        done();
      });
    });
  });
  it('#insert documents via bulk', function (done) {
    store.open().then(function () {
      store.collection('dollhouse').insert([{ _id: 'echo' }, { _id: 'sierra' }]);
      store.collection('dollhouse').find({}).toArray(function (err, results) {
        results.length.should.equal(2);
        done();
      });
    });
  });
  it('#update documents via bulk', function (done) {
    store.open().then(function () {
      store.collection('dollhouse').insert([{ _id: 'echo' }, { _id: 'sierra' }]);
      store.collection('dollhouse').save([{ _id: 'echo', version: 2 }, { _id: 'sierra', version: 22 }]);
      store.collection('dollhouse').find({}).toArray(function (err, results) {
        results.length.should.equal(2);
        results[0].version.should.equal(2);
        results[1].version.should.equal(22);
        done();
      });
    });
  });
  it('#count should return number of documents', function (done) {
    store.open().then(function () {
      store.collection('dollhouse').insert({ _id: 'echo' });
      store.collection('dollhouse').insert({ _id: 'sierra' });
      store.collection('dollhouse').find({}).count(function (err, count) {
        count.should.equal(2);
        done();
      });
    });
  });
  it('#count should return number of documents with filter', function (done) {
    store.open().then(function () {
      store.collection('dollhouse').insert({ _id: 'echo' });
      store.collection('dollhouse').insert({ _id: 'sierra' });
      store.collection('dollhouse').find({_id: 'echo'}).count(function (err, count) {
        count.should.equal(1);
        done();
      });
    });
  });
 it('#count should include skip', function (done) {
    store.open().then(function () {
      store.collection('dollhouse').insert({ _id: 'echo' });
      store.collection('dollhouse').insert({ _id: 'sierra' });
      store.collection('dollhouse').find({}).skip(1).count(true, function (err, count) {
        count.should.equal(1);
        done();
      });
    });
  });
   it('#count should include skip only when explicity stated', function (done) {
    store.open().then(function () {
      store.collection('dollhouse').insert({ _id: 'echo' });
      store.collection('dollhouse').insert({ _id: 'sierra' });
      store.collection('dollhouse').find({}).skip(1).count(function (err, count) {
        count.should.equal(2);
        done();
      });
    });
  });
  it('#find {_id:"echo"} should use primary key index', function (done) {
    store.open().then(function () {
      store.collection('dollhouse')._isIdentityQuery({ _id: 'echo' }).should.equal(true);
      done();
    });
  });
  it('#find {id:"echo"} should use primary key index', function (done) {
    store.open().then(function () {
      store.collection('dollhouse')._isIdentityQuery({ id: 'echo' }).should.equal(true);
      done();
    });
  });
  it('#find {xid:"echo"} should not use primary key index', function (done) {
    store.open().then(function () {
      store.collection('dollhouse')._isIdentityQuery({ xid: 'echo' }).should.equal(false);
      done();
    });
  });
  it('#find {id:"echo", age:12} should not use primary key index', function (done) {
    store.open().then(function () {
      store.collection('dollhouse')._isIdentityQuery({ id: 'echo', age:12 }).should.equal(false);
      done();
    });
  });
  it('#find {_id: $in ["echo"]} should return correct document', function (done) {
    store.open().then(function () {
      store.collection('dollhouse').insert({ _id: 'echo' });
      store.collection('dollhouse').insert({ _id: 'sierra' });
      store.collection('dollhouse').find({ _id: { $in: ['echo', 'sierra']} }).toArray(function (err, results) {
        results.length.should.equal(2);
        results[0]._id.should.equal('echo');
        done();
      });
    });
  });
  it('#_getByKey {id:"echo"} should return value', function (done) {
    store.open().then(function () {
      store.collection('dollhouse').insert({ _id: 'echo' });
      store.collection('dollhouse').insert({ _id: 'sierra' });
      store.collection('dollhouse')._getByKey({query: {_id:'echo'}}, function(err, res) {
        res.length.should.equal(1);
        res[0]._id.should.equal('echo');
        done();
      });
    });
  });
  it('#_getByKey {id:"echo-no-match"} should return 0 value', function (done) {
    store.open().then(function () {
      store.collection('dollhouse').insert({ _id: 'echo' });
      store.collection('dollhouse').insert({ _id: 'sierra' });
      store.collection('dollhouse')._getByKey({query: {_id:'echo-no-match'}}, function(err, res) {
        res.length.should.equal(0);
        done();
      });
    });
  });
});