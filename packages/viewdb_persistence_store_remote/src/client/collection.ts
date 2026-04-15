import Promise = require('bluebird');
import _ = require('lodash');
import Cursor = require('./cursor');
import { EventEmitter } from 'events';
import { v4 as uuid } from 'node-uuid';

class Collection extends EventEmitter {
  static Cursor: any = Cursor;
  _client: any;
  _name: string;

  constructor(client: any, collectionName: string) {
    super();
    this._client = client;
    this._name = collectionName;
  }

  find(query: any, options?: any): any {
    if (this._isIdentityQuery(query)) {
      var id = query.id;
      return [];
    }
    return new Cursor(this, { query: query }, options, this._getDocuments.bind(this));
  }

  insert(_document: any, _options?: any, _callback?: any): void {
    throw new Error('Not implemented');
  }

  save(_document: any, _options?: any, _callback?: any): void {
    throw new Error('Not implemented');
  }

  remove(_document: any, _options?: any, _callback?: any): void {
    throw new Error('Not implemented');
  }

  _buildParams(query: any, method?: string): Record<string, any> {
    var q = query.query || query;
    var skip: number | undefined;
    var limit: number | undefined;
    var sort: Record<string, 1 | -1> | undefined;
    var project: Record<string, 0 | 1> | undefined;
    if (query.query) {
      skip = query.skip;
      limit = query.limit;
      sort = query.sort;
      project = query.project;
    }
    var params: any = {
      collection: this._name,
      skip: skip,
      limit: limit,
      find: q,
      sort: sort
    };
    if (method) {
      params.method = method;
    }
    if (project) {
      params.project = project;
    }

    return params;
  }

  _getDocuments(query: any, callback: (err: Error | null, result?: any) => void): void {
    var params = this._buildParams(query);
    this._client.request(params, function (err: Error | null, res: any) {
      if (err) {
        callback(err);
      } else {
        callback(null, res);
      }
    });
  }

  count(query?: any, options?: any, callback?: any): void {
    if (_.isFunction(query)) {
      callback = query;
      query = {};
    }
    if (_.isFunction(options)) {
      callback = options;
      options = {};
    }

    var params: any = {
      id: uuid(),
      count: query,
      collection: this._name
    };

    if (options) {
      if (options.limit) {
        params.limit = options.limit;
      }
      if (options.skip) {
        params.skip = options.skip;
      }
    }

    this._client.request(params, function (err: Error | null, result: any) {
      callback(err, result);
    });
  }

  _isIdentityQuery(_query: Record<string, any>): boolean {
    return false;
  }
}

export = Collection;
