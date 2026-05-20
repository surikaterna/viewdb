import InMemoryStore from "./inmemory/InMemoryStore";
import { Callback, Collection } from "./types";

interface ViewDBStore {
  open?(callback?: Callback<any>): Promise<any>;
  collection(name: string, callback?: (coll: Collection) => void): Collection;
}

class ViewDB {
  _store: ViewDBStore;

  constructor(store?: ViewDBStore) {
    this._store = store || new InMemoryStore();
  }

  open(): Promise<ViewDB> {
    if (this._store.open) {
      return this._store.open().then(() => {
        return this;
      });
    } else {
      return Promise.resolve(this);
    }
  }

  collection(collectionName: string, callback?: (collection: Collection) => void): Collection {
    return this._store.collection(collectionName, callback);
  }
}

export default ViewDB;
