import { beforeEach, describe, expect, it } from "vitest";
import { QueryCompiler } from "./QueryCompiler";

describe("QueryCompiler", () => {
  let compiler: QueryCompiler;

  beforeEach(() => {
    compiler = new QueryCompiler();
  });

  describe("compile", () => {
    it("compile ne null query", () => {
      const query = {
        attachmentId: { $ne: null },
      };

      expect(() => compiler.compile(query)).not.toThrow();
    });
  });

  describe("compilePredicates", () => {
    it("compile eq query", () => {
      const p = compiler.compilePredicates({ age: 10 });
      expect(p[0]({ age: 10 })).toBe(true);
    });
  });

  describe("subQuery", () => {
    it("compile eq query", () => {
      const p = compiler.subQuery([{ age: 10 }]);
      // @ts-expect-error FIXME
      expect(p[0]({ age: 10 })).toBe(true);
    });
  });
});
