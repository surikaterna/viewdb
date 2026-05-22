import _ from "lodash";
import type {
  Collection,
  Cursor,
  GetDocumentsFn,
  ObserveHandle,
  ObserveOptions,
  ProjectionSpec,
  QueryObject,
  SortSpec,
  VDocument,
} from "./types";
import ViewDBObserver from "./ViewDBObserver";

class ViewDBCursor<T extends VDocument = VDocument> implements Cursor<T> {
  _collection: Collection<T>;
  _query: QueryObject<T>;
  _getDocuments: GetDocumentsFn<T>;
  _isObserving: boolean;

  constructor(collection: Collection<T>, query: QueryObject<T>, getDocuments: GetDocumentsFn<T>) {
    this._collection = collection;
    this._query = query;
    this._getDocuments = getDocuments;
    this._isObserving = false;
  }

  forEach(callback: (result: VDocument[]) => void): void {
    this._getDocuments(this._query).then((result) => {
      _.forEach(result, () => {
        callback(result!);
      });
    });
  }

  toArray(): Promise<T[]> {
    return this._getDocuments(this._query);
  }

  observe(options: ObserveOptions): ObserveHandle {
    this._isObserving = true;
    // Observer constructor returns { stop } object, not the Observer instance
    return new ViewDBObserver(this._query, this._collection, options) as ObserveHandle;
  }

  updateQuery(query: Record<string, any>): void {
    this._query.query = query;
    this._refresh();
  }

  skip(skip: number): this {
    this._query.skip = skip;
    if (this._isObserving) {
      this._refresh();
    }
    return this;
  }

  limit(limit: number): this {
    this._query.limit = limit;
    if (this._isObserving) {
      this._refresh();
    }
    return this;
  }

  sort(sort: SortSpec): this {
    this._query.sort = sort;
    if (this._isObserving) {
      this._refresh();
    }
    return this;
  }

  project(project: ProjectionSpec): this {
    this._query.project = project;
    return this;
  }

  _refresh(): void {
    this._collection.emit("change", {});
  }

  rewind(_options?: unknown): void {
    // NOOP
  }

  async count(): Promise<number> {
    const query: QueryObject<T> = { query: this._query.query };
    if (this._query.skip) {
      query.skip = this._query.skip;
    }
    if (this._query.limit) {
      query.limit = this._query.limit;
    }
    const res = await this._getDocuments(query);
    return res.length;
  }

  close(): Promise<void> {
    // NOOP
    return Promise.resolve();
  }
}

export default ViewDBCursor;
