import { describe, expect, it } from "vitest";
import { projectDocument } from "./utils";

describe("Project document", () => {
  it("#Should pick property", () => {
    const result = projectDocument({ alfa: "abc" }, { alfa: 1 });
    expect(result).toEqual({ alfa: "abc" });
  });

  it("#Should pick property from nested object", () => {
    const result = projectDocument({ alfa: { bravo: { charlie: 1, delta: 2 }, echo: 3 } }, { alfa: { bravo: { delta: 1 } } });
    expect(result).toEqual({ alfa: { bravo: { delta: 2 } } });
  });

  it("#Should pick property from nested array", () => {
    const result = projectDocument(
      {
        alfa: {
          bravo: [
            { delta: 1, echo: 1 },
            { delta: 2, echo: 2 },
          ],
        },
      },
      { alfa: { bravo: { delta: 1 } } }
    );

    expect(result).toEqual({ alfa: { bravo: [{ delta: 1 }, { delta: 2 }] } });
  });

  it("#Should pick nested property from nested array", () => {
    const result = projectDocument(
      {
        alfa: {
          bravo: [
            { delta: 1, echo: { foxtrot: 2, gemini: 3 } },
            { delta: 4, echo: { foxtrot: 5, gemini: 6 } },
          ],
        },
      },
      { alfa: { bravo: { echo: { gemini: 1 } } } }
    );

    expect(result).toEqual({ alfa: { bravo: [{ echo: { gemini: 3 } }, { echo: { gemini: 6 } }] } });
  });

  it("#Should support exclude paths", () => {
    const result = projectDocument({ alfa: 1, bravo: 2, charlie: 3, delta: 4 }, { bravo: 0 });
    expect(result).toEqual({ alfa: 1, charlie: 3, delta: 4 });
  });

  it("#Should support multiple exclude paths", () => {
    const result = projectDocument({ alfa: 1, bravo: 2, charlie: 3, delta: { echo: 4, foxtrot: 5 } }, { bravo: 0, delta: { echo: 0 } });
    expect(result).toEqual({ alfa: 1, charlie: 3, delta: { foxtrot: 5 } });
  });
});
