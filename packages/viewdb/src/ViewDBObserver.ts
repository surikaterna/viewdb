import Kuery from "kuery";
import _ from "lodash";
import merge from "./merge";
import type { Collection, ObserveOptions, Observer, QueryObject, VDocument } from "./types";

class ViewDBObserver<T extends VDocument = VDocument> implements Observer {
  _query: QueryObject<T>;
  _options: ObserveOptions<T>;
  _collection: Collection<T>;
  _cache: T[] | null;
  _refreshPending: boolean;
  stop!: () => void;

  constructor(query: QueryObject<T>, collection: Collection<T>, options: ObserveOptions<T>) {
    this._query = query;
    this._options = options;
    this._collection = collection;
    this._cache = [];
    this._refreshPending = false;

    const enableBatching = options.enableBatching === true;

    const listener = (changedDocs?: T[]) => {
      if (this._cache !== null && this.isIrrelevant(changedDocs)) {
        return;
      }

      if (enableBatching) {
        if (!this._refreshPending) {
          this._refreshPending = true;
          queueMicrotask(() => {
            this._refreshPending = false;
            if (this._cache !== null) {
              this.refresh();
            }
          });
        }
      } else {
        this.refresh();
      }
    };
    collection.on("change", listener);
    this.refresh(true);

    this.stop = () => {
      this._cache = null;
      collection.removeListener("change", listener);
    };
  }

  /**
   * Returns true if we can prove the change is irrelevant to this observer.
   * Conservative: returns false (not irrelevant) when in doubt.
   */
  isIrrelevant(changedDocs?: any): boolean {
    if (!changedDocs || !Array.isArray(changedDocs) || changedDocs.length === 0) {
      return false;
    }
    if (!this._cache || !this._query.query) {
      return false;
    }

    const q = new Kuery(this._query.query);
    if (q.find(changedDocs).length > 0) {
      return false;
    }

    const changedIds = new Set<string>();
    for (const d of changedDocs) {
      const id = d._id;
      if (id) changedIds.add(id);
    }

    if (changedIds.size > 0 && this._cache.some((d) => d._id != null && changedIds.has(d._id))) {
      return false;
    }

    return true;
  }

  refresh(initial?: boolean): void {
    this._collection._getDocuments(this._query).then((result) => {
      if (initial && this._options.init) {
        this._cache = result;
        this._options.init(result);
      } else {
        const old = this._cache;
        this._cache = merge(
          old,
          result,
          _.defaults(
            {
              comparatorId: (a: T, b: T) => _.get(a, "_id") === _.get(b, "_id"),
              keyFn: (doc: T) => String(_.get(doc, "_id")),
            },
            this._options
          )
        );
      }
    });
  }
}

export default ViewDBObserver;
