import _ = require('lodash');
import HybridCursor = require('./cursor');
import * as cacheUtils from '../cacheUtils';

class HybridCollection {
  _local: any;
  _remote: any;
  _name: string;
  _options: any;
  _cacheCollection: any;
  _projectedDocumentCollection: any;

  constructor(
    local: any,
    remote: any,
    name: string,
    options: any,
    cacheCollection?: any,
    projectedDocumentCollection?: any,
  ) {
    this._local = local;
    this._remote = remote;
    this._name = name;
    this._options = options;
    this._cacheCollection = cacheCollection;
    this._projectedDocumentCollection = projectedDocumentCollection;
  }

  find(query: any, options?: any): HybridCursor {
    return new HybridCursor(
      query,
      this._local.find(query, options),
      this._remote.find(query, options),
      options,
      Object.assign({}, this._options, {
        onCacheUpdateCallback: this._cacheQuery.bind(this),
        getCachedData: this._getCachedData.bind(this),
      }),
    );
  }

  save(doc: any, callback?: any): any {
    if (this._options.syncWrites) {
      this._remote.save(doc, callback);
    }
    return this._local.save(doc, callback);
  }

  insert(doc: any, callback?: any): any {
    var self = this;
    return this._local.insert(doc, function (err: Error | null, result: any) {
      if (self._options.syncWrites) {
        self._remote.insert(doc, callback);
      }
      if (callback) {
        callback(err, result);
      }
    });
  }

  remove(query: any, options?: any, callback?: any): any {
    var self = this;
    return this._local.remove(
      query,
      options,
      function (err: Error | null, result: any) {
        if (self._options.syncWrites) {
          self._remote.remove(query, options);
        }
        if (callback) {
          callback(err, result);
        }
      },
    );
  }

  _cacheQuery(
    query: any,
    skip: number,
    limit: number,
    sort: Record<string, 1 | -1> | undefined,
    project: Record<string, 0 | 1> | undefined,
    documents: any[],
  ): void {
    var self = this;

    if (!this._options.cacheQueries) {
      return;
    }

    var cachedDateTime = new Date().getTime();
    var documentIds: any[] = [];
    _.forEach(documents, function (document: any) {
      documentIds.push(document._id);

      var isProjected = !_.isEmpty(project);
      var collection = self._local;
      if (isProjected) {
        collection = self._projectedDocumentCollection;
      }

      collection.save(
        Object.assign({}, document, { _insertedAt: cachedDateTime }),
        { skipVersioning: true, skipTimestamp: true },
      );
    });

    var queryHash = cacheUtils.generateQueryHash(
      query,
      self._name,
      skip,
      limit,
      sort,
      project,
    );
    this._cacheCollection.save(
      {
        _id: queryHash,
        createDateTime: cachedDateTime,
        resultSet: documentIds,
      },
      { skipVersioning: true, skipTimestamp: true },
    );
  }

  _getCachedData(
    query: any,
    skip: number,
    limit: number,
    sort: Record<string, 1 | -1> | undefined,
    project: Record<string, 0 | 1> | undefined,
    callback: any,
  ): void {
    var self = this;
    this._getCachedIds(query, skip, limit, sort, function (ids: any) {
      if (!ids) {
        callback(undefined);
        return;
      }

      var collection = self._local;
      var isProjected = !_.isEmpty(project);
      if (isProjected) {
        collection = self._projectedDocumentCollection;
      }

      collection.find({ _id: { $in: ids } }).toArray(function (
        cacheError: Error | null,
        cachedResults: any,
      ) {
        if (cacheError) {
          callback(cacheError, cachedResults);
        }

        if (ids.length !== cachedResults.length) {
          callback(null);
          return;
        }

        callback(null, cachedResults);
      });
    });
  }

  _getCachedIds(
    query: any,
    skip: number,
    limit: number,
    sort: Record<string, 1 | -1> | undefined,
    callback: any,
  ): void {
    if (!this._cacheCollection || !this._options.cacheLifeTime) {
      callback(undefined);
      return;
    }

    var queryHash = cacheUtils.generateQueryHash(
      query,
      this._name,
      skip,
      limit,
      sort,
    );
    var minimumChangeDateTime = new Date();
    minimumChangeDateTime.setMinutes(
      minimumChangeDateTime.getMinutes() - this._options.cacheLifeTime,
    );
    var minTimeEpoch = minimumChangeDateTime.getTime();

    this._cacheCollection
      .find({ _id: queryHash, createDateTime: { $gt: minTimeEpoch } })
      .toArray(function (err: Error | null, result: any) {
        var hasResult = result && result[0];

        if (!hasResult) {
          callback(undefined);
          return;
        }
        callback(result[0].resultSet);
      });
  }
}

export = HybridCollection;
