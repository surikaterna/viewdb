import should from "should";
import { InMemoryStore, ViewDBCursor } from "viewdb";
import HybridStore from "../../src/hybrid/HybridStore";

describe("HybridStore", function () {
  it("should cache", () =>
    new Promise<void>((resolve, reject) => {
      const localStore = new InMemoryStore();
      const remoteStore = new InMemoryStore();

      remoteStore.collection("alfa").insert({ id: "abc" }, function () {
        const hcursor = new HybridStore(localStore, remoteStore, { cacheQueries: true });
        hcursor
          .collection("alfa")
          .find({})
          .toArray(function (err, res) {
            if (res.length > 0) {
              // Caching of data is not sync action, wait for next tick before fetching data
              setTimeout(function () {
                hcursor
                  .collection("alfa")
                  ._getCachedData({}, undefined, undefined, undefined, undefined, function (err, data) {
                    data.length.should.equal(1);
                    resolve();
                  });
              });
            }
          });
      });
    }));

  it("should cache projected data separate", () =>
    new Promise<void>((resolve, reject) => {
      ViewDBCursor.prototype.project = function (project) {
        this._project = project;
        return this;
      };
      const localStore = new InMemoryStore();
      const remoteStore = new InMemoryStore();

      remoteStore.collection("alfa").insert({ id: "abc", property: "def" }, function () {
        const hcursor = new HybridStore(localStore, remoteStore, { cacheQueries: true });
        hcursor
          .collection("alfa")
          .find({ id: "abc" })
          .project({ id: 1 })
          .toArray(function (err, res) {
            if (res.length > 0) {
              // Caching of data is not sync action, wait for next tick before fetching data
              setTimeout(function () {
                hcursor
                  .collection("alfa")
                  .find({ id: "abc" })
                  .toArray(function (err2, projectedRes) {
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
                                    data.length.should.equal(1);
                                    projectedData.length.should.equal(1);
                                    projectedData[0]._insertedAt.should.be.belowOrEqual(data[0]._insertedAt);
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
    }));

  it("should call remote if cache is no longer correct", () =>
    new Promise<void>((resolve, reject) => {
      const localStore = new InMemoryStore();
      const remoteStore = new InMemoryStore();

      remoteStore.collection("alfa").insert({ id: "abc" }, function () {
        const hcursor = new HybridStore(localStore, remoteStore, { cacheQueries: true });

        hcursor
          .collection("alfa")
          .find({})
          .toArray(function (err, res) {
            if (res.length > 0) {
              setTimeout(function () {
                hcursor
                  .collection("alfa")
                  ._getCachedData({}, undefined, undefined, undefined, undefined, function (err, data) {
                    data.length.should.equal(1);
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
              iterations += 1;
              res.length.should.equal(1);
              if (iterations > 1 || res.length === 0) {
                resolve();
              }
            });
        });
      });
    }));
});
