import { cloneDeep, findIndex, has, isArray, isFunction, isObject, pullAll } from 'lodash';
import { EventEmitter } from 'events';
import Kuery from 'kuery';
import { v4 as uuid } from 'uuid';
import Cursor from '../Cursor';

export default class Collection extends EventEmitter {
  constructor(collectionName) {
    super();

    this._documents = [];
    this._name = collectionName;
  }

  count = (callback) => {
    callback(null, this._documents.length);
  };

  createIndex = (options, callback) => {
    throw new Error('createIndex not supported!');
  };

  drop = (callback) => {
    this._documents = [];

    if (callback) {
      callback(null);
    }
  };

  ensureIndex = (options, callback) => {
    throw new Error('ensureIndex not supported!');
  };

  find = (query, options) => {
    return new Cursor(this, { query: query }, options, this._getDocuments);
  };

  insert = (documents, options, callback) => {
    return this._write('insert', documents, options, callback);
  };

  remove = (query, options, callback) => {
    const q = new Kuery(query);
    const documents = q.find(this._documents);
    this._documents = pullAll(this._documents, documents);

    process.nextTick(function () {
      callback(null);
    });
  };

  save = (documents, options, callback) => {
    return this._write('save', documents, options, callback);
  };

  _getDocuments = (queryObject, callback) => {
    const query = queryObject.query || queryObject;
    const q = new Kuery(query);

    if (queryObject.sort) {
      q.sort(queryObject.sort);
    }

    if (queryObject.skip) {
      q.skip(queryObject.skip);
    }

    if (queryObject.limit) {
      q.limit(queryObject.limit);
    }

    const documents = q.find(this._documents);
    process.nextTick(() => {
      callback(null, cloneDeep(documents));
    });
  };

  _write = (op, documents, options, callback) => {
    if (isFunction(options)) {
      callback = options;
      options = undefined;
    }

    if (!isArray(documents)) {
      documents = [documents];
    }

    for (let i = 0; i < documents.length; i++) {
      const document = documents[i];

      if (!isObject(document)) {
        return callback(new Error('Document must be object'));
      }

      if (!has(document, '_id')) {
        document['_id'] = document['id'] || uuid();
      }

      const idx = findIndex(this._documents, { _id: document['_id'] });

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

    this.emit('change', documents);

    if (callback) {
      callback(null, documents);
    }
  };
}
