import { v4 as uuid } from 'uuid';
import { cloneDocument, documentId, validVersion } from '../deltaCache';
import type { DocumentId, ObserverChange, SocketClientOptions, WireDocument } from '../deltaProtocol';
import _ = require('lodash');

export interface ObserverQuery {
  [key: string]: unknown;
  query?: unknown;
  skip?: unknown;
  limit?: unknown;
  sort?: unknown;
  project?: unknown;
}

export interface ObserverParams {
  [key: string]: unknown;
  id: string;
  observe: unknown;
  collection: string;
  events: { i: boolean; a: boolean; r: boolean; c: boolean; m: boolean };
  deltaVersion?: 1;
}

export interface ObserverClient {
  options?: SocketClientOptions;
  cancelRequest?(id: number): void;
  subscribe(payload: Record<string, unknown>, callback: (err: Error | string | null, response?: unknown) => void): { stop: () => void };
  request(payload: Record<string, unknown>, callback?: (err: Error | null, response?: unknown) => void): number | void;
}

export interface RemoteCollection {
  _client: ObserverClient;
  _name: string;
}

export interface ObserverDefaults {
  events: ObserverParams['events'];
  deltaVersion?: 1;
}

export interface ObserverCallbacks {
  init?: (result: WireDocument[]) => void;
  added?: (document: WireDocument, index: number) => void;
  removed?: (document: WireDocument, index: number) => void;
  changed?: (oldDocument: WireDocument | null | undefined, newDocument: WireDocument, index: number) => void;
  moved?: (document: WireDocument, oldIndex: number, newIndex: number) => void;
}

export interface EventRecord {
  change: ObserverChange;
  sequence?: number;
}

export interface PendingDocumentRecovery {
  targetVersion?: number;
}

export function buildParams(defaults: ObserverDefaults, query: ObserverQuery, collection: RemoteCollection): ObserverParams {
  var id = uuid();
  var params: ObserverParams = {
    id: id,
    observe: query.query || query,
    collection: collection._name,
    skip: query.query ? query.skip : undefined,
    limit: query.query ? query.limit : undefined,
    sort: query.query ? query.sort : undefined,
    events: defaults.events,
    deltaVersion: defaults.deltaVersion
  };
  if (query.query && query.project) params.project = query.project;
  return params;
}
export function documentVersionFor(change: ObserverChange, id: DocumentId): unknown {
  if (change.a && documentId(change.a.e) === id) return change.a.e.version;
  if (change.r && documentId(change.r.e) === id) return change.r.e.version;
  if (change.d && change.d.documentId === id) return change.d.version;
  if (change.c && documentId(change.c.n) === id) return change.c.n.version;
  return undefined;
}

export function idKey(document: WireDocument): string | undefined {
  var id = documentId(document);
  if (id === undefined) return undefined;
  return typeof id + ':' + String(id);
}
export function copyDocuments(documents: WireDocument[]): WireDocument[] {
  return documents.map((document) => cloneDocument(document));
}

export function isStructural(change: ObserverChange): boolean {
  return Boolean(change.i || change.s || change.a || change.r || change.m);
}
export interface ObserverRowIdentity {
  id?: DocumentId;
  rowKey?: string;
  version?: number;
}
interface MergeRow extends WireDocument {
  key: string;
  index: number;
  document: WireDocument | null;
}

interface RowMergeOptions {
  keyFn: (row: MergeRow) => string;
  added?: (row: MergeRow, index: number) => void;
  removed?: (row: MergeRow, index: number) => void;
  changed?: (oldRow: MergeRow, newRow: MergeRow, index: number) => void;
  moved?: (row: MergeRow, oldIndex: number, newIndex: number) => void;
}

var merge = require('viewdb').merge as (current: MergeRow[] | null, next: MergeRow[], options: RowMergeOptions) => MergeRow[];

