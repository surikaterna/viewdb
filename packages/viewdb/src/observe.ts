import _ = require('lodash');
import merge = require('./merger');
import { QueryObject, VDocument, ObserveOptions, CollectionLike } from './types';

class Observer {
  _query: QueryObject;
  _queryOptions: QueryObject;
  _options: ObserveOptions;
  _collection: CollectionLike;
  _cache: VDocument[] | null;
  private _boundListener: () => void;

  constructor(query: QueryObject, queryOptions: QueryObject, collection: CollectionLike, options: ObserveOptions) {
    this._query = query;
    this._queryOptions = queryOptions;
    this._options = options;
    this._collection = collection;
    this._cache = [];

    this._boundListener = this._onCollectionChange.bind(this);
    collection.on('change', this._boundListener);
    this.refresh(true);

    // The constructor returns a plain object, not `this`.
    // This matches the original JS behavior.
    const self = this;
    return {
      stop: function () {
        self._cache = null;
        collection.removeListener('change', self._boundListener);
      }
    } as any;
  }

  private _onCollectionChange(): void {
    this.refresh();
  }

  refresh(initial?: boolean): void {
    const self = this;
    this._collection._getDocuments(this._query, function (err: Error | null, result?: VDocument[]) {
      if (initial && self._options.init) {
        self._cache = result!;
        self._options.init(result!);
      } else {
        const old = self._cache;
        self._cache = merge(
          old,
          result!,
          _.defaults(
            {
              comparatorId: function (a: VDocument, b: VDocument) {
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
