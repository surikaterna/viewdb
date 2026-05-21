import _ from "lodash";
import {
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

class ViewDBCursor implements Cursor {
  _collection: Collection;
  _query: QueryObject;
  _options: QueryObject;
  _getDocuments: GetDocumentsFn;
  _isObserving: boolean;

  constructor(collection: Collection, query: QueryObject, options: QueryObject, getDocuments: GetDocumentsFn) {
    this._collection = collection;
    this._query = query;
    this._options = options;
    this._getDocuments = getDocuments;
    this._isObserving = false;
  }

  forEach(callback: (result: VDocument[]) => void): void {
    this._getDocuments(this._query).then((result) => {
      _.forEach(result, function () {
        callback(result!);
      });
    });
  }

  toArray(): Promise<VDocument[]> {
    return this._getDocuments(this._query);
  }

  observe(options: ObserveOptions): ObserveHandle {
    this._isObserving = true;
    // Observer constructor returns { stop } object, not the Observer instance
    return new ViewDBObserver(this._query, this._options, this._collection, options) as any;
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

  count(): Promise<number> {
    const query: QueryObject = { query: this._query.query };
    if (this._query.skip) {
      query.skip = this._query.skip;
    }
    if (this._query.limit) {
      query.limit = this._query.limit;
    }
    return this._getDocuments(query).then((res) => res.length);
  }

  close(): Promise<void> {
    // NOOP
    return Promise.resolve();
  }
}

export default ViewDBCursor;
