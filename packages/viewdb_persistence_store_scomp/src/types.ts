/** A generic document stored in viewdb */
export type VDocument = Record<string, unknown> & { _id?: string };

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

/** The scomp contract shape for ViewDB operations */
export interface ViewDbScompContract {
  find(input: FindRequest): Promise<VDocument[]>;
  count(input: CountRequest): Promise<number>;
  insert(input: InsertRequest): Promise<WriteResponse>;
  save(input: SaveRequest): Promise<WriteResponse>;
  remove(input: RemoveRequest): Promise<WriteResponse>;
  observe(input: ObserveRequest): AsyncIterable<ObserveEvent>;
}
