import Cursor from '../src/cursor';
import { ViewDB } from '..';

describe('Cursor', () => {
  it('#toArray', () =>
    new Promise((resolve, reject) => {
      var cursor = new Cursor(null, {}, null, function (query, callback) {
        callback(null, [1, 2, 3, 4]);
      });
      cursor.toArray(function (err, result) {
        expect(result.length).toBe(4);
        resolve();
      });
    }));
  it('#forEach', () =>
    new Promise((resolve, reject) => {
      var cursor = new Cursor(null, {}, null, function (query, callback) {
        callback(null, [1, 2, 3, 4]);
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
    new Promise((resolve, reject) => {
      var db = new ViewDB();
      var collection = db.collection('documents');
      for (var i = 0; i < 10; i++) {
        collection.insert({ a: 'a', id: i });
      }
      collection
        .find({ a: 'a' })
        .skip(5)
        .toArray(function (err, res) {
          expect(res.length).toBe(5);
          resolve();
        });
    }));
  it('#limit', () =>
    new Promise((resolve, reject) => {
      var db = new ViewDB();
      var collection = db.collection('documents');
      for (var i = 0; i < 10; i++) {
        collection.insert({ a: 'a', id: i });
      }
      collection
        .find({ a: 'a' })
        .limit(9)
        .toArray(function (err, res) {
          expect(res[8].id).toBe(8);
          expect(res.length).toBe(9);
          resolve();
        });
    }));
  it('#sort', () =>
    new Promise((resolve, reject) => {
      var db = new ViewDB();
      var collection = db.collection('documents');
      for (var i = 0; i < 10; i++) {
        collection.insert({ a: 'a', id: i });
      }
      collection
        .find({})
        .sort({ id: 1 })
        .toArray(function (err, res) {
          expect(res[0].id).toBe(0);
          resolve();
        });
    }));
  it('#sort desc', () =>
    new Promise((resolve, reject) => {
      var db = new ViewDB();
      var collection = db.collection('documents');
      for (var i = 0; i < 10; i++) {
        collection.insert({ a: 'a', id: i });
      }
      collection
        .find({})
        .sort({ id: -1 })
        .toArray(function (err, res) {
          expect(res[0].id).toBe(9);
          resolve();
        });
    }));
  it('#skip/limit', () =>
    new Promise((resolve, reject) => {
      var db = new ViewDB();
      var collection = db.collection('documents');
      for (var i = 0; i < 10; i++) {
        collection.insert({ a: 'a', id: i });
      }
      collection
        .find({ a: 'a' })
        .skip(8)
        .limit(10)
        .toArray(function (err, res) {
          expect(res[1].id).toBe(9);
          expect(res.length).toBe(2); // only 2 left after skipping 8/10
          resolve();
        });
    }));
});
