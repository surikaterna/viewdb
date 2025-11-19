export interface Callback<T> {
  (error: null, results: T): void;
  (error: Error, results: undefined): void;
  (error: Error | null, results?: T): void;
}

export type MaybeArray<T> = T | T[];
export type Nullable<T> = T | null;
export type Nullish<T> = T | null | undefined;
export type Optional<T> = T | undefined;
