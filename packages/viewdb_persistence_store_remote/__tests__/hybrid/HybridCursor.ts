import { ViewDBCursor as LocalCursor } from "viewdb";
import HybridCursor from "../../src/hybrid/HybridCursor";

const LocalCursorAny: any = LocalCursor;

describe("Cursor", () => {
  it("#toArray should return remote", () =>
    new Promise<void>((resolve) => {
      const lcursor = new LocalCursorAny(null, {}, null, () => Promise.resolve([{ _id: "1" }, { _id: "2" }]));
      const rcursor = new LocalCursorAny(null, {}, null, () => Promise.resolve([{ _id: "1" }, { _id: "2" }]));
      const hcursor = new HybridCursor({}, lcursor, rcursor, {}, {});
      hcursor.toArray((_err, result) => {
        expect(result.length).toBe(2);
        resolve();
      });
    }));
  it("#toArray with localFirst should call callback twice", () =>
    new Promise<void>((resolve) => {
      const lcursor = new LocalCursorAny(null, {}, null, () => Promise.resolve([{ _id: "1" }, { _id: "2" }]));
      const rcursor = new LocalCursorAny(null, {}, null, () => Promise.resolve([{ _id: "1" }, { _id: "2" }]));
      const hcursor = new HybridCursor({}, lcursor, rcursor, {}, { localFirst: true });
      let calls = 0;
      hcursor.toArray((_err) => {
        if (++calls === 2) {
          resolve();
        }
      });
    }));
  it("#toArray with localFirst false should call callback once", () =>
    new Promise<void>((resolve) => {
      const lcursor = new LocalCursorAny(null, {}, null, () => Promise.resolve([{ _id: "1" }, { _id: "2" }]));
      const rcursor = new LocalCursorAny(null, {}, null, () => Promise.resolve([{ _id: "1" }, { _id: "2" }]));
      const hcursor = new HybridCursor({}, lcursor, rcursor, {}, { localFirst: false });
      hcursor.toArray((_err) => {
        resolve();
      });
    }));
  it("#toArray with versions should merge correctly", () =>
    new Promise<void>((resolve) => {
      const lcursor = new LocalCursorAny(null, {}, null, () =>
        Promise.resolve([
          { _id: "1", version: 1, local: true },
          { _id: "2", version: 2, local: true },
        ])
      );
      const rcursor = new LocalCursorAny(null, {}, null, () =>
        Promise.resolve([
          { _id: "1", version: 2, local: false },
          { _id: "2", version: 1, local: false },
        ])
      );
      const hcursor = new HybridCursor({}, lcursor, rcursor, {}, { localFirst: false });
      hcursor.toArray((_err, result) => {
        expect(result[0].local).not.toBe(true);
        expect(result[1].local).toBe(true);
        resolve();
      });
    }));

  it("#toArray with local data first should return correctly", () =>
    new Promise<void>((resolve) => {
      const lcursor = new LocalCursorAny(
        null,
        {},
        null,
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve([
                { _id: "1", version: 1, local: true },
                { _id: "2", version: 2, local: true },
              ]);
            }, 10);
          })
      );
      const rcursor = new LocalCursorAny(null, {}, null, () =>
        Promise.resolve([
          { _id: "1", version: 2, local: false },
          { _id: "2", version: 1, local: false },
        ])
      );
      const hcursor = new HybridCursor({}, lcursor, rcursor, {}, { localFirst: false });
      hcursor.toArray((_err, result) => {
        expect(result[0].local).not.toBe(true);
        expect(result[1].local).toBe(true);
        resolve();
      });
    }));
  it("#toArray should throw on local error", () =>
    new Promise<void>((resolve) => {
      const lcursor = new LocalCursorAny(null, {}, null, () => Promise.reject(new Error()));
      const rcursor = new LocalCursorAny(null, {}, null, () =>
        Promise.resolve([
          { _id: "1", version: 2, local: false },
          { _id: "2", version: 1, local: false },
        ])
      );
      const hcursor = new HybridCursor({}, lcursor, rcursor, {}, { localFirst: false });
      hcursor.toArray((err) => {
        expect(err).toBeTruthy();
        resolve();
      });
    }));
  it("#toArray should throw on remote error", () =>
    new Promise<void>((resolve) => {
      const lcursor = new LocalCursorAny(null, {}, null, () =>
        Promise.resolve([
          { _id: "1", version: 2, local: false },
          { _id: "2", version: 1, local: false },
        ])
      );
      const rcursor = new LocalCursorAny(null, {}, null, () => Promise.reject(new Error()));
      const hcursor = new HybridCursor({}, lcursor, rcursor, {}, { localFirst: false, throwRemoteErr: true });
      hcursor.toArray((err) => {
        expect(err).toBeTruthy();
        resolve();
      });
    }));
  it("#toArray should not throw on remote error if opted out", () =>
    new Promise<void>((resolve) => {
      const lcursor = new LocalCursorAny(null, {}, null, () =>
        Promise.resolve([
          { _id: "1", version: 2, local: false },
          { _id: "2", version: 1, local: false },
        ])
      );
      const rcursor = new LocalCursorAny(null, {}, null, () => Promise.reject(new Error()));
      const hcursor = new HybridCursor({}, lcursor, rcursor, {}, { localFirst: false, throwRemoteErr: false });
      hcursor.toArray((err, result) => {
        expect(err).toBeNull();
        expect(result.length).toBe(2);
        resolve();
      });
    }));
  it("#toArray should not throw on using $elemMatch with $ne and $eq", () =>
    new Promise<void>((resolve) => {
      const query: any = { things: { $elemMatch: { name: { $eq: "banana" }, category: { $ne: "toy" } } } };
      const lcursor = new LocalCursorAny(
        null,
        query,
        null,
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve([
                {
                  _id: "1",
                  things: [
                    { name: "banana", category: "fruit" },
                    { name: "orange", category: "toy" },
                  ],
                  version: 1,
                  local: true,
                },
                {
                  _id: "2",
                  things: [
                    { name: "banana", category: "toy" },
                    { name: "orange", category: "fruit" },
                  ],
                  version: 2,
                  local: true,
                },
              ]);
            }, 10);
          })
      );
      const rcursor = new LocalCursorAny(null, query, null, () => Promise.reject(new Error()));
      const hcursor = new HybridCursor(query, lcursor, rcursor, {}, { localFirst: false, throwRemoteErr: false });
      hcursor.toArray((err, result) => {
        expect(err).toBeNull();
        expect(result.length).toBe(1);
        expect(result[0].things[0].name).toBe("banana");
        expect(result[0].things[0].category).toBe("fruit");
        resolve();
      });
    }));
  it("#toArray should not throw on remote error if opted out and delayed local response", () =>
    new Promise<void>((resolve) => {
      const lcursor = new LocalCursorAny(
        null,
        {},
        null,
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve([
                { _id: "1", version: 1, local: true },
                { _id: "2", version: 2, local: true },
              ]);
            }, 10);
          })
      );
      const rcursor = new LocalCursorAny(null, {}, null, () => Promise.reject(new Error()));
      const hcursor = new HybridCursor({}, lcursor, rcursor, {}, { localFirst: false, throwRemoteErr: false });
      hcursor.toArray((err, result) => {
        expect(err).toBeNull();
        expect(result.length).toBe(2);
        resolve();
      });
    }));
  it("#toArray should throw on remote error if not opted out and delayed local response", () =>
    new Promise<void>((resolve) => {
      const lcursor = new LocalCursorAny(
        null,
        {},
        null,
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve([
                { _id: "1", version: 1, local: true },
                { _id: "2", version: 2, local: true },
              ]);
            }, 10);
          })
      );
      const rcursor = new LocalCursorAny(null, {}, null, () => Promise.reject(new Error()));
      const hcursor = new HybridCursor({}, lcursor, rcursor, {}, { localFirst: false, throwRemoteErr: true });
      hcursor.toArray((err) => {
        expect(err).toBeTruthy();
        resolve();
      });
    }));
});
