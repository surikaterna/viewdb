import assert from "node:assert";
import { beforeEach, describe, expect, it } from "vitest";
import { ViewDB } from "./ViewDB";
import type { Indexed, ViewDBCollection } from "./interfaces";

describe("ViewDB", () => {
  type Doc = { _id: string; a?: number; b?: number; name?: string };
  let db: ViewDB;
  let collection: ViewDBCollection<Doc>;

  beforeEach(async () => {
    db = new ViewDB();
    await db.open();
    collection = db.collection<Doc>("documents");
  });

  describe("#count", () => {
    it("should return 0 for empty collection", async () => {
      const count = await collection.count();
      expect(count).toBe(0);
    });
  });

  describe("#insert", () => {
    it("should store a document and include it in count", async () => {
      await collection.insert({ a: 1 } as Doc);
      const count = await collection.count();
      expect(count).toBe(1);
    });

    it("should add id on insert if missing", async () => {
      await collection.insert({ a: 1 } as Doc);
      const res = await collection.find({ a: 1 }).toArray();
      expect(res[0]?._id).toBeDefined();
    });

    it("should fail at storing a previously stored document", async () => {
      await collection.insert({ _id: "1", a: 1 });
      await expect(collection.insert({ _id: "1", a: 2 })).rejects.toThrow();
    });

    it("should fail at storing an empty document", async () => {
      await expect(collection.insert(1 as unknown as Indexed)).rejects.toThrow();
    });

    it("#insert bulk should work", async () => {
      await collection.insert([
        { _id: "1", a: 1 },
        { _id: "2", b: 2 },
      ]);

      const count = await collection.count();
      expect(count).toBe(2);
    });
  });

  describe("#save", () => {
    it("should save multiple", async () => {
      await collection.insert([
        { _id: "1", a: 1 },
        { _id: "2", b: 2 },
      ]);

      await collection.save([
        { _id: "1", a: 10 },
        { _id: "2", b: 20 },
      ]);

      const res = await collection.find({}).toArray();

      expect(res.length).toBe(2);
      expect(res[0]?.a).toBe(10);
      expect(res[1]?.b).toBe(20);
    });

    it("should add id on insert if missing", async () => {
      await collection.save({ a: 1 } as Doc);
      await collection.save({ b: 1 } as Doc);

      const count = await collection.count();
      expect(count).toBe(2);
    });

    it("should add document on save", async () => {
      await collection.save({ a: 1 } as Doc);
      const count = await collection.count();
      expect(count).toBe(1);
    });

    it("should merge if id exists", async () => {
      const docs = await collection.save({ a: 1 } as Doc);
      assert(docs[0]);
      docs[0].b = 2;
      await collection.save(docs);

      const count = await collection.count();
      expect(count).toBe(1);
    });
  });

  describe("#find", () => {
    it("find all documents", async () => {
      await collection.insert({ a: 1 } as Doc);
      const docs = await collection.find({}).toArray();
      assert(docs[0]);

      expect(docs.length).toBe(1);
      expect(docs[0].a).toBe(1);
    });

    it("find one document", async () => {
      const ids = await collection.insert({ a: 1 } as Doc);
      assert(ids[0]);
      const docs = await collection.find({ _id: ids[0]._id }).toArray();
      assert(docs[0]);

      expect(docs.length).toBe(1);
      expect(docs[0].a).toBe(1);
    });

    it("should return empty collection if query does not match", async () => {
      await collection.insert({ a: 1 } as Doc);
      const docs = await collection.find({ _id: "5" }).toArray();
      expect(docs.length).toBe(0);
    });
  });

  describe("#remove", () => {
    it("should remove one document matching a query", async () => {
      await collection.insert({ a: 1, name: "hello" } as Doc);
      await collection.remove({ name: "hello" });

      const res = await collection.find({}).toArray();
      expect(res.length).toBe(0);
    });

    it("shouldnt do anything when no documents are matched against the query", async () => {
      await collection.insert({ a: 1, name: "hello" } as Doc);
      await collection.remove({ name: "world" });

      const res = await collection.find({}).toArray();
      expect(res.length).toBe(1);
    });
  });

  describe("#drop", () => {
    it("should remove all documents", async () => {
      await collection.insert({ _id: "echo" });
      await collection.drop();

      const results = await db.collection("dollhouse").find({}).toArray();
      expect(results.length).toBe(0);
    });
  });
});
