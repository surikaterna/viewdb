import { isFunction, forEach} from 'lodash';
import Observe from './observe';

export class Cursor {
  _collection: any;
  _query: any;
  _options: any;
  _getDocuments: any;
  _isObserving: any;

  constructor(collection?: any, query?: any, options?: any, getDocuments?: any) {
    this._collection = collection;
    this._query = query;
    this._options = options;
    this._getDocuments = getDocuments;
    this._isObserving = false;
  }

  forEach =  (callback: any, _thiz: any) => {
    this._getDocuments(this._query,  (_err: any, result: any) => {
      forEach(result,  (_n) => {
        callback(result)
      });
    });
  };

  toArray =  (callback: any) =>{
    this._getDocuments(this._query, callback);
  };

  observe =  (options: any) => {
    this._isObserving = true;
    return new Observe(this._query, this._options, this._collection, options);
  };

  skip = (skip: any) =>{
    this._query.skip = skip;
    if (this._isObserving) {
      this._refresh();
    }
    return this;
  };

  limit =  (limit: any) => {
    this._query.limit = limit;
    if (this._isObserving) {
      this._refresh();
    }
    return this;
  };

  sort =  (sort: any) =>{
    this._query.sort = sort;
    if (this._isObserving) {
      this._refresh();
    }
    return this;
  };

  _refresh =  () => {
    this._collection.emit('change', {});
  };

  rewind =  (_options: any) => {
    //NOOP
  };

  count =  (applySkipLimit: any, callback: any) =>{
    if (isFunction(applySkipLimit)) {
      callback = applySkipLimit;
      applySkipLimit = false;
    }
    var query: any = { query: this._query.query };
    if (applySkipLimit) {
      if (this._query.skip) {
        query.skip = this._query.skip;
      }
      if (this._query.limit) {
        query.limit = this._query.limit;
      }
    }
    this._getDocuments(query, (err: any, res: any) =>{
      callback(err, res && res.length);
    })
  };
}

export default Cursor;
