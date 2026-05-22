import InMemoryStore from "./inmemory/InMemoryStore";
import type { Collection, Store } from "./types";

class ViewDB {
  _store: Store;

  constructor(store?: Store) {
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

  collection(collectionName: string): Collection {
    return this._store.collection(collectionName);
  }
}

export default ViewDB;
