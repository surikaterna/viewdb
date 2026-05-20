import should from "should";
import { Cursor as LocalCursor } from "viewdb";
import Cursor from "../../src/hybrid/cursor";

const LocalCursorAny: any = LocalCursor;

describe("Cursor", function () {
  it("#toArray should return remote", () =>
    new Promise<void>((resolve, reject) => {
      const lcursor = new LocalCursorAny(null, {}, null, function (query, callback) {
        callback(null, [{ _id: "1" }, { _id: "2" }]);
      });
      const rcursor = new LocalCursorAny(null, {}, null, function (query, callback) {
        callback(null, [{ _id: "1" }, { _id: "2" }]);
      });
      const hcursor = new Cursor({}, lcursor, rcursor, {}, {});
      hcursor.toArray(function (err, result) {
        result.length.should.equal(2);
        resolve();
      });
    }));
  it("#toArray with localFirst should call callback twice", () =>
    new Promise<void>((resolve, reject) => {
      const lcursor = new LocalCursorAny(null, {}, null, function (query, callback) {
        callback(null, [{ _id: "1" }, { _id: "2" }]);
      });
      const rcursor = new LocalCursorAny(null, {}, null, function (query, callback) {
        callback(null, [{ _id: "1" }, { _id: "2" }]);
      });
      const hcursor = new Cursor({}, lcursor, rcursor, {}, { localFirst: true });
      let calls = 0;
      hcursor.toArray(function (err, result) {
        if (++calls === 2) {
          resolve();
        }
      });
    }));
  it("#toArray with localFirst false should call callback once", () =>
    new Promise<void>((resolve, reject) => {
      const lcursor = new LocalCursorAny(null, {}, null, function (query, callback) {
        callback(null, [{ _id: "1" }, { _id: "2" }]);
      });
      const rcursor = new LocalCursorAny(null, {}, null, function (query, callback) {
        callback(null, [{ _id: "1" }, { _id: "2" }]);
      });
      const hcursor = new Cursor({}, lcursor, rcursor, {}, { localFirst: false });
      const calls = 0;
      hcursor.toArray(function (err, result) {
        resolve();
      });
    }));
  it("#toArray with versions should merge correctly", () =>
    new Promise<void>((resolve, reject) => {
      const lcursor = new LocalCursorAny(null, {}, null, function (query, callback) {
        callback(null, [
          { _id: "1", version: 1, local: true },
          { _id: "2", version: 2, local: true },
        ]);
      });
      const rcursor = new LocalCursorAny(null, {}, null, function (query, callback) {
        callback(null, [
          { _id: "1", version: 2, local: false },
          { _id: "2", version: 1, local: false },
        ]);
      });
      const hcursor = new Cursor({}, lcursor, rcursor, {}, { localFirst: false });
      const calls = 0;
      hcursor.toArray(function (err, result) {
        result[0].local.should.not.be.true;
        result[1].local.should.be.true;
        resolve();
      });
    }));

  it("#toArray with local data first should return correctly", () =>
    new Promise<void>((resolve, reject) => {
      const lcursor = new LocalCursorAny(null, {}, null, function (query, callback) {
        setTimeout(function () {
          callback(null, [
            { _id: "1", version: 1, local: true },
            { _id: "2", version: 2, local: true },
          ]);
        }, 10);
      });
      const rcursor = new LocalCursorAny(null, {}, null, function (query, callback) {
        callback(null, [
          { _id: "1", version: 2, local: false },
          { _id: "2", version: 1, local: false },
        ]);
      });
      const hcursor = new Cursor({}, lcursor, rcursor, {}, { localFirst: false });
      const calls = 0;
      hcursor.toArray(function (err, result) {
        result[0].local.should.not.be.true;
        result[1].local.should.be.true;
        resolve();
      });
    }));
  it("#toArray should throw on local error", () =>
    new Promise<void>((resolve, reject) => {
      const lcursor = new LocalCursorAny(null, {}, null, function (query, callback) {
        callback(new Error());
      });
      const rcursor = new LocalCursorAny(null, {}, null, function (query, callback) {
        callback(null, [
          { _id: "1", version: 2, local: false },
          { _id: "2", version: 1, local: false },
        ]);
      });
      const hcursor = new Cursor({}, lcursor, rcursor, {}, { localFirst: false });
      const calls = 0;
      hcursor.toArray(function (err, result) {
        should.exist(err);
        resolve();
      });
    }));
  it("#toArray should throw on remote error", () =>
    new Promise<void>((resolve, reject) => {
      const lcursor = new LocalCursorAny(null, {}, null, function (query, callback) {
        callback(null, [
          { _id: "1", version: 2, local: false },
          { _id: "2", version: 1, local: false },
        ]);
      });
      const rcursor = new LocalCursorAny(null, {}, null, function (query, callback) {
        callback(new Error());
      });
      const hcursor = new Cursor({}, lcursor, rcursor, {}, { localFirst: false, throwRemoteErr: true });
      const calls = 0;
      hcursor.toArray(function (err, result) {
        should.exist(err);
        resolve();
      });
    }));
  it("#toArray should not throw on remote error if opted out", () =>
    new Promise<void>((resolve, reject) => {
      const lcursor = new LocalCursorAny(null, {}, null, function (query, callback) {
        callback(null, [
          { _id: "1", version: 2, local: false },
          { _id: "2", version: 1, local: false },
        ]);
      });
      const rcursor = new LocalCursorAny(null, {}, null, function (query, callback) {
        callback(new Error());
      });
      const hcursor = new Cursor({}, lcursor, rcursor, {}, { localFirst: false, throwRemoteErr: false });
      const calls = 0;
      hcursor.toArray(function (err, result) {
        should.not.exist(err);
        result.length.should.equal(2);
        resolve();
      });
    }));
  it("#toArray should not throw on using $elemMatch with $ne and $eq", () =>
    new Promise<void>((resolve, reject) => {
      const query: any = { things: { $elemMatch: { name: { $eq: "banana" }, category: { $ne: "toy" } } } };
      const lcursor = new LocalCursorAny(null, query, null, function (query, callback) {
        setTimeout(function () {
          callback(null, [
            {
              _id: "1",
              things: [
                { name: "banana", category: "fruit" },
                { name: "orange", category: "toy" },
              ],
              version: 1,
              local: true,
            },
            {
              _id: "2",
              things: [
                { name: "banana", category: "toy" },
                { name: "orange", category: "fruit" },
              ],
              version: 2,
              local: true,
            },
          ]);
        }, 10);
      });
      const rcursor = new LocalCursorAny(null, query, null, function (query, callback) {
        callback(new Error());
      });
      const hcursor = new Cursor(query, lcursor, rcursor, {}, { localFirst: false, throwRemoteErr: false });
      const calls = 0;
      hcursor.toArray(function (err, result) {
        should.not.exist(err);
        result.length.should.equal(1);
        result[0].things[0].name.should.equal("banana");
        result[0].things[0].category.should.equal("fruit");
        resolve();
      });
    }));
  it("#toArray should not throw on remote error if opted out and delayed local response", () =>
    new Promise<void>((resolve, reject) => {
      const lcursor = new LocalCursorAny(null, {}, null, function (query, callback) {
        setTimeout(function () {
          callback(null, [
            { _id: "1", version: 1, local: true },
            { _id: "2", version: 2, local: true },
          ]);
        }, 10);
      });
      const rcursor = new LocalCursorAny(null, {}, null, function (query, callback) {
        callback(new Error());
      });
      const hcursor = new Cursor({}, lcursor, rcursor, {}, { localFirst: false, throwRemoteErr: false });
      const calls = 0;
      hcursor.toArray(function (err, result) {
        should.not.exist(err);
        result.length.should.equal(2);
        resolve();
      });
    }));
  it("#toArray should throw on remote error if not opted out and delayed local response", () =>
    new Promise<void>((resolve, reject) => {
      const lcursor = new LocalCursorAny(null, {}, null, function (query, callback) {
        setTimeout(function () {
          callback(null, [
            { _id: "1", version: 1, local: true },
            { _id: "2", version: 2, local: true },
          ]);
        }, 10);
      });
      const rcursor = new LocalCursorAny(null, {}, null, function (query, callback) {
        callback(new Error());
      });
      const hcursor = new Cursor({}, lcursor, rcursor, {}, { localFirst: false, throwRemoteErr: true });
      const calls = 0;
      hcursor.toArray(function (err, result) {
        should.exist(err);
        resolve();
      });
    }));
});
