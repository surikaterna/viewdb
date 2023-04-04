var ViewDB = require('..');


describe('ViewDB', () => {
  describe('#count', () => {
    it('should return 0 for empty collection', done => {
      var db = new ViewDB();
      var collection = db.collection('documents');
      // Perform a total count command
      collection.count(function (err, count) {
        expect(count).toBe(0);
        done();
      });
    });
  });
  describe('#insert', () => {
    it('should store a document and include it in count', done => {
      var db = new ViewDB();
      var collection = db.collection('documents');
      collection.insert({ a: 1 }, function (err, ids) {
        expect(err).toBeFalsy();
        // Perform a total count command
        collection.count(function (err, count) {
          expect(count).toBe(1);
          done();
          //assert.equal(null, err);
          //assert.equal(1, count);
        });
      });
    });
    it('should add id on insert if missing', done => {
      var db = new ViewDB();
      var collection = db.collection('documents');
      collection.insert({ a: 1 }, function (err, ids) {
        collection.find({ a: 1 }).toArray(function (err, res) {
          expect(res[0]._id).toBeDefined();
          done();
        });
      });
    });
    it('should fail at storing a previously stored document', done => {
      var db = new ViewDB();
      var collection = db.collection('documents');
      collection.insert({ '_id': 1, a: 1 });
      collection.insert({ '_id': 1, a: 2 }, function (err, ids) {
        expect(err).toBeDefined();
        done();
      });
    });

    it('should fail at storing an empty document', done => {
      var db = new ViewDB();
      var collection = db.collection('documents');
      collection.insert(1, function (err, ids) {
        expect(err).toBeDefined();
        done();
      });
    });
    it('#insert bulk should work', done => {
      var db = new ViewDB();
      var collection = db.collection('documents');
      collection.insert([{ a: 1 }, { b: 2 }], function (err, ids) {
        collection.count(function (err, res) {
          expect(res).toBe(2);
        });
        done();
      });
    });
  });
  describe('#save', () => {
    it('should save multiple', done => {
      var db = new ViewDB();
      var collection = db.collection('documents');
      collection.insert([{ _id: 1, a: 1 }, { _id: 2, b: 2 }], function () {
        collection.save([{ _id: 1, a: 10 }, { _id: 2, b: 20 }], function () {
          collection.find({}).toArray(function (err, res) {
            expect(res.length).toBe(2);
            expect(res[0].a).toBe(10);
            expect(res[1].b).toBe(20);
            done();
          });
        });
      });
    });
    it('should add id on insert if missing', done => {
      var db = new ViewDB();
      var collection = db.collection('documents');
      collection.save({ a: 1 });
      collection.save({ b: 1 });
      collection.count(function (err, result) {
        expect(result).toBe(2);
        done();
      })
    });
    it('should add document on save', done => {
      var db = new ViewDB();
      var collection = db.collection('documents');
      collection.save({ a: 1 }, function (err, ids) {
        collection.count(function (err, count) {
          expect(count).toBe(1);
          done();
        });
        //should.exist(ids._id);
        //done();
      });
    });
    it('should merge if id exists', done => {
      var db = new ViewDB();
      var collection = db.collection('documents');
      collection.save({ a: 1 }, function (err, docs) {
        docs[0]['b'] = 2;
        collection.save(docs, function (err, ids) {
          collection.count(function (err, count) {
            expect(count).toBe(1);
            done();
          });
        });

      });
    });
  });
  describe('#find', () => {
    it('find all documents', done => {
      var db = new ViewDB();
      var collection = db.collection('documents');
      collection.insert({ a: 1 }, function (err, ids) {
        collection.find({}).toArray(function (err, docs) {
          expect(docs.length).toBe(1);
          expect(docs[0].a).toBe(1);
          done();
        });
      });
    });
    it('find one document', done => {
      var db = new ViewDB();
      var collection = db.collection('documents');
      collection.insert({ a: 1 }, function (err, ids) {
        collection.find({ _id: ids[0]._id }).toArray(function (err, docs) {
          expect(docs.length).toBe(1);
          expect(docs[0].a).toBe(1);
          done();
        });
      });
    });
    it(
      'should return empty collection if query does not match',
      done => {
        var db = new ViewDB();
        var collection = db.collection('documents');
        collection.insert({ a: 1 }, function (err, ids) {
          collection.find({ _id: 5 }).toArray(function (err, docs) {
            expect(docs.length).toBe(0);
            done();
          });
        });
      }
    );
  });
  describe('#remove', () => {
    it('should remove one document matching a query', done => {
      var db = new ViewDB();
      var collection = db.collection('documents');
      collection.insert({ a: 1, name: 'hello' }, function (err, ids) {
        collection.remove({ name: 'hello' }, null, function (err, docs) {
          collection.find({}).toArray(function (err, res) {
            expect(res.length).toBe(0);
            done();
          });
        })
      });
    })

    it(
      'shouldnt do anything when no documents are matched against the query',
      done => {
        var db = new ViewDB();
        var collection = db.collection('documents');
        collection.insert({ a: 1, name: 'hello' }, function (err, ids) {
          collection.remove({ name: 'world' }, null, function (err, docs) {
            collection.find({}).toArray(function (err, res) {
              expect(res.length).toBe(1);
              done();
            });
          })
        });
      }
    );
  });
  describe('#drop', () => {
    it('should remove all documents', done => {
      var store = new ViewDB();
      store.open().then(function () {
        store.collection('dollhouse').insert({ _id: 'echo' });
        store.collection('dollhouse').drop();

        store.collection('dollhouse').find({}).toArray(function (err, results) {
          expect(results.length).toBe(0);
          done();
        });
      });
    });
  });
});