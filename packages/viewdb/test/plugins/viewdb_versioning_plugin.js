import _ from "lodash";

import { plugins, ViewDB as ViewDb } from "../..";

const ViewDbVersioningPlugin = plugins.VersioningPlugin;

describe("Viewdb versioning plugin", () => {
  it("should add version on insert", () =>
    new Promise((resolve, reject) => {
      var viewDb = new ViewDb();
      new ViewDbVersioningPlugin(viewDb);
      var obj = { id: "123" };

      var collection = viewDb.collection("test");
      collection.insert(obj);

      collection.find({ id: "123" }).toArray(function (err, objects) {
        var object = objects[0];

        expect(object.version).toBe(0);
        resolve();
      });
    }));
  it("should add version on builk insert", () =>
    new Promise((resolve, reject) => {
      var viewDb = new ViewDb();
      new ViewDbVersioningPlugin(viewDb);

      var collection = viewDb.collection("test");
      collection.insert([{ id: "123" }, { id: "999" }]);

      collection.find({}).toArray(function (err, objects) {
        expect(objects[0].version).toBe(0);
        expect(objects[1].version).toBe(0);
        resolve();
      });
    }));
  it("should increase version on save", () =>
    new Promise((resolve, reject) => {
      var viewDb = new ViewDb();
      new ViewDbVersioningPlugin(viewDb);
      var obj = { id: "123" };

      var collection = viewDb.collection("test");
      collection.insert(obj);
      obj.name = "Pelle";
      collection.save(obj);

      collection.find({ id: "123" }).toArray(function (err, objects) {
        var object = objects[0];
        expect(object.version).toBe(1);
        expect(object.name).toBe("Pelle");
        resolve();
      });
    }));

  it("should increase version on bulk save", () =>
    new Promise((resolve, reject) => {
      var viewDb = new ViewDb();
      new ViewDbVersioningPlugin(viewDb);

      var collection = viewDb.collection("test");
      collection.insert([
        { _id: "123", version: 10 },
        { _id: "999", version: 101 },
      ]);
      collection.find({}).toArray(function (err, objects) {
        _.forEach(objects, function (o, i) {
          o.name = i === 0 ? "Pelle" : "Kalle";
        });
        collection.save(objects, function () {
          collection.find({}).toArray(function (err, objects) {
            expect(objects[0].version).toBe(12); // add 1 version for insert and one for save
            expect(objects[0].name).toBe("Pelle");
            expect(objects[1].version).toBe(103);
            expect(objects[1].name).toBe("Kalle");
            resolve();
          });
        });
      });
    }));
  it("should skip changing version with skipVersioning option on save", () =>
    new Promise((resolve, reject) => {
      var viewDb = new ViewDb();
      new ViewDbVersioningPlugin(viewDb);
      var obj = { id: "123" };

      var collection = viewDb.collection("test");
      collection.insert(obj);
      obj.name = "Pelle";
      collection.save(obj, { skipVersioning: true });

      collection.find({ id: "123" }).toArray(function (err, objects) {
        var object = objects[0];
        expect(object.version).toBe(0); // still version 0
        expect(object.name).toBe("Pelle");
        resolve();
      });
    }));
  it("should add version on save", () =>
    new Promise((resolve, reject) => {
      var viewDb = new ViewDb();
      new ViewDbVersioningPlugin(viewDb);
      var obj = { id: "123" };

      var collection = viewDb.collection("test");
      collection.insert(obj);
      obj.name = "Pelle";
      obj.version = undefined;
      collection.save(obj);

      collection.find({ id: "123" }).toArray(function (err, objects) {
        var object = objects[0];
        expect(object.version).toBe(0);
        expect(object.name).toBe("Pelle");
        resolve();
      });
    }));
});
