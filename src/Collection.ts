import { Cursor } from '.';

type Nullable<T> = T | null;

export interface BaseDocument {
  _id?: string;
  id?: string;
}

export type Query = Record<string, any>;
export type FindOptions = Record<string, any>;
export type SortQuery = Record<string, number>;
type FindAndModifyOptions = Record<string, any>;
type FindAndModifyCallback = Function;

export interface Collection<Document extends BaseDocument = Record<string, any>> {
  find(query: Query, options: FindOptions): Cursor;
  findAndModify(query: Query, sort: Nullable<SortQuery>, update: Query, options: FindAndModifyOptions, cb: FindAndModifyCallback): void;
}
