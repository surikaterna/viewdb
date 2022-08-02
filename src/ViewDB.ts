import InMemoryStore from './inmemory/Store';

export default class ViewDB {
  constructor(store) {
    this._store = store || new InMemoryStore();
  }

  collection = (collectionName, callback) => {
    return this._store.collection(collectionName, callback);
  };

  open = async () => {
    if (this._store.open) {
      await this._store.open();
      return this;
    } else {
      return this;
    }
  };
}
