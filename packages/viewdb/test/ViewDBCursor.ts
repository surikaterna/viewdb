import { ViewDB } from "..";
import ViewDBCursor from "../src/ViewDBCursor";

describe("Cursor", () => {
  it("#toArray", async () => {
    const cursor = new ViewDBCursor(null, {}, () => Promise.resolve([{ v: 1 }, { v: 2 }, { v: 3 }, { v: 4 }]));
    const result = await cursor.toArray();
    expect(result.length).toBe(4);
  });
  it("#forEach", () =>
    new Promise<void>((resolve) => {
      const cursor = new ViewDBCursor(null, {}, () => Promise.resolve([{ v: 1 }, { v: 2 }, { v: 3 }, { v: 4 }]));
      let calls = 0;
      cursor.forEach((result) => {
        expect(result).toBeTruthy();
        calls++;
      });
      setTimeout(() => {
        expect(calls).toBe(4);
        resolve();
      }, 0);
    }));
  it("#skip", async () => {
    const db = new ViewDB();
    const collection = db.collection("documents");
    for (let i = 0; i < 10; i++) {
      await collection.insert!({ a: "a", id: i });
    }
    const res = await collection.find({ a: "a" }).skip(5).toArray();
    expect(res.length).toBe(5);
  });

  it("#limit", async () => {
    const db = new ViewDB();
    const collection = db.collection("documents");
    for (let i = 0; i < 10; i++) {
      await collection.insert!({ a: "a", id: i });
    }
    const res = await collection.find({ a: "a" }).limit(9).toArray();
    expect(res[8].id).toBe(8);
    expect(res.length).toBe(9);
  });

  it("#sort", async () => {
    const db = new ViewDB();
    const collection = db.collection("documents");
    for (let i = 0; i < 10; i++) {
      await collection.insert!({ a: "a", id: i });
    }
    const res = await collection.find({}).sort({ id: 1 }).toArray();
    expect(res[0].id).toBe(0);
  });

  it("#sort desc", async () => {
    const db = new ViewDB();
    const collection = db.collection("documents");
    for (let i = 0; i < 10; i++) {
      await collection.insert!({ a: "a", id: i });
    }
    const res = await collection.find({}).sort({ id: -1 }).toArray();
    expect(res[0].id).toBe(9);
  });

  it("#skip/limit", async () => {
    const db = new ViewDB();
    const collection = db.collection("documents");
    for (let i = 0; i < 10; i++) {
      await collection.insert!({ a: "a", id: i });
    }
    const res = await collection.find({ a: "a" }).skip(8).limit(10).toArray();
    expect(res[1].id).toBe(9);
    expect(res.length).toBe(2); // only 2 left after skipping 8/10
  });
});
