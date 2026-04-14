import _ = require('lodash');
import Observer = require('./observe');

type GetDocumentsFn = (query: any, callback: (err: any, result?: any[]) => void) => void;

class Cursor {
  _collection: any;
  _query: any;
  _options: any;
  _getDocuments: GetDocumentsFn;
  _isObserving: boolean;

  constructor(collection: any, query: any, options: any, getDocuments: GetDocumentsFn) {
    this._collection = collection;
    this._query = query;
    this._options = options;
    this._getDocuments = getDocuments;
    this._isObserving = false;
  }

  forEach(callback: (result: any[]) => void): void {
    this._getDocuments(this._query, function (err, result) {
      _.forEach(result, function () {
        callback(result!);
      });
    });
  }

  toArray(callback: (err: any, result?: any[]) => void): void {
    this._getDocuments(this._query, callback);
  }

  observe(options: any): { stop(): void } {
    this._isObserving = true;
    // Observer constructor returns { stop } object, not the Observer instance
    return new Observer(this._query, this._options, this._collection, options) as any;
  }

  updateQuery(query: any): void {
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

  sort(sort: any): this {
    this._query.sort = sort;
    if (this._isObserving) {
      this._refresh();
    }
    return this;
  }

  _refresh(): void {
    this._collection.emit('change', {});
  }

  rewind(_options?: any): void {
    // NOOP
  }

  count(callback: (err: any, count?: number) => void): void {
    const query: any = { query: this._query.query };
    if (this._query.skip) {
      query.skip = this._query.skip;
    }
    if (this._query.limit) {
      query.limit = this._query.limit;
    }
    this._getDocuments(query, function (err, res) {
      callback(err, res && res.length);
    });
  }

  close(callback: () => void): void {
    // NOOP
    callback();
  }
}

export = Cursor;
