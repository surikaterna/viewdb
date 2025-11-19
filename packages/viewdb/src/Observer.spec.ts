import { describe, expect, it } from "vitest";
import { ViewDB } from "./ViewDB";

describe("Observe", () => {
  it("#observe with insert", async () => {
    const store = new ViewDB();
    await store.open();
    const cursor = store.collection("dollhouse").find({});

    const promise = new Promise<void>((done) => {
      const handle = cursor.observe({
        added: (x) => {
          expect(x._id).toBe("echo");
          handle.stop();
          done();
        },
      });
    });

    await store.collection("dollhouse").insert({ _id: "echo" });
    return promise;
  });

  it("#observe with query and insert", async () => {
    const store = new ViewDB();
    await store.open();
    store.collection("dollhouse").insert({ _id: "echo" });
    const cursor = store.collection("dollhouse").find({ _id: "echo2" });

    const promise = new Promise<void>((done) => {
      const handle = cursor.observe({
        added: function (x) {
          expect(x._id).toBe("echo2");
          handle.stop();
          done();
        },
      });
    });

    await store.collection("dollhouse").insert({ _id: "echo2" });
    return promise;
  });

  it("#observe with query and update", async () => {
    const store = new ViewDB();
    await store.open();

    type Doc = { _id: string; age: number };
    const collection = store.collection<Doc>("dollhouse");
    const cursor = collection.find({ _id: "echo" });

    const promise = new Promise<void>((done) => {
      const handle = cursor.observe({
        added: (oldDoc) => {
          expect(oldDoc.age).toBe(10);
          expect(oldDoc._id).toBe("echo");
        },
        changed: (oldDoc, newDoc) => {
          expect(oldDoc.age).toBe(10);
          expect(newDoc.age).toBe(100);
          handle.stop();
          done();
        },
      });
    });

    await collection.insert({ _id: "echo", age: 10 });
    await collection.save({ _id: "echo", age: 100 });
    return promise;
  });

  it("#observe with query and skip", async () => {
    const store = new ViewDB();
    await store.open();
    const collection = store.collection("dollhouse");

    const cursor = collection.find({});
    let skip = 0;
    cursor.limit(1);

    const promise = new Promise<void>((resolve) => {
      const handle = cursor.observe({
        added: () => {
          cursor.skip(++skip);
          if (skip === 3) {
            handle.stop();
            resolve();
          }
        },
      });
    });

    await collection.insert({ _id: "echo" });
    await collection.insert({ _id: "echo2" });
    await collection.insert({ _id: "echo3" });

    await promise;

    const res = await cursor.toArray();
    expect(res.length).toBe(0);
  });

  it("#observe with no results", async () => {
    const store = new ViewDB();
    await store.open();
    const cursor = store.collection("dollhouse").find({});

    return new Promise<void>((done) => {
      const handle = cursor.observe({
        init: (docs) => {
          expect(docs.length).toBe(0);
          handle.stop();
          done();
        },
      });
    });
  });

  it("#observe with init after one insert", async () => {
    const store = new ViewDB();
    const collection = store.collection("dollhouse");

    await collection.insert({ _id: "echo" });
    await store.open();
    const cursor = collection.find({});

    return new Promise<void>((done) => {
      const handle = cursor.observe({
        init: (docs) => {
          expect(docs.length).toBe(1);
          handle.stop();
          done();
        },
      });
    });
  });

  it("#observe with one insert after init", async () => {
    const store = new ViewDB();
    await store.open();
    const collection = store.collection("dollhouse");
    const cursor = collection.find({});

    const promise = new Promise<void>((done) => {
      const handle = cursor.observe({
        init: (docs) => {
          expect(docs.length).toBe(0);
        },
        added: (doc) => {
          expect(doc._id).toBe("echo");
          handle.stop();
          done();
        },
      });
    });

    setTimeout(() => {
      collection.insert({ _id: "echo" });
    }, 5);

    return promise;
  });

  it("#observe with query update", async () => {
    type Doc = { _id: string; name: string; data?: string };
    const store = new ViewDB();
    await store.open();
    const collection = store.collection<Doc>("dollhouse");
    const cursor = collection.find({});

    const promise = new Promise<void>((done) => {
      const handle = cursor.observe({
        init: (docs) => {
          expect(docs.length).toBe(0);
        },
        added: (doc) => {
          expect(doc._id).toMatch(/^echo/);
        },
        changed: (oldDoc, newDoc) => {
          expect(oldDoc).toEqual({ _id: "echo1", name: "marco" });
          expect(newDoc).toEqual({ _id: "echo1", name: "marco", data: "changed" });

          handle.stop();
          done();
        },
        removed: (doc) => {
          expect(doc).toEqual({ _id: "echo3", name: "polo" });

          collection.save([{ _id: "echo3", name: "polo", data: "changed" }]).then(() => {
            collection.save([{ _id: "echo1", name: "marco", data: "changed" }]);
          });
        },
      });
    });

    await collection.insert([
      { _id: "echo1", name: "marco" },
      { _id: "echo2", name: "marco" },
      { _id: "echo3", name: "polo" },
    ]);
    cursor.updateQuery({ name: "marco" });

    return promise;
  });
});
