import { defaults, get } from 'lodash';
import merge from './merger';

export class Observer {
  _query: any;
  _queryOptions: any;
  _options: any;
  _collection: any;
  _cache: any;

  constructor(query: any, queryOptions: any, collection: any, options: any) {
    this._query = query;
    this._queryOptions = queryOptions;
    this._options = options;
    this._collection = collection;
    this._cache = [];

    collection.on('change', this.listener);
    this.refresh(true);
  }

  stop = () => {
    this._cache = null;
    this._collection.removeListener('change', this.listener);
  };

  private listener = () => {
    this.refresh();
  };

  private refresh = (initial?: boolean) => {
    this._collection._getDocuments(this._query, (_err: any, result: any[]) => {
      if (initial && this._options.init) {
        this._cache = result;
        this._options.init(result);
      } else {
        var old = this._cache;

        this._cache = merge(old, result, defaults({
          comparatorId: (a: any, b: any) => {
            return get(a, '_id') === get(b, '_id');
          }
        }, this._options));
        //rewind cursor for next query...
      }
    });
  };
}

export default Observer;
