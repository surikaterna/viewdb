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
import { maybePromise } from './utils/promiseUtils';

export interface CursorForEachCallback<Document extends BaseDocument = Record<string, any>> {
  (documents: Array<Document>): void;
}

export type CursorRewindOptions = Record<string, any>;
export type CursorOptions = Record<string, any>;

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

  count(): Promise<number>;
  count(applySkipLimit: boolean): Promise<number>;
  count(callback: CollectionCountCallback): void;
  count(applySkipLimit: boolean, callback: CollectionCountCallback): void;
  count(applySkipLimit?: boolean | CollectionCountCallback, callback?: CollectionCountCallback): Promise<number> | void {
    if (isFunction(applySkipLimit)) {
      callback = applySkipLimit;
      applySkipLimit = false;
    }

    return maybePromise<number, number>(callback, (done) => {
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
        if (err) {
          return done(err);
        }

        if (!res) {
          return done(new Error('Failed getting documents without error.'));
        }

        return done(null, res.length);
      });
    });
  };

  // TODO: Should call the callback with each document, not with the list every time
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

  toArray(): Promise<Array<Document>>;
  toArray(callback: GetDocumentsCallback<Document>): void;
  toArray(callback?: GetDocumentsCallback<Document>): Promise<Array<Document>> | void;
  toArray(callback?: GetDocumentsCallback<Document>): Promise<Array<Document>> | void {
    return maybePromise(callback, (done) => {
      this._getDocuments(this._query, (err, documents) => {
        if (err) {
          return done(err);
        }

        if (!documents) {
          return done(new Error('Failed getting documents without error.'));
        }

        return done(null, documents);
      });
    });
  }

  /**
   * Not intended to be used externally
   *
   * TODO: Remove _ prefix since this should probably be a public method
   */
  _refresh = () => {
    this._collection.emit('change', {});
  };
}
