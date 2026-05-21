import { EventEmitter } from "events";
import Kuery from "kuery";
import _ from "lodash";
import { v4 as uuid } from "uuid";
import { Collection, QueryObject, VDocument } from "../types";
import ViewDBCursor from "../ViewDBCursor";

class InMemoryCollection extends EventEmitter implements Collection {
  _documents: VDocument[];
  _name: string;

  constructor(collectionName: string) {
    super();
    this._documents = [];
    this._name = collectionName;
  }

  count(): Promise<number> {
    return Promise.resolve(this._documents.length);
  }

  _write(op: string, documents: VDocument | VDocument[], _options?: Record<string, any>): Promise<VDocument[]> {
    const docs: VDocument[] = _.isArray(documents) ? documents : [documents];
    const promise = new Promise<VDocument[]>((resolve, reject) => {
      for (let i = 0; i < docs.length; i++) {
        const document: Record<string, any> = docs[i];
        if (!_.isObject(document)) {
          reject(new Error("Document must be object"));
          return;
        }
        if (!_.has(document, "_id")) {
          document._id = document.id || uuid();
        }
        const idx = _.findIndex(this._documents, { _id: document._id });
        if (op === "insert" && idx >= 0) {
          reject(new Error("Unique constraint!"));
          return;
        }
        if (idx === -1) {
          this._documents.push(document as VDocument);
        } else {
          this._documents[idx] = document as VDocument;
        }
      }
      this.emit("change", docs);
      resolve(docs);
    });

    return promise;
  }

  insert(documents: VDocument | VDocument[], options?: Record<string, any>): Promise<VDocument[]> {
    return this._write("insert", documents, options);
  }

  save(documents: VDocument | VDocument[], options?: Record<string, any>): Promise<VDocument[]> {
    return this._write("save", documents, options);
  }

  drop(): Promise<void> {
    this._documents = [];
    return Promise.resolve();
  }

  find(query: Record<string, any>, options?: Record<string, any>): ViewDBCursor {
    return new ViewDBCursor(this, { query: query }, options || {}, this._getDocuments.bind(this));
  }

  remove(query: Record<string, any>, _options?: Record<string, any>): Promise<void> {
    const q = new Kuery(query);
    const documents = q.find(this._documents);
    this._documents = _.pullAll(this._documents, documents);
    return Promise.resolve();
  }

  ensureIndex(): never {
    throw new Error("ensureIndex not supported!");
  }

  createIndex(): never {
    throw new Error("createIndex not supported!");
  }

  _getDocuments(queryObject: QueryObject): Promise<VDocument[]> {
    const query = queryObject.query || queryObject;
    const q = new Kuery(query);
    if (queryObject.sort) {
      q.sort(queryObject.sort);
    }
    if (queryObject.skip) {
      q.skip(queryObject.skip);
    }
    if (queryObject.limit) {
      q.limit(queryObject.limit);
    }
    const documents = q.find(this._documents);
    const promise = new Promise<VDocument[]>((resolve) => {
      process.nextTick(() => {
        resolve(_.cloneDeep(documents));
      });
    });
    return promise;
  }
}

export default InMemoryCollection;
