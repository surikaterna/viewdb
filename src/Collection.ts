import { EventEmitter } from 'events';
import { Cursor } from '.';
import { Callback } from './utils/promiseUtils';

export type Nullable<T> = T | null;

export interface BaseDocument {
  _id?: string;
  id?: string;
}

export interface CollectionCallback<Document extends BaseDocument = Record<string, any>> {
  (collection: Collection<Document>): void;
}

export type CollectionCountCallback = Callback<number>;

export interface CollectionDropCallback {
  (error: null): void;
}

export interface QueryObject extends Record<string, any> {
  query?: Record<string, any>;
  limit?: number;
  skip?: number;
  sort?: Record<string, number>;
}

export interface GetDocumentsCallback<Document extends BaseDocument = Record<string, any>> {
  (err: Nullable<Error>, documents?: Array<Document>): void;
}

export interface GetDocumentsFunc<Document extends BaseDocument = Record<string, any>> {
  (query: QueryObject, callback: GetDocumentsCallback<Document>): void;
}

export interface RemoveOptions {
  justOne?: boolean;
  writeConcern?: WriteConcern;
  collation?: Collation;
}

interface Collation {
  locale: string;
  caseLevel?: boolean;
  caseFirst?: string;
  strength?: number;
  numericOrdering?: boolean;
  alternate?: string;
  maxVariable?: string;
  backwards?: boolean;
}

export type RemoveJustOne = boolean;

interface WriteConcern {
  w?: number | 'majority';
  j?: boolean;
  wtimeout?: number;
}

export interface RemoveCallback {
  (err: Nullable<Error>, result?: WriteResult): void;
}

export interface WriteResult {
  nRemoved: number;
  writeConcernError?: WriteConcernError;
  writeError?: WriteError;
}

interface WriteConcernError extends WriteError {
  errInfo: {
    wTimeout: boolean;
  };
}

interface WriteError {
  code: number;
  errmsg: string;
}

export type Query = Record<string, any>;
export type CreateIndexFieldOrSpec = string | CreateIndexArraySpec | CreateIndexObjectSpec;

export type CreateIndexArraySpec = Array<string | CreateIndexNameOrderTuple | CreateIndexObjectSpec>;
export type CreateIndexNameOrderTuple = [string, number];
export type CreateIndexObjectSpec = Record<string | number, string | number>;

export type CreateIndexOptions = Record<string, any>;
export type CreateIndexCallback = Callback<CreateIndexResult>;
export type CreateIndexResult = Record<string, any>;
export type FindOptions = Record<string, any>;
export type SortQuery = Record<string, number>;

export interface FindAndModifyOptions extends Record<string, any> {
  upsert?: boolean;
  skipVersioning?: boolean;
}

export type FindAndModifyCallback<Document extends BaseDocument = Record<string, any>> = Callback<FindAndModifyResult<Document>>;

export interface FindAndModifyResult<Document extends object = Record<string, any>> {
  ok: 0 | 1;
  value: Nullable<Document>;
  lastErrorObject?: {
    updatedExisting: boolean;
    upserted: unknown;
  };
}

export type WriteOperation = 'insert' | 'save';
export type WriteOptions = Record<string, any>;
export type WriteCallback<Document extends BaseDocument = Record<string, any>> = GetDocumentsCallback<Document>;

export type MaybeArray<T> = T | Array<T>;

export interface Collection<Document extends BaseDocument = Record<string, any>> extends EventEmitter {
  /** Not intended to be used externally, but required internally for the Observer */
  _getDocuments: GetDocumentsFunc<Document>;

  count(): Promise<number>;
  count(callback: CollectionCountCallback): void;
  count(callback?: CollectionCountCallback): Promise<number> | void;

  createIndex(fieldOrSpec: CreateIndexFieldOrSpec): Promise<CreateIndexResult>;
  createIndex(fieldOrSpec: CreateIndexFieldOrSpec, options: CreateIndexOptions): Promise<CreateIndexResult>;
  createIndex(fieldOrSpec: CreateIndexFieldOrSpec, options: Nullable<CreateIndexOptions>, callback: CreateIndexCallback): void;
  createIndex(fieldOrSpec: CreateIndexFieldOrSpec, options?: Nullable<CreateIndexOptions>, callback?: CreateIndexCallback): Promise<CreateIndexResult> | void;

  drop(): boolean;

  ensureIndex(fieldOrSpec: CreateIndexFieldOrSpec): Promise<CreateIndexResult>;
  ensureIndex(fieldOrSpec: CreateIndexFieldOrSpec, options: CreateIndexOptions): Promise<CreateIndexResult>;
  ensureIndex(fieldOrSpec: CreateIndexFieldOrSpec, options: Nullable<CreateIndexOptions>, callback: CreateIndexCallback): void;
  ensureIndex(fieldOrSpec: CreateIndexFieldOrSpec, options?: Nullable<CreateIndexOptions>, callback?: CreateIndexCallback): Promise<CreateIndexResult> | void;

  find(query: Query, options?: FindOptions): Cursor<Document>;

  findAndModify(query: Query, sort: Nullable<SortQuery>, update: Query): Promise<FindAndModifyResult<Document>>;
  findAndModify(query: Query, sort: Nullable<SortQuery>, update: Query, options: FindAndModifyOptions): Promise<FindAndModifyResult<Document>>;
  findAndModify(query: Query, sort: Nullable<SortQuery>, update: Query, options: Nullable<FindAndModifyOptions>, cb: FindAndModifyCallback<Document>): void;
  findAndModify(
    query: Query,
    sort: Nullable<SortQuery>,
    update: Query,
    options?: Nullable<FindAndModifyOptions>,
    cb?: FindAndModifyCallback<Document>
  ): Promise<FindAndModifyResult<Document>> | void;

  insert(documents: MaybeArray<Document>): Promise<Array<Document>>;
  insert(documents: MaybeArray<Document>, callback: WriteCallback<Document>): void;
  insert(documents: MaybeArray<Document>, options: WriteOptions): Promise<Array<Document>>;
  insert(documents: MaybeArray<Document>, options: WriteOptions, callback: WriteCallback<Document>): void;
  insert(
    documents: MaybeArray<Document>,
    options?: WriteOptions | WriteCallback<Document>,
    callback?: WriteCallback<Document>
  ): Promise<Array<Document>> | void;

  remove(query: Query): Promise<WriteResult>;
  remove(query: Query, options: Nullable<RemoveOptions | RemoveJustOne>): Promise<WriteResult>;
  remove(query: Query, options: Nullable<RemoveOptions | RemoveJustOne>, callback: RemoveCallback): void;
  remove(query: Query, options?: Nullable<RemoveOptions | RemoveJustOne>, callback?: RemoveCallback): Promise<WriteResult> | void;

  save(documents: MaybeArray<Document>): Promise<Array<Document>>;
  save(documents: MaybeArray<Document>, callback: WriteCallback<Document>): void;
  save(documents: MaybeArray<Document>, options: WriteOptions): Promise<Array<Document>>;
  save(documents: MaybeArray<Document>, options: WriteOptions, callback: WriteCallback<Document>): void;
  save(documents: MaybeArray<Document>, options?: WriteOptions | WriteCallback<Document>, callback?: WriteCallback<Document>): Promise<Array<Document>> | void;
}
