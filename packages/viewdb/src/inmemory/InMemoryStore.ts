import { Store } from "../types";
import InMemoryCollection from "./InMemoryCollection";

class InMemoryStore implements Store {
  _collections: Record<string, InMemoryCollection>;

  constructor() {
    this._collections = {};
  }

  collection(collectionName: string): InMemoryCollection {
    let coll = this._collections[collectionName];
    if (coll === undefined) {
      coll = new InMemoryCollection(collectionName);
      this._collections[collectionName] = coll;
    }
    return coll;
  }
}

export default InMemoryStore;
