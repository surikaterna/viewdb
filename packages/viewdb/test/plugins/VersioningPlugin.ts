import _ from "lodash";

import { plugins, ViewDB as ViewDB } from "../..";

const VersioningPlugin = plugins.VersioningPlugin;

describe("Viewdb versioning plugin", () => {
  it("should add version on insert", async () => {
    const viewDb = new ViewDB();
    new VersioningPlugin(viewDb);
    const obj: any = { id: "123" };

    const collection = viewDb.collection("test");
    await collection.insert!(obj);

    const objects = await collection.find({ id: "123" }).toArray();
    const object = objects[0];

    expect(object.version).toBe(0);
  });

  it("should add version on builk insert", async () => {
    const viewDb = new ViewDB();
    new VersioningPlugin(viewDb);

    const collection = viewDb.collection("test");
    await collection.insert!([{ id: "123" }, { id: "999" }]);

    const objects = await collection.find({}).toArray();
    expect(objects[0].version).toBe(0);
    expect(objects[1].version).toBe(0);
  });

  it("should increase version on save", async () => {
    const viewDb = new ViewDB();
    new VersioningPlugin(viewDb);
    const obj: any = { id: "123" };

    const collection = viewDb.collection("test");
    await collection.insert!(obj);
    obj.name = "Pelle";
    await collection.save!(obj);

    const objects = await collection.find({ id: "123" }).toArray();
    const object = objects[0];
    expect(object.version).toBe(1);
    expect(object.name).toBe("Pelle");
  });

  it("should increase version on bulk save", async () => {
    const viewDb = new ViewDB();
    new VersioningPlugin(viewDb);

    const collection = viewDb.collection("test");
    await collection.insert!([
      { _id: "123", version: 10 },
      { _id: "999", version: 101 },
    ]);
    const objects = await collection.find({}).toArray();
    _.forEach(objects, function (o, i) {
      (o as any).name = Number(i) === 0 ? "Pelle" : "Kalle";
    });
    await collection.save!(objects);
    const saved = await collection.find({}).toArray();
    expect(saved[0].version).toBe(12); // add 1 version for insert and one for save
    expect(saved[0].name).toBe("Pelle");
    expect(saved[1].version).toBe(103);
    expect(saved[1].name).toBe("Kalle");
  });

  it("should skip changing version with skipVersioning option on save", async () => {
    const viewDb = new ViewDB();
    new VersioningPlugin(viewDb);
    const obj: any = { id: "123" };

    const collection = viewDb.collection("test");
    await collection.insert!(obj);
    obj.name = "Pelle";
    await collection.save!(obj, { skipVersioning: true });

    const objects = await collection.find({ id: "123" }).toArray();
    const object = objects[0];
    expect(object.version).toBe(0); // still version 0
    expect(object.name).toBe("Pelle");
  });

  it("should add version on save", async () => {
    const viewDb = new ViewDB();
    new VersioningPlugin(viewDb);
    const obj: any = { id: "123" };

    const collection = viewDb.collection("test");
    await collection.insert!(obj);
    obj.name = "Pelle";
    obj.version = undefined;
    await collection.save!(obj);

    const objects = await collection.find({ id: "123" }).toArray();
    const object = objects[0];
    expect(object.version).toBe(0);
    expect(object.name).toBe("Pelle");
  });
});
