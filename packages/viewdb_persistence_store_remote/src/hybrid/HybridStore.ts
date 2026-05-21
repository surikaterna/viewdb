import Promise from "bluebird";
import _ from "lodash";
import HybridCollection from "./HybridCollection";

interface HybridStoreOptions {
  syncWrites: boolean;
  cacheReads: boolean;
  localFirst: boolean;
  throwRemoteErr: boolean;
  throttleObserveRefresh: number;
  cacheLifeTime: number;
  cacheQueries: boolean;
  localOnlyCollections: Set<string>;
  cacheCollectionName: string;
  projectedDocumentsCollection: string;
  queryMaxTime?: number;
  loggingEnabled?: boolean;
}

const defaultOptions: HybridStoreOptions = {
  syncWrites: false, // if local writes should be sent over the wire to remote
  cacheReads: true, // when reading remote documents should they be stored in the local db
  localFirst: true, // when reading documents should we return the locally cached ones first and then the remote ones when they arrive
  throwRemoteErr: false, // if remote throws should we swallow them or throw them to client
  throttleObserveRefresh: 200,
  cacheLifeTime: 2, // Time in minutes that the cache should be alive
  cacheQueries: false,
  localOnlyCollections: new Set<string>(),
  cacheCollectionName: "_cache",
  projectedDocumentsCollection: "_projected_cache",
};

class HybridStore {
  _local: any;
  _remote: any;
  _options: HybridStoreOptions;
  _collections: Record<string, any>;

  constructor(local: any, remote: any, options?: Partial<HybridStoreOptions>) {
    this._local = local;
    this._remote = remote;
    this._options = _.defaults(options || {}, defaultOptions);
    this._collections = {};

    if (this._options.cacheQueries) {
      this._collections[this._options.cacheCollectionName] = local.collection(this._options.cacheCollectionName);
      this._collections[this._options.projectedDocumentsCollection] = local.collection(
        this._options.projectedDocumentsCollection
      );
      setInterval(this._cleanCachedData.bind(this), 1000 * 60 * 30); // Clean every 30 minutes
    }
  }

  open(): Promise<HybridStore> {
    const self = this;
    const storesToOpen: any[] = [];
    if (this._local.open) {
      storesToOpen.push(this._local.open());
    }
    if (this._remote.open) {
      storesToOpen.push(this._remote.open());
    }

    return Promise.all(storesToOpen).then(function () {
      return self;
    });
  }

  collection(name: string): any {
    let collection = this._collections[name];
    if (!collection) {
      const local = this._local.collection(name);

      if (this._options.localOnlyCollections.has(name)) {
        this._collections[name] = local;
      } else {
        const remote = this._remote.collection(name);
        this._collections[name] = new HybridCollection(
          local,
          remote,
          name,
          this._options,
          this._collections[this._options.cacheCollectionName],
          this._collections[this._options.projectedDocumentsCollection]
        );
      }

      collection = this._collections[name];
    }
    return collection;
  }

  _cleanCachedData(): void {
    const self = this;
    const minimumChangeDateTime = new Date();
    minimumChangeDateTime.setMinutes(minimumChangeDateTime.getMinutes() - this._options.cacheLifeTime);
    const maxTimeEpoch = minimumChangeDateTime.getTime();

    // Clean cached query first to prevent query not pointing at anything
    this._cleanCollection(this._collections[this._options.cacheCollectionName], maxTimeEpoch, "createDateTime");

    _.forEach(this._collections, function (collection: any, collectionName: string) {
      if (collectionName === self._options.cacheCollectionName) {
        return;
      }

      self._cleanCollection(collection._local || collection, maxTimeEpoch);
    });
  }

  _cleanCollection(collection: any, maxEpoch: number, propertyName?: string): void {
    const comparisonPropertyName = propertyName || "_insertedAt";
    collection.remove({ [comparisonPropertyName]: { $lt: maxEpoch } }, null);
  }
}

export default HybridStore;
