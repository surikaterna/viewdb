import assert from 'node:assert';
import Cursor from '../src/cursor';
import ViewDB from '..';
import { CollectionLike } from '../src/types';
import Collection from '../src/inmemory/collection';

describe('Cursor', () => {
  it('#toArray', () =>
    new Promise<void>((resolve) => {
      const collection = null as unknown as CollectionLike;
      var cursor = new Cursor(collection, {}, {}, function (_query, callback) {
        callback(null, [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }]);
      });
      cursor.toArray(function (_err, result) {
        assert(result);
        expect(result.length).toBe(4);
        resolve();
      });
    }));
  it('#forEach', () =>
    new Promise<void>((resolve) => {
      const collection = null as unknown as CollectionLike;
      var cursor = new Cursor(collection, {}, {}, function (_query, callback) {
        callback(null, [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }]);
      });
      var calls = 0;
      cursor.forEach(function (result) {
        expect(result).toBeTruthy();
        calls++;
      });
      setTimeout(function () {
        expect(calls).toBe(4);
        resolve();
      }, 0);
    }));
  it('#skip', () =>
    new Promise<void>((resolve) => {
      const db = new ViewDB();
      const collection = db.collection('documents') as Collection;
      for (var i = 0; i < 10; i++) {
        collection.insert({ a: 'a', id: i });
      }
      collection
        .find({ a: 'a' })
        .skip(5)
        .toArray(function (_err, res) {
          assert(res);
          expect(res.length).toBe(5);
          resolve();
        });
    }));
  it('#limit', () =>
    new Promise<void>((resolve) => {
      const db = new ViewDB();
      const collection = db.collection('documents') as Collection;
      for (var i = 0; i < 10; i++) {
        collection.insert({ a: 'a', id: i });
      }
      collection
        .find({ a: 'a' })
        .limit(9)
        .toArray(function (_err, res) {
          assert(res);
          expect(res[8].id).toBe(8);
          expect(res.length).toBe(9);
          resolve();
        });
    }));
  it('#sort', () =>
    new Promise<void>((resolve) => {
      const db = new ViewDB();
      const collection = db.collection('documents') as Collection;
      for (var i = 0; i < 10; i++) {
        collection.insert({ a: 'a', id: i });
      }
      collection
        .find({})
        .sort({ id: 1 })
        .toArray(function (_err, res) {
          assert(res);
          expect(res[0].id).toBe(0);
          resolve();
        });
    }));
  it('#sort desc', () =>
    new Promise<void>((resolve) => {
      const db = new ViewDB();
      const collection = db.collection('documents') as Collection;
      for (var i = 0; i < 10; i++) {
        collection.insert({ a: 'a', id: i });
      }
      collection
        .find({})
        .sort({ id: -1 })
        .toArray(function (_err, res) {
          assert(res);
          expect(res[0].id).toBe(9);
          resolve();
        });
    }));
  it('#skip/limit', () =>
    new Promise<void>((resolve) => {
      const db = new ViewDB();
      const collection = db.collection('documents') as Collection;
      for (var i = 0; i < 10; i++) {
        collection.insert({ a: 'a', id: i });
      }
      collection
        .find({ a: 'a' })
        .skip(8)
        .limit(10)
        .toArray(function (_err, res) {
          assert(res);
          expect(res[1].id).toBe(9);
          expect(res.length).toBe(2); // only 2 left after skipping 8/10
          resolve();
        });
    }));
});
