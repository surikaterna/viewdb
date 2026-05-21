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

  open(): Promise<RemoteStore> {
    return Promise.resolve(this);
  }

  collection(name: string): RemoteCollection {
    let collection = this._collections[name];
    if (!collection) {
      collection = this._collections[name] = new RemoteCollection(this._client, name);
    }
    return collection;
  }
}

export default RemoteStore;
