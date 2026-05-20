import { plugins, ViewDB as ViewDB } from "../..";

const TimestampPlugin = plugins.TimestampPlugin;
const VersioningPlugin = plugins.VersioningPlugin;

describe("Viewdb timestamp plugin", () => {
  it("should add changeDateTime and createDateTime timestamp on insert", () =>
    new Promise<void>((resolve, reject) => {
      const viewDb = new ViewDB();
      new TimestampPlugin(viewDb);
      new VersioningPlugin(viewDb);
      const obj: any = { id: "123" };
      const collection = viewDb.collection("test");
      const currentTime = new Date().valueOf();

      // wait 1ms until update operation to check for lastModified updated
      setTimeout(function () {
        collection.insert(obj, function () {
          collection.find({ id: "123" }).toArray(function (err, objects) {
            const object = objects[0];
            expect(object.createDateTime).toBeDefined();
            if (currentTime < object.createDateTime) {
              resolve();
            } else {
              reject(new Error("Timestamp was not renewed"));
            }
          });
        });
      }, 5);
    }));
  it("should add changeDateTime and createDateTime timestamp on bulk insert", () =>
    new Promise<void>((resolve, reject) => {
      const viewDb = new ViewDB();
      new TimestampPlugin(viewDb);
      new VersioningPlugin(viewDb);
      const collection = viewDb.collection("test");
      const currentTime = new Date().valueOf();

      // wait 1ms until update operation to check for lastModified updated
      setTimeout(function () {
        collection.insert([{ _id: "123" }, { _id: "999" }], function () {
          collection.find({}).toArray(function (err, objects) {
            let hasError = false;
            objects.forEach(function (object) {
              expect(object.createDateTime).toBeDefined();
              if (currentTime >= object.createDateTime) {
                hasError = true;
              }
            });
            (hasError && reject(new Error("Timestamp was not renewed"))) || resolve();
          });
        });
      }, 5);
    }));
  it("should update changeDateTime on builk save", () =>
    new Promise<void>((resolve, reject) => {
      const viewDb = new ViewDB();
      new TimestampPlugin(viewDb);
      new VersioningPlugin(viewDb);
      const collection = viewDb.collection("test");

      collection.insert([{ _id: "123" }, { _id: "999" }]);
      collection.find({}).toArray(function (err, objects) {
        const insertTime = objects[0].createDateTime;
        const updateTime = objects[0].changeDateTime;
        expect(insertTime).toBeDefined();
        expect(insertTime).toBe(updateTime);
        setTimeout(function () {
          collection.save(
            [
              { _id: "123", name: "Pelle", createDateTime: insertTime, changeDateTime: insertTime },
              { _id: "999", name: "Kalle", createDateTime: insertTime, changeDateTime: insertTime },
            ],
            function () {
              collection.find({}).toArray(function (err, objects) {
                objects.forEach(function (object) {
                  expect(object.createDateTime).toBe(insertTime);
                  expect(object.changeDateTime).toBeGreaterThan(insertTime);
                });
                resolve();
              });
            }
          );
        }, 100);
      });

      // wait 1ms until update operation to check for lastModified updated
    }));
  it("should update changeDateTime on save", () =>
    new Promise<void>((resolve, reject) => {
      const viewDb = new ViewDB();
      new TimestampPlugin(viewDb);
      new VersioningPlugin(viewDb);
      const obj: any = { id: "123" };
      let insertTime;
      const collection = viewDb.collection("test");

      collection.insert(obj);
      collection.find({ id: "123" }).toArray(function (err, objects) {
        const object = objects[0];
        insertTime = object.createDateTime;
      });

      // wait 1ms until update operation to check for changeDateTime updated
      setTimeout(function () {
        obj.name = "Pelle";
        collection.save(obj);
        collection.find({ id: "123" }).toArray(function (err, objects) {
          const object = objects[0];
          expect(object.createDateTime).toBe(insertTime);
          expect(object.changeDateTime).toBeGreaterThan(insertTime);
          resolve();
        });
      }, 1);
    }));

  it("should skip changing timestamp with skipTimestamp option on save", () =>
    new Promise<void>((resolve, reject) => {
      const viewDb = new ViewDB();
      new TimestampPlugin(viewDb);
      new VersioningPlugin(viewDb);
      const obj: any = { id: "123" };
      let insertTime;
      const collection = viewDb.collection("test");

      collection.insert(obj);
      collection.find({ id: "123" }).toArray(function (err, objects) {
        const object = objects[0];
        insertTime = object.createDateTime;
      });

      // wait 1ms until update operation to check for changeDateTime updated
      setTimeout(function () {
        obj.name = "Pelle";
        collection.save(obj, { skipTimestamp: true }, function () {
          collection.find({ id: "123" }).toArray(function (err, objects) {
            const object = objects[0];
            expect(object.createDateTime).toBe(insertTime);
            expect(object.changeDateTime).toBe(insertTime);
            resolve();
          });
        });
      }, 1);
    }));

  it("should work together with version plugin", () =>
    new Promise<void>((resolve, reject) => {
      const viewDb = new ViewDB();
      new TimestampPlugin(viewDb);
      new VersioningPlugin(viewDb);
      const obj: any = { id: "123" };
      const collection = viewDb.collection("test");
      collection.insert(obj);
      obj.name = "Pelle";
      obj.version = undefined;
      collection.save(obj);
      collection.find({ id: "123" }).toArray(function (err, objects) {
        const object = objects[0];
        expect(object.version).toBe(0);
        expect(object.name).toBe("Pelle");
        expect(object.createDateTime).toBeDefined();
        expect(object.changeDateTime).toBeDefined();
        resolve();
      });
    }));
});
