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
