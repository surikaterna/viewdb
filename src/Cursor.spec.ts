import ViewDB, { Collection, Cursor } from '.';

describe('Cursor', () => {
  let db: ViewDB;
  let collection: Collection;
  const documents: Array<Record<string, any>> = [];

  beforeAll((done) => {
    db = new ViewDB();
    collection = db.collection('documents');

    for (let i = 0; i < 10; i++) {
      documents.push({id: i.toString(), a: 'a'});
    }

    collection.insert(documents, () => {
      done();
    });
  });

  describe('#toArray', () => {
    it('should work with callback', (done) => {
      const cursor = new Cursor(collection, {}, null, (query, callback) => {
        callback(null, documents);
      });

      cursor.toArray((err, result) => {
        expect(result?.length).toBe(10);
        done();
      });
    })

    it('should return a Promise', async () => {
      const cursor = new Cursor(collection, {}, null, (query, callback) => {
        callback(null, documents);
      });

      const docs = await cursor.toArray();
      expect(docs.length).toBe(10);
    })
  });

  it('#forEach', (done) => {
    const cursor = new Cursor(collection, {}, null, (query, callback) => {
      callback(null, documents);
    });
    let calls = 0;

    cursor.forEach((result) => {
      expect(result).toBeDefined();
      calls++;
    });

    expect(calls).toBe(10);
    done();
  });

  it('#skip', async () => {
    const docs = await collection.find({a: 'a'}).skip(5).toArray();
    expect(docs.length).toBe(5);
  });

  it('#limit', async () => {
    const docs = await collection.find({a: 'a'}).limit(9).toArray();
    expect(docs[8].id).toBe('8');
    expect(docs.length).toBe(9);
  });

  it('#sort', async () => {
    const docs = await collection.find({}).sort({id: 1}).toArray();
    expect(docs[0].id).toBe('0');
  });

  it('#sort desc', async () => {
    const docs = await collection.find({}).sort({id: -1}).toArray();
    expect(docs[0].id).toBe('9');
  });

  it('#skip/limit', async () => {
    const docs = await collection.find({a: 'a'}).skip(8).limit(10).toArray();
    expect(docs[1].id).toBe('9');
    expect(docs.length).toBe(2); // only 2 left after skipping 8/10
  });
});
