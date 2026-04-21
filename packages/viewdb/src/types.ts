/** A generic document stored in viewdb */
export type VDocument = Record<string, any> & { _id?: string };

/** Query object passed to find/observe/getDocuments */
export interface QueryObject {
  query?: Record<string, any>;
  skip?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
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
}

/** Handle returned by observe() */
export interface ObserveHandle {
  stop: () => void | Promise<void>;
  dispose?: () => void | Promise<void>;
}

/**
 * Callback signature for _getDocuments implementations.
 * Used by Collection implementations across all stores.
 */
export type GetDocumentsFn = (queryObject: QueryObject, callback: Callback<VDocument[]>) => void;

/**
 * Abstract collection interface that all store collections should satisfy.
 * Used internally to type _collection fields in cursor/observe.
 */
export interface CollectionLike {
  find(query: Record<string, any>, options?: Record<string, any>): any;
  _getDocuments: GetDocumentsFn;
  emit(event: string, ...args: any[]): void;
  on(event: string, listener: (...args: any[]) => void): any;
  removeListener(event: string, listener: (...args: any[]) => void): any;
}

/**
 * Extended collection interface for stores that support write operations.
 * Methods use Promise-based signatures as the migration target.
 * All methods are optional — stores implement them as they migrate from callbacks to Promises.
 */
export interface WritableCollectionLike extends CollectionLike {
  insert?(doc: VDocument | VDocument[], options?: Record<string, any>): Promise<VDocument[]>;
  save?(doc: VDocument | VDocument[], options?: Record<string, any>): Promise<VDocument[]>;
  remove?(query: Record<string, any>, options?: Record<string, any>): Promise<void>;
  count?(): Promise<number>;
  drop?(): Promise<void>;
}