export function reconcileSnapshotRows(
  current: ObserverRowIdentity[] | null,
  documents: WireDocument[],
  rowKeys: string[] | undefined,
  getCached: (row: ObserverRowIdentity) => WireDocument | undefined,
  callbacks: ObserverCallbacks,
  shouldContinue: () => boolean
): ObserverRowIdentity[] {
  var keyed =
    !!current &&
    !!rowKeys &&
    rowKeys.length === documents.length &&
    current.every((row) => typeof row.rowKey === 'string' && row.rowKey.length > 0) &&
    rowKeys.every((key) => typeof key === 'string' && key.length > 0);
  var prior: MergeRow[] | null = current
    ? current.map((row, index) => ({
        key: keyed ? 'row:' + row.rowKey : row.id === undefined ? 'old:' + index : 'id:' + idKey({ _id: row.id }),
        index: index,
        document: null
      }))
    : null;
  var nextRows: ObserverRowIdentity[] = [];
  var next: MergeRow[] = documents.map((document, index) => {
    var id = documentId(document);
    var rowKey = rowKeys && rowKeys.length === documents.length ? rowKeys[index] : undefined;
    nextRows.push({ id: id, rowKey: rowKey, version: validVersion(document.version) ? document.version : undefined });
    return {
      key: keyed ? 'row:' + rowKey : id === undefined ? 'new:' + index : 'id:' + idKey({ _id: id }),
      index: index,
      document: document
    };
  });
  var merged = merge(prior, next, {
    keyFn: (row) => String(row.key),
    added: (row, index) => {
      if (shouldContinue() && callbacks.added && row.document) callbacks.added(cloneDocument(row.document), index);
    },
    removed: (row, index) => {
      if (!shouldContinue() || !callbacks.removed || !current) return;
      var old = getCached(current[row.index]);
      if (old) callbacks.removed(cloneDocument(old), index);
    },
    changed: (oldRow, newRow, index) => {
      if (!shouldContinue() || !callbacks.changed || !current || !newRow.document) return;
      var old = getCached(current[oldRow.index]);
      var document = newRow.document;
      if (!old || !_.isEqual(old, document)) {
        callbacks.changed(old ? cloneDocument(old) : null, cloneDocument(document), index);
      }
    },
    moved: (row, oldIndex, newIndex) => {
      if (shouldContinue() && callbacks.moved && row.document) callbacks.moved(cloneDocument(row.document), oldIndex, newIndex);
    }
  });
  return merged.map((row) => nextRows[row.index]);
}

export function updatePendingTarget(pendingDocuments: Map<DocumentId, PendingDocumentRecovery>, id: DocumentId, version: unknown): void {
  var pending = pendingDocuments.get(id);
  if (pending && validVersion(version) && (pending.targetVersion === undefined || version > pending.targetVersion)) pending.targetVersion = version;
}

export function isIndex(value: unknown): value is number {
  return validVersion(value);
}

export class RecoveryRequests {
  private readonly ids = new Set<number>();

  request(client: ObserverClient, payload: Record<string, unknown>, callback: (error: Error | null, response?: unknown) => void, active: () => boolean): void {
    var id: number | undefined;
    var completed = false;
    var returnedId = client.request(payload, (error, response) => {
      completed = true;
      if (id !== undefined) this.ids.delete(id);
      callback(error, response);
    });
    if (typeof returnedId === 'number') id = returnedId;
    if (!completed && active() && typeof returnedId === 'number') this.ids.add(returnedId);
    else if (typeof returnedId === 'number') client.cancelRequest?.(returnedId);
  }

  cancelAll(client: ObserverClient): void {
    this.ids.forEach((id) => {
      client.cancelRequest?.(id);
    });
    this.ids.clear();
  }
}

export function coveredByRecovery(record: EventRecord, id: DocumentId, recoveredVersion: number, sequence: number): boolean {
  var change = record.change;
  var version = documentVersionFor(change, id);
  var sameFullDocument =
    Boolean(change.a && documentId(change.a.e) === id) ||
    Boolean(change.r && documentId(change.r.e) === id) ||
    Boolean(change.c && documentId(change.c.n) === id) ||
    Boolean(change.d && change.d.documentId === id);
  return (
    (sameFullDocument && record.sequence !== undefined && record.sequence <= sequence) ||
    (Boolean(change.d) && validVersion(version) && version <= recoveredVersion)
  );
}
