import Observer = require('./observe');
import { nodeify } from './utils';

class Cursor {
  _query: any;
  _queryOptions: { query?: any; skip?: number; limit?: number; sort?: Record<string, 1 | -1>; project?: Record<string, 0 | 1> };
  _cursor: any;
  _oplogListener: any;
  _collection: any;

  constructor(collection: any, query: any, options: any, cursor: any, oplogListener?: any) {
    this._query = query;
    this._queryOptions = options || {};
    this._cursor = cursor;
    this._oplogListener = oplogListener;
    this._collection = collection;
  }

  each(): any {
    return this._cursor.each.apply(this._cursor, arguments);
  }

  setReadPreference(): this {
    this._cursor.withReadPreference.apply(this._cursor, arguments);
    return this;
  }

  count(callback?: (err: Error | null, count?: number) => void): any {
    return nodeify(this._cursor.count.apply(this._cursor, arguments), callback);
  }

  project(project: Record<string, 0 | 1>): this {
    this._cursor.project.apply(this._cursor, arguments);
    this._queryOptions.project = project;
    return this;
  }

  toArray(callback?: (err: Error | null, result?: any[]) => void): any {
    return nodeify(this._cursor.toArray.apply(this._cursor, arguments), callback);
  }

  observe(options: any): any {
    return new Observer(this._query, this._queryOptions, this._collection, options, this._oplogListener);
  }

  skip(skip: number): this {
    this._cursor.skip.apply(this._cursor, arguments);
    this._queryOptions.skip = skip;
    this._refresh();
    return this;
  }

  limit(limit: number): this {
    this._queryOptions.limit = limit;
    this._cursor.limit.apply(this._cursor, arguments);
    this._refresh();
    return this;
  }

  sort(sort: Record<string, 1 | -1>): this {
    this._queryOptions.sort = sort;
    this._cursor.sort.apply(this._cursor, arguments);
    this._refresh();
    return this;
  }

  _refresh(): void {
    this._collection.emit('change', {});
  }

  rewind(): any {
    return this._cursor.rewind.apply(this._cursor, arguments);
  }

  close(callback?: (err: Error | null) => void): any {
    return nodeify(this._cursor.close.apply(this._cursor, arguments), callback);
  }
}

export = Cursor;
