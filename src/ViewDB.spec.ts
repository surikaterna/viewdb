import ViewDB, { Collection } from '.';

describe('ViewDB', () => {
  let db: ViewDB;
  let collection: Collection;

  beforeEach(() => {
    db = new ViewDB();
    collection = db.collection('documents');
  });

  describe('#count', () => {
    it('should return 0 for empty collection', async () => {
      const count = await collection.count();
      expect(count).toBe(0);
    });
  });

  describe('#insert', () => {
    it('should store a document and include it in count', (done) => {
      collection.insert({a: 1}, async (err) => {
        expect(err).toBeNull();
        const count = await collection.count();
        expect(count).toBe(1);
        done();
      });
    });

    it('should add id on insert if missing', (done) => {
      collection.insert({a: 1}, async () => {
        const docs = await collection.find({a: 1}).toArray();
        expect(docs[0]._id).toBeDefined();
        done();
      });
    });
    it('should fail at storing a previously stored document', (done) => {
      collection.insert({'_id': 1, a: 1}, () => {
        collection.insert({'_id': 1, a: 2}, (err) => {
          expect(err).toBeDefined();
          done();
        });
      });
    });

    it('should fail at storing an empty document', (done) => {
      collection.insert(1 as unknown as Record<string, any>, (err) => {
        expect(err).toBeDefined();
        done();
      });
    });

    it('insert bulk should work', (done) => {
      collection.insert([{a: 1}, {b: 2}], async () => {
        const count = await collection.count();
        expect(count).toBe(2);
        done();
      });
    });
  });

  describe('#save', () => {
    it('should save multiple', (done) => {
      collection.insert([{_id: 1, a: 1}, {_id: 2, b: 2}], () => {
        collection.save([{_id: 1, a: 10}, {_id: 2, b: 20}], async () => {
          const docs = await collection.find({}).toArray();
          expect(docs?.length).toBe(2);
          expect(docs?.[0].a).toBe(10);
          expect(docs?.[1].b).toBe(20);
          done();
        });
      });
    });

    it('should add id on insert if missing', (done) => {
      collection.save({a: 1}, () => {
        collection.save({b: 1}, async () => {
          const count = await collection.count();
          expect(count).toBe(2);
          done();
        });
      });
    });

    it('should add document on save', (done) => {
      collection.save({a: 1}, async () => {
        const count = await collection.count();
        expect(count).toBe(1);
        done();
      });
    });

    it('should merge if id exists', (done) => {
      collection.save({a: 1}, (err, docs) => {
        if (!docs) {
          return done(new Error('Did not receive saved documents'));
        }

        docs[0]['b'] = 2;
        collection.save(docs, async (err, docs) => {
          expect(docs?.[0].b).toBe(2);

          const count = await collection.count();
          expect(count).toBe(1);
          done();
        });
      });
    });
  });

  describe('#find', () => {
    it('find all documents', (done) => {
      collection.insert({a: 1}, async () => {
        const docs = await collection.find({}).toArray();
        expect(docs.length).toBe(1);
        expect(docs[0].a).toBe(1);
        done();
      });
    });

    it('find one document', (done) => {
      collection.insert({a: 1}, async (err, insertedDocs) => {
        if (!insertedDocs) {
          return done(new Error('Did not receive inserted documents'));
        }

        const savedDocs = await collection.find({_id: insertedDocs[0]._id}).toArray();
        expect(savedDocs.length).toBe(1);
        expect(savedDocs[0].a).toBe(1);
        done();
      });
    });

    it('should return empty collection if query does not match', (done) => {
      collection.insert({a: 1}, async () => {
        const docs = await collection.find({_id: 5}).toArray();
        expect(docs.length).toBe(0);
        done();
      });
    });
  });

  describe('#remove', () => {
    it('should remove one document matching a query', (done) => {
      collection.insert({a: 1, name: 'hello'}, () => {
        collection.remove({name: 'hello'}, null, async () => {
          const docs = await collection.find({}).toArray();
          expect(docs.length).toBe(0);
          done();
        });
      });
    });

    it('should not do anything when no documents are matched against the query', (done) => {
      collection.insert({a: 1, name: 'hello'}, () => {
        collection.remove({name: 'world'}, null, async () => {
          const docs = await collection.find({}).toArray();
          expect(docs?.length).toBe(1);
          done();
        });
      });
    });
  });

  describe('#drop', () => {
    it('should remove all documents', (done) => {
      collection.insert({_id: 'echo'}, (err, docs) => {
        expect(docs?.length).toBe(1);
        collection.drop(async () => {
          const docs = await collection.find({}).toArray();
          expect(docs?.length).toBe(0);
          done();
        });
      });
    });
  });
});
