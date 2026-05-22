import _ from "lodash";
import * as cacheUtils from "../cacheUtils";
import HybridCursor from "./HybridCursor";

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
    projectedDocumentCollection?: any
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
      })
    );
  }

  save(doc: any): any {
    if (this._options.syncWrites) {
      this._remote.save(doc);
    }
    return this._local.save(doc);
  }

  insert(doc: any): any {
    return this._local.insert(doc).then((result: any) => {
      if (this._options.syncWrites) {
        this._remote.insert(doc);
      }
      return result;
    });
  }

  remove(query: any, options?: any): any {
    return this._local.remove(query, options).then((result: any) => {
      if (this._options.syncWrites) {
        this._remote.remove(query, options);
      }
      return result;
    });
  }

  _cacheQuery(
    query: any,
    skip: number,
    limit: number,
    sort: Record<string, 1 | -1> | undefined,
    project: Record<string, 0 | 1> | undefined,
    documents: any[]
  ): void {
    if (!this._options.cacheQueries) {
      return;
    }

    const cachedDateTime = Date.now();
    const documentIds: any[] = [];
    _.forEach(documents, (document: any) => {
      documentIds.push(document._id);

      const isProjected = !_.isEmpty(project);
      let collection = this._local;
      if (isProjected) {
        collection = this._projectedDocumentCollection;
      }

      collection.save(Object.assign({}, document, { _insertedAt: cachedDateTime }), {
        skipVersioning: true,
        skipTimestamp: true,
      });
    });

    const queryHash = cacheUtils.generateQueryHash(query, this._name, skip, limit, sort, project);
    this._cacheCollection.save(
      { _id: queryHash, createDateTime: cachedDateTime, resultSet: documentIds },
      { skipVersioning: true, skipTimestamp: true }
    );
  }

  _getCachedData(
    query: any,
    skip: number,
    limit: number,
    sort: Record<string, 1 | -1> | undefined,
    project: Record<string, 0 | 1> | undefined,
    callback: any
  ): void {
    this._getCachedIds(query, skip, limit, sort, (ids: any) => {
      if (!ids) {
        callback(undefined);
        return;
      }

      let collection = this._local;
      const isProjected = !_.isEmpty(project);
      if (isProjected) {
        collection = this._projectedDocumentCollection;
      }

      collection
        .find({ _id: { $in: ids } })
        .toArray()
        .then((cachedResults: any) => {
          if (ids.length !== cachedResults.length) {
            callback(null);
            return;
          }

          callback(null, cachedResults);
        })
        .catch((cacheError: Error) => {
          callback(cacheError);
        });
    });
  }

  _getCachedIds(
    query: any,
    skip: number,
    limit: number,
    sort: Record<string, 1 | -1> | undefined,
    callback: any
  ): void {
    if (!this._cacheCollection || !this._options.cacheLifeTime) {
      callback(undefined);
      return;
    }

    const queryHash = cacheUtils.generateQueryHash(query, this._name, skip, limit, sort);
    const minimumChangeDateTime = new Date();
    minimumChangeDateTime.setMinutes(minimumChangeDateTime.getMinutes() - this._options.cacheLifeTime);
    const minTimeEpoch = minimumChangeDateTime.getTime();

    this._cacheCollection
      .find({ _id: queryHash, createDateTime: { $gt: minTimeEpoch } })
      .toArray()
      .then((result: any) => {
        const hasResult = result?.[0];

        if (!hasResult) {
          callback(undefined);
          return;
        }
        callback(result[0].resultSet);
      })
      .catch(() => {
        callback(undefined);
      });
  }
}

export default HybridCollection;
