import Promise = require('bluebird');
import _ = require('lodash');
import { v4 as uuid } from 'uuid';
import Kuery = require('kuery');
import { EventEmitter } from 'events';

var ViewDB = require('viewdb');
var Cursor = ViewDB.Cursor;

class Collection extends EventEmitter {
  static Cursor: any = Cursor;
  _db: IDBDatabase;
  _name: string;

  constructor(db: IDBDatabase, name: string) {
    super();
    this._db = db;
    this._name = name;
  }

  _isIdentityQuery(query: Record<string, any>, _options?: Record<string, any>): boolean {
    var keys = Object.keys(query);
    if (keys.length === 1 && (keys[0] === 'id' || keys[0] === '_id') && (typeof query['id'] === 'string' || typeof query['_id'] === 'string')) {
      return true;
    } else {
      return false;
    }
  }

  find(query: any, options?: any): any {
    if (this._isIdentityQuery(query)) {
      return new Cursor(this, { query: query }, options, this._getByKey.bind(this));
    } else {
      return new Cursor(this, { query: query }, options, this._getDocuments.bind(this));
    }
  }

  _getKey(document: Record<string, any>): string {
    return this._name + '_' + document['_id'];
  }

  insert(documents: any, options?: any, callback?: any): any {
    return this._write('add', documents, options, callback);
  }

  _write(op: string, documents: any, options?: any, callback?: any): any {
    var self = this;
    if (_.isFunction(options)) {
      callback = options;
      options = null;
    }

    if (!_.isArray(documents)) {
      documents = [documents];
    }

    return new Promise(function (resolve, reject) {
      var txn: IDBTransaction = self._db.transaction(['documents'], 'readwrite');
      var docs: IDBObjectStore = txn.objectStore('documents');

      txn.oncomplete = (txn as any).onsuccess = function () {
        self.emit('change', documents);
        process.nextTick(function () {
          resolve(documents);
        });
      };

      txn.onerror = function (event: Event) {
        reject(new Error(String(event)));
      };
      var currentIndex = 0;
      var numberOfDocs = documents.length;
      function addNext() {
        var document = documents[currentIndex++];
        if (!_.has(document, '_id')) {
          document['_id'] = document['id'] || uuid();
        }
        document.$collection = self._name;
        document.$collectionKey = self._getKey(document);
        var request: IDBRequest = (docs as any)[op](document);
        request.onsuccess = function () {
          if (currentIndex < numberOfDocs) {
            addNext();
          }
        };
        request.onerror = function (event: Event) {
          reject(new Error(String(event)));
        };
      }
      addNext();
    }).nodeify(callback);
  }

  save(documents: any, options?: any, callback?: any): any {
    return this._write('put', documents, options, callback);
  }

  drop(callback?: any): void {
    var txn = this._db.transaction(['documents'], 'readwrite');
    var docs = txn.objectStore('documents');
    var cursor = docs.index('$collection').openCursor(this._name);
    cursor.onerror = function (event: Event) {
      if (callback) {
        callback(new Error(String(event)));
      } else {
        console.log(event);
      }
    };
    cursor.onsuccess = function (event: Event) {
      var c = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (c) {
        c.delete();
        c.continue();
      } else {
        if (callback) {
          callback(null);
        }
      }
    };
  }

  remove(query: any, options?: any, callback?: any): void {
    var self = this;
    if (_.isFunction(options)) {
      callback = options;
      options = null;
    }
    if (!callback) {
      callback = function () {};
    }

    this._getDocuments(query, function (err: Error | null, res: any) {
      if (err) {
        callback(err);
      } else {
        var txn = self._db.transaction(['documents'], 'readwrite');
        txn.oncomplete = (txn as any).onsuccess = function () {
          self.emit('change', { remove: query });
          callback(null);
        };

        txn.onerror = function (event: Event) {
          callback(new Error(String(event)));
        };
        var docs = txn.objectStore('documents');
        _.forEach(res, function (doc: any) {
          var key = self._getKey(doc);
          var delReq = docs.delete(key);
        });
      }
    });
  }

  _getDocuments(query: any, callback: (err: Error | null, result?: any[]) => void): void {
    var qry = query.query || query;
    var txn = this._db.transaction(['documents'], 'readonly');
    var docs = txn.objectStore('documents');
    var cursor = docs.index('$collection').openCursor(this._name);
    var result: any[] = [];
    cursor.onerror = function (event: Event) {
      callback(new Error(String(event)));
    };
    cursor.onsuccess = function (event: Event) {
      var c = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (c) {
        result.push(c.value);
        c.continue();
      } else {
        var q = new Kuery(qry);
        query.sort && q.sort(query.sort);
        query.skip && q.skip(query.skip);
        query.limit && q.limit(query.limit);
        callback(null, q.find(result));
      }
    };
  }

  _getByKey(query: any, callback: (err: Error | null, result?: any[]) => void): void {
    var qry = query.query || query;
    var txn = this._db.transaction(['documents'], 'readonly');
    var docs = txn.objectStore('documents');
    var key = qry['id'] || qry['_id'];
    key = this._name + '_' + key;
    var request = docs.get(key);
    request.onsuccess = function (_event: Event) {
      var result: any[] = [];
      if (request.result !== undefined) {
        result.push(request.result);
      }
      callback(null, result);
    };
    request.onerror = function (_event: Event) {
      callback(new Error('Unable to _getByKey ' + key));
    };
  }
}

export = Collection;
