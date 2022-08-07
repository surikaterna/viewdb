import { forEach, isFunction } from 'lodash';
import {
  BaseDocument,
  Collection,
  CollectionCountCallback,
  GetDocumentsCallback,
  GetDocumentsFunc,
  Nullable,
  QueryObject,
  SortQuery
} from './Collection';
import Observe, { ObserverOptions } from './Observer';

export interface CursorCountFunc<Document extends BaseDocument = Record<string, any>> {
  (applySkipLimit: boolean, callback: CollectionCountCallback): Promise<number>;

  (callback: CollectionCountCallback, options: undefined): Promise<number>;

  (applySkipLimit: undefined, callback: undefined): Promise<number>;

  (applySkipLimit?: boolean | CollectionCountCallback, callback?: CollectionCountCallback): Promise<number>;
}

export interface CursorForEachCallback<Document extends BaseDocument = Record<string, any>> {
  (documents: Array<Document>): void;
}

export interface CursorRewindOptions {
}

export interface CursorOptions {
}

export default class Cursor<Document extends BaseDocument = Record<string, any>> {
  private readonly _collection: Collection<Document>;
  private readonly _query: QueryObject;
  private readonly _options?: Nullable<CursorOptions>;
  private readonly _getDocuments: GetDocumentsFunc<Document>;
  private _isObserving: boolean;

  constructor(collection: Collection<Document>, query: QueryObject, options: Nullable<CursorOptions> | undefined, getDocuments: GetDocumentsFunc<Document>) {
    this._collection = collection;
    this._query = query;
    this._options = options;
    this._getDocuments = getDocuments;
    this._isObserving = false;
  }

  count: CursorCountFunc<Document> = (applySkipLimit, callback) => new Promise<number>((resolve, reject) => {
    if (isFunction(applySkipLimit)) {
      callback = applySkipLimit;
      applySkipLimit = false;
    }

    const query: QueryObject = {query: this._query.query};
    if (applySkipLimit) {
      if (this._query.skip) {
        query.skip = this._query.skip;
      }

      if (this._query.limit) {
        query.limit = this._query.limit;
      }
    }

    this._getDocuments(query, (err, res) => {
      callback?.(err, res?.length);

      if (err) {
        return reject(err);
      }

      if (!res) {
        return reject(new Error('Failed getting documents without error.'));
      }

      return resolve(res.length);
    });
  });

  forEach = (callback: CursorForEachCallback<Document>) => {
    this._getDocuments(this._query, (err, result) => {
      forEach(result, () => {
        callback(result as Array<Document>);
      });
    });
  };

  limit = (limit: number) => {
    this._query.limit = limit;

    if (this._isObserving) {
      this._refresh();
    }

    return this;
  };

  observe = (options: ObserverOptions<Document>): Observe<Document> => {
    this._isObserving = true;
    return new Observe<Document>(this._query, this._options, this._collection, options);
  };

  rewind = (options?: CursorRewindOptions) => {
    //NOOP
  };

  skip = (skip: number): Cursor<Document> => {
    this._query.skip = skip;

    if (this._isObserving) {
      this._refresh();
    }

    return this;
  };

  sort = (sort: SortQuery): Cursor<Document> => {
    this._query.sort = sort;

    if (this._isObserving) {
      this._refresh();
    }

    return this;
  };

  toArray = (callback?: GetDocumentsCallback<Document>): Promise<Array<Document>> => new Promise((resolve, reject) => {
    this._getDocuments(this._query, (err, documents) => {
      callback?.(err, documents);

      if (err) {
        return reject(err);
      }

      if (!documents) {
        return reject(new Error('Failed getting documents without error.'));
      }

      return resolve(documents);
    });
  });

  /**
   * Not intended to be used externally
   *
   * TODO: Remove _ prefix since this should probably be a public method
   */
  _refresh = () => {
    this._collection.emit('change', {});
  };
}
