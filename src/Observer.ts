import { defaults } from 'lodash';
import { BaseDocument, Collection, Nullable, QueryObject } from './Collection';
import { CursorOptions } from './Cursor';
import merge, { MergerOptions } from './merge';

export interface ObserverOptions<Document extends BaseDocument = Record<string, any>> extends MergerOptions<Document> {
  init?(documents?: Array<Document>): void;
}

export default class Observer<Document extends BaseDocument = Record<string, any>> {
  private readonly _query: QueryObject;
  private readonly _options: ObserverOptions<Document>;
  private readonly _collection: Collection<Document>;
  private _cache: Nullable<Array<Document> | undefined>;
  private readonly _mergeOptions: ObserverOptions<Document>;

  constructor(query: QueryObject, queryOptions: Nullable<CursorOptions> | undefined, collection: Collection<Document>, options: ObserverOptions<Document>) {
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
        if (!result) {
          return;
        }

        const old = this._cache;

        this._cache = merge(
          old,
          result,
          this._mergeOptions
        );
      }
    });
  };
}

function indexedIdComparator<Document extends BaseDocument = Record<string, any>>(firstDocument?: Document, secondDocument?: Document): boolean {
  return firstDocument?._id === secondDocument?._id;
}
