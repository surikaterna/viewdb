import InMemoryStore = require('./inmemory/store');

interface ViewDBStore {
  open?(): Promise<any>;
  collection(collectionName: string, callback?: (collection: any) => void): any;
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

  collection(collectionName: string, callback?: (collection: any) => void): any {
    return this._store.collection(collectionName, callback);
  }
}

export = ViewDB;
