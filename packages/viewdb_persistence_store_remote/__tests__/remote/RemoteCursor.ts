import SocketMock from "socket.io-mock";
import { ViewDB as ViewDB } from "viewdb";
import RemoteStore from "../../src/client/RemoteStore";
import RequestResponseClient from "../../src/client/RequestResponseClient";
import HybridStore from "../../src/hybrid/HybridStore";
import ViewDBSocketServer from "../../src/server/ViewDBSocketServer";

describe("Remote server/client", function () {
  let clientVdb, remote, socketServer, socketClient, clientStore, client;
  beforeEach(() => {
    socketServer = new SocketMock();
    socketClient = socketServer.socketClient;
    client = new RequestResponseClient(socketClient);
    clientStore = new RemoteStore(client);
    clientVdb = new ViewDB(clientStore);
    remote = new ViewDB();
    new ViewDBSocketServer(remote, socketServer);
  });

  it("#socketMock should work", () =>
    new Promise<void>((resolve) => {
      socketClient.on("ping", function (message) {
        expect(message).toBe("Hello");
        socketClient.emit("pong", "heya");
      });
      socketServer.on("pong", function (message) {
        expect(message).toBe("heya");
        resolve();
      });
      socketServer.emit("ping", "Hello");
    }));

  it("#remote query", async () => {
    await remote.collection("dollhouse").insert!({ _id: "echo", test: "success" });
    const res = await clientVdb.collection("dollhouse").find({ _id: "echo" }).toArray();
    expect(res[0].test).toBe("success");
  });

  it("#remote cursor sort should not trigger refresh when not observing", function () {
    const collection = clientVdb.collection("dollhouse");
    let changes = 0;
    collection.on("change", function () {
      changes++;
    });

    collection.find({ _id: "echo" }).sort({ _id: 1 });

    expect(changes).toBe(0);
  });

  it("#remote cursor count", async () => {
    await remote.collection("dollhouse").insert!({ _id: "echo" });
    await remote.collection("dollhouse").insert!({ _id: "echo2" });
    const res = await clientVdb.collection("dollhouse").find({ _id: "echo" }).count();
    expect(res).toBe(1);
  });

  it("#remote cursor count should use skip/limit from cursor", async () => {
    await remote.collection("dollhouse").insert!({ _id: "echo" });
    await remote.collection("dollhouse").insert!({ _id: "echo2" });
    await remote.collection("dollhouse").insert!({ _id: "echo3" });
    const res = await clientVdb.collection("dollhouse").find({}).skip(1).limit(1).count();
    expect(res).toBe(1);
  });

  it("#remote cursor count should use skip from options", async () => {
    await remote.collection("dollhouse").insert!({ _id: "echo" });
    await remote.collection("dollhouse").insert!({ _id: "echo2" });
    await remote.collection("dollhouse").insert!({ _id: "echo3" });
    const res = await (clientVdb.collection("dollhouse").find({}) as any).count({ skip: 1 });
    expect(res).toBe(2);
  });

  it("#remote cursor count should use limit from options", async () => {
    await remote.collection("dollhouse").insert!({ _id: "echo" });
    await remote.collection("dollhouse").insert!({ _id: "echo2" });
    await remote.collection("dollhouse").insert!({ _id: "echo3" });
    const res = await (clientVdb.collection("dollhouse").find({}) as any).count({ limit: 2 });
    expect(res).toBe(2);
  });

  it("#remote collection count", () =>
    new Promise<void>((resolve) => {
      remote.collection("dollhouse").insert({ _id: "echo" });
      remote.collection("dollhouse").insert({ _id: "echo2" });
      clientVdb.collection("dollhouse").count({ _id: "echo" }, function (_err, res) {
        expect(res).toBe(1);
        resolve();
      });
    }));

  it("#remote collection count with skip", () =>
    new Promise<void>((resolve) => {
      remote.collection("dollhouse").insert({ _id: "echo" });
      remote.collection("dollhouse").insert({ _id: "echo2" });
      clientVdb.collection("dollhouse").count({}, { skip: 1 }, function (_err, res) {
        expect(res).toBe(1);
        resolve();
      });
    }));

  it("#remote collection count with limit", () =>
    new Promise<void>((resolve) => {
      remote.collection("dollhouse").insert({ _id: "echo" });
      remote.collection("dollhouse").insert({ _id: "echo2" });
      clientVdb.collection("dollhouse").count({}, { limit: 1 }, function (_err, res) {
        expect(res).toBe(1);
        resolve();
      });
    }));

  it("#remote collection observe", () =>
    new Promise<void>((resolve) => {
      remote.collection("dollhouse").insert({ _id: "echo" });
      remote.collection("dollhouse").insert({ _id: "echo2" });
      const cursor = clientVdb.collection("dollhouse").find({ _id: { $in: ["echo2", "echo3"] } });
      cursor.observe({
        init: function (init) {
          expect(init.length).toBe(1);
        },
        added: function (a) {
          expect(a._id).toBe("echo3");
          resolve();
        },
      });
      remote.collection("dollhouse").insert({ _id: "echo3" });
    }));

  it("#remote collection observe should call init again on reconnected", () =>
    new Promise<void>((resolve) => {
      remote.collection("dollhouse").insert({ _id: "echo2" });
      const cursor = clientVdb.collection("dollhouse").find({ _id: { $in: ["echo2", "echo3"] } });
      let inits = 0;
      cursor.observe({
        init: function (init) {
          inits++;
          if (inits === 1) {
            expect(init.length).toBe(1);
            remote.collection("dollhouse").insert({ _id: "echo3" });
            client.onClientReconnected();
          } else if (inits === 2) {
            expect(init.length).toBe(2);
            resolve();
          }
        },
      });
    }));

  it("#remote collection observe should continue to work on reconnected", () =>
    new Promise<void>((resolve) => {
      remote.collection("dollhouse").insert({ _id: "echo2" });
      const cursor = clientVdb.collection("dollhouse").find({ _id: { $in: ["echo2", "echo3"] } });
      let inits = 0;
      cursor.observe({
        init: function (init) {
          inits++;
          expect(init.length).toBe(1);
          if (inits === 1) {
            client.onClientReconnected();
            remote.collection("dollhouse").insert({ _id: "echo3" });
          } else {
            expect(inits).toBe(2);
          }
        },
        added: function (item) {
          expect(item._id).toBe("echo3");
          remote.collection("dollhouse").save({ _id: "echo3", updated: true });
        },
        changed: function (_asis, tobe) {
          expect(tobe.updated).toBe(true);
          resolve();
        },
      });
    }));

  it("#remote reconnected should work with hybrid", () =>
    new Promise<void>((resolve) => {
      remote.collection("dollhouse").insert({ _id: "echo2" });
      const local = new ViewDB();
      const hybrid = new ViewDB(new (HybridStore as any)(local, clientStore, { throttleObserveRefresh: 0 }));
      let list = [];
      let changes = 0;
      hybrid.open().then(function () {
        const cursor = hybrid.collection("dollhouse").find({ _id: { $in: ["echo2"] } });
        cursor.observe({
          init: function (init) {
            list = init;
          },
          added: function (_element, index) {
            list.splice(index, 1);
            remote.collection("dollhouse").save({ _id: "echo2", changed: 1 });
            client.onClientReconnected();
          },
          changed: function (_asis, tobe, index) {
            changes++;
            remote.collection("dollhouse").save({ _id: "echo2", changed: 2 });
            list[index] = tobe;
            expect(list.length).toBe(1);
            if (changes === 2) {
              resolve();
            }
          },
        });
      });
    }));
});
