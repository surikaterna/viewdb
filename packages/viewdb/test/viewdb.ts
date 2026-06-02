import assert from 'node:assert';
import ViewDB from '..';
import Collection from '../src/inmemory/collection';

type TestCollection = Collection & {
  remove(query: Record<string, unknown>, options: Record<string, unknown> | null, callback?: (err: Error | null) => void): void;
};

describe('ViewDB', () => {
  describe('#count', () => {
    it('should return 0 for empty collection', () =>
      new Promise<void>((resolve) => {
        const db = new ViewDB();
        const collection = db.collection('documents') as TestCollection;
        // Perform a total count command
        collection.count(function (_err, count) {
          expect(count).toBe(0);
          resolve();
        });
      }));
  });
  describe('#insert', () => {
    it('should store a document and include it in count', () =>
      new Promise<void>((resolve) => {
        const db = new ViewDB();
        const collection = db.collection('documents') as Collection;
        collection.insert({ a: 1 }, function (err) {
          expect(err).toBeFalsy();
          // Perform a total count command
          collection.count(function (_err, count) {
            expect(count).toBe(1);
            resolve();
            //assert.equal(null, err);
            //assert.equal(1, count);
          });
        });
      }));
    it('should add id on insert if missing', () =>
      new Promise<void>((resolve) => {
        const db = new ViewDB();
        const collection = db.collection('documents') as Collection;
        collection.insert({ a: 1 }, function () {
          collection.find({ a: 1 }).toArray(function (_err, res) {
            assert(res);
            expect(res[0]._id).toBeDefined();
            resolve();
          });
        });
      }));
    it('should fail at storing a previously stored document', () =>
      new Promise<void>((resolve) => {
        const db = new ViewDB();
        const collection = db.collection('documents') as TestCollection;
        collection.insert({ _id: '1', a: 1 });
        collection.insert({ _id: '1', a: 2 }, function (err) {
          expect(err).toBeDefined();
          resolve();
        });
      }));

    it('should fail at storing an empty document', () =>
      new Promise<void>((resolve) => {
        const db = new ViewDB();
        const collection = db.collection('documents') as TestCollection;
        collection.insert(1 as never, function (err) {
          expect(err).toBeDefined();
          resolve();
        });
      }));
    it('#insert bulk should work', () =>
      new Promise<void>((resolve) => {
        const db = new ViewDB();
        const collection = db.collection('documents') as TestCollection;
        collection.insert([{ a: 1 }, { b: 2 }], function () {
          collection.count(function (_err, res) {
            expect(res).toBe(2);
          });
          resolve();
        });
      }));
  });
  describe('#save', () => {
    it('should save multiple', () =>
      new Promise<void>((resolve) => {
        const db = new ViewDB();
        const collection = db.collection('documents') as Collection;
        collection.insert(
          [
            { _id: 1, a: 1 },
            { _id: 2, b: 2 }
          ],
          function () {
            collection.save(
              [
                { _id: 1, a: 10 },
                { _id: 2, b: 20 }
              ],
              function () {
                collection.find({}).toArray(function (_err, res) {
                  assert(res);
                  expect(res.length).toBe(2);
                  expect(res[0].a).toBe(10);
                  expect(res[1].b).toBe(20);
                  resolve();
                });
              }
            );
          }
        );
      }));
    it('should add id on insert if missing', () =>
      new Promise<void>((resolve) => {
        const db = new ViewDB();
        const collection = db.collection('documents') as TestCollection;
        collection.save({ a: 1 });
        collection.save({ b: 1 });
        collection.count(function (_err, result) {
          expect(result).toBe(2);
          resolve();
        });
      }));
    it('should add document on save', () =>
      new Promise<void>((resolve) => {
        const db = new ViewDB();
        const collection = db.collection('documents') as Collection;
        collection.save({ a: 1 }, function () {
          collection.count(function (_err, count) {
            expect(count).toBe(1);
            resolve();
          });
          //should.exist(ids._id);
          //resolve();
        });
      }));
    it('should merge if id exists', () =>
      new Promise<void>((resolve) => {
        const db = new ViewDB();
        const collection = db.collection('documents') as TestCollection;
        collection.save({ a: 1 }, function (_err, docs) {
          assert(docs);
          docs[0]['b'] = 2;
          collection.save(docs, function () {
            collection.count(function (_err, count) {
              expect(count).toBe(1);
              resolve();
            });
          });
        });
      }));
  });
  describe('#find', () => {
    it('find all documents', () =>
      new Promise<void>((resolve) => {
        const db = new ViewDB();
        const collection = db.collection('documents') as TestCollection;
        collection.insert({ a: 1 }, function () {
          collection.find({}).toArray(function (_err, docs) {
            assert(docs);
            expect(docs.length).toBe(1);
            expect(docs[0].a).toBe(1);
            resolve();
          });
        });
      }));
    it('find one document', () =>
      new Promise<void>((resolve) => {
        const db = new ViewDB();
        const collection = db.collection('documents') as TestCollection;
        collection.insert({ a: 1 }, function (_err, ids) {
          assert(ids);
          collection.find({ _id: ids[0]._id }).toArray(function (_err, docs) {
            assert(docs);
            expect(docs.length).toBe(1);
            expect(docs[0].a).toBe(1);
            resolve();
          });
        });
      }));
    it('should return empty collection if query does not match', () =>
      new Promise<void>((resolve) => {
        const db = new ViewDB();
        const collection = db.collection('documents') as TestCollection;
        collection.insert({ a: 1 }, function () {
          collection.find({ _id: 5 }).toArray(function (_err, docs) {
            assert(docs);
            expect(docs.length).toBe(0);
            resolve();
          });
        });
      }));
  });
  describe('#remove', () => {
    it('should remove one document matching a query', () =>
      new Promise<void>((resolve) => {
        const db = new ViewDB();
        const collection = db.collection('documents') as TestCollection;
        collection.insert({ a: 1, name: 'hello' }, function () {
          collection.remove({ name: 'hello' }, null, function () {
            collection.find({}).toArray(function (_err, res) {
              assert(res);
              expect(res.length).toBe(0);
              resolve();
            });
          });
        });
      }));

    it('shouldnt do anything when no documents are matched against the query', () =>
      new Promise<void>((resolve) => {
        const db = new ViewDB();
        const collection = db.collection('documents') as TestCollection;
        collection.insert({ a: 1, name: 'hello' }, function () {
          collection.remove({ name: 'world' }, null, function () {
            collection.find({}).toArray(function (_err, res) {
              assert(res);
              expect(res.length).toBe(1);
              resolve();
            });
          });
        });
      }));
  });
  describe('#drop', () => {
    it('should remove all documents', () =>
      new Promise<void>((resolve) => {
        const store = new ViewDB();
        store.open().then(function () {
          const collection = store.collection('dollhouse') as TestCollection;
          collection.insert({ _id: 'echo' });
          collection.drop();

          collection.find({}).toArray(function (_err, results) {
            assert(results);
            expect(results.length).toBe(0);
            resolve();
          });
        });
      }));
  });
});
