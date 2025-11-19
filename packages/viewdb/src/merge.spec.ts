import defaults from "lodash/defaults";
import isEqual from "lodash/isEqual";
import { describe, expect, it } from "vitest";
import { merge } from "./merge";

describe("Merger", () => {
  it("#merge with remove element", () =>
    new Promise<void>((done) => {
      const firstList = [{ a: 1 }, "b", "d"];
      const secondList = [{ a: 1 }, "b"];

      const result = merge(firstList, secondList, {
        removed: (item) => {
          expect(item).toBe("d");
          done();
        },
        comparatorId: isEqual,
        comparator: isEqual,
      });

      expect(isEqual(secondList, result)).toBe(true);
    }));

  it("#merge with remove complex element", () =>
    new Promise<void>((done) => {
      const firstList = [{ a: 1 }, "b", "d", { e: 1 }];
      const secondList = [{ a: 1 }, "b"];
      const removed = [];

      const result = merge(firstList, secondList, {
        removed: (item) => {
          removed.push(item);
        },
        comparatorId: isEqual,
        comparator: isEqual,
      });

      expect(removed.length).toBe(2);
      expect(isEqual(secondList, result)).toBe(true);
      done();
    }));

  it("#merge with objects instead of arrays", () =>
    new Promise<void>((done) => {
      const firstList = { 0: { a: 1 }, 1: "b", 2: "d", 3: { e: 1 } };
      const secondList = [{ a: 1 }, "b"];
      const removed = [];

      // @ts-expect-error FIXME
      const result = merge(firstList, secondList, {
        removed: (e) => {
          removed.push(e);
        },
        comparatorId: isEqual,
        comparator: isEqual,
      });

      expect(removed.length).toBe(2);
      expect(isEqual(secondList, result)).toBe(true);
      done();
    }));

  it("#merge with one add element", () =>
    new Promise<void>((done, fail) => {
      const firstList = [{ a: 1 }, "b"];
      const secondList = [{ a: 1 }, "b", "c"];

      const result = merge(firstList, secondList, {
        added: (item) => {
          expect(item).toBe("c");
          done();
        },
        removed: () => {
          fail(new Error("should not be called"));
        },
      });

      expect(isEqual(secondList, result)).toBe(true);
    }));

  it("#merge with one complex add element", () =>
    new Promise<void>((done, fail) => {
      const firstList = [{ a: 1 }, "b"];
      const secondList = [{ a: 1 }, "b", { c: 1 }];

      // @ts-expect-error FIXME
      const result = merge(firstList, secondList, {
        added: (item) => {
          expect(isEqual(item, { c: 1 })).toBe(true);
          done();
        },
        removed: () => {
          fail(new Error("should not be called"));
        },
      });

      expect(isEqual(secondList, result)).toBe(true);
    }));

  it("#merge with one move element", () =>
    new Promise<void>((done, fail) => {
      const firstList = [{ a: 1 }, "b", { c: 1 }];
      const secondList = [{ a: 1 }, { c: 1 }, "b"];
      const moved = [];

      const result = merge(firstList, secondList, {
        added: () => {
          fail(new Error("should not be called"));
        },
        removed: () => {
          fail(new Error("should not be called"));
        },
        moved: (e, oldIndex, newIndex) => {
          moved.push([e, oldIndex, newIndex]);
        },
      });

      expect(moved.length).toBe(1);
      expect(isEqual(secondList, result)).toBe(true);
      done();
    }));

  it("#merge with one changing elements", () =>
    new Promise<void>((done, fail) => {
      const firstList = [{ _id: 1, a: "Hello" }];
      const secondList = [{ _id: 1, a: "Hej" }];

      const result = merge(firstList, secondList, {
        added: () => {
          fail(new Error("should not be called"));
        },
        removed: () => {
          fail(new Error("should not be called"));
        },
        moved: () => {
          fail(new Error("should not be called"));
        },
        changed: (o, n, index) => {},
        comparatorId: (a, b) => a._id === b._id,
      });

      expect(isEqual(secondList, result)).toBe(true);
      done();
    }));

  it("#merge true and false array", () => {
    const firstList = [true, false];
    const secondList = [false, true];
    const result = merge(firstList, secondList);

    expect(isEqual(secondList, result)).toBe(true);
  });

  it("#merge complex moves", () =>
    new Promise<void>((done) => {
      const firstList = [
        { _id: 1, a: "Hello1" },
        { _id: 2, a: "Hello2" },
        { _id: 3, a: "Hello3" },
        { _id: 4, a: "Hello4" },
      ];

      const secondList = [
        { _id: 4, a: "Hej4" },
        { _id: 3, a: "Hej3" },
        { _id: 2, a: "Hej2" },
        { _id: 1, a: "Hej1" },
      ];

      type Item = (typeof firstList)[number];

      const result = merge(
        firstList,
        secondList,
        defaults(
          {
            comparatorId: (a: Item, b: Item) => {
              return a._id === b._id;
            },
          },
          {}
        )
      );

      expect(isEqual(secondList, result)).toBe(true);
      done();
    }));

  it("#merge complex moves and add and remove", () =>
    new Promise<void>((done) => {
      const firstList = [
        { _id: 1, a: "Hello1" },
        { _id: 2, a: "Hello2" },
        { _id: 3, a: "Hello3" },
        { _id: 4, a: "Hello4" },
      ];

      const secondList = [
        { _id: 4, a: "Hej4" },
        { _id: 99, a: "Hej99" },
        { _id: 2, a: "Hej2" },
        { _id: 1, a: "Hej1" },
        { _id: 100, a: "Hej100" },
      ];

      type Item = (typeof firstList)[number];

      const result = merge(
        firstList,
        secondList,
        defaults(
          {
            comparatorId: (a: Item, b: Item) => a._id === b._id,
          },
          {}
        )
      );

      expect(isEqual(secondList, result)).toBe(true);
      done();
    }));
});
