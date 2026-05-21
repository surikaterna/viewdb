import { EventEmitter } from "events";
import Kuery from "kuery";
import _ from "lodash";
import { v4 as uuid } from "uuid";

import { ViewDBCursor } from "viewdb";

class IndexedDBCollection extends EventEmitter {
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
      (typeof query["id"] === "string" || typeof query["_id"] === "string")
    ) {
      return true;
    } else {
      return false;
    }
  }

  find(query: any, options?: any): any {
    if (this._isIdentityQuery(query)) {
      return new ViewDBCursor(this, { query: query }, options, this._getByKey.bind(this));
    } else {
      return new ViewDBCursor(this, { query: query }, options, this._getDocuments.bind(this));
    }
  }

  _getKey(document: Record<string, any>): string {
    return this._name + "_" + document["_id"];
  }

  insert(documents: any, options?: any): any {
    return this._write("add", documents, options);
  }

  _write(op: string, documents: any, options?: any): any {
    const self = this;

    if (!_.isArray(documents)) {
      documents = [documents];
    }

    return new Promise(function (resolve, reject) {
      const txn: IDBTransaction = self._db.transaction(["documents"], "readwrite");
      const docs: IDBObjectStore = txn.objectStore("documents");

      txn.oncomplete = (txn as any).onsuccess = function () {
        self.emit("change", documents);
        process.nextTick(function () {
          resolve(documents);
        });
      };

      txn.onerror = function (event: Event) {
        reject(new Error(String(event)));
      };
      let currentIndex = 0;
      const numberOfDocs = documents.length;
      function addNext() {
        const document = documents[currentIndex++];
        if (!_.has(document, "_id")) {
          document["_id"] = document["id"] || uuid();
        }
        document.$collection = self._name;
        document.$collectionKey = self._getKey(document);
        const request: IDBRequest = (docs as any)[op](document);
        request.onsuccess = function () {
          if (currentIndex < numberOfDocs) {
            addNext();
          }
        };
        request.onerror = function (event: Event) {
          reject(new Error(String(event)));
        };
      }
      addNext();
    });
  }

  save(documents: any, options?: any): any {
    return this._write("put", documents, options);
  }

  drop(): Promise<void> {
    return new Promise((resolve, reject) => {
      const txn = this._db.transaction(["documents"], "readwrite");
      const docs = txn.objectStore("documents");
      const cursor = docs.index("$collection").openCursor(this._name);
      cursor.onerror = function (event: Event) {
        reject(new Error(String(event)));
      };
      cursor.onsuccess = function (event: Event) {
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

  remove(query: any, _options?: any): Promise<void> {
    return this._getDocuments(query).then((res: any) => {
      return new Promise<void>((resolve, reject) => {
        const txn = this._db.transaction(["documents"], "readwrite");
        txn.oncomplete = (txn as any).onsuccess = () => {
          this.emit("change", { remove: query });
          resolve();
        };

        txn.onerror = function (event: Event) {
          reject(new Error(String(event)));
        };
        const docs = txn.objectStore("documents");
        _.forEach(res, (doc: any) => {
          const key = this._getKey(doc);
          docs.delete(key);
        });
      });
    });
  }

  _getDocuments(query: any): Promise<any[]> {
    const qry = query.query || query;
    return new Promise((resolve, reject) => {
      const txn = this._db.transaction(["documents"], "readonly");
      const docs = txn.objectStore("documents");
      const cursor = docs.index("$collection").openCursor(this._name);
      const result: any[] = [];
      cursor.onerror = function (event: Event) {
        reject(new Error(String(event)));
      };
      cursor.onsuccess = function (event: Event) {
        const c = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (c) {
          result.push(c.value);
          c.continue();
        } else {
          const q = new Kuery(qry);
          query.sort && q.sort(query.sort);
          query.skip && q.skip(query.skip);
          query.limit && q.limit(query.limit);
          resolve(q.find(result));
        }
      };
    });
  }

  _getByKey(query: any): Promise<any[]> {
    const qry = query.query || query;
    return new Promise((resolve, reject) => {
      const txn = this._db.transaction(["documents"], "readonly");
      const docs = txn.objectStore("documents");
      let key = qry["id"] || qry["_id"];
      key = this._name + "_" + key;
      const request = docs.get(key);
      request.onsuccess = function (_event: Event) {
        const result: any[] = [];
        if (request.result !== undefined) {
          result.push(request.result);
        }
        resolve(result);
      };
      request.onerror = function (_event: Event) {
        reject(new Error("Unable to _getByKey " + key));
      };
    });
  }
}

export default IndexedDBCollection;
