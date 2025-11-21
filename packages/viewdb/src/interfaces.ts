import type { EventEmitter } from "node:events";
import type { Query, QueryObject, SortObject } from "kuery";
import type { CreateIndexesOptions, IndexSpecification } from "mongodb";
import type { MaybeArray } from "./types";

export interface ViewDBCollection<T extends Indexed> extends EventEmitter {
  count(): Promise<number>;
  createIndex(indexSpec: IndexSpecification, options?: CreateIndexesOptions): Promise<string>;
  drop(): Promise<void>;
  ensureIndex?(): Promise<void>;
  find(query: Query<T>, options?: CollectionFindOptions): ViewDBCursor<T>;
  findAndModify(query: Query<T>, sort: SortObject | null, update: UpdateFilter, options?: CollectionFindAndModifyOptions): Promise<FindAndModifyResult>;
  insert(documents: MaybeArray<T>, options?: CollectionInsertOptions): Promise<T[]>;
  remove(query: Query<T>, options?: CollectionRemoveOptions): Promise<void>;
  save(documents: MaybeArray<T>, options?: CollectionSaveOptions): Promise<T[]>;
  updateMany(query: Query<T>, update: UpdateFilter, options?: CollectionUpdateManyOptions): Promise<UpdateResult>;
  updateOne(query: Query<T>, update: UpdateFilter, options?: CollectionUpdateOneOptions): Promise<UpdateResult>;

  /** @internal */
  _getDocuments(queryObject: QueryObject<T>): Promise<T[]>;
  /** @internal */
  __plugins_timestamp?: boolean;
  /** @internal */
  __plugins_versioning?: boolean;
}

export type CollectionFindOptions = Record<string, any>;
export type CollectionFindAndModifyOptions = Record<string, any>;
export type CollectionInsertOptions = {
  skipTimestamp?: boolean;
  skipVersioning?: boolean;
};
export type CollectionRemoveOptions = Record<string, any>;
export type CollectionSaveOptions = {
  skipTimestamp?: boolean;
  skipVersioning?: boolean;
};
export type CollectionUpdateManyOptions = Record<string, any>;
export type CollectionUpdateOneOptions = Record<string, any>;

export type FindAndModifyResult = Record<string, any>;

export type UpdateFilter = Record<string, any>;

export type UpdateResult = {
  acknowledged: boolean;
  matchedCount: number;
  modifiedCount: number;
  upsertedCount: number;
  upsertedId: string | null;
};

export interface ViewDBCursor<T extends Indexed> {
  forEach?(iterator: CursorIterator<T>): Promise<void>;
  limit(limit: number): ViewDBCursor<T>;
  observe(options: ObserverOptions<T>): ViewDBObserver;
  toArray(): Promise<T[]>;
  sort(sortObject: SortObject): ViewDBCursor<T>;
  skip(skip: number): ViewDBCursor<T>;
  updateQuery?(query: Query<T>): void;
}

export type CursorIterator<T> = (doc: T) => boolean | undefined;

export interface ViewDBObserver {
  stop(): void;
}

export type ObserverOptions<T> = {
  init?: (documents: T[]) => void;
  added?: (document: T, index?: number) => void;
  changed?: (oldDocument: T | null, newDocument: T, index?: number) => void;
  removed?: (document: T, index?: number) => void;
};

export interface ViewDBStore {
  collection<T extends Indexed>(name: string): ViewDBCollection<T>;
  open?(): Promise<ViewDBStore>;
}

export type Indexed = { _id: string };
