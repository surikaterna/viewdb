import Cursor from './cursor';
import 'should';
import  ViewDB from '.';

describe('Cursor', function () {
  it('#toArray', function (done) {
    var cursor = new Cursor(null, {}, null, function (_query: any, callback: any) {
      callback(null, [1, 2, 3, 4]);
    });
    cursor.toArray(function (_err: any, result: any) {
      result.length.should.equal(4);
      done();
    });
  });
  it('#forEach', function (done) {
    var cursor = new Cursor(null, {}, null, function (_query: any, callback: any) {
      callback(null, [1, 2, 3, 4]);
    });
    var calls = 0;
    cursor.forEach(function (result: any) {
      result.should.be.ok;
      calls++;
    });
    setTimeout(function () {
      calls.should.equal(4);
      done();
    }, 0);
  });
  it('#skip', function (done) {
    var db = new ViewDB();
    var collection = db.collection('documents');
    for (var i = 0; i < 10; i++) {
      collection.insert({ a: 'a', id: i });
    }
    collection.find({ a: 'a' }).skip(5).toArray(function (_err: any, res: any) {
      res.length.should.equal(5);
      done();
    });
  });
  it('#limit', function (done) {
    var db = new ViewDB();
    var collection = db.collection('documents');
    for (var i = 0; i < 10; i++) {
      collection.insert({ a: 'a', id: i });
    }
    collection.find({ a: 'a' }).limit(9).toArray(function (_err: any, res: any) {
      res[8].id.should.equal(8);
      res.length.should.equal(9);
      done();
    });
  });
  it('#sort', function (done) {
    var db = new ViewDB();
    var collection = db.collection('documents');
    for (var i = 0; i < 10; i++) {
      collection.insert({ a: 'a', id: i });
    }
    collection.find({}).sort({id: 1}).toArray(function (_err: any, res: any) {
      res[0].id.should.equal(0);
      done();
    });
  });
  it('#sort desc', function (done) {
    var db = new ViewDB();
    var collection = db.collection('documents');
    for (var i = 0; i < 10; i++) {
      collection.insert({ a: 'a', id: i });
    }
    collection.find({}).sort({id: -1}).toArray(function (_err: any, res: any) {
      res[0].id.should.equal(9);
      done();
    });
  });
  it('#skip/limit', function (done) {
    var db = new ViewDB();
    var collection = db.collection('documents');
    for (var i = 0; i < 10; i++) {
      collection.insert({ a: 'a', id: i });
    }
    collection.find({ a: 'a' }).skip(8).limit(10).toArray(function (_err: any, res: any) {
      res[1].id.should.equal(9);
      res.length.should.equal(2); // only 2 left after skipping 8/10
      done();
    });
  });
})
