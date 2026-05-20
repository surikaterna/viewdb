import should from "should";
import reconcile from "../../src/hybrid/reconcile";

const reconcileAny: any = reconcile;

describe("Reconcile", function () {
  it("#reconcile should return remote docs if only remote", function () {
    reconcileAny([], [{ _id: "1" }]).length.should.equal(1);
  });

  it("#reconcile should return local docs if only local", function () {
    reconcileAny([{ _id: "1" }], []).length.should.equal(1);
  });
  it("#reconcile should return empty if no local or remote docs", function () {
    reconcileAny([], []).length.should.equal(0);
  });
  it("#reconcile should return all docs if local and remote docs do not match", function () {
    reconcileAny([{ _id: "1" }, { _id: "2" }], [{ _id: "3" }, { _id: "4" }]).length.should.equal(4);
  });
  it("#reconcile should return some docs if local and remote docs do match", function () {
    reconcileAny([{ _id: "1" }, { _id: "2" }], [{ _id: "1" }, { _id: "2" }]).length.should.equal(2);
  });
  it("#reconcile should return remote docs if local and remote docs do match", function () {
    const result = reconcileAny(
      [{ _id: "1" }, { _id: "2" }],
      [
        { _id: "1", a: 1 },
        { _id: "2", a: 2 },
      ]
    );
    result[0].should.have.property("a");
    result[1].should.have.property("a");
  });
  it("#reconcile should return local docs if local and remote docs do match and local version higher", function () {
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
    result[0].should.not.have.property("a");
    result[1].should.not.have.property("a");
  });
  it("#reconcile should return remote docs if local and remote docs do match and remote version higher", function () {
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
    result[0].should.have.property("a");
    result[1].should.have.property("a");
  });
  it("#reconcile should work timely with large arrays", function () {
    const local = [];
    const remote = [];
    for (let i = 0; i < 1000; i++) {
      local.push({ _id: String(i), version: 1 });
      remote.push({ _id: String(i), version: 1 });
    }
    const start = new Date().getTime();
    const result = reconcileAny(local, remote);
    const end = new Date().getTime();
    (end - start).should.be.below(500);
  });
  it("#reconcile should not break if local contain duplicates, and should update to newest version of local copy", function () {
    const result = reconcileAny(
      [
        { _id: "1", version: 1 },
        { _id: "1", version: 2 },
      ],
      [{ _id: "1", version: 1 }]
    );
    result[0].version.should.equal(2);
  });
  it("#reconcile should not break if local contain duplicates, and should get best copy with version", function () {
    const result = reconcileAny([{ _id: "1" }, { _id: "1", version: 1 }], [{ _id: "1" }]);
    result[0].version.should.equal(1);
  });
});
