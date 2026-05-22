import Kuery from "kuery";
import _ from "lodash";
import { LoggerFactory } from "slf";
import HybridObserver from "./HybridObserver";
import reconcile from "./reconcile";
import TimeTracker from "./TimeTracker";

const LOG = LoggerFactory.getLogger("viewdb:remote:hybrid-cursor");

class HybridCursor {
  _query: any;
  _sort: Record<string, 1 | -1> | undefined;
  _limit: number | undefined;
  _skip: number;
  _local: any;
  _remote: any;
  _findOptions: any;
  _options: any;
  _onCacheUpdateCallback: any;
  _getCachedData: any;
  _project: Record<string, 0 | 1> | undefined;

  constructor(query: any, local: any, remote: any, findOptions: any, options: any) {
    this._query = query;
    this._sort = undefined;
    this._limit = undefined;
    this._skip = 0;
    this._local = local;
    this._remote = remote;
    this._findOptions = findOptions;
    this._options = options;
    this._onCacheUpdateCallback = options.onCacheUpdateCallback;
    this._getCachedData = options.getCachedData;
  }

  _toArray(callback: any): void {
    const self = this;
    let localData: any[] | null = null;
    let remoteData: any[] | null = null;
    let localErr: Error | null = null;
    let remoteErr: Error | null = null;
    const kuery = new Kuery(this._query);
    const sort = this._sort;
    const limit = this._limit;
    const skip = this._skip;
    const project = this._project;

    if (sort) {
      kuery.sort(sort);
    }
    if (limit) {
      kuery.limit(limit);
    }
    if (skip) {
      kuery.skip(skip);
    }

    function serverResult(err: Error | null, result: any) {
      if (err) {
        remoteErr = err;
        result = result || [];
        if (self._options.throwRemoteErr) {
          return callback(err);
        }
      }
      remoteData = result;
      if (localData) {
        const combinedResult = kuery.find(reconcile(localData, remoteData!));
        callback(null, combinedResult);
        if (_.isFunction(self._onCacheUpdateCallback)) {
          self._onCacheUpdateCallback(self._query, skip, limit, sort, project, combinedResult);
        }
      }
    }

    function localResult(err: Error | null, result: any) {
      if (err) {
        localErr = err;
        return callback(err, result);
      }

      localData = result;
      if (remoteData || remoteErr) {
        if (!(remoteErr && self._options.throwRemoteErr)) {
          const combinedResult = kuery.find(reconcile(localData!, remoteData || []));
          callback(null, combinedResult);
          if (_.isFunction(self._onCacheUpdateCallback)) {
            self._onCacheUpdateCallback(self._query, skip, limit, sort, project, combinedResult);
          }
        }
      } else {
        if (self._options.localFirst) {
          callback(err, localData);
        }
      }
    }

    if (sort) {
      this._local.sort(sort);
      this._remote.sort(sort);
    }
    if (limit) {
      this._local.limit(limit);
      this._remote.limit(limit);
    }
    if (skip) {
      this._local.skip(skip);
      this._remote.skip(skip);
    }
    if (project && _.isFunction(this._remote.project)) {
      this._remote.project(project);
    }

    this._local.toArray().then(
      (result: any) => localResult(null, result),
      (err: Error) => localResult(err, [])
    );
    this._remote.toArray().then(
      (result: any) => serverResult(null, result),
      (err: Error) => serverResult(err, [])
    );
  }

  toArray(callback: any): void {
    const self = this;
    const timeTracker = new TimeTracker();
    let wrappedCallback = callback;

    if (this._options.loggingEnabled) {
      wrappedCallback = function () {
        timeTracker.stop();
        const queryTime = timeTracker.getExecutionTime();
        if (queryTime > self._options.queryMaxTime) {
          LOG.warn(
            "Query %j, took longer than allowed max time of %s seconds.",
            self._query,
            self._options.queryMaxTime
          );
        }

        return callback.apply(self, arguments);
      };
    }
    timeTracker.start();
    if (this._options.cacheQueries && this._getCachedData) {
      this._getCachedData(
        this._query,
        this._skip,
        this._limit,
        this._sort,
        this._project,
        (_err: Error | null, data: any) => {
          if (data) {
            wrappedCallback(null, data);
            return;
          }

          self._toArray(wrappedCallback);
        }
      );
    } else {
      this._toArray(wrappedCallback);
    }
  }

