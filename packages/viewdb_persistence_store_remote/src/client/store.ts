import Promise = require('bluebird');
import Collection = require('./collection');

class Store {
  _collections: Record<string, Collection>;
  _client: any;

  constructor(client: any) {
    this._collections = {};
    this._client = client;
  }

  open(callback?: (err: Error | null, value?: Store) => void): any {
    return Promise.resolve(this).nodeify(callback);
  }

  collection(name: string, callback?: (collection: Collection) => void): Collection {
    var collection = this._collections[name];
    if (!collection) {
      collection = this._collections[name] = new Collection(this._client, name);
    }
    if (callback) {
      callback(collection);
    }
    return collection;
  }
}

export = Store;
