import { EventEmitter } from 'events';
// @ts-expect-error
import Kuery from 'kuery';
import { cloneDeep, findIndex, has, isArray, isObject, pullAll } from 'lodash';
import { v4 as uuid } from 'uuid';
import {
  BaseDocument,
  Collection,
  CollectionCountCallback,
  CreateIndexCallback,
  CreateIndexFieldOrSpec,
  CreateIndexOptions,
  CreateIndexResult,
  FindAndModifyCallback,
  FindAndModifyOptions,
  FindAndModifyResult,
  FindOptions,
  GetDocumentsCallback,
  MaybeArray,
  Nullable,
  Query,
  QueryObject,
  RemoveCallback,
  RemoveJustOne,
  RemoveOptions,
  SortQuery,
  WriteCallback,
  WriteOperation,
  WriteOptions,
  WriteResult
} from '../Collection';
import Cursor from '../Cursor';
import { maybePromise } from '../utils/promiseUtils';

const checkIsWriteCallback = <Document>(options?: WriteCallback<Document> | WriteOptions): options is WriteCallback<Document> => typeof options === 'function';

export default class InMemoryCollection<Document extends BaseDocument = Record<string, any>> extends EventEmitter implements Collection<Document> {
  private documents: Array<Document>;
  private readonly name: string;

  constructor(collectionName: string) {
    super();

    this.documents = [];
    this.name = collectionName;
  }

  findAndModify(query: Query, sort: Nullable<SortQuery>, update: Query): Promise<FindAndModifyResult<Document>>;
  findAndModify(query: Query, sort: Nullable<SortQuery>, update: Query, options: FindAndModifyOptions): Promise<FindAndModifyResult<Document>>;
  findAndModify(query: Query, sort: Nullable<SortQuery>, update: Query, options: Nullable<FindAndModifyOptions>, cb: FindAndModifyCallback<Document>): void;
  findAndModify(
    query: Query,
    sort: Nullable<SortQuery>,
    update: Query,
    options?: Nullable<FindAndModifyOptions>,
    cb?: FindAndModifyCallback<Document>
  ): Promise<FindAndModifyResult<Document>> | void {
    return maybePromise(cb, (done) => {
      done(new Error('findAndModify not supported!'));
    });
  }

  count(): Promise<number>;
  count(callback: CollectionCountCallback): void;
  count(callback?: CollectionCountCallback): Promise<number> | void {
    return maybePromise(callback, (done) => {
      return done(null, this.documents.length);
    });
  }

  createIndex(fieldOrSpec: CreateIndexFieldOrSpec): Promise<CreateIndexResult>;
  createIndex(fieldOrSpec: CreateIndexFieldOrSpec, options: CreateIndexOptions): Promise<CreateIndexResult>;
  createIndex(fieldOrSpec: CreateIndexFieldOrSpec, options: Nullable<CreateIndexOptions>, callback: CreateIndexCallback): void;
  createIndex(fieldOrSpec: CreateIndexFieldOrSpec, options?: Nullable<CreateIndexOptions>, callback?: CreateIndexCallback): Promise<CreateIndexResult> | void {
    return maybePromise(callback, (done) => {
      done(new Error('createIndex not supported!'));
    });
  }

  drop(): boolean {
    this.documents = [];
    return true;
  }

  ensureIndex(fieldOrSpec: CreateIndexFieldOrSpec): Promise<CreateIndexResult>;
  ensureIndex(fieldOrSpec: CreateIndexFieldOrSpec, options: CreateIndexOptions): Promise<CreateIndexResult>;
  ensureIndex(fieldOrSpec: CreateIndexFieldOrSpec, options: Nullable<CreateIndexOptions>, callback: CreateIndexCallback): void;
  ensureIndex(fieldOrSpec: CreateIndexFieldOrSpec, options?: Nullable<CreateIndexOptions>, callback?: CreateIndexCallback): Promise<CreateIndexResult> | void {
    return maybePromise(callback, (done) => {
      done(new Error('ensureIndex not supported!'));
    });
  }

  find = (query: Query, options?: FindOptions): Cursor<Document> => {
    return new Cursor<Document>(this, { query: query }, options, this._getDocuments);
  };

  insert(documents: MaybeArray<Document>): Promise<Array<Document>>;
  insert(documents: MaybeArray<Document>, callback: WriteCallback<Document>): void;
  insert(documents: MaybeArray<Document>, options: WriteOptions): Promise<Array<Document>>;
  insert(documents: MaybeArray<Document>, options: WriteOptions, callback: WriteCallback<Document>): void;
  insert(
    documents: MaybeArray<Document>,
    options?: WriteOptions | WriteCallback<Document>,
    callback?: WriteCallback<Document>
  ): Promise<Array<Document>> | void {
    return this.write('insert', documents, options, callback);
  }

  remove(query: Query): Promise<WriteResult>;
  remove(query: Query, options: Nullable<RemoveOptions | RemoveJustOne>): Promise<WriteResult>;
  remove(query: Query, options: Nullable<RemoveOptions | RemoveJustOne>, callback: RemoveCallback): void;
  remove(query: Query, options?: Nullable<RemoveOptions | RemoveJustOne>, callback?: RemoveCallback): Promise<WriteResult> | void {
    return maybePromise(callback, (done) => {
      const q = new Kuery(query);
      const documents = q.find(this.documents) as Array<Document>;
      this.documents = pullAll(this.documents, documents);

      process.nextTick(() => {
        done(null, {
          nRemoved: documents.length
        });
      });
    });
  }

  save(documents: MaybeArray<Document>): Promise<Array<Document>>;
  save(documents: MaybeArray<Document>, options: WriteOptions): Promise<Array<Document>>;
  save(documents: MaybeArray<Document>, callback: WriteCallback<Document>): void;
  save(documents: MaybeArray<Document>, options: WriteOptions, callback: WriteCallback<Document>): void;
  save(documents: MaybeArray<Document>, options?: WriteOptions | WriteCallback<Document>, callback?: WriteCallback<Document>): Promise<Array<Document>> | void {
    return this.write('save', documents, options, callback);
  }

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

  private write(
    op: WriteOperation,
    documents: MaybeArray<Document>,
    options?: WriteOptions | WriteCallback<Document>,
    optionalCallback?: WriteCallback<Document>
  ): Promise<Array<Document>> | void {
    const callback = checkIsWriteCallback<Document>(options) ? options : optionalCallback;

    return maybePromise<Document, Array<Document>>(callback, (done) => {
      if (!isArray(documents)) {
        documents = [documents];
      }

      for (let i = 0; i < documents.length; i++) {
        const document = documents[i];

        if (!isObject(document)) {
          return done(new Error('Document must be object'));
        }

        if (!has(document, '_id')) {
          document._id = document.id || uuid();
        }

        const idx = findIndex<BaseDocument>(this.documents, { _id: document._id });

        if (op === 'insert' && idx >= 0) {
          return done(new Error('Unique constraint!'));
        }

        // not stored before
        if (idx === -1) {
          this.documents.push(document);
        } else {
          this.documents[idx] = document;
        }
      }

      this.emit('change', documents);
      return done(null, documents);
    });
  }
}
