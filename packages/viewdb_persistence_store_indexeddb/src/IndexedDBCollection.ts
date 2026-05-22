import { EventEmitter } from "events";
import Kuery, { type TypedQuery } from "kuery";
import _ from "lodash";
import { v4 as uuid } from "uuid";
import { type Collection, isQueryObject, type QueryObject, type VDocument, ViewDBCursor } from "viewdb";

class IndexedDBCollection<T extends VDocument = VDocument> extends EventEmitter implements Collection<T> {
  static Cursor: any = ViewDBCursor;
  _db: IDBDatabase;
  _name: string;

  constructor(db: IDBDatabase, name: string) {
    super();
    this._db = db;
    this._name = name;
  }

  _isIdentityQuery(query: Record<string, any>, _options?: Record<string, any>): boolean {
    const keys = Object.keys(query);
    if (
      keys.length === 1 &&
      (keys[0] === "id" || keys[0] === "_id") &&
      (typeof query.id === "string" || typeof query._id === "string")
    ) {
      return true;
    } else {
      return false;
    }
  }

  find(query: TypedQuery<T>): ViewDBCursor<T> {
    if (this._isIdentityQuery(query)) {
      return new ViewDBCursor(this, { query }, this._getByKey.bind(this));
    } else {
      return new ViewDBCursor(this, { query }, this._getDocuments.bind(this));
    }
  }

  _getKey(document: Record<string, any>): string {
    return `${this._name}_${document._id}`;
  }

  insert(documents: T | T[], options?: Record<string, any>): Promise<T[]> {
    return this._write("add", documents, options);
  }

  _write(op: string, documents: T | T[], _options?: Record<string, any>): Promise<T[]> {
    const self = this;
    const docs = _.isArray(documents) ? documents : [documents];

    return new Promise((resolve, reject) => {
      const txn: IDBTransaction = self._db.transaction(["documents"], "readwrite");
      const objectStore: IDBObjectStore = txn.objectStore("documents");

      txn.oncomplete = (txn as any).onsuccess = () => {
        self.emit("change", docs);
        process.nextTick(() => {
          resolve(docs);
        });
      };

      txn.onerror = (event: Event) => {
        reject(new Error(String(event)));
      };
      let currentIndex = 0;
      const numberOfDocs = docs.length;
      function addNext() {
        const doc = docs[currentIndex++];
        if (!_.has(doc, "_id")) {
          (doc as any)._id = (doc as any).id || uuid();
        }
        (doc as Record<string, any>).$collection = self._name;
        (doc as Record<string, any>).$collectionKey = self._getKey(doc);
        const request: IDBRequest = (objectStore as any)[op](doc);
        request.onsuccess = () => {
          if (currentIndex < numberOfDocs) {
            addNext();
          }
        };
        request.onerror = (event: Event) => {
          reject(new Error(String(event)));
        };
      }
      addNext();
    });
  }

  save(documents: T | T[], options?: Record<string, any>): Promise<T[]> {
    return this._write("put", documents, options);
  }

  drop(): Promise<void> {
    return new Promise((resolve, reject) => {
      const txn = this._db.transaction(["documents"], "readwrite");
      const objectStore = txn.objectStore("documents");
      const cursor = objectStore.index("$collection").openCursor(this._name);
      cursor.onerror = (event: Event) => {
        reject(new Error(String(event)));
      };
      cursor.onsuccess = (event: Event) => {
        const c = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (c) {
          c.delete();
          c.continue();
        } else {
          resolve();
        }
      };
    });
  }

  remove(query: TypedQuery<T>, _options?: Record<string, any>): Promise<void> {
    return this._getDocuments(query).then((res: any) => {
      return new Promise<void>((resolve, reject) => {
        const txn = this._db.transaction(["documents"], "readwrite");
        txn.oncomplete = (txn as any).onsuccess = () => {
          this.emit("change", { remove: query });
          resolve();
        };

        txn.onerror = (event: Event) => {
          reject(new Error(String(event)));
        };
        const objectStore = txn.objectStore("documents");
        _.forEach(res, (doc: any) => {
          const key = this._getKey(doc);
          objectStore.delete(key);
        });
      });
    });
  }

  _getDocuments(queryObject: QueryObject<T> | TypedQuery<T>): Promise<T[]> {
    const query = isQueryObject(queryObject) ? (queryObject.query as TypedQuery<T>) : queryObject;
    return new Promise((resolve, reject) => {
      const txn = this._db.transaction(["documents"], "readonly");
      const objectStore = txn.objectStore("documents");
      const cursor = objectStore.index("$collection").openCursor(this._name);
      const result: T[] = [];
      cursor.onerror = (event: Event) => {
        reject(new Error(String(event)));
      };
      cursor.onsuccess = (event: Event) => {
        const c = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (c) {
          result.push(c.value);
          c.continue();
        } else {
          const q = new Kuery<T>(query);
          if (isQueryObject(queryObject)) {
            queryObject.sort && q.sort(queryObject.sort);
            queryObject.skip && q.skip(queryObject.skip);
            queryObject.limit && q.limit(queryObject.limit);
          }
          resolve(q.find(result) as T[]);
        }
      };
    });
  }

  _getByKey(query: any): Promise<any[]> {
    const qry = query.query || query;
    return new Promise((resolve, reject) => {
      const txn = this._db.transaction(["documents"], "readonly");
      const objectStore = txn.objectStore("documents");
      let key = qry.id || qry._id;
      key = `${this._name}_${key}`;
      const request = objectStore.get(key);
      request.onsuccess = (_event: Event) => {
        const result: any[] = [];
        if (request.result !== undefined) {
          result.push(request.result);
        }
        resolve(result);
      };
      request.onerror = (_event: Event) => {
        reject(new Error(`Unable to _getByKey ${key}`));
      };
    });
  }
}

export default IndexedDBCollection;
