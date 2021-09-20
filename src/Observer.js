import { defaults, get } from 'lodash';
import merge from './merge';

export default class Observer {
  constructor(query, queryOptions, collection, options) {
    this._query = query;
    this._options = options;
    this._collection = collection;
    this._cache = [];

    this._mergeOptions = defaults(
      {
        comparatorId: indexedIdComparator
      },
      this._options
    )

    const listener = () => {
      this.refresh();
    };

    collection.on('change', listener);
    this.refresh(true);

    return {
      stop: () => {
        this._cache = null;
        collection.removeListener('change', listener);
      }
    };
  }

  refresh = (initial) => {
    this._collection._getDocuments(this._query, (err, result) => {
      if (initial && this._options.init) {
        this._cache = result;
        this._options.init(result);
      } else {
        const old = this._cache;

        this._cache = merge(
          old,
          result,
          this._mergeOptions
        );
      }
    });
  };
}

function indexedIdComparator (firstDocument, secondDocument) {
  return get(firstDocument, '_id') === get(secondDocument, '_id')
}
