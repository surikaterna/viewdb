import { EventEmitter } from 'events';
import { forEach, isFunction, isArray } from 'lodash';
import Cursor = require('./cursor');
import { nodeify } from './utils';

var wrapCallback = function (args: any, cb: () => void) {
  var realCb = args[args.length - 1];
  if (isFunction(realCb)) {
    args[args.length - 1] = function () {
      cb();
      realCb.apply(null, arguments);
    };
  } else {
    args = Array.prototype.slice.call(args);
    args.push(cb);
  }
  return args;
};

class Collection extends EventEmitter {
  _collection: any;
  _oplogListener: any;

  constructor(collection: any, oplogListener?: any) {
    super();
    this._collection = collection;
    this._oplogListener = oplogListener;
  }

  count(): any {
    return this._collection.count.apply(this._collection, arguments);
  }

  find(query: any, options?: any): Cursor {
    var cursor = this._collection.find.apply(this._collection, arguments);
    return new Cursor(this, { query: query }, options, cursor, this._oplogListener);
  }

  findAndModify(query: any, sort: any, update: any, options: any, cb?: any): Promise<any> {
    if (sort) {
      Object.assign(options, sort);
    }
    const self = this;
    function callback(err: any, doc?: any) {
      self.emit('change', { findAndModify: update });
      if (isFunction(cb)) {
        cb(err, doc);
      }
    }
    return new Promise((resolve, reject) => {
      this._collection
        .findOneAndUpdate(query, update, options)
        .then(function (res: any) {
          resolve(res);
          callback(null, res);
        })
        .catch(function (err: any) {
          reject(err);
          callback(err);
        });
    });
  }

  updateMany(query: any, update: any, options?: any, cb?: any): any {
    var self = this;
    var args = wrapCallback(arguments, function () {
      self.emit('change', { updateMany: update });
    });
    if (isFunction(options)) {
      cb = options;
    }
    return nodeify(this._collection.updateMany.apply(this._collection, args), cb);
  }

  updateOne(query: any, update: any, options?: any, cb?: any): any {
    var self = this;
    var args = wrapCallback(arguments, function () {
      self.emit('change', { updateOne: update });
    });
    if (isFunction(options)) {
      cb = options;
    }
    return nodeify(this._collection.updateOne.apply(this._collection, args), cb);
  }

  remove(query: any, options?: any, cb?: any): any {
    console.warn('Deprecated: use deleteMany or deleteOne instead');
    var self = this;
    var args = wrapCallback(arguments, function () {
      self.emit('change', { remove: query });
    });
    if (isFunction(options)) {
      cb = options;
    }
    return nodeify(this._collection.deleteMany.apply(this._collection, args), cb);
  }

  deleteMany(query: any, _options?: any): any {
    var self = this;
    var args = wrapCallback(arguments, function () {
      self.emit('change', { remove: query });
    });
    return this._collection.deleteMany.apply(this._collection, args);
  }

  deleteOne(query: any, _options?: any): any {
    var self = this;
    var args = wrapCallback(arguments, function () {
      self.emit('change', { remove: query });
    });
    return this._collection.deleteOne.apply(this._collection, args);
  }

  insert(docs: any, cb?: any): any {
    var self = this;
    var onFulfilled = function () {
      self.emit('change', { insert: docs });
      if (isFunction(cb)) {
        cb(null, docs);
      }
    };
    var onRejected = function (err: any) {
      if (isFunction(cb)) {
        cb(err);
      }
    };
    var promise;
    if (isArray(docs)) {
      promise = this._collection.insertMany(docs).then(onFulfilled).catch(onRejected);
    } else {
      promise = this._collection.insertOne(docs).then(onFulfilled).catch(onRejected);
    }
    return promise;
  }

  save(docs: any, cb?: any): any {
    var self = this;
    if (!isArray(docs)) {
      docs = [docs];
    }
    const operations: any[] = [];
    forEach(docs, function (d: any) {
      if (!d._id) {
        operations.push({ insertOne: { document: d } });
      } else {
        operations.push({ replaceOne: { filter: { _id: d._id }, replacement: d, upsert: true } });
      }
    });
    return this._collection
      .bulkWrite(operations)
      .then(function () {
        self.emit('change', { save: docs });
        if (isFunction(cb)) {
          cb(null, docs);
        }
      })
      .catch(function (err: any) {
        if (isFunction(cb)) {
          cb(err);
        }
      });
  }

  drop(cb?: any): any {
    var self = this;
    var args = wrapCallback(arguments, function () {
      self.emit('change', { drop: true });
    });
    return nodeify(this._collection.drop.apply(this._collection, args), cb);
  }

  createIndex(indexSpec: any, options?: any, cb?: any): any {
    if (isFunction(options)) {
      cb = options;
      options = {};
    }
    return nodeify(this._collection.createIndex(indexSpec, options), cb);
  }

  _getDocuments(queryObject: any, callback: (err: any, result?: any[]) => void): void {
    var query = queryObject.query || queryObject;
    var cursor = this._collection.find(query);
    if (queryObject.skip) {
      cursor.skip(queryObject.skip);
    }
    if (queryObject.limit) {
      cursor.limit(queryObject.limit);
    }
    if (queryObject.sort) {
      cursor.sort(queryObject.sort);
    }
    if (queryObject.project) {
      cursor.project(queryObject.project);
    }
    cursor.toArray().then(function (res: any, err: any) {
      if (err) {
        callback(err);
      } else {
        callback(null, res);
      }
    });
  }
}

export = Collection;
