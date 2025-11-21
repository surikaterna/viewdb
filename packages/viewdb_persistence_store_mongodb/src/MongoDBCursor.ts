import type { QueryObject, QueryOptions, SortObject } from "kuery";
import type { Document, FindCursor, ReadPreferenceLike } from "mongodb";
import { type Indexed, Observer as LegacyObserver, type ObserverOptions, type ViewDBCursor, type ViewDBObserver } from "viewdb";
import type { MongoDBCollection } from "./MongoDBCollection";
import { MongoDBObserver } from "./MongoDBObserver";
import type { OplogListener } from "./OplogListener";

export class MongoDBCursor<T extends Indexed> implements ViewDBCursor<T> {
  private readonly queryObject: QueryObject<T>;
  private readonly queryOptions: QueryOptions;
  private readonly cursor: FindCursor<T>;
  private readonly oplogListener: OplogListener<T>;
  private readonly collection: MongoDBCollection<T>;

  constructor(
    collection: MongoDBCollection<T>,
    queryObject: QueryObject<T>,
    queryOptions: QueryOptions,
    cursor: FindCursor<T>,
    oplogListener: OplogListener<T>
  ) {
    this.queryObject = queryObject;
    this.queryOptions = queryOptions || {};
    this.cursor = cursor;
    this.oplogListener = oplogListener;
    this.collection = collection;
  }

  setReadPreference(readPreference: ReadPreferenceLike): MongoDBCursor<T> {
    this.cursor.withReadPreference.call(this.cursor, readPreference);
    return this;
  }

  count(): Promise<number> {
    // TODO: Update to use this.collection.countDocuments
    return this.cursor.count();
  }

  project(project: Document): MongoDBCursor<T> {
    this.cursor.project(project);
    this.queryOptions.project = project;
    return this;
  }

  toArray(): Promise<T[]> {
    return this.cursor.toArray();
  }

  observe(options: ObserverOptions<T> = {}): ViewDBObserver {
    if (!this.oplogListener) {
      return new LegacyObserver(this.queryObject, this.queryOptions, this.collection, options);
    }

    return new MongoDBObserver(this.queryObject, this.queryOptions, this.collection, options, this.oplogListener);
  }

  skip(amount: number): MongoDBCursor<T> {
    this.cursor.skip(amount);
    this.queryOptions.skip = amount;
    this._refresh();
    return this;
  }

  limit(amount: number): MongoDBCursor<T> {
    this.queryOptions.limit = amount;
    this.cursor.limit(amount);
    this._refresh();
    return this;
  }

  sort(sortObject: SortObject): MongoDBCursor<T> {
    this.queryOptions.sort = sortObject;
    this.cursor.sort(sortObject);
    this._refresh();
    return this;
  }

  _refresh() {
    this.collection.emit("change", {});
  }

  rewind() {
    return this.cursor.rewind();
  }

  close(options?: { timeoutMS?: number }) {
    return this.cursor.close(options);
  }
}
