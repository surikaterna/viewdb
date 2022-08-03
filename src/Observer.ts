import { defaults, get } from 'lodash';
import { BaseDocument, Collection, Nullable, QueryObject } from './Collection';
import { CursorOptions } from './Cursor';
import merge from './merge';

export interface ObserveOptions<Document extends BaseDocument = Record<string, any>> {
  init?(documents?: Array<Document>): void;
}

export default class Observer<Document extends BaseDocument = Record<string, any>> {
  private readonly _query: QueryObject;
  private readonly _options: ObserveOptions<Document>;
  private readonly _collection: Collection<Document>;
  private _cache: Nullable<Array<Document> | undefined>;
  private readonly _mergeOptions: ObserveOptions;

  constructor(query: QueryObject, queryOptions: CursorOptions, collection: Collection<Document>, options: ObserveOptions<Document>) {
    this._query = query;
    this._options = options;
    this._collection = collection;
    this._cache = [];

    this._mergeOptions = defaults(
      {
        comparatorId: indexedIdComparator
      },
      this._options
    );

    collection.on('change', this.listener);
    this.refresh(true);
  }

  stop = () => {
    this._cache = null;
    this._collection.removeListener('change', this.listener);
  };

  private listener = () => {
    this.refresh();
  };

  private refresh = (initial?: boolean) => {
    this._collection._getDocuments(this._query, (err, result) => {
      if (initial && this._options.init) {
        this._cache = result;
        this._options.init(result);
      } else {
        const old = this._cache;

        // TODO: Verify actual type of _cache, in case it's different from what's assumed
        this._cache = merge(
          old,
          result,
          this._mergeOptions
        ) as Array<Document>;
      }
    });
  };
}

function indexedIdComparator<Document extends BaseDocument = Record<string, any>>(firstDocument: Document, secondDocument: Document): boolean {
  return get(firstDocument, '_id') === get(secondDocument, '_id');
}
