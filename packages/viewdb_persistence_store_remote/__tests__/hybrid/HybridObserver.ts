import should from "should";
import { ViewDB as ViewDB } from "viewdb";
import HybridStore from "../../src/hybrid/HybridStore";

describe("Observe", function () {
  let local = null;
  let remote = null;
  let hybrid = null;

  beforeEach(
    () =>
      new Promise<void>((resolve, reject) => {
        local = new ViewDB();
        remote = new ViewDB();
        hybrid = new ViewDB(new (HybridStore as any)(local, remote, { throttleObserveRefresh: 0 }));
        hybrid.open().then(function () {
          resolve();
        });
      })
  );

  it("#observe with local insert", () =>
    new Promise<void>((resolve, reject) => {
      const cursor = hybrid.collection("dollhouse").find({});
      const handle = cursor.observe({
        added: function (x) {
          x._id.should.equal("echo");
          handle.stop();
          resolve();
        },
      });
      local.collection("dollhouse").insert({ _id: "echo" });
    }));
  it("#observe with query and local insert", () =>
    new Promise<void>((resolve, reject) => {
      remote.collection("dollhouse").insert({ _id: "echo" });
      const cursor = hybrid.collection("dollhouse").find({ _id: "echo2" });
      const handle = cursor.observe({
        added: function (x) {
          x._id.should.equal("echo2");
          handle.stop();
          resolve();
        },
      });
      local.collection("dollhouse").insert({ _id: "echo2" });
    }));
  it("#observe called twice with one local and one remote insert", () =>
    new Promise<void>((resolve, reject) => {
      remote.collection("dollhouse").insert({ _id: "echo" });
      const cursor = hybrid.collection("dollhouse").find({ _id: "echo2" });
      let called = 0;
      const handle = cursor.observe({
        added: function (x) {
          if (++called === 2) {
            resolve();
          }
        },
        changed: function (x) {
          if (++called === 2) {
            handle.stop();
            resolve();
          }
        },
      });
      local.collection("dollhouse").insert({ _id: "echo2" });
      remote.collection("dollhouse").insert({ _id: "echo2", remote: true });
    }));
  it("#observe with query and update", () =>
    new Promise<void>((resolve, reject) => {
      const store = new ViewDB();
      store.open().then(function () {
        const cursor = store.collection("dollhouse").find({ _id: "echo" });
        const handle = cursor.observe({
          added: function (x) {
            x.age.should.equal(10);
            x._id.should.equal("echo");
          },
          changed: function (o, n) {
            o.age.should.equal(10);
            n.age.should.equal(100);
            handle.stop();
            resolve();
          },
        });

        store
          .collection("dollhouse")
          .insert({ _id: "echo", age: 10 })
          .then(function () {
            return store.collection("dollhouse").save({ _id: "echo", age: 100 });
          })
          .catch(reject);
      });
    }));
  it("#observe with both empty local and remote result", () =>
    new Promise<void>((resolve, reject) => {
      const cursor = hybrid.collection("dollhouse").find({ _id: "echo2" });
      const handle = cursor.observe({
        init: function (r) {
          r.length.should.equal(0);
          handle.stop();
          resolve();
        },
        added: function (x) {
          console.log(x);
          reject(new Error("uh oh"));
        },
      });
    }));
  it("#should cache query if setting is enabled", () =>
    new Promise<void>((resolve, reject) => {
      hybrid = new ViewDB(
        new (HybridStore as any)(local, remote, {
          throttleObserveRefresh: 0,
          cacheQueries: true,
          queryMaxTime: 2,
        })
      );
      hybrid.open().then(function () {
        const cursor = hybrid.collection("dollhouse").find({});
        cursor.observe({
          added: function () {
            setTimeout(function () {
              hybrid
                .collection("dollhouse")
                ._getCachedData({}, 0, 0, undefined, undefined, function (err, cachedDocuments) {
                  cachedDocuments.length.should.equal(1);
                  cachedDocuments[0]._id.should.equal("alfa");
                  cachedDocuments[0].age.should.equal(100);
                  resolve();
                });
            });
          },
        });

        remote.collection("dollhouse").insert({ _id: "alfa", age: 100 });
      });
    }));
});
