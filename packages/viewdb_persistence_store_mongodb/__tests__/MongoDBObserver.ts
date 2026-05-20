import _ from "lodash";
import { MongoClient } from "mongodb";
import { ViewDB as ViewDB } from "viewdb";
import MongoDBStore from "../src/MongoDBStore";

describe("Observe", function () {
  const COLLECTION_NAME = "observe";

  let _mongoClient;
  let _db;

  const getDb = () => _db;
  const getVDb = () => new ViewDB(new MongoDBStore(getDb()));

  beforeAll(async () => {
    const mongoClient = await MongoClient.connect(global.__MONGO_URI__);
    const db = await mongoClient.db("db_test_suite");

    _mongoClient = mongoClient;
    _db = db;
  });

  beforeEach(async () => {
    try {
      await _db.collection(COLLECTION_NAME).drop();
    } catch (err) {
      // No-op
    }
  });

  afterAll(async () => {
    await _mongoClient.close();
  });

  it("#observe with query and update", () =>
    new Promise<void>((resolve, reject) => {
      const store = getVDb();
      store.open().then(function () {
        const cursor = store.collection(COLLECTION_NAME).find({ _id: "echo" });
        const handle = cursor.observe({
          added: function (x) {
            expect(x.age).toBe(10);
            expect(x._id).toBe("echo");
          },
          changed: function (asis, tobe) {
            expect(asis.age).toBe(10);
            expect(tobe.age).toBe(100);
            handle.stop();
            resolve();
          },
        });
        store.collection(COLLECTION_NAME).insert({ _id: "echo", age: 10 }, function () {
          store.collection(COLLECTION_NAME).save({ _id: "echo", age: 100 }, function () {});
        });
      });
    }));
  it("#observe with insert", () =>
    new Promise<void>((resolve, reject) => {
      let handle;
      const store = getVDb();
      store.open().then(function () {
        const collection = store.collection(COLLECTION_NAME);
        const cursor = collection.find({});
        handle = cursor.observe({
          added: function (x) {
            expect(x._id).toBe("echo");
            handle.stop();
            resolve();
          },
        });
        collection.insert({ _id: "echo" });
      });
    }));
  it("#observe with remove", () =>
    new Promise<void>((resolve, reject) => {
      const realDone = _.after(2, resolve);
      const store = getVDb();
      store.open().then(function () {
        const cursor = store.collection(COLLECTION_NAME).find({});
        const handle = cursor.observe({
          added: function (x) {
            expect(x._id).toBe("echo");
            realDone();
          },
          removed: function () {
            handle.stop();
            realDone();
          },
        });
        const coll = store.collection(COLLECTION_NAME);
        coll.insert({ _id: "echo" }, function () {
          coll.remove({ _id: "echo" }, function () {});
        });
      });
    }));
  it("#observe with query and insert", () =>
    new Promise<void>((resolve, reject) => {
      const store = getVDb();
      store.open().then(function () {
        store.collection(COLLECTION_NAME).insert({ _id: "echo1" }, function () {
          const cursor = store.collection(COLLECTION_NAME).find({ _id: "echo2" });
          const handle = cursor.observe({
            added: function (x) {
              expect(x._id).toBe("echo2");
              resolve();
              handle.stop();
            },
          });
        });
        store.collection(COLLECTION_NAME).insert({ _id: "echo4" }, function () {
          store.collection(COLLECTION_NAME).insert({ _id: "echo2" });
        });
      });
    }));
  it("#observe with query and skip", () =>
    new Promise<void>((resolve, reject) => {
      const store = getVDb();
      store.open().then(function () {
        store.collection(COLLECTION_NAME).insert({ _id: "echo" });
        store.collection(COLLECTION_NAME).insert({ _id: "echo2" });
        store.collection(COLLECTION_NAME).insert({ _id: "echo3" });
        const cursor = store.collection(COLLECTION_NAME).find({});
        let skip = 0;
        cursor.limit(1);
        const realDone = _.after(3, function () {
          cursor.toArray(function (err, res) {
            expect(res).toHaveLength(0);
            handle.stop();
            resolve();
          });
        });

        const handle = cursor.observe({
          added: function () {
            cursor.skip(++skip);
            realDone();
          },
        });
      });
    }));
});
