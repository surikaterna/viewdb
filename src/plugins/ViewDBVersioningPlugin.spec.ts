import { forEach } from 'lodash';
import ViewDB from '..';
import ViewDb, { Collection, VersioningPlugin } from '..';

describe('ViewDB versioning plugin', () => {
  let viewDb: ViewDB;
  let collection: Collection;
  let currentTime: number;
  const doc123Id = '123';
  const doc999Id = '999';
  let doc123: Record<string, any>;
  let doc999: Record<string, any>;

  beforeEach(() => {
    viewDb = new ViewDb();
    new VersioningPlugin(viewDb);

    collection = viewDb.collection('test');
    currentTime = new Date().valueOf();
    doc123 = { id: doc123Id };
    doc999 = { id: doc999Id };
  });

  it('should add version on insert', async () => {
    const collection = viewDb.collection('test');
    await collection.insert(doc123);
    const docs = await collection.find({ id: doc123Id }).toArray();
    expect(docs[0].version).toBe(0);
  });

  it('should add version on bulk insert', async () => {
    await collection.insert([{ id: doc123Id }, { id: doc999Id }]);
    const docs = await collection.find({}).toArray();
    expect(docs[0].version).toBe(0);
    expect(docs[1].version).toBe(0);
  });

  it('should increase version on save', async () => {
    await collection.insert(doc123);
    doc123.name = 'Pelle';
    await collection.save(doc123);

    const docs = await collection.find({ id: doc123Id }).toArray();
    const doc = docs[0];
    expect(doc.version).toBe(1);
    expect(doc.name).toBe('Pelle');
  });

  it('should increase version on bulk save', async () => {
    await collection.insert([
      { _id: doc123Id, version: 10 },
      { _id: doc999Id, version: 101 }
    ]);
    const insertedDocs = await collection.find({}).toArray();

    forEach(insertedDocs, (doc, index) => {
      doc.name = index === 0 ? 'Pelle' : 'Kalle';
    });

    await collection.save(insertedDocs);
    const savedDocs = await collection.find({}).toArray();
    const firstDoc = savedDocs[0];
    const secondDoc = savedDocs[1];

    expect(firstDoc.version).toBe(12); // add 1 version for insert and one for save
    expect(firstDoc.name).toBe('Pelle');
    expect(secondDoc.version).toBe(103);
    expect(secondDoc.name).toBe('Kalle');
  });

  it('should skip changing version with skipVersioning option on save', async () => {
    // collection.insert(doc123, (err, docs) => {
    //   const doc = docs?.[0];
    //   expect(doc?.version).toBe(0);
    //
    //   doc123.name = 'Pelle';
    //   collection.save(doc123, {skipVersioning: true}, async () => {
    //     const docs = await collection.find({id: doc123Id}).toArray();
    //     const doc = docs[0];
    //     expect(doc.version).toBe(0);
    //     expect(doc.name).toBe('Pelle');
    //     done();
    //   });
    // });
    const insertedDocs = await collection.insert(doc123);
    expect(insertedDocs[0].version).toBe(0);

    doc123.name = 'Pelle';
    await collection.save(doc123, { skipVersioning: true });
    const docs = await collection.find({ id: doc123Id }).toArray();
    const doc = docs[0];

    expect(doc.version).toBe(0);
    expect(doc.name).toBe('Pelle');
  });

  it('should add version on save', (done) => {
    collection.insert(doc123, () => {
      doc123.name = 'Pelle';
      doc123.version = undefined;
      collection.save(doc123, async () => {
        const docs = await collection.find({ id: doc123Id }).toArray();
        const doc = docs[0];
        expect(doc.version).toBe(0);
        expect(doc.name).toBe('Pelle');
        done();
      });
    });
  });
});
