import should from "should";
import SocketMock from "socket.io-mock";
import { ViewDB as ViewDb } from "viewdb";
import Client from "../../src/client/rr_client";
import Store from "../../src/client/store";
import HybridStore from "../../src/hybrid/store";
import ViewDbSocketServer from "../../src/server/server";

describe("Remote server/client", function () {
  let clientVdb, remote, socketServer, socketClient, clientStore, client;
  beforeEach(
    () =>
      new Promise<void>((resolve, reject) => {
        socketServer = new SocketMock();
        socketClient = socketServer.socketClient;
        client = new Client(socketClient);
        clientStore = new Store(client);
        clientVdb = new ViewDb(clientStore);
        remote = new ViewDb();
        const vdbSocketServer = new ViewDbSocketServer(remote, socketServer);
        resolve();
      })
  );
  it("#socketMock should work", () =>
    new Promise<void>((resolve, reject) => {
      socketClient.on("ping", function (message) {
        message.should.equal("Hello");
        socketClient.emit("pong", "heya");
      });
      socketServer.on("pong", function (message) {
        message.should.equal("heya");
        resolve();
      });
      socketServer.emit("ping", "Hello");
    }));
  it("#remote query", () =>
    new Promise<void>((resolve, reject) => {
      remote.collection("dollhouse").insert({ _id: "echo", test: "success" });
      clientVdb
        .collection("dollhouse")
        .find({ _id: "echo" })
        .toArray(function (err, res) {
          res[0].test.should.equal("success");
          resolve();
        });
    }));
  it("#remote cursor sort should not trigger refresh when not observing", function () {
    const collection = clientVdb.collection("dollhouse");
    let changes = 0;
    collection.on("change", function () {
      changes++;
    });

    collection.find({ _id: "echo" }).sort({ _id: 1 });

    changes.should.equal(0);
  });
  it("#remote cursor count", () =>
    new Promise<void>((resolve, reject) => {
      remote.collection("dollhouse").insert({ _id: "echo" });
      remote.collection("dollhouse").insert({ _id: "echo2" });
      clientVdb
        .collection("dollhouse")
        .find({ _id: "echo" })
        .count(function (err, res) {
          res.should.equal(1);
          resolve();
        });
    }));
  it("#remote cursor count should use skip/limit from cursor", () =>
    new Promise<void>((resolve, reject) => {
      remote.collection("dollhouse").insert({ _id: "echo" });
      remote.collection("dollhouse").insert({ _id: "echo2" });
      remote.collection("dollhouse").insert({ _id: "echo3" });
      clientVdb
        .collection("dollhouse")
        .find({})
        .skip(1)
        .limit(1)
        .count(function (err, res) {
          res.should.equal(1);
          resolve();
        });
    }));
  it("#remote cursor count should use skip from options", () =>
    new Promise<void>((resolve, reject) => {
      remote.collection("dollhouse").insert({ _id: "echo" });
      remote.collection("dollhouse").insert({ _id: "echo2" });
      remote.collection("dollhouse").insert({ _id: "echo3" });
      clientVdb
        .collection("dollhouse")
        .find({})
        .count({}, { skip: 1 }, function (err, res) {
          res.should.equal(2);
          resolve();
        });
    }));
  it("#remote cursor count should use limit from options", () =>
    new Promise<void>((resolve, reject) => {
      remote.collection("dollhouse").insert({ _id: "echo" });
      remote.collection("dollhouse").insert({ _id: "echo2" });
      remote.collection("dollhouse").insert({ _id: "echo3" });
      clientVdb
        .collection("dollhouse")
        .find({})
        .count({}, { limit: 2 }, function (err, res) {
          res.should.equal(2);
          resolve();
        });
    }));
  it("#remote collection count", () =>
    new Promise<void>((resolve, reject) => {
      remote.collection("dollhouse").insert({ _id: "echo" });
      remote.collection("dollhouse").insert({ _id: "echo2" });
      clientVdb.collection("dollhouse").count({ _id: "echo" }, function (err, res) {
        res.should.equal(1);
        resolve();
      });
    }));
  it("#remote collection count with skip", () =>
    new Promise<void>((resolve, reject) => {
      remote.collection("dollhouse").insert({ _id: "echo" });
      remote.collection("dollhouse").insert({ _id: "echo2" });
      clientVdb.collection("dollhouse").count({}, { skip: 1 }, function (err, res) {
        res.should.equal(1);
        resolve();
      });
    }));
  it("#remote collection count with limit", () =>
    new Promise<void>((resolve, reject) => {
      remote.collection("dollhouse").insert({ _id: "echo" });
      remote.collection("dollhouse").insert({ _id: "echo2" });
      clientVdb.collection("dollhouse").count({}, { limit: 1 }, function (err, res) {
        res.should.equal(1);
        resolve();
      });
    }));
  it("#remote collection observe", () =>
    new Promise<void>((resolve, reject) => {
      remote.collection("dollhouse").insert({ _id: "echo" });
      remote.collection("dollhouse").insert({ _id: "echo2" });
      const cursor = clientVdb.collection("dollhouse").find({ _id: { $in: ["echo2", "echo3"] } });
      cursor.observe({
        init: function (init) {
          init.length.should.equal(1);
        },
        added: function (a) {
          a._id.should.equal("echo3");
          resolve();
        },
      });
      remote.collection("dollhouse").insert({ _id: "echo3" });
    }));
  it("#remote collection observe should call init again on reconnected", () =>
    new Promise<void>((resolve, reject) => {
      remote.collection("dollhouse").insert({ _id: "echo2" });
      const cursor = clientVdb.collection("dollhouse").find({ _id: { $in: ["echo2", "echo3"] } });
      let inits = 0;
      cursor.observe({
        init: function (init) {
          inits++;
          if (inits === 1) {
            init.length.should.equal(1);
            remote.collection("dollhouse").insert({ _id: "echo3" });
            client.onClientReconnected();
          } else if (inits === 2) {
            init.length.should.equal(2);
            resolve();
          }
        },
      });
    }));
  it("#remote collection observe should continue to work on reconnected", () =>
    new Promise<void>((resolve, reject) => {
      remote.collection("dollhouse").insert({ _id: "echo2" });
      const cursor = clientVdb.collection("dollhouse").find({ _id: { $in: ["echo2", "echo3"] } });
      let inits = 0;
      cursor.observe({
        init: function (init) {
          inits++;
          init.length.should.equal(1);
          if (inits === 1) {
            client.onClientReconnected();
            remote.collection("dollhouse").insert({ _id: "echo3" });
          } else {
            inits.should.equal(2); // max 2 inits - 1 reconnect
          }
        },
        added: function (item) {
          item._id.should.equal("echo3");
          remote.collection("dollhouse").save({ _id: "echo3", updated: true });
        },
        changed: function (asis, tobe) {
          tobe.updated.should.equal(true);
          resolve();
        },
      });
    }));
  it("#remote reconnected should work with hybrid", () =>
    new Promise<void>((resolve, reject) => {
      remote.collection("dollhouse").insert({ _id: "echo2" });
      const local = new ViewDb();
      const hybrid = new ViewDb(new (HybridStore as any)(local, clientStore, { throttleObserveRefresh: 0 }));
      let list = [];
      let changes = 0;
      hybrid.open().then(function () {
        const cursor = hybrid.collection("dollhouse").find({ _id: { $in: ["echo2"] } });
        cursor.observe({
          init: function (init) {
            list = init;
          },
          added: function (element, index) {
            list.splice(index, 1);
            remote.collection("dollhouse").save({ _id: "echo2", changed: 1 });
            client.onClientReconnected();
          },
          changed: function (asis, tobe, index) {
            changes++;
            remote.collection("dollhouse").save({ _id: "echo2", changed: 2 });
            list[index] = tobe;
            list.length.should.equal(1);
            if (changes === 2) {
              resolve();
            }
          },
        });
      });
    }));
});
