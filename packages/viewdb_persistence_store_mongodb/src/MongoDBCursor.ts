import type { FindCursor, WithId } from "mongodb";
import type {
  Cursor,
  ObserveHandle,
  ObserveOptions,
  ProjectionSpec,
  QueryObject,
  ReadPreference,
  SortSpec,
  VDocument,
} from "viewdb";
import type MongoDBCollection from "./MongoDBCollection";
import MongoDBObserver, { type OplogListener } from "./MongoDBObserver";

class MongoDBCursor<T extends VDocument = VDocument> implements Cursor<T> {
  _query: QueryObject<T>;
  _queryOptions: QueryObject<T>;
  _cursor: FindCursor<WithId<T>>;
  _oplogListener?: OplogListener<T>;
  _collection: MongoDBCollection<T>;

  constructor(
    collection: MongoDBCollection<T>,
    query: QueryObject<T>,
    options: any,
    cursor: FindCursor<WithId<T>>,
    oplogListener?: OplogListener<T>
  ) {
    this._query = query;
    this._queryOptions = options || {};
    this._cursor = cursor;
    this._oplogListener = oplogListener;
    this._collection = collection;
  }

  setReadPreference(readPreference: ReadPreference): this {
    return this.withReadPreference(readPreference);
  }

  count(): Promise<number> {
    return this._cursor.count();
  }

  project(project: ProjectionSpec): this {
    this._queryOptions.project = project;
    this._cursor.project(project);
    return this;
  }

  toArray(): Promise<T[]> {
    return this._cursor.toArray() as Promise<T[]>;
  }

  observe(options: ObserveOptions<T>): ObserveHandle {
    return new MongoDBObserver<T>(
      this._query,
      this._queryOptions,
      this._collection,
      options,
      this._oplogListener
    ) as unknown as ObserveHandle;
  }

  skip(skip: number): this {
    this._queryOptions.skip = skip;
    this._cursor.skip(skip);
    this._refresh();
    return this;
  }

  limit(limit: number): this {
    this._queryOptions.limit = limit;
    this._cursor.limit(limit);
    this._refresh();
    return this;
  }

  sort(sort: SortSpec): this {
    this._queryOptions.sort = sort;
    this._cursor.sort(sort);
    this._refresh();
    return this;
  }

  _refresh(): void {
    this._collection.emit("change", {});
  }

  rewind(): any {
    return (this._cursor as any).rewind.apply(this._cursor, arguments);
  }

  async close(): Promise<void> {
    return this._cursor.close();
  }

  withReadPreference(readPreference: ReadPreference): this {
    this._cursor.withReadPreference(readPreference);
    return this;
  }
}

export default MongoDBCursor;
