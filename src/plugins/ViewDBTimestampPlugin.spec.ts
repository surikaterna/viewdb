import ViewDB from '..';
import ViewDb, { Collection, TimestampPlugin, VersioningPlugin } from '..';

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('ViewDB timestamp plugin', () => {
  let viewDb: ViewDB;
  let collection: Collection;
  let currentTime: number;
  const doc123Id = '123';
  const doc999Id = '999';
  let doc123: Record<string, any>;
  let doc999: Record<string, any>;

  beforeEach(() => {
    viewDb = new ViewDb();
    new TimestampPlugin(viewDb);
    new VersioningPlugin(viewDb);

    collection = viewDb.collection('test');
    currentTime = new Date().valueOf();
    doc123 = { id: doc123Id };
    doc999 = { id: doc999Id };
  });

  it('should add changeDateTime and createDateTime timestamp on insert', async () => {
    // wait 5ms until before operation to check for creation time compared to current time
    await wait(5);
    await collection.insert(doc123);
    const docs = await collection.find({ id: doc123Id }).toArray();
    const { createDateTime, changeDateTime } = docs[0];

    expect(createDateTime).toBeDefined();
    expect(createDateTime).toBe(changeDateTime);
    expect(createDateTime).toBeGreaterThan(currentTime);
  });

  it('should add changeDateTime and createDateTime timestamp on bulk insert', async () => {
    // wait 5ms until before operation to check for creation time compared to current time
    await wait(5);
    await collection.insert([doc123, doc999]);
    const docs = await collection.find({}).toArray();

    docs.forEach(({ createDateTime, changeDateTime }) => {
      expect(createDateTime).toBeDefined();
      expect(changeDateTime).toBeGreaterThan(currentTime);
    });
  });

  it('should update changeDateTime on bulk save', async () => {
    await collection.insert([doc123, doc999]);
    const insertedDocs = await collection.find({}).toArray();
    const { createDateTime: insertCreateDateTime, changeDateTime: insertChangeDateTime } = insertedDocs[0];

    expect(insertCreateDateTime).toBeDefined();
    expect(insertCreateDateTime).toBe(insertChangeDateTime);

    // wait 5ms until update operation to check for changeDateTime updated
    await wait(5);
    await collection.save([
      { _id: doc123Id, name: 'Pelle', createDateTime: insertCreateDateTime, changeDateTime: insertChangeDateTime },
      { _id: doc999Id, name: 'Kalle', createDateTime: insertCreateDateTime, changeDateTime: insertChangeDateTime }
    ]);
    const savedDocs = await collection.find({}).toArray();

    savedDocs.forEach(({ createDateTime, changeDateTime }) => {
      expect(createDateTime).toBe(insertCreateDateTime);
      expect(changeDateTime).toBeGreaterThan(insertCreateDateTime);
    });
  });

  it('should update changeDateTime on save', async () => {
    await collection.insert(doc123);
    const insertedDocs = await collection.find({ id: doc123Id }).toArray();
    const insertTime = insertedDocs[0].createDateTime;

    // wait 5ms until update operation to check for changeDateTime updated
    await wait(5);
    doc123.name = 'Pelle';
    await collection.save(doc123);
    const savedDocs = await collection.find({ id: doc123Id }).toArray();
    const { createDateTime, changeDateTime } = savedDocs[0];

    expect(createDateTime).toBe(insertTime);
    expect(changeDateTime).toBeGreaterThan(insertTime);
  });

  it('should skip changing timestamp with skipTimestamp option on save', async () => {
    await collection.insert(doc123);
    const insertedDocs = await collection.find({ id: '123' }).toArray();
    const insertTime = insertedDocs[0].createDateTime;

    // wait 5ms until update operation to check for changeDateTime updated
    await wait(5);
    doc123.name = 'Pelle';
    await collection.save(doc123, { skipTimestamp: true });
    const savedDocs = await collection.find({ id: doc123Id }).toArray();
    const { createDateTime, changeDateTime } = savedDocs[0];

    expect(createDateTime).toBe(insertTime);
    expect(changeDateTime).toBe(insertTime);
  });

  it('should work together with version plugin', async () => {
    await collection.insert(doc123);
    doc123.name = 'Pelle';
    doc123.version = undefined;
    await collection.save(doc123);
    const docs = await collection.find({ id: '123' }).toArray();
    const { name, version, createDateTime, changeDateTime } = docs[0];

    expect(version).toBe(0);
    expect(name).toBe('Pelle');
    expect(createDateTime).toBeDefined();
    expect(changeDateTime).toBeDefined();
  });
});
