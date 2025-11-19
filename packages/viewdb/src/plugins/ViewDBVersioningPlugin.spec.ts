import assert from "node:assert";
import { beforeEach, describe, expect, it } from "vitest";
import { ViewDBCollection } from "../interfaces";
import { ViewDB } from "../ViewDB";
import { ViewDBVersioningPlugin } from "./ViewDBVersioningPlugin";

type Doc = {
  _id: string;
  id: string;
  name?: string;
  version?: number;
};

describe("Viewdb versioning plugin", () => {
  let db: ViewDB;
  let collection: ViewDBCollection<Doc>;

  beforeEach(() => {
    db = new ViewDB();
    new ViewDBVersioningPlugin(db);
    collection = db.collection("test");
  });

  it("should add version on insert", async () => {
    const newDoc = { id: "123" } as Doc;
    collection.insert(newDoc);

    const [doc] = await collection.find({ id: "123" }).toArray();
    expect(doc?.version).toBe(0);
  });

  it("should add version on builk insert", async () => {
    await collection.insert([{ id: "123" }, { id: "999" }] as Doc[]);
    const docs = await collection.find({}).toArray();

    expect(docs[0]?.version).toBe(0);
    expect(docs[1]?.version).toBe(0);
  });

  it("should increase version on save", async () => {
    const newDoc = { id: "123" } as Doc;

    await collection.insert(newDoc);
    newDoc.name = "Pelle";
    await collection.save(newDoc);

    const [doc] = await collection.find({ id: "123" }).toArray();
    assert(doc);

    expect(doc.version).toBe(1);
    expect(doc.name).toBe("Pelle");
  });

  it("should increase version on bulk save", async () => {
    await collection.insert([
      { _id: "123", version: 10 },
      { _id: "999", version: 101 },
    ] as Doc[]);

    const initialDocs = await collection.find({}).toArray();
    for (const doc of initialDocs) {
      doc.name = doc._id === "123" ? "Pelle" : "Kalle";
    }
    await collection.save(initialDocs);

    const docs = await collection.find({}).toArray();
    assert(docs[0]);
    assert(docs[1]);

    expect(docs[0].version).toBe(12);
    expect(docs[0].name).toBe("Pelle");
    expect(docs[1].version).toBe(103);
    expect(docs[1].name).toBe("Kalle");
  });

  it("should skip changing version with skipVersioning option on save", async () => {
    const newDoc = { id: "123" } as Doc;
    await collection.insert(newDoc);

    newDoc.name = "Pelle";
    await collection.save(newDoc, { skipVersioning: true });

    const [doc] = await collection.find({ id: "123" }).toArray();
    assert(doc);

    expect(doc.version).toBe(0);
    expect(doc.name).toBe("Pelle");
  });

  it("should add version on save", async () => {
    const newDoc = { id: "123" } as Doc;
    await collection.insert(newDoc);

    newDoc.name = "Pelle";
    newDoc.version = undefined;
    await collection.save(newDoc);

    const [doc] = await collection.find({ id: "123" }).toArray();
    assert(doc);

    expect(doc.version).toBe(0);
    expect(doc.name).toBe("Pelle");
  });
});
