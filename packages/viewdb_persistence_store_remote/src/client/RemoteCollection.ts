import { EventEmitter } from "events";
import _ from "lodash";
import type { VdbClient } from "../types";
import RemoteCursor from "./RemoteCursor";

class RemoteCollection extends EventEmitter {
  static Cursor: any = RemoteCursor;
  _client: VdbClient;
  _name: string;

  constructor(client: VdbClient, collectionName: string) {
    super();
    this._client = client;
    this._name = collectionName;
  }

  find(query: any): any {
    if (this._isIdentityQuery(query)) {
      return [];
    }
    return new RemoteCursor(this, { query }, this._getDocuments.bind(this));
  }

  insert(_document: any, _options?: any, _callback?: any): void {
    throw new Error("Not implemented");
  }

  save(_document: any, _options?: any, _callback?: any): void {
    throw new Error("Not implemented");
  }

  remove(_document: any, _options?: any, _callback?: any): void {
    throw new Error("Not implemented");
  }

  _buildParams(query: any, method?: string): Record<string, any> {
    const q = query.query || query;
    let skip: number | undefined;
    let limit: number | undefined;
    let sort: Record<string, 1 | -1> | undefined;
    let project: Record<string, 0 | 1> | undefined;
    if (query.query) {
      skip = query.skip;
      limit = query.limit;
      sort = query.sort;
      project = query.project;
    }
    const params: any = {
      collection: this._name,
      skip: skip,
      limit: limit,
      find: q,
      sort: sort,
    };
    if (method) {
      params.method = method;
    }
    if (project) {
      params.project = project;
    }

    return params;
  }

  _getDocuments(query: any): Promise<any> {
    const params = this._buildParams(query);
    return new Promise((resolve, reject) => {
      this._client.request(params, (err: Error | null, res: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      });
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

    const params: any = {
      id: crypto.randomUUID(),
      count: query,
      collection: this._name,
    };

    if (options) {
      if (options.limit) {
        params.limit = options.limit;
      }
      if (options.skip) {
        params.skip = options.skip;
      }
    }

    this._client.request(params, (err: Error | null, result: any) => {
      callback(err, result);
    });
  }

  _isIdentityQuery(_query: Record<string, any>): boolean {
    return false;
  }
}

export default RemoteCollection;
