import { EventEmitter } from "events";
import Kuery, { findOne, type TypedQuery } from "kuery";
import _ from "lodash";
import { v4 as uuid } from "uuid";
import type {
  Collection,
  CountDocumentsOptions,
  DeleteResult,
  InsertManyResult,
  InsertOneResult,
  QueryObject,
  VDocument,
} from "../types";
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

  async deleteMany(query?: TypedQuery<T>): Promise<DeleteResult> {
    try {
      if (!query) {
        const deletedCount = this._documents.length;
        this._documents.length = 0;
        return { acknowledged: true, deletedCount };
      }

      const q = new Kuery(query);
      const docs = q.find(this._documents);
      this._documents = _.pullAll(this._documents, docs);
      return { acknowledged: true, deletedCount: docs.length };
    } catch {
      return { acknowledged: false };
    }
  }

  async deleteOne(query?: TypedQuery<T>): Promise<DeleteResult> {
    try {
      if (!query) {
        const doc = this._documents.shift();
        return { acknowledged: true, deletedCount: doc ? 1 : 0 };
      }

      const doc = findOne(this._documents, query);
      if (!doc) {
        return { acknowledged: true, deletedCount: 0 };
      }

      const index = this._documents.indexOf(doc);
      this._documents.splice(index, 1);
      return { acknowledged: true, deletedCount: 1 };
    } catch {
      return { acknowledged: false };
    }
  }

  async estimatedDocumentCount(): Promise<number> {
    return this._documents.length;
  }

  async _write(op: string, documents: T | T[], _options?: Record<string, any>): Promise<T[]> {
    const docs: T[] = _.isArray(documents) ? documents : [documents];

    for (let i = 0; i < docs.length; i++) {
      const document: Record<string, any> = docs[i];
      if (!_.isObject(document)) {
        throw new Error("Document must be object");
      }
      if (!_.has(document, "_id")) {
        document._id = document.id || uuid();
      }
      const idx = _.findIndex(this._documents, { _id: document._id });
      if (op === "insert" && idx >= 0) {
        throw new Error("Unique constraint!");
      }
      if (idx === -1) {
        this._documents.push(document as T);
      } else {
        this._documents[idx] = document as T;
      }
    }

    this.emit("change", docs);
    return docs;
  }

  insert(docs: T | T[], options?: Record<string, any>): Promise<T[]> {
    return this._write("insert", docs, options);
  }

  async insertMany(docs: T[]): Promise<InsertManyResult> {
    try {
      let insertedCount = 0;
      const insertedDocs: T[] = [];
      const insertedIds: Record<number, string> = {};

      for (const doc of docs) {
        try {
          const index = this.insertSingle(doc);
          insertedIds[index] = doc._id as string;
          insertedDocs.push(doc);
          insertedCount += 1;
        } catch {
          // continue inserting
        }
      }

      this.emit("insertMany", insertedDocs);

      return {
        acknowledged: true,
        insertedCount,
        insertedIds,
      };
    } catch {
      return {
        acknowledged: false,
      };
    }
  }

  async insertOne(doc: T): Promise<InsertOneResult> {
    try {
      this.insertSingle(doc);
      this.emit("insertOne", doc);

      return {
        acknowledged: true,
        insertedId: doc._id as string,
      };
    } catch {
      return {
        acknowledged: false,
      };
    }
  }

  private insertSingle(doc: T): number {
    if (!doc._id) {
      doc._id = "id" in doc ? doc.id : uuid();
    }

    const index = this._documents.findIndex((d) => d._id === doc._id);
    if (index > -1) {
      throw new Error("Unique constraint!");
    }

    this._documents.push(doc);
    return this._documents.length - 1;
  }

  save(docs: T | T[], options?: Record<string, any>): Promise<T[]> {
    return this._write("save", docs, options);
  }

  drop(): Promise<void> {
    this._documents = [];
    return Promise.resolve();
  }

  find(query: TypedQuery<T>): ViewDBCursor<T> {
    return new ViewDBCursor(this, { query }, this._getDocuments.bind(this));
  }

  remove(query: TypedQuery<T>): Promise<void> {
    const q = new Kuery(query);
    const documents = q.find(this._documents);
    this._documents = _.pullAll(this._documents, documents);
    this.emit("change", { remove: query });
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
