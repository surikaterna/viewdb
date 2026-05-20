import Promise from "bluebird";
import IndexedDBCollection from "./IndexedDBCollection";

class IndexedDBStore {
  _idb: IDBFactory;
  _db: IDBDatabase | null;
  _name: string;
  _collections: Record<string, IndexedDBCollection>;

  constructor(idb: IDBFactory, name?: string) {
    this._idb = idb;
    this._db = null;
    this._name = name ? "vdb_" + name : "vdb";
    this._collections = {};
  }

  open(callback?: (err: Error | null, value?: IndexedDBStore) => void): Promise<IndexedDBStore> {
    const self = this;
    const request: IDBOpenDBRequest = this._idb.open(this._name, 2);
    return new Promise<IndexedDBStore>(function (resolve, reject) {
      request.onsuccess = function (event: Event) {
        self._db = (event.target as IDBOpenDBRequest).result;
        resolve(self);
      };
      request.onupgradeneeded = function (event: IDBVersionChangeEvent) {
        const db: IDBDatabase = (event.target as IDBOpenDBRequest).result;
        if (event.oldVersion < 1) {
          const documents = db.createObjectStore("documents", { keyPath: "$collectionKey" });
          documents.createIndex("$collection", "$collection", { unique: false });
        }
        //fix for _id being keypath...
        if (event.oldVersion < 2) {
          db.deleteObjectStore("documents");
          const documents = db.createObjectStore("documents", { keyPath: "$collectionKey" });
          documents.createIndex("$collection", "$collection", { unique: false });
        }
      };
      request.onerror = function (event: Event) {
        reject(new Error(String(event)));
      };
      request.onblocked = function (event: Event) {
        reject(new Error(String(event)));
      };
    }).nodeify(callback);
  }

  close(callback?: (err: Error | null) => void): Promise<void> {
    const self = this;
    return new Promise<void>(function (resolve, _reject) {
      self._db!.close();
      resolve();
    }).nodeify(callback);
  }

  delete(callback?: (err: Error | null) => void): Promise<void> {
    const self = this;
    return new Promise<void>(function (resolve, reject) {
      const req: IDBOpenDBRequest = self._idb.deleteDatabase(self._name);
      req.onsuccess = function () {
        resolve();
      };
      req.onerror = function (_event: Event) {
        reject();
      };
    }).nodeify(callback);
  }

  collection(name: string, callback?: (collection: IndexedDBCollection) => void): IndexedDBCollection {
    let collection = this._collections[name];
    if (!collection) {
      collection = this._collections[name] = new IndexedDBCollection(this._db!, name);
    }
    if (callback) {
      callback(collection);
    }
    return collection;
  }
}

export default IndexedDBStore;
