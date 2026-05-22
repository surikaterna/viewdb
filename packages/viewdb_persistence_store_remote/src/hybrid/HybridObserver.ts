import _ from "lodash";
import { merge } from "viewdb";
import reconcile from "./reconcile";

function pushArray<T>(arr: T[], arr2: T[]): void {
  arr.push.apply(arr, arr2);
}

function buildOptions(cache: any[], callback: (result: any) => void, removed: any[], isRemote: boolean): any {
  return {
    init: (result: any[]) => {
      if (_.isEmpty(cache)) {
        pushArray(cache, result);
      } else {
        cache.length = 0;
        pushArray(cache, result);
      }
      callback(result);
    },
    added: (e: any, index: number) => {
      cache.splice(index, 0, e);
      if (isRemote && removed.length > 0) {
        removed = [];
      }
      callback(e);
    },
    removed: (e: any, index: number) => {
      cache.splice(index, 1);
      if (removed && !isRemote) {
        removed.push(e._id);
      }
      if (isRemote && removed.length > 0) {
        removed = [];
      }
      callback(e);
    },
    changed: (_asis: any, tobe: any, index: number) => {
      cache[index] = tobe;
      if (isRemote && removed.length > 0) {
        removed = [];
      }
      callback(tobe);
    },
    moved: (e: any, oldIndex: number, newIndex: number) => {
      cache.splice(oldIndex, 1);
      cache.splice(newIndex, 0, e);
      if (isRemote && removed.length > 0) {
        removed = [];
      }
      callback(e);
    },
  };
}

/**
 * @param localCursor Local cursor
 * @param remoteCursor Remote cursor
 * @param collectionOptions Options supplied from collection
 * @param options Options to callback on data change
 */
class HybridObserver {
  _initialized: boolean;
  _localCursor: any;
  _remoteCursor: any;
  _options: any;
  _cacheCallback: any;
  _getCache: any;
  _localCache: any[];
  _remoteCache: any[];
  _removed: any[];
  _reconciledCache: any[];
  _localHandle: { stop: () => void } | null;
  _remoteHandle: { stop: () => void } | null;
  _cacheUpdaterInterval: ReturnType<typeof setInterval> | null;

  constructor(localCursor: any, remoteCursor: any, collectionOptions: any, options: any) {
    const self = this;

    this._initialized = false;
    this._localCursor = localCursor;
    this._remoteCursor = remoteCursor;
    this._options = options;
    this._cacheCallback = options.cacheCallback;
    this._getCache = options.getCache;
    this._localHandle = null;
    this._remoteHandle = null;
    this._cacheUpdaterInterval = null;

    this._localCache = [];
    this._remoteCache = [];
    this._removed = [];
    this._reconciledCache = [];

    // make sure refresh is only called once every x ms
    const _refresh = _.throttle(this.refresh.bind(this), collectionOptions.throttleObserveRefresh);

    const remoteOptions = buildOptions(this._remoteCache, _refresh, this._removed, true);
    if (!this._getCache) {
      this._localHandle = this._localCursor.observe(buildOptions(this._localCache, _refresh, this._removed, false));
      this._remoteHandle = this._remoteCursor.observe(remoteOptions);
    } else {
      this._getCache((_err: Error | null, data: any) => {
        if (data) {
          self._remoteCache.concat(data);
          self.refresh();
          delete remoteOptions.init;
        }
        self._remoteHandle = self._remoteCursor.observe(remoteOptions);
      });

      const cacheUpdater = () => {
        self._cacheCallback(self._remoteCache);
      };

      // While the observer is running, keep the cached data alive
      this._cacheUpdaterInterval = setInterval(
        cacheUpdater,
        1000 * 60 * Math.max(collectionOptions.cacheLifeTime / 2, 1)
      );
    }

    return {
      stop: function () {
        // Help garbage collection? :)
        (this as any)._localCache = null;
        (this as any)._remoteCache = null;
        (this as any)._reconciledCache = null;
        self._localHandle && self._localHandle.stop();
        self._remoteHandle && self._remoteHandle.stop();
        clearInterval(self._cacheUpdaterInterval!);
      },
    } as any;
  }

  refresh(): void {
    let remoteCache = this._remoteCache;
    if (this._removed.length > 0) {
      remoteCache = _.filter(this._remoteCache, (doc: any) => !_.includes(this._removed, doc._id));
    }
    const result = reconcile(this._localCache, remoteCache);

    if (!this._initialized && this._options.init) {
      this._initialized = true;
      this._reconciledCache = result;
      this._options.init(result);
    } else {
      const old = this._reconciledCache;
      this._reconciledCache = merge(
        old,
        result,
        _.defaults(
          {
            comparatorId: (a: { _id: string }, b: { _id: string }) => a._id === b._id,
          },
          this._options
        )
      );
    }

    if (this._cacheCallback && this._getCache) {
      this._cacheCallback(remoteCache);
    }
  }
}

export default HybridObserver;
