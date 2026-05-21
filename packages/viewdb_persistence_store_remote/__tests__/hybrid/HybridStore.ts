import { InMemoryStore, ViewDBCursor } from "viewdb";
import HybridStore from "../../src/hybrid/HybridStore";

describe("HybridStore", function () {
  it("should cache", async () => {
    const localStore = new InMemoryStore();
    const remoteStore = new InMemoryStore();

    await remoteStore.collection("alfa").insert({ id: "abc" });
    const hcursor = new HybridStore(localStore, remoteStore, { cacheQueries: true });

    await new Promise<void>((resolve, reject) => {
      hcursor
        .collection("alfa")
        .find({})
        .toArray(function (err, res) {
          if (err) {
            reject(err);
            return;
          }
          if (res.length > 0) {
            setTimeout(function () {
              hcursor
                .collection("alfa")
                ._getCachedData({}, undefined, undefined, undefined, undefined, function (cacheErr, data) {
                  if (cacheErr) {
                    reject(cacheErr);
                    return;
                  }
                  expect(data.length).toBe(1);
                  resolve();
                });
            });
          }
        });
    });
  });

  it("should cache projected data separate", async () => {
    ViewDBCursor.prototype.project = function (project) {
      this._project = project;
      return this;
    };
    const localStore = new InMemoryStore();
    const remoteStore = new InMemoryStore();

    await remoteStore.collection("alfa").insert({ id: "abc", property: "def" });
    const hcursor = new HybridStore(localStore, remoteStore, { cacheQueries: true });

    await new Promise<void>((resolve, reject) => {
      hcursor
        .collection("alfa")
        .find({ id: "abc" })
        .project({ id: 1 })
        .toArray(function (err, res) {
          if (err) {
            reject(err);
            return;
          }
          if (res.length > 0) {
            setTimeout(function () {
              hcursor
                .collection("alfa")
                .find({ id: "abc" })
                .toArray(function (err2, projectedRes) {
                  if (err2) {
                    reject(err2);
                    return;
                  }
                  if (projectedRes.length > 0) {
                    setTimeout(function () {
                      hcursor
                        .collection("alfa")
                        ._getCachedData(
                          { id: "abc" },
                          undefined,
                          undefined,
                          undefined,
                          undefined,
                          function (_err, data) {
                            hcursor
                              .collection("alfa")
                              ._getCachedData(
                                { id: "abc" },
                                undefined,
                                undefined,
                                undefined,
                                { id: 1 },
                                function (_err2, projectedData) {
                                  expect(data.length).toBe(1);
                                  expect(projectedData.length).toBe(1);
                                  expect(projectedData[0]._insertedAt).toBeLessThanOrEqual(data[0]._insertedAt);
                                  resolve();
                                }
                              );
                          }
                        );
                    });
                  }
                });
            });
          }
        });
    });
  });

  it("should call remote if cache is no longer correct", async () => {
    const localStore = new InMemoryStore();
    const remoteStore = new InMemoryStore();

    await remoteStore.collection("alfa").insert({ id: "abc" });
    const hcursor = new HybridStore(localStore, remoteStore, { cacheQueries: true });

    await new Promise<void>((resolve, reject) => {
      hcursor
        .collection("alfa")
        .find({})
        .toArray(function (err, res) {
          if (err) {
            reject(err);
            return;
          }
          if (res.length > 0) {
            setTimeout(function () {
              hcursor
                .collection("alfa")
                ._getCachedData({}, undefined, undefined, undefined, undefined, function (cacheErr, data) {
                  if (cacheErr) {
                    reject(cacheErr);
                    return;
                  }
                  expect(data.length).toBe(1);
                });
            });
          }
        });

      let iterations = 0;
      setTimeout(function () {
        hcursor._local._collections._cache._documents[0].resultSet = ["xyz"];
        hcursor._collections._cache._documents.resultSet = ["xyz"];
        hcursor
          .collection("alfa")
          .find({})
          .toArray(function (err, res) {
            if (err) {
              reject(err);
              return;
            }
            iterations += 1;
            expect(res.length).toBe(1);
            if (iterations > 1 || res.length === 0) {
              resolve();
            }
          });
      });
    });
  });
});
