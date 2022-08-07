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
export type CreateIndexOptions = Record<string, any>;
export type CreateIndexCallback = Function;
export type EnsureIndexOptions = Record<string, any>;
export type EnsureIndexCallback = Function;
export type FindOptions = Record<string, any>;
export type SortQuery = Record<string, number>;
export type FindAndModifyOptions = Record<string, any>;
export type FindAndModifyCallback = Function;
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

  createIndex(options: CreateIndexOptions, callback: CreateIndexCallback): void;

  drop(): boolean;

  ensureIndex(options: EnsureIndexOptions, callback: EnsureIndexCallback): void;

  find(query: Query, options?: FindOptions): Cursor<Document>;

  findAndModify(query: Query, sort: Nullable<SortQuery>, update: Query, options: FindAndModifyOptions, cb: FindAndModifyCallback): void;

  insert(documents: MaybeArray<Document>): Promise<Array<Document>>;
  insert(documents: MaybeArray<Document>, callback: WriteCallback<Document>): void;
  insert(documents: MaybeArray<Document>, options: WriteOptions): Promise<Array<Document>>;
  insert(documents: MaybeArray<Document>, options: WriteOptions, callback: WriteCallback<Document>): void;
  insert(documents: MaybeArray<Document>, options?: WriteOptions | WriteCallback<Document>, callback?: WriteCallback<Document>): Promise<Array<Document>> | void;

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
