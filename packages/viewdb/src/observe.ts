import _ = require('lodash');
import merge = require('./merger');

class Observer {
  _query: any;
  _queryOptions: any;
  _options: any;
  _collection: any;
  _cache: any[] | null;

  constructor(query: any, queryOptions: any, collection: any, options: any) {
    this._query = query;
    this._queryOptions = queryOptions;
    this._options = options;
    this._collection = collection;
    this._cache = [];

    const self = this;
    const listener = function () {
      self.refresh();
    };
    collection.on('change', listener);
    this.refresh(true);

    // The constructor returns a plain object, not `this`.
    // This matches the original JS behavior.
    return {
      stop: function () {
        self._cache = null;
        collection.removeListener('change', listener);
      }
    } as any;
  }

  refresh(initial?: boolean): void {
    const self = this;
    this._collection._getDocuments(this._query, function (err: any, result: any[]) {
      if (initial && self._options.init) {
        self._cache = result;
        self._options.init(result);
      } else {
        const old = self._cache;
        self._cache = merge(
          old,
          result,
          _.defaults(
            {
              comparatorId: function (a: any, b: any) {
                return _.get(a, '_id') === _.get(b, '_id');
              }
            },
            self._options
          )
        );
      }
    });
  }
}

export = Observer;
