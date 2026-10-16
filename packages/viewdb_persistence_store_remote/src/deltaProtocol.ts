import type { Operation } from 'fast-json-patch';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export interface WireDocument {
  [key: string]: JsonValue;
}

export interface DeltaCacheLimits {
  maxBytes?: number;
  maxEntries?: number;
}

export interface SocketClientOptions {
  /** Private baseline budget per observer. Zero disables baseline retention. */
  deltaCache?: DeltaCacheLimits;
}

export type DocumentId = string | number;
export interface ObserverDelta {
  documentId: DocumentId;
  baseVersion: number;
  version: number;
  patch: Operation[];
  i: number;
}

export interface ObserverChange {
  i?: { r: WireDocument[] };
  /** Private initialization for consumers without a public init callback. */
  s?: { r: WireDocument[] };
  a?: { e: WireDocument; i: number };
  r?: { e: WireDocument; i: number };
  c?: { o?: WireDocument | null; n: WireDocument; i: number };
  m?: { e: WireDocument; o: number; n: number };
  d?: ObserverDelta;
}

export interface ObserverResponse {
  handle?: string;
  deltaVersion?: 1;
  changes?: ObserverChange[];
  /** Monotonic delivery sequence within this registration. */
  sequence?: number;
}

export interface ObserverDocumentRequest {
  h: string;
  documentId: DocumentId;
}

export interface ObserverDocumentResponse {
  visible: boolean;
  document?: WireDocument;
  index?: number;
  sequence: number;
}

export interface ObserverSnapshotResponse {
  documents: WireDocument[];
  sequence: number;
}

export interface ObserverRequest {
  deltaVersion?: 1;
  'observe.document'?: ObserverDocumentRequest;
  'observe.snapshot'?: { h: string };
}

export interface ResponseError {
  code: 'OBSERVER_NOT_FOUND' | 'OBSERVER_NOT_READY' | 'RECOVERY_FAILED';
  message: string;
}
