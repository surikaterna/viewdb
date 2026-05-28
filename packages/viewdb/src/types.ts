import type { TypedQuery } from "kuery";

/** A generic document stored in viewdb */
export type VDocument = Record<string, any> & { _id?: string };

/** Query object passed to find/observe/getDocuments */
export interface QueryObject<T extends VDocument = VDocument> {
  /** Filter query for the documents. */
  query?: TypedQuery<T>;
  /** Set the skip for the cursor. */
  skip?: number;
  /** Set the limit for the cursor. */
  limit?: number;
  /** Sets the sort order of the cursor query. */
  sort?: Record<string, 1 | -1>;
  /** Add a project stage to the aggregation pipeline. */
  project?: Record<string, 0 | 1>;
}

/** Sort specification */
export type SortSpec = Record<string, 1 | -1>;

/** Projection specification */
export type ProjectionSpec = Record<string, 0 | 1>;

/** Standard Node-style callback */
export type Callback<T = void> = (err: Error | null, result?: T) => void;

/** Options for the merge function */
export interface MergeOptions<T = any> {
  comparator?: (a: T, b: T) => boolean;
  comparatorId?: (a: T, b: T) => boolean;
  keyFn?: (element: T) => string;
  added?: (element: T, index: number) => void;
  removed?: (element: T, index: number) => void;
  changed?: (oldElement: T, newElement: T, index: number) => void;
  moved?: (element: T, fromIndex: number, toIndex: number) => void;
}

/** Options passed to cursor.observe() */
export interface ObserveOptions<T = VDocument> {
  init?: (elements: T[]) => void;
  added?: (element: T, index: number) => void;
  removed?: (element: T, index: number) => void;
  changed?: (asis: T, tobe: T, index: number) => void;
  moved?: (element: T, fromIndex: number, toIndex: number) => void;
  enableBatching?: boolean;
}

/** Handle returned by observe() */
export interface ObserveHandle {
  /** Clears the cache and stops the observe listener. */
  stop: () => void | Promise<void>;
  /**
   * @deprecated Use ObserveHandle.stop()
   *
   * Clears the cache and stops the observe listener.
   */
  dispose?: () => void | Promise<void>;
}

/** Core cursor contract used by collections */
export interface Cursor<T extends VDocument = VDocument> {
  /** Frees any client-side resources used by the cursor. */
  close(): Promise<void>;
  /**
   * @deprecated To be replaced with methods on the Collection interface.
   *
   * Get the count of documents for this cursor.
   */
  count(): Promise<number>;
  /** Creates an observe handle to listen for changes. */
  observe(options: ObserveOptions): ObserveHandle;
  /** Set the skip for the cursor. */
  skip(skip: number): this;
  /** Set the limit for the cursor. */
  limit(limit: number): this;
  /** Sets the sort order of the cursor query. */
  sort(sort: SortSpec): this;
  /** Add a project stage to the aggregation pipeline. */
  project(project: ProjectionSpec): this;
  /** @deprecated Use `withReadPreference`. */
  setReadPreference?(readPreference: ReadPreference): this;
  /** Returns an array of documents. */
  toArray(): Promise<T[]>;
  updateQuery?(query: Record<string, any>): void;
  withReadPreference?(readPreference: ReadPreference): this;
}

export type ReadPreference = "primary" | "primaryPreferred" | "secondary" | "secondaryPreferred" | "nearest";

/** Core observer contract returned from cursor.observe() */
export interface Observer extends ObserveHandle {}

/** Core store contract used by ViewDB */
export interface Store {
  open?(): Promise<this>;
  collection<T extends VDocument = VDocument>(name: string): Collection<T>;
}

/**
 * Promise signature for _getDocuments implementations.
 * Used by Collection implementations across all stores.
 */
export type GetDocumentsFn<T extends VDocument = VDocument> = (
  queryObject: QueryObject<T> | TypedQuery<T>
) => Promise<T[]>;

