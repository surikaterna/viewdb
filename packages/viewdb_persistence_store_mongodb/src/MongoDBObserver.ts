import Kuery, { type TypedQuery } from "kuery";
import _ from "lodash";
import { LoggerFactory } from "slf";
import type { MergeOptions, ObserveOptions, Observer, QueryObject, VDocument } from "viewdb";
import { merge, ViewDBObserver } from "viewdb";
import type MongoDBCollection from "./MongoDBCollection";
import { projectDocument } from "./utils";

const log = LoggerFactory.getLogger("viewdb:mongodb:observer");

export interface OplogListener<T extends VDocument = VDocument> {
  listen: Listener<T>;
}

export type Listener<T extends VDocument = VDocument> = (
  namespace: string,
  onOperation: OnOperation<T>,
  observer: Observer
) => void;
export type OnOperation<T extends VDocument = VDocument> = (doc: DocumentOperation<T>) => void;

type DocumentOperation<T extends VDocument = VDocument> = {
  o: T & { _id: string };
  op: string;
};

class MongoDBObserver<T extends VDocument = VDocument> implements Observer {
  _queryOptions: QueryObject<T>;
  _query!: QueryObject<T>;
  _options!: ObserveOptions<T>;
  _collection!: MongoDBCollection<T>;
  _cache!: string[] | null;
  listener: any = undefined;
  _kuery!: Kuery;

  constructor(
    query: QueryObject<T>,
    queryOptions: QueryObject<T>,
    collection: MongoDBCollection<T>,
    options: ObserveOptions<T>,
    oplogListener?: OplogListener<T>
  ) {
    this._queryOptions = queryOptions;

    if (!oplogListener) {
      return new ViewDBObserver<T>(query, collection, options) as any;
    }

    const namespace = collection._collection.namespace;
    this._query = query;
    this._options = options;
    this._queryOptions = {};
    this._collection = collection;
    this._cache = [];
    this.listener = undefined;
    this._kuery = new Kuery<T>(this._query.query as TypedQuery<T>);

    this.loadInitial().then(() => {
      this.listener = oplogListener.listen(namespace, this.onOperation, this);
    });
  }

  dispose() {
    return this.stop();
  }

  async stop() {
    this.listener?.dispose();
    this._cache = null;
    return Promise.resolve();
  }

  async loadInitial(): Promise<void> {
    const newQuery = _.merge(this._query, this._queryOptions);

    let documents: T[] = [];
    try {
      documents = await this._collection._getDocuments(newQuery);
    } catch {}

    if (this._options.init) {
      this._options.init(documents);
    } else {
      merge<T>(
        null,
        documents,
        _.defaults<MergeOptions<T>, MergeOptions<T>>({ comparatorId: comparator }, this._options)
      );
    }

    this._cache = documents.map((d) => d._id as string);
  }

  private onOperation(doc: DocumentOperation<T>): void {
    if (!this._cache) {
      log.warn("Got oplog event for document but cache was already disposed");
      return;
    }

    switch (doc.op) {
      case "i":
        this.onInsert(doc);
        break;
      case "u":
        this.onUpdate(doc);
        break;
      case "d":
        this.onRemove(doc);
        break;
      default:
        log.warn("Unhandled operation: %s", doc.op);
        break;
    }
  }

  private checkKuery(coll: T[]): boolean {
    const res = this._kuery.find(coll);
    return res && res.length > 0;
  }

  private onInsert(doc: DocumentOperation<T>): void {
    if (!this._cache) {
      this._cache = [];
    }

    const index = this._cache.indexOf(doc.o._id);
    const match = this.checkKuery([doc.o]);

    if (!match) {
      return;
    }

    if (index > -1) {
      // already in cache - user has been notified by loadInitial method
      return;
    }

    if (!doc.o._id) {
      return;
    }

    const length = this._cache.push(doc.o._id);
    let document = doc.o;
    const project = this._queryOptions.project;

    if (project) {
      document = projectDocument(document, project);
    }

    this._options.added?.(document, length - 1);
  }

  private onUpdate(doc: DocumentOperation<T>): void {
    const match = this.checkKuery([doc.o]);

    if (!match) {
      this.onRemove(doc);
      return;
    }

    if (!this._cache) {
      this._cache = [];
    }

    let index = this._cache.indexOf(doc.o._id);
    if (index !== -1) {
      this._cache[index] = doc.o._id;
    } else {
      const length = this._cache.push(doc.o._id);
      index = length - 1;
    }

    this._options.changed?.(null as unknown as T, doc.o, index); // have no access to asis / old document
  }

  private onRemove(doc: DocumentOperation<T>): void {
    if (!this._cache) {
      this._cache = [];
    }

    const index = this._cache.indexOf(doc.o._id);
    if (index < 0) {
      return;
    }

    this._cache.splice(index, 1);
    this._options.removed?.(doc.o, index);
  }
}

const comparator = <T extends VDocument = VDocument>(a: T, b: T) => a._id === b._id;

export default MongoDBObserver;
