import Kuery from "kuery";
import _ from "lodash";
import { LoggerFactory } from "slf";
import type { ObserveHandle, ObserveOptions } from "viewdb";
import { merge, ViewDBObserver } from "viewdb";
import { projectDocument } from "./utils";

const log = LoggerFactory.getLogger("viewdb:mongodb:observer");

class MongoDBObserver {
  _queryOptions!: {
    query?: any;
    skip?: number;
    limit?: number;
    sort?: Record<string, 1 | -1>;
    project?: Record<string, 0 | 1>;
  };
  _query: any;
  _options!: ObserveOptions;
  _collection: any;
  _cache: string[] | null = [];
  listener: any = undefined;
  _kuery: any;

  constructor(query: any, queryOptions: any, collection: any, options: any, oplogListener?: any) {
    const self = this;
    self._queryOptions = queryOptions;

    if (!oplogListener) {
      return new ViewDBObserver(query, queryOptions, collection, options) as any;
    }
    const namespace = collection._collection.s.namespace;
    this._query = query;
    this._options = options;
    this._collection = collection;
    this._cache = [];
    this.listener = undefined;
    this._kuery = new Kuery(this._query.query);

    self.loadInitial(function () {
      self.listener = oplogListener.listen(namespace, self._onOperation, self);
    });

    const dispose = function () {
      if (self.listener) {
        self.listener.dispose();
      }
      self._cache = null;
      return Promise.resolve();
    };
    return {
      stop: dispose,
      dispose: dispose,
    } as any;
  }

  loadInitial(cb: () => void): void {
    const self = this;
    const newQuery = _.merge(this._query, self._queryOptions);
    this._collection._getDocuments(newQuery, function (_err: Error | null, result?: any[]) {
      const documents = result || [];
      if (self._options.init) {
        self._options.init(documents);
      } else {
        merge(null, documents, _.defaults({ comparatorId: comparator }, self._options));
      }
      self._cache = _.map(documents, "_id");
      cb();
    });
  }

  _onOperation(doc: any): void {
    if (!this._cache) {
      log.warn("Got oplog event for document but cache was already disposed");
      return;
    }
    switch (doc.op) {
      case "i":
        this._onInsert(doc);
        break;
      case "u":
        this._onUpdate(doc);
        break;
      case "d":
        this._onRemove(doc);
        break;
      default:
        log.warn("Unhandled operation: %s", doc.op);
        break;
    }
  }

  _checkKuery(coll: any[]): boolean {
    const res = this._kuery.find(coll);
    return res && res.length > 0;
  }

  _onInsert(doc: any): void {
    const index = this._cache!.indexOf(doc.o._id);
    const match = this._checkKuery([doc.o]);
    if (match) {
      if (index > -1) {
        // already in cache - user has been notified by loadInitial method
      } else {
        const length = this._cache!.push(doc.o._id);
        let document = doc.o;
        const project = this._queryOptions.project;

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
    const match = this._checkKuery([doc.o]);
    if (match) {
      let index = this._cache!.indexOf(doc.o._id);
      if (index !== -1) {
        this._cache![index] = doc.o._id;
      } else {
        const length = this._cache!.push(doc.o._id);
        index = length - 1;
      }
      if (this._options.changed) {
        this._options.changed(null as any, doc.o, index); // have no access to asis / old document
      }
    } else {
      this._onRemove(doc);
    }
  }

  _onRemove(doc: any): void {
    const index = this._cache!.indexOf(doc.o._id);
    if (index > -1) {
      this._cache!.splice(index, 1);
      if (this._options.removed) {
        this._options.removed(doc.o, index);
      }
    }
  }
}

const comparator = function (a: { _id: string }, b: { _id: string }) {
  return a._id === b._id;
};

export default MongoDBObserver;
