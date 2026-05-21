import _ from "lodash";
import { ViewDB as ViewDB } from "..";

describe("Observe", () => {
  it("#observe with insert", async () => {
    const store = new ViewDB();
    await store.open();
    const cursor = store.collection("dollhouse").find({});
    await new Promise<void>((resolve) => {
      const handle = cursor.observe({
        added: function (x) {
          expect(x._id).toBe("echo");
          handle.stop();
          resolve();
        },
      });
      store.collection("dollhouse").insert!({ _id: "echo" });
    });
  });

  it("#observe with query and insert", async () => {
    const store = new ViewDB();
    await store.open();
    await store.collection("dollhouse").insert!({ _id: "echo" });
    const cursor = store.collection("dollhouse").find({ _id: "echo2" });
    await new Promise<void>((resolve) => {
      cursor.observe({
        added: function (x) {
          expect(x._id).toBe("echo2");
          resolve();
        },
      });
      store.collection("dollhouse").insert!({ _id: "echo2" });
    });
  });

  it("#observe with query and update", async () => {
    const store = new ViewDB();
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

      store.collection("dollhouse").insert!({ _id: "echo", age: 10 }).then(() => {
        store.collection("dollhouse").save!({ _id: "echo", age: 100 });
      });
    });
  });

  it("#observe with query and skip", async () => {
    const store = new ViewDB();
    await store.open();
    await store.collection("dollhouse").insert!({ _id: "echo" });
    await store.collection("dollhouse").insert!({ _id: "echo2" });
    await store.collection("dollhouse").insert!({ _id: "echo3" });
    const cursor = store.collection("dollhouse").find({});
    let skip = 0;
    cursor.limit(1);

    await new Promise<void>((resolve) => {
      const realDone = _.after(3, async function () {
        const res = await cursor.toArray();
        expect(res.length).toBe(0);
        handle.stop();
        resolve();
      });

      const handle = cursor.observe({
        added: function () {
          cursor.skip(++skip);
          realDone();
        },
      });
    });
  });

  it("#observe with no results", async () => {
    const store = new ViewDB();
    await store.open();
    const cursor = store.collection("dollhouse").find({});
    await new Promise<void>((resolve) => {
      const handle = cursor.observe({
        init: function (coll) {
          expect(coll.length).toBe(0);
          handle.stop();
          resolve();
        },
      });
    });
  });

  it("#observe with init after one insert", async () => {
    const store = new ViewDB();
    await store.collection("dollhouse").insert!({ _id: "echo" });
    await store.open();
    const cursor = store.collection("dollhouse").find({});
    await new Promise<void>((resolve) => {
      const handle = cursor.observe({
        init: function (coll) {
          expect(coll.length).toBe(1);
          handle.stop();
          resolve();
        },
      });
    });
  });

  it("#observe with one insert after init", async () => {
    const store = new ViewDB();
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
        store.collection("dollhouse").insert!({ _id: "echo" });
      }, 5);
    });
  });

  it("#observe with query update", async () => {
    const store = new ViewDB();
    await store.open();
    const cursor = store.collection("dollhouse").find({});
    await new Promise<void>((resolve) => {
      const handle = cursor.observe({
        init: (docs) => {
          expect(docs.length).toBe(0);
        },
        added: (doc) => {
          expect(doc._id).toMatch(/^echo/);
        },
        changed: (found, e) => {
          expect(found).toEqual({ _id: "echo1", name: "marco" });
          expect(e).toEqual({ _id: "echo1", name: "marco", data: "changed" });

          handle.stop();
          resolve();
        },
        removed: (doc) => {
          expect(doc).toEqual({ _id: "echo3", name: "polo" });

          store.collection("dollhouse").save!([{ _id: "echo3", name: "polo", data: "changed" }]).then(() => {
            store.collection("dollhouse").save!([{ _id: "echo1", name: "marco", data: "changed" }]);
          });
        },
      });

      store.collection("dollhouse").insert!([
        { _id: "echo1", name: "marco" },
        { _id: "echo2", name: "marco" },
        { _id: "echo3", name: "polo" },
      ]).then(() => {
        cursor.updateQuery!({ name: "marco" });
      });
    });
  });
});
