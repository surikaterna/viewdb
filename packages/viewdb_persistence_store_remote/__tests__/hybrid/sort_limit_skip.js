import _ from "lodash";
import should from "should";
import { ViewDB as ViewDb } from "viewdb";
import { Hybrid as HybridStore } from "../..";

describe("Sort / Limit / Skip", function () {
  var local = null;
  var remote = null;
  var hybrid = null;

  beforeEach(
    () =>
      new Promise((resolve, reject) => {
        local = new ViewDb();
        remote = new ViewDb();
        hybrid = new ViewDb(new HybridStore(local, remote, { throttleObserveRefresh: 0 }));
        hybrid.open().then(function () {
          resolve();
        });
      })
  );

  it("#toArray with sort / limit", () =>
    new Promise((resolve, reject) => {
      var NUMBER_OF_DOCS = 20;
      var LIMIT = 5;
      hybrid.open().then(function () {
        var onPopulated = _.after(NUMBER_OF_DOCS, function () {
          var cursor = hybrid
            .collection("dollhouse")
            .find({ _id: { $gte: 0 } })
            .sort({ age: 1 })
            .limit(LIMIT);
          cursor.toArray(
            _.after(2, function (err, res) {
              res.length.should.equal(LIMIT);
              for (var i = 0; i < LIMIT; i++) {
                res[i].age.should.equal(i);
              }
              resolve();
            })
          );
        });

        const remoteCollection = remote.collection("dollhouse");
        const localCollection = local.collection("dollhouse");

        for (var i = 0; i < NUMBER_OF_DOCS; i++) {
          var collection = i % 2 === 0 ? localCollection : remoteCollection;
          collection.insert({ _id: i, age: i }, onPopulated);
        }
      });
    }));
});
