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
  stop: () => void | Promise<void>;
  dispose?: () => void | Promise<void>;
}

/**
 * Callback signature for _getDocuments implementations.
 * Used by Collection implementations across all stores.
 */
export type GetDocumentsFn = (queryObject: QueryObject, callback: Callback<VDocument[]>) => void;

/**
 * Core collection contract that all persistence store collections should satisfy.
 *
 * Required members are used by Cursor and Observer.
 * Optional members represent common store capabilities.
 */
export interface Collection {
  /** Create a cursor for the given query */
  find(query: Record<string, any>, options?: Record<string, any>): any;
  /** Internal: retrieve documents matching the query object */
  _getDocuments: GetDocumentsFn;
  /** EventEmitter: emit events (primarily 'change') */
  emit(event: string, ...args: any[]): void;
  /** EventEmitter: listen for events */
  on(event: string, listener: (...args: any[]) => void): any;
  /** EventEmitter: remove listener */
  removeListener(event: string, listener: (...args: any[]) => void): any;

  // Optional store capabilities
  /** Insert documents into the collection */
  insert?(documents: any, options?: any, callback?: Callback<any>): void;
  /** Save (upsert) documents */
  save?(documents: any, options?: any, callback?: Callback<any>): void;
  /** Remove documents matching the query */
  remove?(query: any, options?: any, callback?: Callback): void;
  /** Count documents */
  count?(callback: Callback<number>): void;
  /** Drop all documents */
  drop?(callback?: Callback): void;
}
