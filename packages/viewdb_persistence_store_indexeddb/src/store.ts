import Promise = require('bluebird');
import Collection = require('./collection');

class Store {
  _idb: any;
  _db: any;
  _name: string;
  _collections: Record<string, Collection>;

  constructor(idb: any, name?: string) {
    this._idb = idb;
    this._db = undefined;
    this._name = name ? 'vdb_' + name : 'vdb';
    this._collections = {};
  }

  open(callback?: (err: Error | null, value?: Store) => void): Promise<Store> {
    var self = this;
    var request = this._idb.open(this._name, 2);
    return new Promise<Store>(function (resolve, reject) {
      request.onsuccess = function (event: any) {
        self._db = event.target.result;
        resolve(self);
      };
      request.onupgradeneeded = function (event: any) {
        var db = event.target.result;
        if (event.oldVersion < 1) {
          var documents = db.createObjectStore('documents', { keyPath: '$collectionKey', unique: true });
          documents.createIndex('$collection', '$collection', { unique: false });
        }
        //fix for _id being keypath...
        if (event.oldVersion < 2) {
          db.deleteObjectStore('documents');
          var documents = db.createObjectStore('documents', { keyPath: '$collectionKey', unique: true });
          documents.createIndex('$collection', '$collection', { unique: false });
        }
      };
      request.onerror = function (event: any) {
        reject(new Error(event));
      };
      request.onblocked = function (event: any) {
        reject(new Error(event));
      };
    }).nodeify(callback);
  }

  close(callback?: (err: Error | null) => void): Promise<void> {
    var self = this;
    return new Promise<void>(function (resolve, _reject) {
      var req = self._db.close();
      resolve();
    }).nodeify(callback);
  }

  delete(callback?: (err: Error | null) => void): Promise<void> {
    var self = this;
    return new Promise<void>(function (resolve, reject) {
      var req = self._idb.deleteDatabase(self._name);
      req.onsuccess = function () {
        resolve();
      };
      req.onerror = function (_event: Event) {
        reject();
      };
    }).nodeify(callback);
  }

  collection(name: string, callback?: (collection: Collection) => void): Collection {
    var collection = this._collections[name];
    if (!collection) {
      collection = this._collections[name] = new Collection(this._db, name);
    }
    if (callback) {
      callback(collection);
    }
    return collection;
  }
}

export = Store;
