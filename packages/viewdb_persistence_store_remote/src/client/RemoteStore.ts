import Promise from "bluebird";
import { VdbClient } from "../types";
import RemoteCollection from "./RemoteCollection";

class RemoteStore {
  _collections: Record<string, RemoteCollection>;
  _client: VdbClient;

  constructor(client: VdbClient) {
    this._collections = {};
    this._client = client;
  }

  open(callback?: (err: Error | null, value?: RemoteStore) => void): any {
    return Promise.resolve(this).nodeify(callback);
  }

  collection(name: string, callback?: (collection: RemoteCollection) => void): RemoteCollection {
    let collection = this._collections[name];
    if (!collection) {
      collection = this._collections[name] = new RemoteCollection(this._client, name);
    }
    if (callback) {
      callback(collection);
    }
    return collection;
  }
}

export default RemoteStore;
