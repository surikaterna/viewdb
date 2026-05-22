import { plugins, ViewDB } from "../..";

const TimestampPlugin = plugins.TimestampPlugin;
const VersioningPlugin = plugins.VersioningPlugin;

describe("Viewdb timestamp plugin", () => {
  it("should add changeDateTime and createDateTime timestamp on insert", async () => {
    const viewDb = new ViewDB();
    new TimestampPlugin(viewDb);
    new VersioningPlugin(viewDb);
    const obj: any = { id: "123" };
    const collection = viewDb.collection("test");
    const currentTime = new Date().valueOf();

    await new Promise<void>((resolve, reject) => {
      setTimeout(async () => {
        await collection.insert!(obj);
        const objects = await collection.find({ id: "123" }).toArray();
        const object = objects[0];
        expect(object.createDateTime).toBeDefined();
        if (currentTime < object.createDateTime) {
          resolve();
        } else {
          reject(new Error("Timestamp was not renewed"));
        }
      }, 5);
    });
  });

  it("should add changeDateTime and createDateTime timestamp on bulk insert", async () => {
    const viewDb = new ViewDB();
    new TimestampPlugin(viewDb);
    new VersioningPlugin(viewDb);
    const collection = viewDb.collection("test");
    const currentTime = new Date().valueOf();

    await new Promise<void>((resolve, reject) => {
      setTimeout(async () => {
        await collection.insert!([{ _id: "123" }, { _id: "999" }]);
        const objects = await collection.find({}).toArray();
        let hasError = false;
        objects.forEach((object) => {
          expect(object.createDateTime).toBeDefined();
          if (currentTime >= object.createDateTime) {
            hasError = true;
          }
        });
        (hasError && reject(new Error("Timestamp was not renewed"))) || resolve();
      }, 5);
    });
  });

  it("should update changeDateTime on builk save", async () => {
    const viewDb = new ViewDB();
    new TimestampPlugin(viewDb);
    new VersioningPlugin(viewDb);
    const collection = viewDb.collection("test");

    await collection.insert!([{ _id: "123" }, { _id: "999" }]);
    const objects = await collection.find({}).toArray();
    const insertTime = objects[0].createDateTime;
    const updateTime = objects[0].changeDateTime;
    expect(insertTime).toBeDefined();
    expect(insertTime).toBe(updateTime);

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 100);
    });

    await collection.save!([
      { _id: "123", name: "Pelle", createDateTime: insertTime, changeDateTime: insertTime },
      { _id: "999", name: "Kalle", createDateTime: insertTime, changeDateTime: insertTime },
    ]);
    const updated = await collection.find({}).toArray();
    updated.forEach((object) => {
      expect(object.createDateTime).toBe(insertTime);
      expect(object.changeDateTime).toBeGreaterThan(insertTime);
    });
  });

  it("should update changeDateTime on save", async () => {
    const viewDb = new ViewDB();
    new TimestampPlugin(viewDb);
    new VersioningPlugin(viewDb);
    const obj: any = { id: "123" };
    const collection = viewDb.collection("test");

    await collection.insert!(obj);
    const inserted = await collection.find({ id: "123" }).toArray();
    const insertTime = inserted[0].createDateTime;

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 1);
    });

    obj.name = "Pelle";
    await collection.save!(obj);
    const objects = await collection.find({ id: "123" }).toArray();
    const object = objects[0];
    expect(object.createDateTime).toBe(insertTime);
    expect(object.changeDateTime).toBeGreaterThan(insertTime);
  });

  it("should skip changing timestamp with skipTimestamp option on save", async () => {
    const viewDb = new ViewDB();
    new TimestampPlugin(viewDb);
    new VersioningPlugin(viewDb);
    const obj: any = { id: "123" };
    const collection = viewDb.collection("test");

    await collection.insert!(obj);
    const inserted = await collection.find({ id: "123" }).toArray();
    const insertTime = inserted[0].createDateTime;

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 1);
    });

    obj.name = "Pelle";
    await collection.save!(obj, { skipTimestamp: true });
    const objects = await collection.find({ id: "123" }).toArray();
    const object = objects[0];
    expect(object.createDateTime).toBe(insertTime);
    expect(object.changeDateTime).toBe(insertTime);
  });

  it("should work together with version plugin", async () => {
    const viewDb = new ViewDB();
    new TimestampPlugin(viewDb);
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
    expect(object.createDateTime).toBeDefined();
    expect(object.changeDateTime).toBeDefined();
  });
});
