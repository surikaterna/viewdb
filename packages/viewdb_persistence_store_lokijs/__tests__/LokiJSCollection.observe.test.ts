import _ from "lodash";
import { LokiJSStore } from "../src";

describe("Collection", function () {
  let store;
  beforeEach(() => {
    store = new LokiJSStore("test-suite", { inMemoryOnly: true, disableThrottle: true });
  });

  afterEach(async () => {
    if (store) {
      await store.collection("dollhouse").drop();
      await store.collection("dollhouse2").drop();
      await store.close();
      store.clearAllIntervals();
    }
  });

  it("#observe with insert", async () => {
    await store.open();
    const cursor = store.collection("dollhouse").find({});
    await new Promise<void>((resolve) => {
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
  });

  it("#observe with implicit remove", async () => {
    await store.open();
    const cursor = store.collection("dollhouse").find({ _id: "echo", status: "confirmed" });
    let haveAdded = false;
    await new Promise<void>((resolve) => {
      const handle = cursor.observe({
        added: function (_x) {
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
  });

  it("#observe with remove", async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "echo" });
    const cursor = store.collection("dollhouse").find({});
    await new Promise<void>((resolve) => {
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

  it("#observe with query and insert", async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "echo" });
    const cursor = store.collection("dollhouse").find({ _id: "echo2" });
    await new Promise<void>((resolve) => {
      cursor.observe({
        added: function (x) {
          expect(x._id).toBe("echo2");
          resolve();
        },
      });
      store.collection("dollhouse").insert({ _id: "echo2" });
    });
  });

  it("#observe with query and update", async () => {
    await store.open();
    const cursor = store.collection("dollhouse").find({ _id: "echo" });
    await new Promise<void>((resolve) => {
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

      store
        .collection("dollhouse")
        .insert({ _id: "echo", age: 10 })
        .then(() => {
          store.collection("dollhouse").save({ _id: "echo", age: 100 });
        });
    });
  });

  it("#observe with query and skip", async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "echo" });
    await store.collection("dollhouse").insert({ _id: "echo2" });
    await store.collection("dollhouse").insert({ _id: "echo3" });
    const cursor = store.collection("dollhouse").find({});
    let skip = 0;
    cursor.limit(1);

    await new Promise<void>((resolve) => {
      const realDone = _.after(3, function () {
        cursor.toArray().then((res) => {
          expect(res.length).toBe(0);
          setTimeout(() => {
            handle.stop();
            resolve();
          }, 10);
        });
      });

      const handle = cursor.observe({
        added: function (_x) {
          cursor.skip(++skip);
          realDone();
        },
      });
    });
  });

  it("#observe with no results", async () => {
    await store.open();
    const cursor = store.collection("dollhouse").find({});
    await new Promise<void>((resolve) => {
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
  });

  it("#observe with init after one insert", async () => {
    await store.collection("dollhouse").insert({ _id: "echo" });
    await store.open();
    const cursor = store.collection("dollhouse").find({});
    await new Promise<void>((resolve) => {
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

  it("#observe with one insert after init", async () => {
    await store.open();
    const cursor = store.collection("dollhouse").find({});
    await new Promise<void>((resolve) => {
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
      setTimeout(function () {
        store.collection("dollhouse").insert({ _id: "echo" });
      }, 5);
    });
  });
});
