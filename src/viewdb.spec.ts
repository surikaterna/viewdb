import should from 'should';
import ViewDB from '.';

describe('ViewDB', function () {
  describe('#count', function () {
    it('should return 0 for empty collection', function (done) {
      var db = new ViewDB();
      var collection = db.collection('documents');
      // Perform a total count command
      collection.count(function (_err: any, count: any) {
        count.should.equal(0);
        done();
      });
    });
  });
  describe('#insert', function () {
    it('should store a document and include it in count', function (done) {
      var db = new ViewDB();
      var collection = db.collection('documents');
      collection.insert({ a: 1 }, function (err: any, _ids: any) {
        should.not.exist(err);
        // Perform a total count command
        collection.count(function (_err: any, count: any) {
          count.should.equal(1);
          done();
          //assert.equal(null, err);
          //assert.equal(1, count);
        });
      });
    });
    it('should add id on insert if missing', function (done) {
      var db = new ViewDB();
      var collection = db.collection('documents');
      collection.insert({ a: 1 }, function (_err: any, _ids: any) {
        collection.find({ a: 1 }).toArray(function (_err: any, res: any) {
          should.exist(res[0]._id);
          done();
        });
      });
    });
    it('should fail at storing a previously stored document', function (done) {
      var db = new ViewDB();
      var collection = db.collection('documents');
      collection.insert({ '_id': 1, a: 1 });
      collection.insert({ '_id': 1, a: 2 }, function (err: any, _ids: any) {
        should.exist(err);
        done();
      });
    });

    it('should fail at storing an empty document', function (done) {
      var db = new ViewDB();
      var collection = db.collection('documents');
      collection.insert(1, function (err: any, _ids: any) {
        should.exist(err);
        done();
      });
    });
    it('#insert bulk should work', function (done) {
      var db = new ViewDB();
      var collection = db.collection('documents');
      collection.insert([{ a: 1 }, { b: 2 }], function (_err: any, _ids: any) {
        collection.count(function (_err: any, res: any) {
          res.should.equal(2);
        });
        done();
      });
    });
  });
  describe('#save', function () {
    it('should save multiple', function (done) {
      var db = new ViewDB();
      var collection = db.collection('documents');
      collection.insert([{ _id: 1, a: 1 }, { _id: 2, b: 2 }], function () {
        collection.save([{ _id: 1, a: 10 }, { _id: 2, b: 20 }], function () {
          collection.find({}).toArray(function (_err: any, res: any) {
            res.length.should.equal(2);
            res[0].a.should.equal(10);
            res[1].b.should.equal(20);
            done();
          });
        });
      });
    });
    it('should add id on insert if missing', function (done) {
      var db = new ViewDB();
      var collection = db.collection('documents');
      collection.save({ a: 1 });
      collection.save({ b: 1 });
      collection.count(function (_err: any, result: any) {
        result.should.equal(2);
        done();
      });
    });
    it('should add document on save', function (done) {
      var db = new ViewDB();
      var collection = db.collection('documents');
      collection.save({ a: 1 }, function (_err: any, _ids: any) {
        collection.count(function (_err: any, count: any) {
          count.should.equal(1);
          done();
        });
        //should.exist(ids._id);
        //done();
      });
    });
    it('should merge if id exists', function (done) {
      var db = new ViewDB();
      var collection = db.collection('documents');
      collection.save({ a: 1 }, function (_err: any, docs: any) {
        docs[0]['b'] = 2;
        collection.save(docs, function (_err: any, _ids: any) {
          collection.count(function (_err: any, count: any) {
            count.should.equal(1);
            done();
          });
        });

      });
    });
  });
  describe('#find', function () {
    it('find all documents', function (done) {
      var db = new ViewDB();
      var collection = db.collection('documents');
      collection.insert({ a: 1 }, function (_err: any, _ids: any) {
        collection.find({}).toArray(function (_err: any, docs: any) {
          docs.length.should.equal(1);
          docs[0].a.should.equal(1);
          done();
        });
      });
    });
    it('find one document', function (done) {
      var db = new ViewDB();
      var collection = db.collection('documents');
      collection.insert({ a: 1 }, function (_err: any, ids: any) {
        collection.find({ _id: ids[0]._id }).toArray(function (_err: any, docs: any) {
          docs.length.should.equal(1);
          docs[0].a.should.equal(1);
          done();
        });
      });
    });
    it('should return empty collection if query does not match', function (done) {
      var db = new ViewDB();
      var collection = db.collection('documents');
      collection.insert({ a: 1 }, function (_err: any, _ids: any) {
        collection.find({ _id: 5 }).toArray(function (_err: any, docs: any) {
          docs.length.should.equal(0);
          done();
        });
      });
    });
  });
  describe('#remove', function () {
    it('should remove one document matching a query', function (done) {
      var db = new ViewDB();
      var collection = db.collection('documents');
      collection.insert({ a: 1, name: 'hello' }, function (_err: any, _ids: any) {
        collection.remove({ name: 'hello' }, null, function (_err: any, _docs: any) {
          collection.find({}).toArray(function (_err: any, res: any) {
            res.length.should.equal(0);
            done();
          });
        });
      });
    });

    it('shouldnt do anything when no documents are matched against the query', function (done) {
      var db = new ViewDB();
      var collection = db.collection('documents');
      collection.insert({ a: 1, name: 'hello' }, function (_err: any, _ids: any) {
        collection.remove({ name: 'world' }, null, function (_err: any, _docs: any) {
          collection.find({}).toArray(function (_err: any, res: any) {
            res.length.should.equal(1);
            done();
          });
        });
      });
    });
  });
  describe('#drop', function () {
    it('should remove all documents', function (done) {
      var store = new ViewDB();
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'echo' });
        store.collection('dollhouse').drop();

        store.collection('dollhouse').find({}).toArray(function (_err: any, results: any) {
          results.length.should.equal(0);
          done();
        });
      });
    });
  });
});
