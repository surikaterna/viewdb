import { EventEmitter } from 'events';

/** A document stored in ViewDB */
export type VDocument = Record<string, any> & { _id?: string };

/** Query object describing a find operation */
export interface QueryObject {
  query?: Record<string, any>;
  skip?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
  project?: Record<string, 0 | 1>;
}

/** Options for observing a cursor */
export interface ObserveOptions<T = VDocument> {
  init?: (elements: T[]) => void;
  added?: (element: T, index: number) => void;
  removed?: (element: T, index: number) => void;
  changed?: (asis: T, tobe: T, index: number) => void;
  moved?: (element: T, fromIndex: number, toIndex: number) => void;
}

/** Node-style callback */
export type Callback<T = void> = (err: Error | null, result?: T) => void;

/** Find request parameters */
export interface FindRequest {
  collection: string;
  query: Record<string, unknown>;
  sort?: Record<string, 1 | -1>;
  limit?: number;
  skip?: number;
  project?: Record<string, 0 | 1>;
}

/** Count request parameters */
export interface CountRequest {
  collection: string;
  query: Record<string, unknown>;
  skip?: number;
  limit?: number;
}

/** Insert request parameters */
export interface InsertRequest {
  collection: string;
  documents: VDocument | VDocument[];
}

/** Save (upsert) request parameters */
export interface SaveRequest {
  collection: string;
  documents: VDocument | VDocument[];
}

/** Remove request parameters */
export interface RemoveRequest {
  collection: string;
  query: Record<string, unknown>;
}

/** Standard write response */
export interface WriteResponse {
  ok: boolean;
  documents?: VDocument[];
}

/** Observe request parameters */
export interface ObserveRequest {
  collection: string;
  query: Record<string, unknown>;
  sort?: Record<string, 1 | -1>;
  limit?: number;
  skip?: number;
  project?: Record<string, 0 | 1>;
  events?: { i?: boolean; a?: boolean; r?: boolean; c?: boolean; m?: boolean };
}

/** Discriminated union for observe events */
export type ObserveEvent =
  | { type: 'init'; documents: VDocument[] }
  | { type: 'added'; document: VDocument; index: number }
  | { type: 'removed'; document: VDocument; index: number }
  | { type: 'changed'; oldDocument: VDocument; newDocument: VDocument; index: number }
  | { type: 'moved'; document: VDocument; fromIndex: number; toIndex: number };

/** Scomp-specific collection interface with EventEmitter support */
export interface ScompCollectionLike extends EventEmitter {
  _name: string;
  _proxy: ViewDbScompContract;
  count(query?: Record<string, any>, options?: Record<string, any>, callback?: (err: Error | null, result?: number) => void): void;
}

/** The scomp contract shape for ViewDB operations */
export interface ViewDbScompContract {
  find(input: FindRequest): Promise<VDocument[]>;
  count(input: CountRequest): Promise<number>;
  insert(input: InsertRequest): Promise<WriteResponse>;
  save(input: SaveRequest): Promise<WriteResponse>;
  remove(input: RemoveRequest): Promise<WriteResponse>;
  observe(input: ObserveRequest): AsyncIterable<ObserveEvent>;
}
