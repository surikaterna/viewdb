import _ = require('lodash');
import { v4 as uuid } from 'uuid';
import { EventEmitter } from 'events';
import Kuery = require('kuery');
import Cursor = require('../cursor');

class Collection extends EventEmitter {
  _documents: any[];
  _name: string;

  constructor(collectionName: string) {
    super();
    this._documents = [];
    this._name = collectionName;
  }

  count(callback: (err: any, count?: number) => void): void {
    callback(null, this._documents.length);
  }

  _write(op: string, documents: any, options: any, callback?: (err: any, docs?: any[]) => void): void {
    if (_.isFunction(options)) {
      callback = options;
    }
    if (!_.isArray(documents)) {
      documents = [documents];
    }
    for (let i = 0; i < documents.length; i++) {
      const document: Record<string, any> = documents[i];
      if (!_.isObject(document)) {
        return callback!(new Error('Document must be object'));
      }
      if (!_.has(document, '_id')) {
        document._id = document.id || uuid();
      }
      const idx = _.findIndex(this._documents, { _id: document._id });
      if (op === 'insert' && idx >= 0) {
        return callback!(new Error('Unique constraint!'));
      }
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
  }

  insert(documents: any, options?: any, callback?: (err: any, docs?: any[]) => void): void {
    return this._write('insert', documents, options, callback);
  }

  save(documents: any, options?: any, callback?: (err: any, docs?: any[]) => void): void {
    return this._write('save', documents, options, callback);
  }

  drop(callback?: (err: any) => void): void {
    this._documents = [];
    if (callback) {
      callback(null);
    }
  }

  find(query: any, options?: any): Cursor {
    return new Cursor(this, { query: query }, options, this._getDocuments.bind(this));
  }

  remove(query: any, options?: any, callback?: (err: any) => void): void {
    const q = new Kuery(query);
    const documents = q.find(this._documents);
    this._documents = _.pullAll(this._documents, documents);

    process.nextTick(function () {
      callback!(null);
    });
  }

  ensureIndex(): never {
    throw new Error('ensureIndex not supported!');
  }

  createIndex(): never {
    throw new Error('createIndex not supported!');
  }

  _getDocuments(queryObject: any, callback: (err: any, docs?: any[]) => void): void {
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
      callback(null, _.cloneDeep(documents));
    });
  }
}

export = Collection;
