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

  it('#toArray', (done) => {
    const cursor = new Cursor(collection, {}, null, (query, callback) => {
      callback(null, documents);
    });

    cursor.toArray((err, result) => {
      expect(result?.length).toBe(10);
      done();
    });
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

  it('#skip', (done) => {
    collection.find({a: 'a'}).skip(5).toArray((err, res) => {
      expect(res?.length).toBe(5);
      done();
    });
  });

  it('#limit', (done) => {
    collection.find({a: 'a'}).limit(9).toArray((err, res) => {
      expect(res?.[8].id).toBe('8');
      expect(res?.length).toBe(9);
      done();
    });
  });

  it('#sort', (done) => {
    collection.find({}).sort({id: 1}).toArray((err, res) => {
      expect(res?.[0].id).toBe('0');
      done();
    });
  });

  it('#sort desc', (done) => {
    collection.find({}).sort({id: -1}).toArray((err, res) => {
      expect(res?.[0].id).toBe('9');
      done();
    });
  });

  it('#skip/limit', (done) => {
    collection.find({a: 'a'}).skip(8).limit(10).toArray((err, res) => {
      expect(res?.[1].id).toBe('9');
      expect(res?.length).toBe(2); // only 2 left after skipping 8/10
      done();
    });
  });
});