  _refresh(): void {
    this._remote._refresh();
    this._local._refresh();
  }

  sort(sort: Record<string, 1 | -1>): this {
    this._sort = sort;
    return this;
  }

  limit(limit: number): this {
    this._limit = limit;
    return this;
  }

  skip(skip: number): this {
    this._skip = skip;
    return this;
  }

  updateQuery(query: any): void {
    this._local._query.query = query;
    this._remote._query.query = query;
    this._query = query;
    this._refresh();
  }

  _onObserverCacheUpdate(result: any): void {
    if (_.isFunction(this._onCacheUpdateCallback)) {
      this._onCacheUpdateCallback(this._query, this._skip, this._limit, this._sort, this._project, result);
    }
  }

  _getObserverData(callback: any): void {
    this._getCachedData(this._query, this._skip, this._limit, this._sort, this._project, callback);
  }

  _count(_options: any, callback: any): void {
    const self = this;
    let localCount: any = null;
    let remoteCount: any = null;

    const timeTracker = new TimeTracker();
    let wrappedCallback = callback;

    if (this._options.loggingEnabled) {
      wrappedCallback = function () {
        timeTracker.stop();
        const queryTime = timeTracker.getExecutionTime();
        if (queryTime > self._options.queryMaxTime) {
          LOG.warn(
            "Count query %j, took longer than allowed max time of %s seconds.",
            self._query,
            self._options.queryMaxTime
          );
        }

        return callback.apply(self, arguments);
      };
    }

    timeTracker.start();

    function serverResult(err: Error | null, count: any) {
      if (err) {
        return wrappedCallback(err);
      }
      remoteCount = count;
      return wrappedCallback(null, count);
    }

    function localResult(err: Error | null, count: any) {
      if (err) {
        return wrappedCallback(err, count);
      }

      localCount = count;
      if (remoteCount) {
        wrappedCallback(null, remoteCount);
      } else {
        if (self._options.localFirst) {
          wrappedCallback(err, localCount);
        }
      }
    }

    this._local.count().then(
      (count: any) => localResult(null, count),
      (err: Error) => localResult(err, 0)
    );
    this._remote.count().then(
      (count: any) => serverResult(null, count),
      (err: Error) => serverResult(err, 0)
    );
  }

  count(options?: any, callback?: any): void {
    if (_.isFunction(options)) {
      callback = options;
      options = undefined;
    }

    if (this._getCachedData) {
      this._getCachedData(
        this._query,
        this._skip,
        this._limit,
        this._sort,
        this._project,
        (_err: Error | null, data: any) => {
          if (data) {
            callback(null, data.length);
            return;
          }

          this._count(options, callback);
        }
      );
    } else {
      this._count(options, callback);
    }
  }

  observe(options: any): any {
    const sort = this._sort;
    const limit = this._limit;
    const skip = this._skip;

    if (sort) {
      this._local.sort(sort);
      this._remote.sort(sort);
    }
    if (limit) {
      this._local.limit(limit);
      this._remote.limit(limit);
    }
    if (skip) {
      this._local.skip(skip);
      this._remote.skip(skip);
    }
    if (this._project && _.isFunction(this._remote.project)) {
      this._remote.project(this._project);
    }

    let modifiedOptions = options;
    if (this._options.cacheQueries) {
      modifiedOptions = Object.assign({}, options, {
        cacheCallback: this._onObserverCacheUpdate.bind(this),
        getCache: this._getObserverData.bind(this),
      });
    }

    return new HybridObserver(this._local, this._remote, this._options, modifiedOptions);
  }

  project(project: Record<string, 0 | 1>): this {
    this._project = project;
    return this;
  }
}

export default HybridCursor;
