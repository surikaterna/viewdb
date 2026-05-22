import _ from "lodash";
import { LokiJSStore } from "../src";

describe("Collection", () => {
  let store;
  beforeEach(() => {
    store = new LokiJSStore("test-suite", { inMemoryOnly: true });
  });

  afterEach(async () => {
    if (store) {
      await store.collection("dollhouse").drop();
      await store.collection("dollhouse2").drop();
      await store.close();
      store.clearAllIntervals();
    }
  });

  it("#find with empty array should return 0 docs", async () => {
    await store.open();
    const results = await store.collection("dollhouse").find({}).toArray();
    expect(results.length).toBe(0);
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
    await store.collection("dollhouse").find({}).toArray();
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

  it("#count without skip should return total", async () => {
    await store.open();
    await store.collection("dollhouse").insert({ _id: "echo" });
    await store.collection("dollhouse").insert({ _id: "sierra" });
    const count = await store.collection("dollhouse").find({}).count();
    expect(count).toBe(2);
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

  it("#should allow to save with $ chars in _syncProfiles", async () => {
    await store.open();
    await store
      .collection("_syncProfiles")
      .insert({ id: "echo", query: { $or: ["1", "2"] }, subQueries: { $or: ["1", "2"] } });
    const results = await store.collection("_syncProfiles").find({ id: "echo" }).toArray();
    const equal = _.isEqual(["1", "2"], results[0].query["$or"]);
    expect(equal).toBe(true);
  });
});
