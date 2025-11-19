import type { Query, QueryObject, QueryOptions, SortObject } from "kuery";
import forEach from "lodash/forEach";
import { Observer } from "./Observer";
import type { CursorIterator, Indexed, ObserverOptions, ViewDBCollection, ViewDBCursor } from "./interfaces";
import type { Nullish } from "./types";

export type GetDocumentsFunc<T> = (queryObject: QueryObject<T>) => Promise<T[]>;

export class Cursor<T extends Indexed> implements ViewDBCursor<T> {
  private readonly _collection: ViewDBCollection<T>;
  private readonly _query: QueryObject<T>;
  private readonly _options: Nullish<QueryOptions>;
  private readonly _getDocuments: GetDocumentsFunc<T>;
  private _isObserving: boolean;

  constructor(collection: ViewDBCollection<T>, query: QueryObject<T>, options: Nullish<QueryOptions>, getDocuments: GetDocumentsFunc<T>) {
    this._collection = collection;
    this._query = query;
    this._options = options;
    this._getDocuments = getDocuments;
    this._isObserving = false;
  }

  async forEach(callback: CursorIterator<T>) {
    const result = await this._getDocuments(this._query);

    forEach(result, (item) => {
      callback(item);
    });
  }

  toArray() {
    return this._getDocuments(this._query);
  }

  observe(options: ObserverOptions<T>) {
    this._isObserving = true;
    return new Observer(this._query, this._options, this._collection, options);
  }

  updateQuery(query: Query<T>) {
    this._query.query = query;
    this._refresh();
  }

  skip(skip: number) {
    this._query.skip = skip;

    if (this._isObserving) {
      this._refresh();
    }

    return this;
  }

  limit(limit: number) {
    this._query.limit = limit;

    if (this._isObserving) {
      this._refresh();
    }

    return this;
  }

  sort(sort: SortObject) {
    this._query.sort = sort;

    if (this._isObserving) {
      this._refresh();
    }

    return this;
  }

  _refresh() {
    this._collection.emit("change", {});
  }

  rewind(_options: Record<string, any>) {
    //NOOP
  }

  async count(): Promise<number> {
    const query: QueryObject<T> = { query: this._query.query };

    if (this._query.skip) {
      query.skip = this._query.skip;
    }

    if (this._query.limit) {
      query.limit = this._query.limit;
    }

    const docs = await this._getDocuments(query);
    return docs.length;
  }

  close(callback: () => void) {
    //NOOP
    callback();
  }
}
