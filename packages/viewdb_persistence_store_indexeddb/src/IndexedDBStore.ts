import IndexedDBCollection from "./IndexedDBCollection";

class IndexedDBStore {
  _idb: IDBFactory;
  _db: IDBDatabase | null;
  _name: string;
  _collections: Record<string, IndexedDBCollection>;

  constructor(idb: IDBFactory, name?: string) {
    this._idb = idb;
    this._db = null;
    this._name = name ? `vdb_${name}` : "vdb";
    this._collections = {};
  }

  open(): Promise<IndexedDBStore> {
    const request: IDBOpenDBRequest = this._idb.open(this._name, 2);
    return new Promise<IndexedDBStore>((resolve, reject) => {
      request.onsuccess = (event: Event) => {
        this._db = (event.target as IDBOpenDBRequest).result;
        resolve(this);
      };
      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
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
      request.onerror = (event: Event) => {
        reject(new Error(String(event)));
      };
      request.onblocked = (event: Event) => {
        reject(new Error(String(event)));
      };
    });
  }

  close(): Promise<void> {
    return new Promise<void>((resolve, _reject) => {
      this._db!.close();
      resolve();
    });
  }

  delete(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const req: IDBOpenDBRequest = this._idb.deleteDatabase(this._name);
      req.onsuccess = () => {
        resolve();
      };
      req.onerror = (_event: Event) => {
        reject();
      };
    });
  }

  collection(name: string): IndexedDBCollection {
    let collection = this._collections[name];
    if (!collection) {
      collection = this._collections[name] = new IndexedDBCollection(this._db!, name);
    }
    return collection;
  }
}

export default IndexedDBStore;
