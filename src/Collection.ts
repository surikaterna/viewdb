import { EventEmitter } from 'events';
import { Cursor } from '.';

export type Nullable<T> = T | null;

export interface BaseDocument {
  _id?: string;
  id?: string;
}

export interface CollectionCallback<Document extends BaseDocument = Record<string, any>> {
  (collection: Collection<Document>): void;
}

export interface CollectionCountCallback {
  (error: Nullable<Error>, count?: number): void;
}

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
  (err: null, documents: Array<Document>): void;

  (err: Error, documents: undefined): void;

  (err: Nullable<Error>, documents?: Array<Document>): void;
}

export interface GetDocumentsFunc<Document extends BaseDocument = Record<string, any>> {
  (query: QueryObject, callback: GetDocumentsCallback<Document>): void;
}

export interface RemoveFunc<Document extends BaseDocument = Record<string, any>> {
  (query: Query, options?: Nullable<RemoveOptions | RemoveJustOne>, callback?: RemoveCallback): void;
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

type RemoveJustOne = boolean;

interface WriteConcern {
  w?: number | 'majority';
  j?: boolean;
  wtimeout?: number;
}

interface RemoveCallback {
  (err: Nullable<Error>, result?: WriteResult): void;
}

interface WriteResult {
  nRemoved: number;
  writeConcernError?: WriteConcernError;
  writeError?: WriteError;
}

interface WriteConcernError extends WriteError {
  errInfo: {
    wTimeout: boolean;
  }
}

interface WriteError {
  code: number;
  errmsg: string;
}

export interface SaveFunc<Document extends BaseDocument = Record<string, any>> {
  (documents: MaybeArray<Document>, options: WriteOptions, callback: WriteCallback): void;

  (documents: MaybeArray<Document>, callback: WriteCallback, options: undefined): void;

  (documents: MaybeArray<Document>, callback: undefined, options: undefined): void;

  (documents: MaybeArray<Document>, options?: WriteOptions | WriteCallback, callback?: WriteCallback): void;
}

export interface WriteFunc<Document extends BaseDocument = Record<string, any>> {
  (op: WriteOperation, documents: MaybeArray<Document>, options: WriteOptions, callback: WriteCallback): void;

  (op: WriteOperation, documents: MaybeArray<Document>, callback: WriteCallback, options: undefined): void;

  (op: WriteOperation, documents: MaybeArray<Document>, options: undefined, callback: undefined): void;

  (op: WriteOperation, documents: MaybeArray<Document>, options?: WriteOptions | WriteCallback, callback?: WriteCallback): void;
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
  _getDocuments: GetDocumentsFunc<Document>;

  count(callback: CollectionCountCallback): void;

  createIndex(options: CreateIndexOptions, callback: CreateIndexCallback): void;

  drop(callback?: CollectionDropCallback): void;

  ensureIndex(options: EnsureIndexOptions, callback: EnsureIndexCallback): void;

  find(query: Query, options?: FindOptions): Cursor<Document>;

  findAndModify(query: Query, sort: Nullable<SortQuery>, update: Query, options: FindAndModifyOptions, cb: FindAndModifyCallback): void;

  insert: SaveFunc<Document>;

  remove: RemoveFunc<Document>;

  save: SaveFunc<Document>;
}