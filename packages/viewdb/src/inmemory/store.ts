import Collection from "./collection";

class InMemoryStore {
  _collections: Record<string, Collection>;

  constructor() {
    this._collections = {};
  }

  collection(collectionName: string, callback?: (collection: Collection) => void): Collection {
    let coll = this._collections[collectionName];
    if (coll === undefined) {
      coll = new Collection(collectionName);
      this._collections[collectionName] = coll;
    }
    if (callback) {
      callback(coll);
    }
    return coll;
  }
}

export default InMemoryStore;
