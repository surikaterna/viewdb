import _ from "lodash";
import SocketMock from "socket.io-mock";
import { ViewDB } from "viewdb";
import RemoteStore from "../../src/client/RemoteStore";
import RequestResponseClient from "../../src/client/RequestResponseClient";
import HybridStore from "../../src/hybrid/HybridStore";
import ViewDBSocketServer from "../../src/server/ViewDBSocketServer";

describe("Observe-Update Remote", () => {
  let clientRemote, serverViewdb, socketServer, socketClient, clientStore, client, clientLocal, hybrid;
  beforeEach(
    () =>
      new Promise<void>((resolve) => {
        socketServer = new SocketMock();
        socketClient = socketServer.socketClient;
        client = new RequestResponseClient(socketClient);
        serverViewdb = new ViewDB();
        const vdbSocketServer = new ViewDBSocketServer(serverViewdb, socketServer);

        clientLocal = new ViewDB(); // client local viewdb (typically IndexedDB)
        clientStore = new RemoteStore(client);
        clientRemote = new ViewDB(clientStore); // client remote viewdb
        hybrid = new ViewDB(new (HybridStore as any)(clientLocal, clientRemote, { throttleObserveRefresh: 0 }));

        resolve();
      })
  );
  it("#viewdb server+hybrid setup should work", () =>
    new Promise<void>((resolve) => {
      const id = "1";
      let called = 0;
      serverViewdb.collection("dollhouse").insert({ _id: id });
      hybrid
        .collection("dollhouse")
        .find({ _id: id })
        .toArray(() => {
          if (called === 0) {
            called++;
          } else {
            resolve();
          }
        });
    }));
  it("#old docs should be removed on updateQuery", () =>
    new Promise<void>((resolve) => {
      let id = "1";
      serverViewdb.collection("dollhouse").insert({ _id: id });
      const hybridCursor = hybrid.collection("dollhouse").find({ _id: id });
      const realDone = _.after(6, resolve);

      const handle = hybridCursor.observe({
        init: () => {
          realDone(); // 1 call
        },
        added: (x) => {
          realDone(); // 3 calls
          expect(x._id).toBe(id);
          if (x._id === "3") {
            handle.stop();
          } else {
            id = String(Number(id) + 1);
            hybridCursor.updateQuery({ _id: id });
            serverViewdb.collection("dollhouse").insert({ _id: id });
          }
        },
        removed: () => {
          realDone(); // 2 calls
        },
      });
      serverViewdb.collection("dollhouse").insert({ _id: "echo2" });
    }));
  it("#update query from client", () =>
    new Promise<void>((resolve) => {
      let id = "1";
      serverViewdb.collection("dollhouse").insert({ _id: id });
      const hybridCursor = hybrid.collection("dollhouse").find({ _id: id });

      const handle = hybridCursor.observe({
        added: (x) => {
          expect(x._id).toBe(id);
          if (x._id === "3") {
            handle.stop();
            resolve();
          } else {
            id = String(Number(id) + 1);
            hybridCursor.updateQuery({ _id: id });
            serverViewdb.collection("dollhouse").insert({ _id: id });
          }
        },
      });
      serverViewdb.collection("dollhouse").insert({ _id: "echo2" });
    }));
  it("#observe-update with update from server $in query", () =>
    new Promise<void>((resolve) => {
      serverViewdb.collection("dollhouse").insert({ _id: "1" });
      const realDone = _.after(2, resolve);
      const hybridCursor = hybrid.collection("dollhouse").find({ _id: { $in: ["1", "2"] } });

      const handle = hybridCursor.observe({
        added: (x) => {
          if (x._id === "3") {
            handle.stop();
            realDone();
          } else {
            hybridCursor.updateQuery({ _id: { $in: ["2", "3"] } });
            serverViewdb.collection("dollhouse").insert({ _id: "3" });
          }
        },
        removed: (x) => {
          expect(x._id).toBe("1");
          realDone();
        },
      });
    }));
});
