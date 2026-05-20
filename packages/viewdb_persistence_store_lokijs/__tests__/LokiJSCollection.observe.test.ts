import _ from "lodash";
import { LokiJSStore } from "..";

describe("Collection", function () {
  let store;
  beforeEach(
    () =>
      new Promise<void>((resolve) => {
        store = new LokiJSStore("test-suite", { inMemoryOnly: true, disableThrottle: true });
        resolve();
      })
  );
  afterEach(
    () =>
      new Promise<void>((resolve) => {
        if (store) {
          store.collection("dollhouse").drop(function () {
            store.collection("dollhouse2").drop(function () {
              store.close(function () {
                store.clearAllIntervals();
                resolve();
              });
            });
          });
        }
      })
  );
  it("#observe with insert", () =>
    new Promise<void>((resolve) => {
      store.open().then(function () {
        const cursor = store.collection("dollhouse").find({});
        const handle = cursor.observe({
          added: function (x) {
            expect(x._id).toBe("echo");
            setTimeout(() => {
              handle.stop();
              resolve();
            }, 10);
          },
        });
        store.collection("dollhouse").insert({ _id: "echo" });
      });
    }));
  it("#observe with implicit remove", () =>
    new Promise<void>((resolve) => {
      store.open().then(function () {
        const cursor = store.collection("dollhouse").find({ _id: "echo", status: "confirmed" });
        let haveAdded = false;
        const handle = cursor.observe({
          added: function (x) {
            haveAdded = true;
          },
          removed: function (x) {
            expect(haveAdded).toBe(true);
            expect(x._id).toBe("echo");
            handle.stop();
            resolve();
          },
        });
        store.collection("dollhouse").insert({ _id: "echo", status: "confirmed" });
        store.collection("dollhouse").save({ _id: "echo", status: "checked_in" });
      });
    }));
  it("#observe with remove", () =>
    new Promise<void>((resolve) => {
      store.open().then(function () {
        store.collection("dollhouse").insert({ _id: "echo" }, function () {
          const cursor = store.collection("dollhouse").find({});
          const handle = cursor.observe({
            removed: function (x) {
              expect(x._id).toBe("echo");
              handle.stop();
              resolve();
            },
          });
          store.collection("dollhouse").remove({ _id: "echo" });
        });
      });
    }));
  it("#observe with query and insert", () =>
    new Promise<void>((resolve) => {
      store.open().then(function () {
        store.collection("dollhouse").insert({ _id: "echo" });
        const cursor = store.collection("dollhouse").find({ _id: "echo2" });
        cursor.observe({
          added: function (x) {
            expect(x._id).toBe("echo2");
            resolve();
          },
        });
        store.collection("dollhouse").insert({ _id: "echo2" });
      });
    }));
  it("#observe with query and update", () =>
    new Promise<void>((resolve) => {
      store.open().then(function () {
        const cursor = store.collection("dollhouse").find({ _id: "echo" });
        const handle = cursor.observe({
          added: function (x) {
            expect(x.age).toBe(10);
            expect(x._id).toBe("echo");
          },
          changed: function (o, n) {
            expect(o.age).toBe(10);
            expect(n.age).toBe(100);
            handle.stop();
            resolve();
          },
        });

        store.collection("dollhouse").insert({ _id: "echo", age: 10 }, function () {
          store.collection("dollhouse").save({ _id: "echo", age: 100 });
        });
      });
    }));
  it("#observe with query and skip", () =>
    new Promise<void>((resolve) => {
      store.open().then(function () {
        store.collection("dollhouse").insert({ _id: "echo" });
        store.collection("dollhouse").insert({ _id: "echo2" });
        store.collection("dollhouse").insert({ _id: "echo3" });
        const cursor = store.collection("dollhouse").find({});
        let skip = 0;
        cursor.limit(1);
        const realDone = _.after(3, function () {
          cursor.toArray(function (err, res) {
            expect(res.length).toBe(0);
            setTimeout(() => {
              handle.stop();
              resolve();
            }, 10);
          });
        });
        const handle = cursor.observe({
          added: function (x) {
            cursor.skip(++skip);
            realDone();
          },
        });
      });
    }));
  it("#observe with no results", () =>
    new Promise<void>((resolve) => {
      store.open().then(function () {
        const cursor = store.collection("dollhouse").find({});
        const handle = cursor.observe({
          init: function (coll) {
            expect(coll.length).toBe(0);
            setTimeout(() => {
              handle.stop();
              resolve();
            }, 10);
          },
        });
      });
    }));
  it("#observe with init after one insert", () =>
    new Promise<void>((resolve) => {
      store.collection("dollhouse").insert({ _id: "echo" }, function () {
        store.open().then(function () {
          const cursor = store.collection("dollhouse").find({});
          const handle = cursor.observe({
            init: function (coll) {
              expect(coll.length).toBe(1);
              setTimeout(() => {
                handle.stop();
                resolve();
              }, 10);
            },
          });
        });
      });
    }));
  it("#observe with one insert after init", () =>
    new Promise<void>((resolve) => {
      store.open().then(function () {
        const cursor = store.collection("dollhouse").find({});
        const handle = cursor.observe({
          init: function (coll) {
            expect(coll.length).toBe(0);
          },
          added: function (a) {
            expect(a._id).toBe("echo");
            handle.stop();
            resolve();
          },
        });
      });
      setTimeout(function () {
        store.collection("dollhouse").insert({ _id: "echo" });
      }, 5);
    }));
});
