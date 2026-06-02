import _ = require('lodash');
import Kuery = require('kuery');
import { projectDocument } from './utils';
import { LoggerFactory } from 'slf';
import type { ObserveOptions } from 'viewdb/dist/types';

var ViewDB = require('viewdb');
var merge = ViewDB.merge;
var LegacyObserver = ViewDB.Observer;

const log = LoggerFactory.getLogger('viewdb:mongodb:observer');

class Observer {
  _queryOptions!: { query?: any; skip?: number; limit?: number; sort?: Record<string, 1 | -1>; project?: Record<string, 0 | 1> };
  _query: any;
  _options!: ObserveOptions;
  _collection: any;
  _cache: string[] | null = [];
  _cacheIndex: Map<string, number> | null = new Map();
  listener: any = undefined;
  _kuery: any;

  constructor(query: any, queryOptions: any, collection: any, options: any, oplogListener?: any) {
    var self = this;
    self._queryOptions = queryOptions;

    if (!oplogListener) {
      return new LegacyObserver(query, queryOptions, collection, options) as any;
    }
    var namespace = collection._collection.s.namespace;
    this._query = query;
    this._options = options;
    this._collection = collection;
    this._cache = [];
    this._cacheIndex = new Map();
    this.listener = undefined;
    this._kuery = new Kuery(this._query.query);

    self.loadInitial(function () {
      self.listener = oplogListener.listen(namespace, self._onOperation, self);
    });

    var dispose = function () {
      if (self.listener) {
        self.listener.dispose();
      }
      self._cache = null;
      self._cacheIndex = null;
      return Promise.resolve();
    };
    return {
      stop: dispose,
      dispose: dispose
    } as any;
  }

  loadInitial(cb: () => void): void {
    var self = this;
    var newQuery = _.merge(this._query, self._queryOptions);
    this._collection._getDocuments(newQuery, function (err: Error | null, result?: any[]) {
      if (self._options.init) {
        self._options.init(result || []);
      } else {
        merge(null, result, _.defaults({ comparatorId: comparator }, self._options));
      }
      self._cache = _.map(result, '_id');
      self._cacheIndex = new Map();
      for (var i = 0; i < self._cache.length; i++) {
        self._cacheIndex.set(self._cache[i], i);
      }
      cb();
    });
  }

  _onOperation(doc: any): void {
    if (!this._cache) {
      log.warn('Got oplog event for document but cache was already disposed');
      return;
    }
    switch (doc.op) {
      case 'i':
        this._onInsert(doc);
        break;
      case 'u':
        this._onUpdate(doc);
        break;
      case 'd':
        this._onRemove(doc);
        break;
      default:
        log.warn('Unhandled operation: %s', doc.op);
        break;
    }
  }

  _checkKuery(doc: any): boolean {
    return this._kuery.test(doc);
  }

  _onInsert(doc: any): void {
    var index = this._cacheIndex!.get(doc.o._id);
    var match = this._checkKuery(doc.o);
    if (match) {
      if (index !== undefined) {
        // already in cache - user has been notified by loadInitial method
      } else {
        var length = this._cache!.push(doc.o._id);
        this._cacheIndex!.set(doc.o._id, length - 1);
        var document = doc.o;
        var project = this._queryOptions.project;

        if (project) {
          document = projectDocument(document, project);
        }

        if (this._options.added) {
          this._options.added(document, length - 1);
        }
      }
    }
  }

  _onUpdate(doc: any): void {
    var match = this._checkKuery(doc.o);
    if (match) {
      var index = this._cacheIndex!.get(doc.o._id);
      if (index !== undefined) {
        this._cache![index] = doc.o._id;
      } else {
        var length = this._cache!.push(doc.o._id);
        index = length - 1;
        this._cacheIndex!.set(doc.o._id, index);
      }
      if (this._options.changed) {
        this._options.changed(null as any, doc.o, index); // have no access to asis / old document
      }
    } else {
      this._onRemove(doc);
    }
  }

  _onRemove(doc: any): void {
    var index = this._cacheIndex!.get(doc.o._id);
    if (index !== undefined) {
      this._cache!.splice(index, 1);
      this._cacheIndex!.delete(doc.o._id);

      // Keep id->index map in sync for all shifted entries.
      for (var i = index; i < this._cache!.length; i++) {
        this._cacheIndex!.set(this._cache![i], i);
      }

      if (this._options.removed) {
        this._options.removed(doc.o, index);
      }
    }
  }
}

var comparator = function (a: { _id: string }, b: { _id: string }) {
  return a._id === b._id;
};

export = Observer;
