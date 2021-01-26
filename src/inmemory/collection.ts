import { isFunction, isArray, isObject, findIndex, has, pullAll, cloneDeep} from 'lodash';
import {v4 as uuid} from 'uuid';
import {EventEmitter} from 'events';
// @ts-ignore
import Kuery from 'kuery';
import Cursor  from '../cursor';

export class Collection extends EventEmitter {
  _documents: any;
  _name: any;

  constructor(collectionName: any) {
    super();

    this._documents = [];
    this._name = collectionName;
  }

  count = (callback: any) => callback(null, this._documents.length);

  _write =  (op: any, documents: any, options: any, callback: any) => {
    if(isFunction(options)) {
      callback = options;
      options = undefined;
    }
    if (!isArray(documents)) {
      documents = [documents];
    }
    for (var i = 0; i < documents.length; i++) {
      var document: any = documents[i];
      if (!isObject(document)) {
        return callback(new Error('Document must be object'));
      }
      if (!has(document, '_id')) {
        (document as any)['_id'] = (document as any)['id'] || uuid();
      }
      var idx = findIndex(this._documents, { _id: (document as any)['_id'] });
      if (op === 'insert' && idx >= 0) {
        return callback(new Error('Unique constraint!'));
      }
      // not stored before
      if (idx === -1) {
        this._documents.push(document);
      } else {
        this._documents[idx] = document;
      }
    }
    this.emit("change", documents);
    if (callback) {
      callback(null, documents);
    }
  }

  insert = (documents: any, options: any, callback: any) => this._write('insert', documents, options, callback);

  save = (documents: any, options: any, callback: any) => this._write('save', documents, options, callback);

  drop =  (callback: any) => {
    this._documents = [];

    if (callback) {
      callback(null);
    }
  };

  find = (query: any, options: any) => new Cursor(this, { query: query }, options, this._getDocuments.bind(this));

  remove =  (query: any, _options: any, callback: any) => {
    var q = new Kuery(query);
    var documents = q.find(this._documents);
    this._documents = pullAll(this._documents, documents);

    process.nextTick(function () {
      callback(null);
    });
  };

  ensureIndex = (_options: any, _callback: any) => {
    throw new Error('ensureIndex not supported!')
  };

  createIndex =  (_options: any, _callback: any) => {
    throw new Error('createIndex not supported!')
  };

  _getDocuments =  (queryObject: any, callback: any) => {
    var query = queryObject.query || queryObject;
    var q = new Kuery(query);
    if (queryObject.sort) {
      q.sort(queryObject.sort);
    }
    if (queryObject.skip) {
      q.skip(queryObject.skip);
    }
    if (queryObject.limit) {
      q.limit(queryObject.limit);
    }
    var documents = q.find(this._documents);
    process.nextTick(function () {
      callback(null, cloneDeep(documents));
    });
  };
}

export default Collection;
