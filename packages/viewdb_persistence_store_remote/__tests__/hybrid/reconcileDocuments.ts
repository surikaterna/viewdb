import reconcile from "../../src/hybrid/reconcile";

const reconcileAny: any = reconcile;

describe("Reconcile", () => {
  it("#reconcile should return remote docs if only remote", () => {
    expect(reconcileAny([], [{ _id: "1" }]).length).toBe(1);
  });

  it("#reconcile should return local docs if only local", () => {
    expect(reconcileAny([{ _id: "1" }], []).length).toBe(1);
  });
  it("#reconcile should return empty if no local or remote docs", () => {
    expect(reconcileAny([], []).length).toBe(0);
  });
  it("#reconcile should return all docs if local and remote docs do not match", () => {
    expect(reconcileAny([{ _id: "1" }, { _id: "2" }], [{ _id: "3" }, { _id: "4" }]).length).toBe(4);
  });
  it("#reconcile should return some docs if local and remote docs do match", () => {
    expect(reconcileAny([{ _id: "1" }, { _id: "2" }], [{ _id: "1" }, { _id: "2" }]).length).toBe(2);
  });
  it("#reconcile should return remote docs if local and remote docs do match", () => {
    const result = reconcileAny(
      [{ _id: "1" }, { _id: "2" }],
      [
        { _id: "1", a: 1 },
        { _id: "2", a: 2 },
      ]
    );
    expect(result[0]).toHaveProperty("a");
    expect(result[1]).toHaveProperty("a");
  });
  it("#reconcile should return local docs if local and remote docs do match and local version higher", () => {
    const result = reconcileAny(
      [
        { _id: "1", version: 2 },
        { _id: "2", version: 2 },
      ],
      [
        { _id: "1", a: 1, version: 1 },
        { _id: "2", a: 2, version: 1 },
      ]
    );
    expect(result[0]).not.toHaveProperty("a");
    expect(result[1]).not.toHaveProperty("a");
  });
  it("#reconcile should return remote docs if local and remote docs do match and remote version higher", () => {
    const result = reconcileAny(
      [
        { _id: "1", version: 1 },
        { _id: "2", version: 1 },
      ],
      [
        { _id: "1", a: 1, version: 2 },
        { _id: "2", a: 2, version: 2 },
      ]
    );
    expect(result[0]).toHaveProperty("a");
    expect(result[1]).toHaveProperty("a");
  });
  it("#reconcile should work timely with large arrays", () => {
    const local = [];
    const remote = [];
    for (let i = 0; i < 1000; i++) {
      local.push({ _id: String(i), version: 1 });
      remote.push({ _id: String(i), version: 1 });
    }
    const start = new Date().getTime();
    const result = reconcileAny(local, remote);
    const end = new Date().getTime();
    expect(end - start).toBeLessThan(500);
  });
  it("#reconcile should not break if local contain duplicates, and should update to newest version of local copy", () => {
    const result = reconcileAny(
      [
        { _id: "1", version: 1 },
        { _id: "1", version: 2 },
      ],
      [{ _id: "1", version: 1 }]
    );
    expect(result[0].version).toBe(2);
  });
  it("#reconcile should not break if local contain duplicates, and should get best copy with version", () => {
    const result = reconcileAny([{ _id: "1" }, { _id: "1", version: 1 }], [{ _id: "1" }]);
    expect(result[0].version).toBe(1);
  });
});