/** Core collection contract that all persistence store collections should satisfy. */
export interface Collection<T extends VDocument = VDocument> {
  /**
   * @deprecated Use `Collection.countDocuments` or `Collection.estimatedDocumentCount`.
   *
   * Count documents
   */
  count?(query?: TypedQuery<T>, options?: CountDocumentsOptions): Promise<number>;
  /** Gets the number of documents matching the filter. */
  countDocuments(query: TypedQuery<T>, options?: CountDocumentsOptions): Promise<number>;
  createIndex?(indexSpec: IndexSpecification, options?: CreateIndexOptions): Promise<string>;
  /** Delete multiple documents. */
  deleteMany(query?: TypedQuery<T>, options?: DeleteOptions): Promise<DeleteResult>;
  /** Delete a single document. */
  deleteOne(query?: TypedQuery<T>, options?: DeleteOptions): Promise<DeleteResult>;
  /** Drop all documents */
  drop?(): Promise<boolean>;
  /** EventEmitter: emit events (primarily 'change') */
  emit(event: string, ...args: any[]): void;
  /** Gets an estimate of the count of documents in a collection using collection metadata. */
  estimatedDocumentCount(): Promise<number>;
  /** Create a cursor for the given query */
  find(query: TypedQuery<T>, options?: Record<string, any>): Cursor<T>;
  /** @deprecated Use `findOneAndUpdate` or `updateOne`. */
  findAndModify?(
    query: TypedQuery<T>,
    sort: SortSpec | null,
    update: UpdateFilter,
    options: FindOneAndUpdateOptions
  ): Promise<T>;
  /** Insert multiple documents. */
  insertMany(docs: T[], options?: InsertManyOptions): Promise<InsertManyResult>;
  /** Insert a single document. */
  insertOne(doc: T, options?: InsertOneOptions): Promise<InsertOneResult>;
  /**
   * @deprecated Use `Collection.insertMany` or `Collection.insertOne`.
   *
   * Insert documents into the collection
   */
  insert?(documents: T | T[], options?: any): Promise<any>;
  /** EventEmitter: listen for events */
  on(event: string, listener: (...args: any[]) => void): any;
  /**
   * @deprecated Use `Collection.deleteMany` or `Collection.deleteOne`.
   *
   * Remove documents matching the query
   */
  remove?(query: TypedQuery<T>, options?: any): Promise<void>;
  /** EventEmitter: remove listener */
  removeListener(event: string, listener: (...args: any[]) => void): any;
  /**
   * @deprecated Use `Collection.updateMany` or `Collection.updateOne`.
   *
   * Save (upsert) documents
   * */
  save?(documents: any, options?: any): Promise<any>;
  /** Update multiple documents in a collection. */
  updateMany?(query: TypedQuery<T>, update: UpdateFilter, options?: UpdateManyOptions): Promise<UpdateResult>;
  /** Update a single document in a collection. */
  updateOne?(query: TypedQuery<T>, update: UpdateFilter, options?: UpdateOneOptions): Promise<UpdateResult>;
  /** Internal: retrieve documents matching the query object */
  _getDocuments: GetDocumentsFn<T>;
}

export type CountDocumentsOptions = Record<string, any> & {
  /** Set the skip for the cursor. */
  skip?: number;
  /** Set the limit for the cursor. */
  limit?: number;
};

export type DeleteOptions = Record<string, any>;

export type DeleteResult = AckResult<{
  /** The number of documents that were deleted. */
  deletedCount?: number;
}> & {};

export type CreateIndexOptions = Record<string, any>;
/**
 * @example
 * ```ts
 * // Basic syntax
 * createIndex({ a: 1, b: -1 })
 * // Ensure index order
 * createIndex([["a", 1], ["b", -1]])
 * // Alternative to { a: 1 }
 * createIndex("a")
 * // Alternative to { a: 1, b: 1 }
 * createIndex(["a", "b"])
 * // Alternative to { a: 1, b: -1 }
 * createIndex([ { h: 1 }, { i: -1 } ])
 * // Alternative to { "a": 1, "b": -1, "c": "2d" }
 * createIndex(["a", ["b", -1], { c: "2d" })
 * ```
 */
export type IndexSpecification = MaybeArray<
  string | [string, IndexDirection] | Record<string, IndexDirection> | Map<string, IndexDirection>
>;
export type IndexDirection = -1 | 1 | "2d" | "2dsphere" | "text" | "geoHaystack" | "hashed" | number;

export type MaybeArray<T> = T | T[];

export type FindOneAndUpdateOptions = Record<string, any>;

export type InsertManyOptions = Record<string, any>;

export type InsertManyResult = AckResult<{
  /** The number of documents that were inserted. */
  insertedCount: number;
  /** Map of the index of the inserted document to the id of the inserted document. */
  insertedIds: {
    [key: number]: string;
  };
}> & {};

export type InsertOneOptions = Record<string, any>;

export type InsertOneResult = AckResult<{
  /** The ID of the document that were inserted. */
  insertedId: string;
}> & {};

export type UpdateFilter = Record<string, any>;

export type UpdateManyOptions = Record<string, any>;
export type UpdateOneOptions = Record<string, any>;

export type UpdateResult = AckResult<{
  /** The number of documents that matched the filter. */
  matchedCount: number;
  /** The number of documents that were modified. */
  modifiedCount: number;
  /** The number of documents that were upserted. */
  upsertedCount: number;
  /** The identifier of the inserted document if an upsert took place. */
  upsertedId: string | null;
}> & {};

type AckResult<T extends Record<string, unknown>> =
  | ({
      /** Indicates whether this write result was acknowledged. */
      acknowledged: true;
    } & { [K in keyof T]-?: T[K] })
  | ({
      /** Indicates whether this write result was acknowledged. */
      acknowledged: false;
    } & { [K in keyof T]?: T[K] });
