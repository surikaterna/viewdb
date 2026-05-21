import IndexedDBStore from "../src/IndexedDBStore";
import getDb from "./util";

describe("Collection", function () {
  let store;

  beforeEach(() => {
    const idb = getDb();
    store = new IndexedDBStore(idb);
  });

  afterEach(async () => {
    if (store) {
      await store.close();
      const idb = store._idb;
      idb._databases.clear();
    }
  });

  it("#find with empty array should return 0 docs", async () => {
    await store.open();
    const results = await store.collection("dollhouse").find({}).toArray();
    expect(results.length).toBe(0);
  });

  it("#insert two documents with same key should throw", async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "echo" });
    let thrown = false;
    try {
      await store.collection("dollhouse").insert({ _id: "echo" });
    } catch (_err) {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });

  it("#insert two documents with same key but in different collections should work", async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "echo" });
    await store.collection("dollhouse2").insert({ _id: "echo" });
  });

  it("#update documents already existing", async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "echo" });
    await store.collection("dollhouse").save({ _id: "echo", version: 2 });
    const results = await store.collection("dollhouse").find({}).toArray();
    expect(results.length).toBe(1);
    expect(results[0].version).toBe(2);
  });

  it("#find {} should return single inserted document", async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "echo" });
    const results = await store.collection("dollhouse").find({}).toArray();
    expect(results.length).toBe(1);
  });

  it("#find {} should return multiple inserted documents", async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "echo" });
    await store.collection("dollhouse").insert({ _id: "sierra" });
    const results = await store.collection("dollhouse").find({}).toArray();
    expect(results.length).toBe(2);
  });

  it('#find {_id:"echo"} should return correct document', async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "echo" });
    await store.collection("dollhouse").insert({ _id: "sierra" });
    const results = await store.collection("dollhouse").find({ _id: "echo" }).toArray();
    expect(results.length).toBe(1);
    expect(results[0]._id).toBe("echo");
  });

  it('#find with complex key {"name.first":"echo"} should return correct document', async () => {
    await store.open();
    await Promise.all([
      store.collection("dollhouse").insert({ _id: "echo", name: { first: "ECHO", last: "TV" } }),
      store.collection("dollhouse").insert({ _id: "sierra", name: { first: "SIERRA", last: "TV" } }),
    ]);
    const results = await store.collection("dollhouse").find({ "name.first": "ECHO" }).toArray();
    expect(results.length).toBe(1);
    expect(results[0]._id).toBe("echo");
  });

  it("#drop should remove all documents", async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "echo" });
    await store.collection("dollhouse").drop();
    const results = await store.collection("dollhouse").find({}).toArray();
    expect(results.length).toBe(0);
  });

  it("#sort should sort on a property", async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "alpha" });
    await store.collection("dollhouse").insert({ _id: "beta" });
    await store.collection("dollhouse").insert({ _id: "cosworth" });
    await store.collection("dollhouse").insert({ _id: "dingo" });
    const results = await store.collection("dollhouse").find({}).sort({ _id: 1 }).toArray();
    expect(results[0]._id).toBe("alpha");
  });

  it("#sort should sort on a property, descending", async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "alpha" });
    await store.collection("dollhouse").insert({ _id: "beta" });
    await store.collection("dollhouse").insert({ _id: "cosworth" });
    await store.collection("dollhouse").insert({ _id: "dingo" });
    const results = await store.collection("dollhouse").find({}).sort({ _id: -1 }).toArray();
    expect(results[0]._id).toBe("dingo");
  });

  it("#insert documents via bulk", async () => {
    await store.open();
    await store.collection("dollhouse").insert([{ _id: "echo" }, { _id: "sierra" }]);
    const results = await store.collection("dollhouse").find({}).toArray();
    expect(results.length).toBe(2);
  });

  it("#update documents via bulk", async () => {
    await store.open();
    await store.collection("dollhouse").insert([{ _id: "echo" }, { _id: "sierra" }]);
    await store.collection("dollhouse").save([
      { _id: "echo", version: 2 },
      { _id: "sierra", version: 22 },
    ]);
    const results = await store.collection("dollhouse").find({}).toArray();
    expect(results.length).toBe(2);
    expect(results[0].version).toBe(2);
    expect(results[1].version).toBe(22);
  });

  it("#count should return number of documents", async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "echo" });
    await store.collection("dollhouse").insert({ _id: "sierra" });
    const count = await store.collection("dollhouse").find({}).count();
    expect(count).toBe(2);
  });

  it("#count should return number of documents with filter", async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "echo" });
    await store.collection("dollhouse").insert({ _id: "sierra" });
    const count = await store.collection("dollhouse").find({ _id: "echo" }).count();
    expect(count).toBe(1);
  });

  it("#count should include skip", async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "echo" });
    await store.collection("dollhouse").insert({ _id: "sierra" });
    const count = await store.collection("dollhouse").find({}).skip(1).count();
    expect(count).toBe(1);
  });

  it('#find {_id:"echo"} should use primary key index', async () => {
    await store.open();
    expect(store.collection("dollhouse")._isIdentityQuery({ _id: "echo" })).toBe(true);
  });

  it('#find {id:"echo"} should use primary key index', async () => {
    await store.open();
    expect(store.collection("dollhouse")._isIdentityQuery({ id: "echo" })).toBe(true);
  });

  it('#find {xid:"echo"} should not use primary key index', async () => {
    await store.open();
    expect(store.collection("dollhouse")._isIdentityQuery({ xid: "echo" })).toBe(false);
  });

  it('#find {id:"echo", age:12} should not use primary key index', async () => {
    await store.open();
    expect(store.collection("dollhouse")._isIdentityQuery({ id: "echo", age: 12 })).toBe(false);
  });

  it('#find {_id: $in ["echo"]} should return correct document', async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "echo" });
    await store.collection("dollhouse").insert({ _id: "sierra" });
    const results = await store
      .collection("dollhouse")
      .find({ _id: { $in: ["echo", "sierra"] } })
      .toArray();
    expect(results.length).toBe(2);
    expect(results[0]._id).toBe("echo");
  });

  it('#_getByKey {id:"echo"} should return value', async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "echo" });
    await store.collection("dollhouse").insert({ _id: "sierra" });
    const res = await store.collection("dollhouse")._getByKey({ query: { _id: "echo" } });
    expect(res.length).toBe(1);
    expect(res[0]._id).toBe("echo");
  });

  it('#_getByKey {id:"echo-no-match"} should return 0 value', async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "echo" });
    await store.collection("dollhouse").insert({ _id: "sierra" });
    const res = await store.collection("dollhouse")._getByKey({ query: { _id: "echo-no-match" } });
    expect(res.length).toBe(0);
  });
});
