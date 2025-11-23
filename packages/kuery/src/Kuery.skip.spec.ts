import { describe, expect, it } from "vitest";
import { Kuery } from "./Kuery";

const collection = [
  {
    id: 1,
    name: "Andreas",
    address: { street: "Bellmansgatan" },
    born: new Date("1980-01-01T12:00:00.000Z"),
  },
  { id: 2, name: "Sven", born: new Date("1989-01-01T12:00:00.000Z") },
  { id: 3, name: "Christian", born: new Date("1990-01-01T12:00:00.000Z") },
  {
    id: 4,
    name: "Emil",
    girlfriends: [
      { name: "fanny", hotness: 10 },
      { name: "eve", hotness: 1000 },
    ],
    born: new Date("1982-01-01T12:00:00.000Z"),
  },
];

describe("Kuery", () => {
  describe("#skip", () => {
    it("should skip 2 documents", () => {
      const q = new Kuery({});
      q.skip(2);
      const r = q.find(collection);

      expect(r).toHaveLength(2);
      expect(r[0].id).toBe(3);
    });

    it("should skip 2 documents with query", () => {
      const q = new Kuery({ id: { $gt: 1 } });
      q.skip(2);
      const r = q.find(collection);

      expect(r).toHaveLength(1);
      expect(r[0].id).toBe(4);
    });
  });

  describe("#limit", () => {
    it("should limit 2 documents", () => {
      const q = new Kuery({});
      q.limit(2);
      const r = q.find(collection);

      expect(r).toHaveLength(2);
      expect(r[0].id).toBe(1);
    });

    it("should limit 2 documents with query", () => {
      const q = new Kuery({ id: { $gt: 1 } });
      q.limit(2);
      const r = q.find(collection);

      expect(r).toHaveLength(2);
      expect(r[0].id).toBe(2);
    });

    it("should limit 2, skip 1 documents with query", () => {
      const q = new Kuery({ id: { $gt: 1 } });
      q.limit(2).skip(1);
      const r = q.find(collection);

      expect(r).toHaveLength(2);
      expect(r[0].id).toBe(3);
    });
  });

  describe("#sort", () => {
    it("should sort on one property", () => {
      const q = new Kuery({});
      q.sort({ born: 1 });
      const r = q.find(collection);

      expect(r).toHaveLength(collection.length);
      expect(r[0].born).toEqual(collection[0].born);
      expect(r[1].born).toEqual(collection[3].born);
    });

    it("should sort ands skip", () => {
      const q = new Kuery({});
      q.sort({ born: -1 });
      q.skip(1);
      const r = q.find(collection);

      expect(r[0].name).toBe("Sven");
    });
  });
});
