import Promise from 'bluebird';
import Collection from './collection';
import { VdbClient } from '../types';

class Store {
  _collections: Record<string, Collection>;
  _client: VdbClient;

  constructor(client: VdbClient) {
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

export default Store;
