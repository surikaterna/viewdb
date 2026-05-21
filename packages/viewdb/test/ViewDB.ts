import { ViewDB } from "..";

describe("ViewDB", () => {
  describe("#count", () => {
    it("should return 0 for empty collection", async () => {
      const db = new ViewDB();
      const collection = db.collection("documents");
      const count = await collection.count!();
      expect(count).toBe(0);
    });
  });

  describe("#insert", () => {
    it("should store a document and include it in count", async () => {
      const db = new ViewDB();
      const collection = db.collection("documents");
      await collection.insert!({ a: 1 });
      const count = await collection.count!();
      expect(count).toBe(1);
    });

    it("should add id on insert if missing", async () => {
      const db = new ViewDB();
      const collection = db.collection("documents");
      await collection.insert!({ a: 1 });
      const res = await collection.find({ a: 1 }).toArray();
      expect(res[0]._id).toBeDefined();
    });

    it("should fail at storing a previously stored document", async () => {
      const db = new ViewDB();
      const collection = db.collection("documents");
      await collection.insert!({ _id: 1, a: 1 });
      await expect(collection.insert!({ _id: 1, a: 2 })).rejects.toThrow("Unique constraint!");
    });

    it("should fail at storing an empty document", async () => {
      const db = new ViewDB();
      const collection = db.collection("documents");
      await expect(collection.insert!(1 as any)).rejects.toThrow("Document must be object");
    });

    it("#insert bulk should work", async () => {
      const db = new ViewDB();
      const collection = db.collection("documents");
      await collection.insert!([{ a: 1 }, { b: 2 }]);
      const res = await collection.count!();
      expect(res).toBe(2);
    });
  });

  describe("#save", () => {
    it("should save multiple", async () => {
      const db = new ViewDB();
      const collection = db.collection("documents");
      await collection.insert!([
        { _id: 1, a: 1 },
        { _id: 2, b: 2 },
      ]);
      await collection.save!([
        { _id: 1, a: 10 },
        { _id: 2, b: 20 },
      ]);
      const res = await collection.find({}).toArray();
      expect(res.length).toBe(2);
      expect(res[0].a).toBe(10);
      expect(res[1].b).toBe(20);
    });

    it("should add id on insert if missing", async () => {
      const db = new ViewDB();
      const collection = db.collection("documents");
      await collection.save!({ a: 1 });
      await collection.save!({ b: 1 });
      const result = await collection.count!();
      expect(result).toBe(2);
    });

    it("should add document on save", async () => {
      const db = new ViewDB();
      const collection = db.collection("documents");
      await collection.save!({ a: 1 });
      const count = await collection.count!();
      expect(count).toBe(1);
    });

    it("should merge if id exists", async () => {
      const db = new ViewDB();
      const collection = db.collection("documents");
      const docs = await collection.save!({ a: 1 });
      docs[0]["b"] = 2;
      await collection.save!(docs);
      const count = await collection.count!();
      expect(count).toBe(1);
    });
  });

  describe("#find", () => {
    it("find all documents", async () => {
      const db = new ViewDB();
      const collection = db.collection("documents");
      await collection.insert!({ a: 1 });
      const docs = await collection.find({}).toArray();
      expect(docs.length).toBe(1);
      expect(docs[0].a).toBe(1);
    });

    it("find one document", async () => {
      const db = new ViewDB();
      const collection = db.collection("documents");
      const ids = await collection.insert!({ a: 1 });
      const docs = await collection.find({ _id: ids[0]._id }).toArray();
      expect(docs.length).toBe(1);
      expect(docs[0].a).toBe(1);
    });

    it("should return empty collection if query does not match", async () => {
      const db = new ViewDB();
      const collection = db.collection("documents");
      await collection.insert!({ a: 1 });
      const docs = await collection.find({ _id: 5 }).toArray();
      expect(docs.length).toBe(0);
    });
  });

  describe("#remove", () => {
    it("should remove one document matching a query", async () => {
      const db = new ViewDB();
      const collection = db.collection("documents");
      await collection.insert!({ a: 1, name: "hello" });
      await collection.remove!({ name: "hello" });
      const res = await collection.find({}).toArray();
      expect(res.length).toBe(0);
    });

    it("shouldnt do anything when no documents are matched against the query", async () => {
      const db = new ViewDB();
      const collection = db.collection("documents");
      await collection.insert!({ a: 1, name: "hello" });
      await collection.remove!({ name: "world" });
      const res = await collection.find({}).toArray();
      expect(res.length).toBe(1);
    });
  });

  describe("#drop", () => {
    it("should remove all documents", async () => {
      const store = new ViewDB();
      await store.open();
      await store.collection("dollhouse").insert!({ _id: "echo" });
      await store.collection("dollhouse").drop!();
      const results = await store.collection("dollhouse").find({}).toArray();
      expect(results.length).toBe(0);
    });
  });
});
