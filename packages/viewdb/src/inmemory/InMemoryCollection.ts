import { EventEmitter } from "events";
import Kuery, { type TypedQuery } from "kuery";
import _ from "lodash";
import { v4 as uuid } from "uuid";
import type { Collection, CountDocumentsOptions, QueryObject, VDocument } from "../types";
import { isQueryObject } from "../utils";
import ViewDBCursor from "../ViewDBCursor";

class InMemoryCollection<T extends VDocument = VDocument> extends EventEmitter implements Collection<T> {
  _documents: T[];
  readonly _name: string;

  constructor(name: string) {
    super();
    this._documents = [];
    this._name = name;
  }

  async count(): Promise<number> {
    return this.estimatedDocumentCount();
  }

  async countDocuments(query: TypedQuery<T>, options?: CountDocumentsOptions): Promise<number> {
    const queryObject: QueryObject<T> = {
      query,
      limit: options?.limit,
      skip: options?.skip,
    };

    const docs = await this._getDocuments(queryObject);
    return docs.length;
  }

  async estimatedDocumentCount(): Promise<number> {
    return this._documents.length;
  }

  _write(op: string, documents: T | T[], _options?: Record<string, any>): Promise<T[]> {
    const docs: T[] = _.isArray(documents) ? documents : [documents];
    const promise = new Promise<T[]>((resolve, reject) => {
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
          this._documents.push(document as T);
        } else {
          this._documents[idx] = document as T;
        }
      }
      this.emit("change", docs);
      resolve(docs);
    });

    return promise;
  }

  insert(documents: T | T[], options?: Record<string, any>): Promise<T[]> {
    return this._write("insert", documents, options);
  }

  save(documents: T | T[], options?: Record<string, any>): Promise<T[]> {
    return this._write("save", documents, options);
  }

  drop(): Promise<void> {
    this._documents = [];
    return Promise.resolve();
  }

  find(query: TypedQuery<T>): ViewDBCursor<T> {
    return new ViewDBCursor(this, { query }, this._getDocuments.bind(this));
  }

  remove(query: TypedQuery<T>, _options?: Record<string, any>): Promise<void> {
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

  _getDocuments(queryObject: QueryObject<T> | TypedQuery<T>): Promise<T[]> {
    const query = isQueryObject(queryObject) ? (queryObject.query as TypedQuery<T>) : queryObject;
    const q = new Kuery<T>(query);

    if (isQueryObject(queryObject)) {
      if (queryObject.sort) {
        q.sort(queryObject.sort);
      }
      if (queryObject.skip) {
        q.skip(queryObject.skip);
      }
      if (queryObject.limit) {
        q.limit(queryObject.limit);
      }
    }

    const documents = q.find(this._documents);
    const promise = new Promise<T[]>((resolve) => {
      process.nextTick(() => {
        resolve(_.cloneDeep(documents as T[]));
      });
    });
    return promise;
  }
}

export default InMemoryCollection;
