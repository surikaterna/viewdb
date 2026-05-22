import _ from "lodash";
import nock from "nock";
import { RestClient as Client, Client as Store } from "../..";
import mockResponse from "./mock-response.json";

const testOptions = {
  pollInterval: 15,
};

describe("RestClient", () => {
  afterEach(() => {
    nock.cleanAll();
  });
  it("#request should work", () =>
    new Promise<void>((resolve) => {
      const restClient = new Client("http://www.example.com/", {}, testOptions);
      nock("http://www.example.com").get("/party?q=%7B%22name%22%3A%22Firstname%22%7D").reply(200, mockResponse);

      restClient.request({ find: { name: "Firstname" }, collection: "party" }, (_err, result) => {
        expect(result).toEqual(mockResponse);
        resolve();
      });
    }));

  it("#skiplimit url should be correct", () =>
    new Promise<void>((resolve) => {
      const restClient = new Client("http://www.example.com/", {}, testOptions);
      nock("http://www.example.com")
        .get("/party?q=%7B%22name%22%3A%22Firstname%22%7D&skip=50&limit=77")
        .reply(() => {
          resolve();
          return [201, mockResponse, {}];
        });
      const store = new Store(restClient);
      store
        .collection("party")
        .find({ name: "Firstname" })
        .skip(50)
        .limit(77)
        .toArray(() => {});
    }));

  it("#observe should work", () =>
    new Promise<void>((resolve) => {
      const restClient = new Client("http://www.example.com/", {}, testOptions);
      const handle = restClient.subscribe(
        { observe: { name: "a" }, collection: "shipment", events: {}, skip: 1, limit: 100 },
        () => {}
      );
      const realDone = _.after(2, () => {
        handle.stop();
        resolve();
      });
      nock("http://www.example.com")
        .persist() // keep nock alive after first call
        .get("/shipment?q=%7B%22name%22%3A%22a%22%7D&skip=1&limit=100")
        .reply(() => {
          realDone();
          return [201, mockResponse, {}];
        });

      // {observe:this._query, collection:this._collection._name, events:events}
    }));

  it("#observe should stop when calling stop", () =>
    new Promise<void>((resolve) => {
      const restClient = new Client("http://www.example.com/", {}, testOptions);
      let hitCount = 0;

      nock("http://www.example.com")
        .persist() // keep nock alive after first call
        .get("/parcel?q=%7B%22name%22%3A%22a%22%7D")
        .reply(() => {
          hitCount++;
          stop();
          return [201, mockResponse, {}];
        });

      const observer = restClient.subscribe({ observe: { name: "a" }, collection: "parcel", events: {} }, () => {});
      const stop = _.after(1, observer.stop);

      setTimeout(() => {
        expect(hitCount).toBe(1);
        resolve();
      }, 15);
    }));

  it("#observe should notify changes", () =>
    new Promise<void>((resolve) => {
      const restClient = new Client("http://www.example.com", {}, testOptions);

      // mock returning response with data - dies after one hit
      nock("http://www.example.com").get("/party?q=%7B%22name%22%3A%22a%22%7D").reply(201, mockResponse);
      // mock returning empty response
      nock("http://www.example.com").get("/party?q=%7B%22name%22%3A%22a%22%7D").reply(201, {});

      let hits = 0;
      const verify = (res) => {
        ++hits;
        if (hits === 1) {
          expect(res.changes[0].a.e.name).toBe("firstName");
          expect(res.changes.length).toBe(1);
        }
        if (hits === 2) {
          handle.stop();
          expect(res.changes[0].r.e.name).toBe("firstName");
          resolve();
        }
      };

      const handle = restClient.subscribe({ observe: { name: "a" }, collection: "party", events: {} }, (_err, res) => {
        if (res) {
          verify(res);
        }
      });
    }));
});
