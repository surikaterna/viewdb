import ViewDB from '.';

describe('ViewDB', () => {
  describe('#count', () => {
    it('should return 0 for empty collection', (done) => {
      const db = new ViewDB();
      const collection = db.collection('documents');
      // Perform a total count command
      collection.count((err, count) => {
        expect(count).toBe(0);
        done();
      });
    });
  });
  describe('#insert', () => {
    it('should store a document and include it in count', (done) => {
      const db = new ViewDB();
      const collection = db.collection('documents');
      collection.insert({a: 1}, (err) => {
        expect(err).toBeNull();
        // Perform a total count command
        collection.count((err, count) => {
          expect(count).toBe(1);
          done();
          //assert.equal(null, err);
          //assert.equal(1, count);
        });
      });
    });
    it('should add id on insert if missing', (done) => {
      const db = new ViewDB();
      const collection = db.collection('documents');
      collection.insert({a: 1}, () => {
        collection.find({a: 1}).toArray((err, res = []) => {
          expect(res[0]._id).toBeDefined();
          done();
        });
      });
    });
    it('should fail at storing a previously stored document', (done) => {
      const db = new ViewDB();
      const collection = db.collection('documents');
      collection.insert({'_id': 1, a: 1});
      collection.insert({'_id': 1, a: 2}, (err) => {
        expect(err).toBeDefined();
        done();
      });
    });

    it('should fail at storing an empty document', (done) => {
      const db = new ViewDB();
      const collection = db.collection('documents');
      collection.insert(1 as unknown as Record<string, any>, (err) => {
        expect(err).toBeDefined();
        done();
      });
    });
    it('#insert bulk should work', (done) => {
      const db = new ViewDB();
      const collection = db.collection('documents');
      collection.insert([{a: 1}, {b: 2}], () => {
        collection.count((err, res) => {
          expect(res).toBe(2);
        });
        done();
      });
    });
  });
  describe('#save', () => {
    it('should save multiple', (done) => {
      const db = new ViewDB();
      const collection = db.collection('documents');
      collection.insert([{_id: 1, a: 1}, {_id: 2, b: 2}], () => {
        collection.save([{_id: 1, a: 10}, {_id: 2, b: 20}], () => {
          collection.find({}).toArray((err, res = []) => {
            expect(res.length).toBe(2);
            expect(res[0].a).toBe(10);
            expect(res[1].b).toBe(20);
            done();
          });
        });
      });
    });
    it('should add id on insert if missing', (done) => {
      const db = new ViewDB();
      const collection = db.collection('documents');
      collection.save({a: 1});
      collection.save({b: 1});
      collection.count((err, result) => {
        expect(result).toBe(2);
        done();
      });
    });
    it('should add document on save', (done) => {
      const db = new ViewDB();
      const collection = db.collection('documents');
      collection.save({a: 1}, () => {
        collection.count((err, count) => {
          expect(count).toBe(1);
          done();
        });
        //should.exist(ids._id);
        //done();
      });
    });
    it('should merge if id exists', (done) => {
      const db = new ViewDB();
      const collection = db.collection('documents');
      collection.save({a: 1}, (err, docs = []) => {
        docs[0]['b'] = 2;
        collection.save(docs, () => {
          collection.count((err, count) => {
            expect(count).toBe(1);
            done();
          });
        });

      });
    });
  });
  describe('#find', () => {
    it('find all documents', (done) => {
      const db = new ViewDB();
      const collection = db.collection('documents');
      collection.insert({a: 1}, () => {
        collection.find({}).toArray((err, docs = []) => {
          expect(docs.length).toBe(1);
          expect(docs[0].a).toBe(1);
          done();
        });
      });
    });
    it('find one document', (done) => {
      const db = new ViewDB();
      const collection = db.collection('documents');
      collection.insert({a: 1}, (err, ids = []) => {
        collection.find({_id: ids[0]._id}).toArray((err, docs = []) => {
          expect(docs.length).toBe(1);
          expect(docs[0].a).toBe(1);
          done();
        });
      });
    });
    it('should return empty collection if query does not match', (done) => {
      const db = new ViewDB();
      const collection = db.collection('documents');
      collection.insert({a: 1}, () => {
        collection.find({_id: 5}).toArray((err, docs) => {
          expect(docs?.length).toBe(0);
          done();
        });
      });
    });
  });
  describe('#remove', () => {
    it('should remove one document matching a query', (done) => {
      const db = new ViewDB();
      const collection = db.collection('documents');
      collection.insert({a: 1, name: 'hello'}, () => {
        collection.remove({name: 'hello'}, null, () => {
          collection.find({}).toArray((err, res) => {
            expect(res?.length).toBe(0);
            done();
          });
        });
      });
    });

    it('should not do anything when no documents are matched against the query', (done) => {
      const db = new ViewDB();
      const collection = db.collection('documents');
      collection.insert({a: 1, name: 'hello'}, () => {
        collection.remove({name: 'world'}, null, () => {
          collection.find({}).toArray((err, res) => {
            expect(res?.length).toBe(1);
            done();
          });
        });
      });
    });
  });
  describe('#drop', () => {
    it('should remove all documents', (done) => {
      const store = new ViewDB();
      store.open().then(() => {
        store.collection('dollhouse').insert({_id: 'echo'});
        store.collection('dollhouse').drop();

        store.collection('dollhouse').find({}).toArray((err, results) => {
          expect(results?.length).toBe(0);
          done();
        });
      });
    });
  });
});
