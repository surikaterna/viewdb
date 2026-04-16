import Collection = require('./collection');
import type { ViewDbScompContract } from '../types';

interface ClientOptions {
  writable?: boolean;
}

class Client {
  _collections: Record<string, Collection>;
  _proxy: ViewDbScompContract;
  _writable: boolean;

  constructor(proxy: ViewDbScompContract, options?: ClientOptions) {
    this._collections = {};
    this._proxy = proxy;
    this._writable = options?.writable ?? false;
  }

  open(callback?: (err: Error | null, value?: Client) => void): Promise<Client> {
    const result = Promise.resolve(this);
    if (callback) {
      result.then((v) => callback(null, v)).catch((err: Error) => callback(err));
    }
    return result;
  }

  collection(name: string, callback?: (collection: Collection) => void): Collection {
    let collection = this._collections[name];
    if (!collection) {
      collection = this._collections[name] = new Collection(this._proxy, name, this._writable);
    }
    if (callback) {
      callback(collection);
    }
    return collection;
  }
}

export = Client;
