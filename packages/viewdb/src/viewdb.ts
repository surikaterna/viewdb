import InMemoryStore = require('./inmemory/store');
import { Callback, CollectionLike } from './types';

interface ViewDBStore {
  open?(callback?: Callback<any>): Promise<any>;
  collection(
    name: string,
    callback?: (coll: CollectionLike) => void,
  ): CollectionLike;
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

  collection(
    collectionName: string,
    callback?: (collection: CollectionLike) => void,
  ): CollectionLike {
    return this._store.collection(collectionName, callback);
  }
}

export = ViewDB;
