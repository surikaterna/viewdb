import { QueryObject } from 'kuery';
import { describe, expect, it } from 'vitest';
import { Cursor, GetDocumentsFunc } from './Cursor';
import { ViewDB } from './ViewDB';
import { ViewDBCollection } from './interfaces';

type Doc = {
  _id: string;
};

describe('Cursor', () => {
  const noCollection = null as unknown as ViewDBCollection<any>;
  const emptyQuery: QueryObject<Doc> = {};
  const docs: Doc[] = [{ _id: '1' }, { _id: '2' }, { _id: '3' }, { _id: '4' }];
  const getDocuments: GetDocumentsFunc<Doc> = () => Promise.resolve(docs);

  it('#toArray', async () => {
    const cursor = new Cursor<Doc>(noCollection, emptyQuery, null, getDocuments);

    const result = await cursor.toArray();
    expect(result.length).toBe(4);
  });

  it('#forEach', async () => {
    const cursor = new Cursor(noCollection, emptyQuery, null, getDocuments);
    let calls = 0;

    await cursor.forEach((result) => {
      expect(result).toBeTruthy();
      calls++;
    });

    expect(calls).toBe(4);
  });

  it('#skip', async () => {
    type Doc = { _id: string; a: string };
    const db = new ViewDB();
    const collection = db.collection<Doc>('documents');

    for (let i = 0; i < 10; i++) {
      await collection.insert({ a: 'a', _id: String(i) });
    }

    const res = await collection.find({ a: 'a' }).skip(5).toArray();
    expect(res.length).toBe(5);
  });

  it('#limit', async () => {
    type Doc = { _id: string; a: string };
    const db = new ViewDB();
    const collection = db.collection<Doc>('documents');

    for (let i = 0; i < 10; i++) {
      await collection.insert({ a: 'a', _id: String(i) });
    }

    const res = await collection.find({ a: 'a' }).limit(9).toArray();

    expect(res[8]?._id).toBe('8');
    expect(res.length).toBe(9);
  });

  it('#sort', async () => {
    type Doc = { _id: string; a: string };
    const db = new ViewDB();
    const collection = db.collection<Doc>('documents');

    for (let i = 0; i < 10; i++) {
      await collection.insert({ a: 'a', _id: String(i) });
    }

    const res = await collection.find({}).sort({ _id: 1 }).toArray();
    expect(res[0]?._id).toBe('0');
  });

  it('#sort desc', async () => {
    type Doc = { _id: string; a: string };
    const db = new ViewDB();
    const collection = db.collection<Doc>('documents');

    for (let i = 0; i < 10; i++) {
      await collection.insert({ a: 'a', _id: String(i) });
    }

    const res = await collection.find({}).sort({ _id: -1 }).toArray();
    expect(res[0]?._id).toBe('9');
  });

  it('#skip/limit', async () => {
    type Doc = { _id: string; a: string };
    const db = new ViewDB();
    const collection = db.collection<Doc>('documents');

    for (let i = 0; i < 10; i++) {
      await collection.insert({ a: 'a', _id: String(i) });
    }

    const res = await collection.find({ a: 'a' }).skip(8).limit(10).toArray();

    expect(res[1]?._id).toBe('9');
    expect(res.length).toBe(2);
  });
});
