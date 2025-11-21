import Kuery, { type QueryObject, type QueryOptions } from "kuery";
import defaults from "lodash/defaults";
import map from "lodash/map";
import merge from "lodash/merge";
import { LoggerFactory } from "slf";
import { type Indexed, merge as mergeDocuments, type ObserverOptions, type ViewDBObserver } from "viewdb";
import type { MongoDBCollection } from "./MongoDBCollection";
import type { Disposable, OperationPayload, OplogListener } from "./OplogListener";
import { projectDocument } from "./utils";

const log = LoggerFactory.getLogger("viewdb_persistence_store_mongodb:observer");

export class MongoDBObserver<T extends Indexed> implements ViewDBObserver {
  private readonly queryOptions: QueryOptions;
  private readonly queryObject: QueryObject<T>;
  private readonly observerOptions: ObserverOptions<T>;
  private readonly collection: MongoDBCollection<T>;
  private cache: string[] | null;
  listener?: Disposable;
  private readonly kuery: Kuery<T>;

  constructor(
    query: QueryObject<T>,
    queryOptions: QueryOptions,
    collection: MongoDBCollection<T>,
    options: ObserverOptions<T>,
    oplogListener: OplogListener<T>
  ) {
    this.queryOptions = queryOptions;

    const namespace = collection.namespace;
    this.queryObject = query;
    this.observerOptions = options;
    this.collection = collection;
    this.cache = [];
    this.listener = undefined;
    this.kuery = new Kuery(this.queryObject.query);

    this.loadInitial(() => {
      this.listener = oplogListener.listen(namespace, this.onOperation, this);
    });
  }

  stop() {
    this.listener?.dispose();
    this.cache = null;
  }

  /**
   * @deprecated use stop instead
   */
  dispose() {
    this.stop();
  }

  loadInitial(cb: () => void) {
    const newQuery = merge(this.queryObject, this.queryOptions);

    this.collection
      ._getDocuments(newQuery)
      .then((result) => {
        if (this.observerOptions.init) {
          this.observerOptions.init(result);
        } else {
          mergeDocuments(null, result, defaults({ comparatorId: comparator }, this.observerOptions));
        }

        this.cache = map(result, "_id");
      })
      .finally(cb);
  }

  private onOperation(doc: OperationPayload<T>) {
    if (!this.cache) {
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

  private checkKuery(coll: T[]) {
    const res = this.kuery.find(coll);
    return res && res.length > 0;
  }

  private onInsert(doc: OperationPayload<T>) {
    const index = this.cache.indexOf(doc.o._id);
    const match = this.checkKuery([doc.o]);

    if (!match || index > -1) {
      return;
    }

    const length = this.cache.push(doc.o._id);
    let document = doc.o;
    const project = this.queryOptions.project;

    if (project) {
      document = projectDocument(document, project) as T;
    }

    this.observerOptions.added?.(document, length - 1);
  }

  private onUpdate(doc: OperationPayload<T>) {
    const match = this.checkKuery([doc.o]);

    if (!match) {
      this.onRemove(doc);
      return;
    }

    let index = this.cache.indexOf(doc.o._id);
    if (index !== -1) {
      this.cache[index] = doc.o._id;
    } else {
      const length = this.cache.push(doc.o._id);
      index = length - 1;
    }

    this.observerOptions.changed?.(null, doc.o, index); // have no access to asis / old document
  }

  private onRemove(doc: OperationPayload<T>) {
    const index = this.cache.indexOf(doc.o._id);
    if (index < 0) {
      return;
    }

    this.cache.splice(index, 1);
    this.observerOptions.removed?.(doc.o, index);
  }
}

const comparator = <T extends Indexed>(a: T, b: T) => a._id === b._id;
