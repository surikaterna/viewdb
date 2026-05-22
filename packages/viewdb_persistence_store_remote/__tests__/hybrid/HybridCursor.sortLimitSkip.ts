import { ViewDB } from "viewdb";
import HybridStore from "../../src/hybrid/HybridStore";

describe("Sort / Limit / Skip", () => {
  let local = null;
  let remote = null;
  let hybrid = null;

  beforeEach(
    () =>
      new Promise<void>((resolve) => {
        local = new ViewDB();
        remote = new ViewDB();
        hybrid = new ViewDB(new (HybridStore as any)(local, remote, { throttleObserveRefresh: 0 }));
        hybrid.open().then(() => {
          resolve();
        });
      })
  );

  it("#toArray with sort / limit", async () => {
    const NUMBER_OF_DOCS = 20;
    const LIMIT = 5;
    await hybrid.open();

    const remoteCollection = remote.collection("dollhouse");
    const localCollection = local.collection("dollhouse");

    const inserts: Promise<any>[] = [];
    for (let i = 0; i < NUMBER_OF_DOCS; i++) {
      const collection = i % 2 === 0 ? localCollection : remoteCollection;
      inserts.push(collection.insert({ _id: String(i), age: i }));
    }
    await Promise.all(inserts);

    const cursor = hybrid
      .collection("dollhouse")
      .find({ _id: { $gte: "0" } })
      .sort({ age: 1 })
      .limit(LIMIT);
    let calls = 0;
    await new Promise<void>((resolve, reject) => {
      cursor.toArray((err, res) => {
        if (err) {
          reject(err);
          return;
        }
        calls += 1;
        if (calls === 2) {
          expect(res.length).toBe(LIMIT);
          for (let i = 0; i < LIMIT; i++) {
            expect(res[i].age).toBe(i);
          }
          resolve();
        }
      });
    });
  });
});
