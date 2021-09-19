import Collection from './Collection';

export default class Store {
  constructor() {
    this._collections = {};
  }

  collection = (collectionName, callback) => {
    let coll = this._collections[collectionName];

    if (coll === undefined) {
      coll = new Collection(collectionName);
      this._collections[collectionName] = coll;
    }

    if (callback) {
      callback(coll);
    }

    return coll;
  };
}
