import should from "should";
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
    results.length.should.equal(0);
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
    thrown.should.equal(true);
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
    results.length.should.equal(1);
    results[0].version.should.equal(2);
  });

  it("#find {} should return single inserted document", async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "echo" });
    const results = await store.collection("dollhouse").find({}).toArray();
    results.length.should.equal(1);
  });

  it("#find {} should return multiple inserted documents", async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "echo" });
    await store.collection("dollhouse").insert({ _id: "sierra" });
    const results = await store.collection("dollhouse").find({}).toArray();
    results.length.should.equal(2);
  });

  it('#find {_id:"echo"} should return correct document', async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "echo" });
    await store.collection("dollhouse").insert({ _id: "sierra" });
    const results = await store.collection("dollhouse").find({ _id: "echo" }).toArray();
    results.length.should.equal(1);
    results[0]._id.should.equal("echo");
  });

  it('#find with complex key {"name.first":"echo"} should return correct document', async () => {
    await store.open();
    await Promise.all([
      store.collection("dollhouse").insert({ _id: "echo", name: { first: "ECHO", last: "TV" } }),
      store.collection("dollhouse").insert({ _id: "sierra", name: { first: "SIERRA", last: "TV" } }),
    ]);
    const results = await store.collection("dollhouse").find({ "name.first": "ECHO" }).toArray();
    results.length.should.equal(1);
    results[0]._id.should.equal("echo");
  });

  it("#drop should remove all documents", async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "echo" });
    await store.collection("dollhouse").drop();
    const results = await store.collection("dollhouse").find({}).toArray();
    results.length.should.equal(0);
  });

  it("#sort should sort on a property", async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "alpha" });
    await store.collection("dollhouse").insert({ _id: "beta" });
    await store.collection("dollhouse").insert({ _id: "cosworth" });
    await store.collection("dollhouse").insert({ _id: "dingo" });
    const results = await store.collection("dollhouse").find({}).sort({ _id: 1 }).toArray();
    results[0]._id.should.equal("alpha");
  });

  it("#sort should sort on a property, descending", async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "alpha" });
    await store.collection("dollhouse").insert({ _id: "beta" });
    await store.collection("dollhouse").insert({ _id: "cosworth" });
    await store.collection("dollhouse").insert({ _id: "dingo" });
    const results = await store.collection("dollhouse").find({}).sort({ _id: -1 }).toArray();
    results[0]._id.should.equal("dingo");
  });

  it("#insert documents via bulk", async () => {
    await store.open();
    await store.collection("dollhouse").insert([{ _id: "echo" }, { _id: "sierra" }]);
    const results = await store.collection("dollhouse").find({}).toArray();
    results.length.should.equal(2);
  });

  it("#update documents via bulk", async () => {
    await store.open();
    await store.collection("dollhouse").insert([{ _id: "echo" }, { _id: "sierra" }]);
    await store.collection("dollhouse").save([
      { _id: "echo", version: 2 },
      { _id: "sierra", version: 22 },
    ]);
    const results = await store.collection("dollhouse").find({}).toArray();
    results.length.should.equal(2);
    results[0].version.should.equal(2);
    results[1].version.should.equal(22);
  });

  it("#count should return number of documents", async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "echo" });
    await store.collection("dollhouse").insert({ _id: "sierra" });
    const count = await store.collection("dollhouse").find({}).count();
    count.should.equal(2);
  });

  it("#count should return number of documents with filter", async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "echo" });
    await store.collection("dollhouse").insert({ _id: "sierra" });
    const count = await store.collection("dollhouse").find({ _id: "echo" }).count();
    count.should.equal(1);
  });

  it("#count should include skip", async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "echo" });
    await store.collection("dollhouse").insert({ _id: "sierra" });
    const count = await store.collection("dollhouse").find({}).skip(1).count();
    count.should.equal(1);
  });

  it('#find {_id:"echo"} should use primary key index', async () => {
    await store.open();
    store.collection("dollhouse")._isIdentityQuery({ _id: "echo" }).should.equal(true);
  });

  it('#find {id:"echo"} should use primary key index', async () => {
    await store.open();
    store.collection("dollhouse")._isIdentityQuery({ id: "echo" }).should.equal(true);
  });

  it('#find {xid:"echo"} should not use primary key index', async () => {
    await store.open();
    store.collection("dollhouse")._isIdentityQuery({ xid: "echo" }).should.equal(false);
  });

  it('#find {id:"echo", age:12} should not use primary key index', async () => {
    await store.open();
    store.collection("dollhouse")._isIdentityQuery({ id: "echo", age: 12 }).should.equal(false);
  });

  it('#find {_id: $in ["echo"]} should return correct document', async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "echo" });
    await store.collection("dollhouse").insert({ _id: "sierra" });
    const results = await store
      .collection("dollhouse")
      .find({ _id: { $in: ["echo", "sierra"] } })
      .toArray();
    results.length.should.equal(2);
    results[0]._id.should.equal("echo");
  });

  it('#_getByKey {id:"echo"} should return value', async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "echo" });
    await store.collection("dollhouse").insert({ _id: "sierra" });
    const res = await store.collection("dollhouse")._getByKey({ query: { _id: "echo" } });
    res.length.should.equal(1);
    res[0]._id.should.equal("echo");
  });

  it('#_getByKey {id:"echo-no-match"} should return 0 value', async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "echo" });
    await store.collection("dollhouse").insert({ _id: "sierra" });
    const res = await store.collection("dollhouse")._getByKey({ query: { _id: "echo-no-match" } });
    res.length.should.equal(0);
  });
});
