import _ from "lodash";
import should from "should";
import { ViewDB as ViewDb } from "viewdb";
import HybridStore from "../../src/hybrid/store";

describe("Sort / Limit / Skip", function () {
  let local = null;
  let remote = null;
  let hybrid = null;

  beforeEach(
    () =>
      new Promise<void>((resolve, reject) => {
        local = new ViewDb();
        remote = new ViewDb();
        hybrid = new ViewDb(new (HybridStore as any)(local, remote, { throttleObserveRefresh: 0 }));
        hybrid.open().then(function () {
          resolve();
        });
      })
  );

  it("#toArray with sort / limit", () =>
    new Promise<void>((resolve, reject) => {
      const NUMBER_OF_DOCS = 20;
      const LIMIT = 5;
      hybrid.open().then(function () {
        const onPopulated = _.after(NUMBER_OF_DOCS, function () {
          const cursor = hybrid
            .collection("dollhouse")
            .find({ _id: { $gte: "0" } })
            .sort({ age: 1 })
            .limit(LIMIT);
          cursor.toArray(
            _.after(2, function (err, res) {
              res.length.should.equal(LIMIT);
              for (let i = 0; i < LIMIT; i++) {
                res[i].age.should.equal(i);
              }
              resolve();
            })
          );
        });

        const remoteCollection = remote.collection("dollhouse");
        const localCollection = local.collection("dollhouse");

        for (let i = 0; i < NUMBER_OF_DOCS; i++) {
          const collection = i % 2 === 0 ? localCollection : remoteCollection;
          collection.insert({ _id: i, age: i }, onPopulated);
        }
      });
    }));
});
