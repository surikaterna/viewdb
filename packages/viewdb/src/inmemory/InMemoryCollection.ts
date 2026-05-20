import { EventEmitter } from "events";
import Kuery from "kuery";
import _ from "lodash";
import { v4 as uuid } from "uuid";
import { Callback, Collection, QueryObject, VDocument } from "../types";
import ViewDBCursor from "../ViewDBCursor";

class InMemoryCollection extends EventEmitter implements Collection {
  _documents: VDocument[];
  _name: string;

  constructor(collectionName: string) {
    super();
    this._documents = [];
    this._name = collectionName;
  }

  count(callback: Callback<number>): void {
    callback(null, this._documents.length);
  }

  _write(
    op: string,
    documents: VDocument | VDocument[],
    options: Record<string, any> | Callback<VDocument[]>,
    callback?: Callback<VDocument[]>
  ): void {
    if (_.isFunction(options)) {
      callback = options as Callback<VDocument[]>;
    }
    const docs: VDocument[] = _.isArray(documents) ? documents : [documents];
    for (let i = 0; i < docs.length; i++) {
      const document: Record<string, any> = docs[i];
      if (!_.isObject(document)) {
        return callback!(new Error("Document must be object"));
      }
      if (!_.has(document, "_id")) {
        document._id = document.id || uuid();
      }
      const idx = _.findIndex(this._documents, { _id: document._id });
      if (op === "insert" && idx >= 0) {
        return callback!(new Error("Unique constraint!"));
      }
      if (idx === -1) {
        this._documents.push(document as VDocument);
      } else {
        this._documents[idx] = document as VDocument;
      }
    }
    this.emit("change", docs);
    if (callback) {
      callback(null, docs);
    }
  }

  insert(
    documents: VDocument | VDocument[],
    options?: Record<string, any> | Callback<VDocument[]>,
    callback?: Callback<VDocument[]>
  ): void {
    return this._write("insert", documents, options!, callback);
  }

  save(
    documents: VDocument | VDocument[],
    options?: Record<string, any> | Callback<VDocument[]>,
    callback?: Callback<VDocument[]>
  ): void {
    return this._write("save", documents, options!, callback);
  }

  drop(callback?: Callback): void {
    this._documents = [];
    if (callback) {
      callback(null);
    }
  }

  find(query: Record<string, any>, options?: Record<string, any>): ViewDBCursor {
    return new ViewDBCursor(this, { query: query }, options || {}, this._getDocuments.bind(this));
  }

  remove(query: Record<string, any>, options?: Record<string, any>, callback?: Callback): void {
    const q = new Kuery(query);
    const documents = q.find(this._documents);
    this._documents = _.pullAll(this._documents, documents);

    process.nextTick(function () {
      callback!(null);
    });
  }

  ensureIndex(): never {
    throw new Error("ensureIndex not supported!");
  }

  createIndex(): never {
    throw new Error("createIndex not supported!");
  }

  _getDocuments(queryObject: QueryObject, callback: Callback<VDocument[]>): void {
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
    process.nextTick(() => {
      callback(null, _.cloneDeep(documents));
    });
  }
}

export default InMemoryCollection;
