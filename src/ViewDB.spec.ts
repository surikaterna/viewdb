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
    it('should store a document and include it in count', async () => {
      await collection.insert({a: 1});
      const count = await collection.count();
      expect(count).toBe(1);
    });

    it('should add id on insert if missing', async () => {
      await collection.insert({a: 1});
      const docs = await collection.find({a: 1}).toArray();
      expect(docs[0]._id).toBeDefined();
    });

    it('should fail at storing a previously stored document', async () => {
      await collection.insert({'_id': 1, a: 1});
      await expect(collection.insert({'_id': 1, a: 2})).rejects.toThrow('Unique constraint!');
    });

    it('should fail at storing an empty document', async () => {
      await expect(collection.insert(1 as unknown as Record<string, any>)).rejects.toThrow('Document must be object');
    });

    it('insert bulk should work', async () => {
      await collection.insert([{a: 1}, {b: 2}]);
      const count = await collection.count();
      expect(count).toBe(2);
    });
  });

  describe('#save', () => {
    it('should save multiple', async () => {
      await collection.insert([{_id: 1, a: 1}, {_id: 2, b: 2}]);
      await collection.save([{_id: 1, a: 10}, {_id: 2, b: 20}]);
      const docs = await collection.find({}).toArray();

      expect(docs?.length).toBe(2);
      expect(docs?.[0].a).toBe(10);
      expect(docs?.[1].b).toBe(20);
    });

    it('should add id on insert if missing', async () => {
      await collection.save({a: 1});
      await collection.save({b: 1});
      const count = await collection.count();

      expect(count).toBe(2);
    });

    it('should add document on save', async () => {
      await collection.save({a: 1});
      const count = await collection.count();
      expect(count).toBe(1);
    });

    it('should merge if id exists', async () => {
      const docs = await collection.save({a: 1});
      docs[0]['b'] = 2;

      await collection.save(docs);
      expect(docs?.[0].b).toBe(2);

      const count = await collection.count();
      expect(count).toBe(1);
    });
  });

  describe('#find', () => {
    it('find all documents', async () => {
      await collection.insert({a: 1});
      const docs = await collection.find({}).toArray();

      expect(docs.length).toBe(1);
      expect(docs[0].a).toBe(1);
    });

    it('find one document', async () => {
      const insertedDocs = await collection.insert({a: 1});
      const savedDocs = await collection.find({_id: insertedDocs[0]._id}).toArray();

      expect(savedDocs.length).toBe(1);
      expect(savedDocs[0].a).toBe(1);
    });

    it('should return empty collection if query does not match', async () => {
      await collection.insert({a: 1});
      const docs = await collection.find({_id: 5}).toArray();
      expect(docs.length).toBe(0);
    });
  });

  describe('#remove', () => {
    it('should remove one document matching a query', async () => {
      await collection.insert({a: 1, name: 'hello'});
      const result = await collection.remove({name: 'hello'});
      const docs = await collection.find({}).toArray();

      expect(result.nRemoved).toBe(1);
      expect(docs.length).toBe(0);
    });

    it('should not do anything when no documents are matched against the query', async () => {
      await collection.insert({a: 1, name: 'hello'});
      const result = await collection.remove({name: 'world'});
      const docs = await collection.find({}).toArray();

      expect(result.nRemoved).toBe(0);
      expect(docs.length).toBe(1);
    });

    it('should work with callback', (done) => {
      collection.insert({a: 1, name: 'hello'}, () => {
        collection.remove({name: 'hello'}, null, async (err, result) => {
          const docs = await collection.find({}).toArray();

          expect(result?.nRemoved).toBe(1);
          expect(docs.length).toBe(0);
          done();
        });
      });
    });
  });

  describe('#drop', () => {
    it('should remove all documents', async () => {
      const insertedDocs = await collection.insert({_id: 'echo'});
      expect(insertedDocs.length).toBe(1);

      const isSuccess = collection.drop();
      const docs = await collection.find({}).toArray();

      expect(isSuccess).toBe(true);
      expect(docs.length).toBe(0);
    });
  });
});
