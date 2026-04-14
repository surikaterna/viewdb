import Observer = require('./observe');
import { nodeify } from './utils';

class Cursor {
  _query: any;
  _queryOptions: any;
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

  count(callback?: any): any {
    return nodeify(this._cursor.count.apply(this._cursor, arguments), callback);
  }

  project(project: any): this {
    this._cursor.project.apply(this._cursor, arguments);
    this._queryOptions.project = project;
    return this;
  }

  toArray(callback?: any): any {
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

  sort(sort: any): this {
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

  close(callback?: any): any {
    return nodeify(this._cursor.close.apply(this._cursor, arguments), callback);
  }
}

export = Cursor;
