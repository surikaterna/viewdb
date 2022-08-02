import { Cursor } from '.';

type Nullable<T> = T | null;

export interface BaseDocument {
  _id?: string;
  id?: string;
}

export interface CollectionCountCallback {
  (error: null, count: number): void;
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

export type Query = Record<string, any>;
export type CreateIndexOptions = Record<string, any>;
export type CreateIndexCallback = Function;
export type EnsureIndexOptions = Record<string, any>;
export type EnsureIndexCallback = Function;
export type RemoveOptions = Record<string, any>;
export type RemoveCallback = Function;
export type SaveOptions = Record<string, any>;
export type SaveCallback = Function;
export type FindOptions = Record<string, any>;
export type SortQuery = Record<string, number>;
export type FindAndModifyOptions = Record<string, any>;
export type FindAndModifyCallback = Function;
export type InsertOptions = Record<string, any>;
export type InsertCallback = Function;

export interface Collection<Document extends BaseDocument = Record<string, any>> {
  count(callback: CollectionCountCallback): void;
  createIndex(options: CreateIndexOptions, callback: CreateIndexCallback): void
  drop(callback?: CollectionDropCallback): void
  ensureIndex(options: EnsureIndexOptions, callback: EnsureIndexCallback): void;
  find(query: Query, options: FindOptions): Cursor;
  findAndModify(query: Query, sort: Nullable<SortQuery>, update: Query, options: FindAndModifyOptions, cb: FindAndModifyCallback): void;
  insert(documents: Array<Document>, options: InsertOptions, callback: InsertCallback): void;
  remove(query: Query, options: RemoveOptions, callback: RemoveCallback): void;
  save(documents: Array<Document>, options: SaveOptions, callback: SaveCallback): void;
}
