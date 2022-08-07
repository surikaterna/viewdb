import { EventEmitter } from 'events';
// @ts-expect-error
import Kuery from 'kuery';
import { cloneDeep, findIndex, has, isArray, isObject, pullAll } from 'lodash';
import { v4 as uuid } from 'uuid';
import {
  BaseDocument,
  Collection,
  CollectionCountCallback,
  CollectionDropCallback,
  CreateIndexCallback,
  CreateIndexOptions,
  EnsureIndexCallback,
  EnsureIndexOptions,
  FindOptions,
  GetDocumentsCallback,
  Query,
  QueryObject,
  RemoveFunc,
  SaveFunc,
  SortQuery,
  WriteCallback,
  WriteFunc,
  WriteOptions
} from '../Collection';
import Cursor from '../Cursor';

const checkIsWriteCallback = (options?: WriteCallback | WriteOptions): options is WriteCallback => typeof options === 'function';

export default class InMemoryCollection<Document extends BaseDocument = Record<string, any>> extends EventEmitter implements Collection<Document> {
  private documents: Array<Document>;
  private readonly name: string;

  constructor(collectionName: string) {
    super();

    this.documents = [];
    this.name = collectionName;
  }

  findAndModify(query: Query, sort: SortQuery | null, update: Query, options: { [x: string]: any; }, cb: Function): void {
    throw new Error('findAndModify not supported!');
  }

  count = (callback: CollectionCountCallback) => {
    callback(null, this.documents.length);
  };

  createIndex = (options: CreateIndexOptions, callback: CreateIndexCallback): void => {
    throw new Error('createIndex not supported!');
  };

  drop = (callback?: CollectionDropCallback): void => {
    this.documents = [];
    callback?.(null);
  };

  ensureIndex = (options: EnsureIndexOptions, callback: EnsureIndexCallback) => {
    throw new Error('ensureIndex not supported!');
  };

  find = (query: Query, options?: FindOptions): Cursor<Document> => {
    return new Cursor<Document>(this, {query: query}, options, this._getDocuments);
  };

  insert: SaveFunc<Document> = (documents, options, callback) => {
    return this.write('insert', documents, options, callback);
  };

  remove: RemoveFunc<Document> = (query, options, callback) => {
    const q = new Kuery(query);
    const documents = q.find(this.documents);
    this.documents = pullAll(this.documents, documents);

    process.nextTick(() => {
      callback?.(null);
    });
  };

  save: SaveFunc<Document> = (documents, options, callback) => {
    return this.write('save', documents, options, callback);
  };

  _getDocuments = (queryObject: QueryObject, callback: GetDocumentsCallback<Document>): void => {
    const query = queryObject.query || queryObject;
    const q = new Kuery(query);

    if (queryObject.sort) {
      q.sort(queryObject.sort);
    }

    if (queryObject.skip) {
      q.skip(queryObject.skip);
    }

    if (queryObject.limit) {
      q.limit(queryObject.limit);
    }

    const documents = q.find(this.documents);
    process.nextTick(() => {
      callback(null, cloneDeep(documents));
    });
  };

  private write: WriteFunc<Document> = (op, documents, options, optionalCallback): void => {
    const callback = checkIsWriteCallback(options)
      ? options
      : optionalCallback;

    if (!isArray(documents)) {
      documents = [documents];
    }

    for (let i = 0; i < documents.length; i++) {
      const document = documents[i];

      if (!isObject(document)) {
        return callback?.(new Error('Document must be object'));
      }

      if (!has(document, '_id')) {
        document._id = document.id || uuid();
      }

      const idx = findIndex<BaseDocument>(this.documents, {_id: document._id});

      if (op === 'insert' && idx >= 0) {
        return callback?.(new Error('Unique constraint!'));
      }

      // not stored before
      if (idx === -1) {
        this.documents.push(document);
      } else {
        this.documents[idx] = document;
      }
    }

    this.emit('change', documents);
    callback?.(null, documents);
  };
}
