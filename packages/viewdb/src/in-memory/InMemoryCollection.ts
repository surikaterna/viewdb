import { EventEmitter } from "events";
import Kuery, { Query, QueryObject, QueryOptions, SortObject } from "kuery";
import cloneDeep from "lodash/cloneDeep";
import has from "lodash/has";
import isArray from "lodash/isArray";
import isObject from "lodash/isObject";
import pullAll from "lodash/pullAll";
import { v4 as uuid } from "uuid";
import { Cursor } from "../Cursor";
import {
  CollectionFindAndModifyOptions,
  CollectionUpdateManyOptions,
  CollectionUpdateOneOptions,
  FindAndModifyResult,
  Indexed,
  UpdateFilter,
  ViewDBCollection,
} from "../interfaces";

type Operation = "insert" | "save";

export class Collection<T extends Indexed> extends EventEmitter implements ViewDBCollection<T> {
  private _documents: T[];
  readonly _name: string;

  constructor(collectionName: string) {
    super();

    this._documents = [];
    this._name = collectionName;
  }

  async count(): Promise<number> {
    return this._documents.length;
  }

  async _write(op: Operation, documents: T | T[], _options: Record<string, any>): Promise<T[]> {
    if (!isArray(documents)) {
      documents = [documents];
    }

    for (const document of documents) {
      if (!isObject(document)) {
        throw new Error("Document must be object");
      }

      if (!has(document, "_id")) {
        document["_id"] = "id" in document && typeof document.id === "string" ? document["id"] : uuid();
      }

      const index = this._documents.findIndex((d) => d._id === document._id);
      if (op === "insert" && index >= 0) {
        throw new Error("Unique constraint!");
      }

      if (index === -1) {
        this._documents.push(document);
      } else {
        this._documents[index] = document;
      }
    }

    this.emit("change", documents);
    return documents;
  }

  insert(documents: T | T[], options: Record<string, any>): Promise<T[]> {
    return this._write("insert", documents, options);
  }

  save(documents: T | T[], options: Record<string, any>): Promise<T[]> {
    return this._write("save", documents, options);
  }

  async drop() {
    this._documents = [];
  }

  find(query: Query<T>, options?: QueryOptions): Cursor<T> {
    return new Cursor(this, { query }, options, this._getDocuments.bind(this));
  }

  async remove(query: Query<T>, _options: any): Promise<void> {
    const q = new Kuery(query);
    const documents = q.find(this._documents);
    this._documents = pullAll(this._documents, documents);
  }

  async ensureIndex() {
    throw new Error("ensureIndex not supported!");
  }

  async createIndex() {
    throw new Error("createIndex not supported!");
  }

  async findAndModify(
    _query: Query<T>,
    _sort: SortObject | null,
    _update: UpdateFilter,
    _options?: CollectionFindAndModifyOptions
  ): Promise<FindAndModifyResult> {
    throw new Error("findAndModify not supported!");
  }

  async updateMany(_query: Query<T>, _update: UpdateFilter, _options?: CollectionUpdateManyOptions): Promise<T[]> {
    throw new Error("updateMany not supported!");
  }

  async updateOne(_query: Query<T>, _update: UpdateFilter, _options?: CollectionUpdateOneOptions): Promise<T> {
    throw new Error("updateOne not supported!");
  }

  /** @internal */
  async _getDocuments(queryObject: QueryObject<T>): Promise<T[]> {
    const query = queryObject.query || queryObject;
    const q = new Kuery(query as Query<T>);

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

    return new Promise((resolve) => {
      process.nextTick(() => {
        resolve(cloneDeep(documents));
      });
    });
  }
}

export default Collection;
