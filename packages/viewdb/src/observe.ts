import Kuery from "kuery";
import _ from "lodash";
import merge from "./merger";
import { CollectionLike, ObserveOptions, QueryObject, VDocument } from "./types";

class Observer {
  _query: QueryObject;
  _queryOptions: QueryObject;
  _options: ObserveOptions;
  _collection: CollectionLike;
  _cache: VDocument[] | null;
  _refreshPending: boolean;

  constructor(query: QueryObject, queryOptions: QueryObject, collection: CollectionLike, options: ObserveOptions) {
    this._query = query;
    this._queryOptions = queryOptions;
    this._options = options;
    this._collection = collection;
    this._cache = [];
    this._refreshPending = false;

    const self = this;
    const enableBatching = options.enableBatching === true;

    const listener = function (changedDocs?: VDocument[]) {
      if (self._cache !== null && self.isIrrelevant(changedDocs)) {
        return;
      }

      if (enableBatching) {
        if (!self._refreshPending) {
          self._refreshPending = true;
          queueMicrotask(() => {
            self._refreshPending = false;
            if (self._cache !== null) {
              self.refresh();
            }
          });
        }
      } else {
        self.refresh();
      }
    };
    collection.on("change", listener);
    this.refresh(true);

    return {
      stop: function () {
        self._cache = null;
        collection.removeListener("change", listener);
      },
    } as any;
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
    const self = this;
    this._collection._getDocuments(this._query, function (err: Error | null, result?: VDocument[]) {
      if (initial && self._options.init) {
        self._cache = result!;
        self._options.init(result!);
      } else {
        const old = self._cache;
        self._cache = merge(
          old,
          result!,
          _.defaults(
            {
              comparatorId: function (a: VDocument, b: VDocument) {
                return _.get(a, "_id") === _.get(b, "_id");
              },
              keyFn: function (doc: VDocument) {
                return String(_.get(doc, "_id"));
              },
            },
            self._options
          )
        );
      }
    });
  }
}

export default Observer;
