import { EventEmitter } from 'events';
import Cursor = require('./cursor');
import type { ViewDbScompContract, VDocument } from '../types';

/** Query object shape used between collection and cursor */
interface QueryObject {
  query: Record<string, unknown>;
  skip?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
  project?: Record<string, 0 | 1>;
}

class Collection extends EventEmitter {
  _proxy: ViewDbScompContract;
  _name: string;
  _writable: boolean;

  constructor(proxy: ViewDbScompContract, collectionName: string, writable: boolean) {
    super();
    this._proxy = proxy;
    this._name = collectionName;
    this._writable = writable;
  }

  find(query: Record<string, unknown>, options?: Record<string, unknown>): Cursor {
    return new Cursor(this as any, { query }, options || {}, this._getDocuments.bind(this));
  }

  _getDocuments(queryObject: QueryObject, callback: (err: Error | null, result?: VDocument[]) => void): void {
    const q = queryObject.query || queryObject;
    this._proxy
      .find({
        collection: this._name,
        query: q as Record<string, unknown>,
        sort: queryObject.sort,
        limit: queryObject.limit,
        skip: queryObject.skip,
        project: queryObject.project
      })
      .then((result) => callback(null, result))
      .catch((err: Error) => callback(err));
  }

  count(
    query?: Record<string, unknown> | ((err: Error | null, result?: number) => void),
    options?: Record<string, unknown> | ((err: Error | null, result?: number) => void),
    callback?: (err: Error | null, result?: number) => void
  ): void {
    if (typeof query === 'function') {
      callback = query;
      query = {};
    }
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    if (!options) options = {};

    const params: { collection: string; query: Record<string, unknown>; skip?: number; limit?: number } = {
      collection: this._name,
      query: (query as Record<string, unknown>) || {}
    };

    if ((options as Record<string, unknown>).limit) {
      params.limit = (options as Record<string, unknown>).limit as number;
    }
    if ((options as Record<string, unknown>).skip) {
      params.skip = (options as Record<string, unknown>).skip as number;
    }

    this._proxy
      .count(params)
      .then((result) => callback!(null, result))
      .catch((err: Error) => callback!(err));
  }

  insert(
    documents: VDocument | VDocument[],
    options?: Record<string, unknown> | ((err: Error | null, result?: unknown) => void),
    callback?: (err: Error | null, result?: unknown) => void
  ): void {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    if (!this._writable) {
      throw new Error('Not implemented');
    }
    this._proxy
      .insert({ collection: this._name, documents })
      .then((result) => {
        if (callback) callback(null, result);
      })
      .catch((err: Error) => {
        if (callback) callback(err);
      });
  }

  save(
    documents: VDocument | VDocument[],
    options?: Record<string, unknown> | ((err: Error | null, result?: unknown) => void),
    callback?: (err: Error | null, result?: unknown) => void
  ): void {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    if (!this._writable) {
      throw new Error('Not implemented');
    }
    this._proxy
      .save({ collection: this._name, documents })
      .then((result) => {
        if (callback) callback(null, result);
      })
      .catch((err: Error) => {
        if (callback) callback(err);
      });
  }

  remove(
    query: Record<string, unknown>,
    options?: Record<string, unknown> | ((err: Error | null, result?: unknown) => void),
    callback?: (err: Error | null, result?: unknown) => void
  ): void {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    if (!this._writable) {
      throw new Error('Not implemented');
    }
    this._proxy
      .remove({ collection: this._name, query })
      .then((result) => {
        if (callback) callback(null, result);
      })
      .catch((err: Error) => {
        if (callback) callback(err);
      });
  }
}

export = Collection;
