import InMemoryCollection from "./InMemoryCollection";

class InMemoryStore {
  _collections: Record<string, InMemoryCollection>;

  constructor() {
    this._collections = {};
  }

  collection(collectionName: string, callback?: (collection: InMemoryCollection) => void): InMemoryCollection {
    let coll = this._collections[collectionName];
    if (coll === undefined) {
      coll = new InMemoryCollection(collectionName);
      this._collections[collectionName] = coll;
    }
    if (callback) {
      callback(coll);
    }
    return coll;
  }
}

export default InMemoryStore;
