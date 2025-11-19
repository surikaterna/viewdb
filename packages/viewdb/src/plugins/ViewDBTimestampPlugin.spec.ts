import assert from "node:assert";
import { beforeEach, describe, expect, it } from "vitest";
import type { ViewDBCollection } from "../interfaces";
import { ViewDB } from "../ViewDB";
import { ViewDBTimestampPlugin } from "./ViewDBTimestampPlugin";
import { ViewDBVersioningPlugin } from "./ViewDBVersioningPlugin";

type Doc = {
  _id: string;
  id: string;
  name?: string;
  createDateTime?: number;
  changeDateTime?: number;
  version?: number;
};

describe("Viewdb timestamp plugin", () => {
  let db: ViewDB;
  let collection: ViewDBCollection<Doc>;

  beforeEach(() => {
    db = new ViewDB();
    new ViewDBTimestampPlugin(db);
    new ViewDBVersioningPlugin(db);
    collection = db.collection<Doc>("test");
  });

  it("should add changeDateTime and createDateTime timestamp on insert", async () => {
    const obj = { id: "123" } as Doc;
    const currentTime = Date.now();

    await wait(5);
    await collection.insert(obj);

    const [doc] = await collection.find({ id: "123" }).toArray();
    assert(doc);

    expect(doc.createDateTime).toBeGreaterThan(currentTime);
  });

  it("should add changeDateTime and createDateTime timestamp on bulk insert", async () => {
    const currentTime = Date.now();

    await wait(5);
    await collection.insert([{ _id: "123" }, { _id: "999" }] as Doc[]);
    const docs = await collection.find({}).toArray();

    for (const doc of docs) {
      expect(doc.createDateTime).toBeGreaterThan(currentTime);
    }
  });

  it("should update changeDateTime on builk save", async () => {
    await collection.insert([{ _id: "123" }, { _id: "999" }] as Doc[]);

    const [initDoc] = await collection.find({}).toArray();
    assert(initDoc?.createDateTime);

    const insertTime = initDoc.createDateTime;
    const updateTime = initDoc.changeDateTime;

    expect(insertTime).toBeDefined();
    expect(insertTime).toBe(updateTime);
    await wait(5);

    await collection.save([
      { _id: "123", name: "Pelle", createDateTime: insertTime, changeDateTime: insertTime },
      { _id: "999", name: "Kalle", createDateTime: insertTime, changeDateTime: insertTime },
    ] as Doc[]);

    const docs = await collection.find({}).toArray();
    for (const doc of docs) {
      expect(doc.createDateTime).toBe(insertTime);
      expect(doc.changeDateTime).toBeGreaterThan(insertTime);
    }
  });

  it("should update changeDateTime on save", async () => {
    const newDoc = { id: "123" } as Doc;
    await collection.insert(newDoc);

    const [initDoc] = await collection.find({ id: "123" }).toArray();
    assert(initDoc?.createDateTime);
    const insertTime = initDoc.createDateTime;

    await wait(5);

    newDoc.name = "Pelle";
    await collection.save(newDoc);
    const [doc] = await collection.find({ id: "123" }).toArray();
    assert(doc);

    expect(doc.createDateTime).toBe(insertTime);
    expect(doc.changeDateTime).toBeGreaterThan(insertTime);
  });

  it("should skip changing timestamp with skipTimestamp option on save", async () => {
    const newDoc = { id: "123" } as Doc;
    await collection.insert(newDoc);

    const [initDoc] = await collection.find({ id: "123" }).toArray();
    assert(initDoc?.createDateTime);
    const insertTime = initDoc.createDateTime;

    newDoc.name = "Pelle";
    await collection.save(newDoc, { skipTimestamp: true });

    const [doc] = await collection.find({ id: "123" }).toArray();
    assert(doc);

    expect(doc.createDateTime).toBe(insertTime);
    expect(doc.changeDateTime).toBe(insertTime);
  });

  it("should work together with version plugin", async () => {
    const obj = { id: "123" } as Doc;
    await collection.insert(obj);

    obj.name = "Pelle";
    obj.version = undefined;
    await collection.save(obj);

    const [doc] = await collection.find({ id: "123" }).toArray();
    assert(doc);

    expect(doc.version).toBe(0);
    expect(doc.name).toBe("Pelle");
    expect(doc.createDateTime).toBeDefined();
    expect(doc.changeDateTime).toBeDefined();
  });
});

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
