import _ from "lodash";
import { ViewDB } from "viewdb";
import { SocketClient, Client as ViewDBRemoteClient } from "../../";
import HybridStore from "../../src/hybrid/HybridStore";

describe("Observe-Update", () => {
  let local = null;
  let remote = null;
  let hybrid = null;

  beforeEach(
    () =>
      new Promise<void>((resolve) => {
        local = new ViewDB();
        const socketIoMock = {
          emit: () => {},
          on: () => {},
        };
        remote = new ViewDBRemoteClient(new SocketClient(socketIoMock));
        hybrid = new ViewDB(new (HybridStore as any)(local, remote, { throttleObserveRefresh: 0 }));
        hybrid.open().then(() => {
          resolve();
        });
      })
  );

  it("#observe-update with update query", () =>
    new Promise<void>((resolve) => {
      let id = "1";
      local.collection("dollhouse").insert({ _id: id });
      const cursor = hybrid.collection("dollhouse").find({ _id: id });

      const handle = cursor.observe({
        added: (x) => {
          expect(x._id).toBe(id);
          if (x._id === "3") {
            handle.stop();
            resolve();
          } else {
            id = String(Number(id) + 1);
            cursor.updateQuery({ _id: id });
            local.collection("dollhouse").insert({ _id: id });
          }
        },
      });
      local.collection("dollhouse").insert({ _id: "echo2" });
    }));
  it("#observe-update with update $in query", () =>
    new Promise<void>((resolve) => {
      local.collection("dollhouse").insert({ _id: "1" });
      const realDone = _.after(2, resolve);
      const cursor = hybrid.collection("dollhouse").find({ _id: { $in: ["1", "2"] } });

      const handle = cursor.observe({
        added: (x) => {
          if (x._id === "3") {
            handle.stop();
            realDone();
          } else {
            cursor.updateQuery({ _id: { $in: ["2", "3"] } });
            local.collection("dollhouse").insert({ _id: "3" });
          }
        },
        removed: (x) => {
          expect(x._id).toBe("1");
          realDone();
        },
      });
    }));
});
