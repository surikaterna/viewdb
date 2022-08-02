import { forEach, isFunction } from 'lodash';
import Observe from './Observer';

export default class Cursor {
  constructor(collection, query, options, getDocuments) {
    this._collection = collection;
    this._query = query;
    this._options = options;
    this._getDocuments = getDocuments;
    this._isObserving = false;
  }

  count = function (applySkipLimit, callback) {
    if (isFunction(applySkipLimit)) {
      callback = applySkipLimit;
      applySkipLimit = false;
    }

    const query = { query: this._query.query };
    if (applySkipLimit) {
      if (this._query.skip) {
        query.skip = this._query.skip;
      }

      if (this._query.limit) {
        query.limit = this._query.limit;
      }
    }

    this._getDocuments(query, (err, res) => {
      callback(err, res && res.length);
    });
  };

  forEach = (callback) => {
    this._getDocuments(this._query, (err, result) => {
      forEach(result, () => {
        callback(result);
      });
    });
  };

  limit = (limit) => {
    this._query.limit = limit;

    if (this._isObserving) {
      this._refresh();
    }

    return this;
  };

  observe = (options) => {
    this._isObserving = true;
    return new Observe(this._query, this._options, this._collection, options);
  };

  rewind = (options) => {
    //NOOP
  };

  skip = (skip) => {
    this._query.skip = skip;

    if (this._isObserving) {
      this._refresh();
    }

    return this;
  };

  sort = (sort) => {
    this._query.sort = sort;

    if (this._isObserving) {
      this._refresh();
    }

    return this;
  };

  toArray = (callback) => {
    this._getDocuments(this._query, callback);
  };

  _refresh = () => {
    this._collection.emit('change', {});
  };
}
