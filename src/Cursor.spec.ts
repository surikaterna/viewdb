import ViewDB, { Cursor } from '.';

describe('Cursor', function () {
  it('#toArray', function (done) {
    const db = new ViewDB();
    const collection = db.collection('documents');
    const cursor = new Cursor(collection, {}, null, function (query, callback) {
      callback(null, [{id: 1}, {id: 2}, {id: 3}, {id: 4}]);
    });
    cursor.toArray(function (err, result = []) {
      expect(result.length).toBe(4);
      done();
    });
  });
  it('#forEach', function (done) {
    const db = new ViewDB();
    const collection = db.collection('documents');
    const cursor = new Cursor(collection, {}, null, function (query, callback) {
      callback(null, [{id: 1}, {id: 2}, {id: 3}, {id: 4}]);
    });
    let calls = 0;
    cursor.forEach(function (result) {
      expect(result).toBeTruthy();
      calls++;
    });
    setTimeout(function () {
      expect(calls).toBe(4);
      done();
    }, 0);
  });
  it('#skip', function (done) {
    const db = new ViewDB();
    const collection = db.collection('documents');
    for (let i = 0; i < 10; i++) {
      collection.insert({a: 'a', id: i});
    }
    collection.find({a: 'a'}).skip(5).toArray(function (err, res = []) {
      expect(res.length).toBe(5);
      done();
    });
  });
  it('#limit', function (done) {
    const db = new ViewDB();
    const collection = db.collection('documents');
    for (let i = 0; i < 10; i++) {
      collection.insert({a: 'a', id: i});
    }
    collection.find({a: 'a'}).limit(9).toArray(function (err, res = []) {
      expect(res[8].id).toBe(8);
      expect(res.length).toBe(9);
      done();
    });
  });
  it('#sort', function (done) {
    const db = new ViewDB();
    const collection = db.collection('documents');
    for (let i = 0; i < 10; i++) {
      collection.insert({a: 'a', id: i});
    }
    collection.find({}).sort({id: 1}).toArray(function (err, res = []) {
      expect(res[0].id).toBe(0);
      done();
    });
  });
  it('#sort desc', function (done) {
    const db = new ViewDB();
    const collection = db.collection('documents');
    for (let i = 0; i < 10; i++) {
      collection.insert({a: 'a', id: i});
    }
    collection.find({}).sort({id: -1}).toArray(function (err, res = []) {
      expect(res[0].id).toBe(9);
      done();
    });
  });
  it('#skip/limit', function (done) {
    const db = new ViewDB();
    const collection = db.collection('documents');
    for (let i = 0; i < 10; i++) {
      collection.insert({a: 'a', id: i});
    }
    collection.find({a: 'a'}).skip(8).limit(10).toArray(function (err, res = []) {
      expect(res[1].id).toBe(9);
      expect(res.length).toBe(2); // only 2 left after skipping 8/10
      done();
    });
  });
});
