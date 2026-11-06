import { compare } from 'fast-json-patch';
import HmacSHA256 = require('crypto-js/hmac-sha256');
import { DocumentId, ObserverDelta, ResponseError, WireDocument } from '../deltaProtocol';
import { documentId, encodedBytes, normalizeDocument, validVersion } from '../deltaCache';
import { VdbSocket } from '../types';
import { getSharedSnapshotCache } from './sharedSnapshotCache';
import { ServerDocument, StableQueryConfig, queryStable } from './stableQuery';

export interface ServerRequest {
  i: string | number;
  p: Record<string, unknown>;
}

export type QueryDecorator = (collection: string, query: Record<string, unknown>, callback: (decoratedQuery: Record<string, unknown>) => void) => void;

export interface ConsumerCallbacks {
  id: string;
  request: ServerRequest;
  socket: VdbSocket;
  events: { i?: boolean; a?: boolean; r?: boolean; c?: boolean; m?: boolean };
  ready: boolean;
  delta: boolean;
  collection: string;
  namespace: number;
  sequence: number;
  rowKeySecret?: string;
  rebindPending?: boolean;
  sort?: Record<string, unknown>;
  skip?: number;
  project?: Record<string, unknown>;
  limit?: number;
  windowed: boolean;
  pendingRebindKey?: string;
}
export interface SharedObserver extends StableQueryConfig {
  handle: { stop: () => void; getStats?: () => { evalCount: number; matchCount: number; rawChangedCount: number; emittedChangedCount: number } } | null;
  consumers: Map<string, ConsumerCallbacks>;
  snapshot: ServerDocument[] | null;
  snapshotIdentities: Array<DocumentId | undefined>;
  windowed: boolean;
  pendingChanges: boolean;
  initializing: boolean;
  reconciling: boolean;
  reconcileDirty: boolean;
  reconcileWaiters: Array<(stable: boolean) => void>;
  initializationWaiters: Array<(stable: boolean) => void>;
  reconcileRetryTimer?: NodeJS.Timeout;
  reconcileRetryDelay: number;
}

export interface ServerChangedEvent {
  c?: { o: null; n: ServerDocument; i: number; rowKey?: string };
  d?: ObserverDelta;
  rowKey?: string;
}

interface MergeEvent {
  kind: 'a' | 'r' | 'c' | 'm';
  document: ServerDocument;
  oldDocument?: ServerDocument;
  index: number;
  oldIndex?: number;
  newIndex?: number;
}

interface MergeOptions {
  keyFn?: (document: ServerDocument) => string;
  added: (document: ServerDocument, index: number) => void;
  removed: (document: ServerDocument, index: number) => void;
  changed: (oldDocument: ServerDocument, newDocument: ServerDocument, index: number) => void;
  moved: (document: ServerDocument, oldIndex: number, newIndex: number) => void;
}

function stableIdKey(document: unknown): string | undefined {
  var id = documentId(document);
  return id === undefined ? undefined : typeof id + ':' + String(id);
}

export function rowKeyFor(consumer: ConsumerCallbacks, identity: DocumentId | undefined): string | undefined {
  var secret = consumer.rowKeySecret;
  if (identity === undefined || !secret) return undefined;
  return HmacSHA256(typeof identity + ':' + String(identity), secret).toString();
}

export function rowKeysFor(consumer: ConsumerCallbacks, documents: ServerDocument[], identities?: Array<DocumentId | undefined>): string[] | undefined {
  var rowKeys: string[] = [];
  for (var index = 0; index < documents.length; index++) {
    var identity = documentId(documents[index]);
    if (identity === undefined && identities) identity = identities[index];
    var rowKey = rowKeyFor(consumer, identity);
    if (rowKey === undefined) return undefined;
    rowKeys.push(rowKey);
  }
  return rowKeys;
}
function rowWithIdentity(document: ServerDocument, identity: DocumentId | undefined, publicRows: Map<ServerDocument, ServerDocument>): ServerDocument {
  var id = documentId(document) === undefined ? identity : documentId(document);
  if (id === undefined || documentId(document) !== undefined) {
    publicRows.set(document, document);
    return document;
  }
  var row: ServerDocument = {};
  Object.keys(document).forEach(function (key) {
    row[key] = document[key];
  });
  row._id = id;
  publicRows.set(row, document);
  return row;
}

export function sendChange(socket: VdbSocket, change: unknown, request: ServerRequest): void {
  socket.emit('/vdb/response', { i: request.i, p: { changes: [change] } });
}

export function emitError(socket: VdbSocket, request: ServerRequest, code: ResponseError['code'], message: string): void {
  socket.emit('/vdb/response', { i: request.i, e: { code: code, message: message } });
}

export function delivered(socket: VdbSocket, consumer: ConsumerCallbacks, changes: unknown[]): void {
  consumer.sequence++;
  socket.emit('/vdb/response', { i: consumer.request.i, p: { changes: changes, sequence: consumer.sequence } });
}

export function cacheDocument(_socket: VdbSocket, consumer: ConsumerCallbacks, doc: unknown, identity?: DocumentId): WireDocument | undefined {
  var normalized = normalizeDocument(doc);
  var id = normalized ? documentId(normalized) : documentId(doc);
  if (id === undefined) id = identity;
  if (!normalized) {
    if (consumer.delta && id !== undefined) getSharedSnapshotCache().delete(consumer, id);
    return undefined;
  }
  if (consumer.delta) getSharedSnapshotCache().seed(consumer, consumer.namespace, consumer.collection, normalized, identity);
  return normalized;
}

export function changedFor(_socket: VdbSocket, consumer: ConsumerCallbacks, tobe: ServerDocument, index: number, identity?: DocumentId): ServerChangedEvent {
  var normalized = normalizeDocument(tobe);
  var id = normalized ? documentId(normalized) : documentId(tobe);
  if (id === undefined) id = identity;
  var key = rowKeyFor(consumer, id);
  var cache = consumer.delta ? getSharedSnapshotCache() : undefined;
  if (!normalized) {
    if (id !== undefined && cache) cache.delete(consumer, id);
    return { c: { o: null, n: tobe, i: index, rowKey: key } };
  }
  var old = id !== undefined && cache ? cache.get(consumer, consumer.namespace, consumer.collection, id) : undefined;
  var before = old && validVersion(old.version) ? old.version : undefined;
  var version = validVersion(normalized.version) ? normalized.version : undefined;
  if (
    consumer.events.c &&
    old &&
    before !== undefined &&
    version !== undefined &&
    version > before &&
    id !== undefined &&
    documentId(old.document) === id &&
    documentId(normalized) === id
  ) {
    var patch = compare(old.document, normalized);
    var delta: ObserverDelta = { documentId: id, baseVersion: before, version: version, patch: patch, i: index };
    if (encodedBytes({ d: delta }) < encodedBytes({ c: { o: null, n: normalized, i: index } })) {
      cache!.seed(consumer, consumer.namespace, consumer.collection, normalized, id);
      return key === undefined ? { d: delta } : { d: delta, rowKey: key };
    }
  }
  if (id !== undefined && cache) cache.seed(consumer, consumer.namespace, consumer.collection, normalized, id);
  return { c: { o: null, n: normalized, i: index, rowKey: key } };
}
function notifyReconcileWaiters(shared: SharedObserver, stable: boolean): void {
  var waiters = shared.reconcileWaiters.splice(0);
  waiters.forEach(function (waiter) {
    waiter(stable);
  });
}

function stableObserver(shared: SharedObserver): void {
  shared.reconciling = false;
  shared.reconcileDirty = false;
  shared.reconcileRetryDelay = 100;
  notifyReconcileWaiters(shared, true);
}

function failedObserver(shared: SharedObserver): void {
  shared.reconciling = false;
  shared.reconcileDirty = false;
  shared.consumers.forEach(function (entry) {
    if (entry.ready) emitError(entry.socket, entry.request, 'RECOVERY_FAILED', 'Unable to obtain a stable observer window');
  });
  notifyReconcileWaiters(shared, false);
  if (shared.reconcileRetryTimer || shared.consumers.size === 0) return;
  var delay = shared.reconcileRetryDelay;
  shared.reconcileRetryDelay = Math.min(delay * 2, 5000);
  shared.reconcileRetryTimer = setTimeout(function () {
    shared.reconcileRetryTimer = undefined;
    if (shared.consumers.size > 0) reconcileObserver(shared);
  }, delay);
}

export function waitForObserverInitialization(shared: SharedObserver, callback: (stable: boolean) => void): void {
  if (!shared.initializing) {
    callback(true);
    return;
  }
  shared.initializationWaiters.push(callback);
}

export function waitForObserverCommit(shared: SharedObserver, callback: (stable: boolean) => void): void {
  if (!shared.windowed) {
    callback(true);
    return;
  }
  shared.reconcileWaiters.push(callback);
  if (!shared.reconciling && !shared.reconcileRetryTimer) reconcileObserver(shared);
}

export function reconcileObserver(shared: SharedObserver, attempts: number = 2): void {
  if (shared.consumers.size === 0) return;
  shared.revision++;
  if (shared.reconciling || shared.reconcileRetryTimer) {
    shared.reconcileDirty = true;
    return;
  }
  shared.reconciling = true;
  var reconcile = function (remainingAttempts: number) {
    if (shared.consumers.size === 0) {
      shared.reconciling = false;
      shared.reconcileDirty = false;
      notifyReconcileWaiters(shared, false);
      return;
    }
    shared.reconcileDirty = false;
    queryStable(shared, 0, function (error, documents, identities) {
      if (shared.consumers.size === 0) {
        shared.reconciling = false;
        shared.reconcileDirty = false;
        notifyReconcileWaiters(shared, false);
        return;
      }
      if (error || !documents || shared.reconcileDirty) {
        if (remainingAttempts > 0)
          return setTimeout(function () {
            reconcile(remainingAttempts - 1);
          }, 10);
        failedObserver(shared);
        return;
      }
      if (!shared.snapshot) {
        shared.snapshot = documents;
        shared.snapshotIdentities = identities || [];
        stableObserver(shared);
        return;
      }
      var publicRows = new Map<ServerDocument, ServerDocument>();
      var oldRows = shared.snapshot.map(function (document, index) {
        return rowWithIdentity(document, shared.snapshotIdentities[index], publicRows);
      });
      var newRows = documents.map(function (document, index) {
        return rowWithIdentity(document, identities && identities[index], publicRows);
      });
      var changes: MergeEvent[] = [];
      var canKeyById =
        newRows.every(function (document) {
          return stableIdKey(document) !== undefined;
        }) &&
        oldRows.every(function (document) {
          return stableIdKey(document) !== undefined;
        });
      var options: MergeOptions = {
        keyFn: canKeyById
          ? function (document) {
              return stableIdKey(document)!;
            }
          : undefined,
        added: function (document, index) {
          changes.push({ kind: 'a', document: document, index: index });
        },
        removed: function (document, index) {
          changes.push({ kind: 'r', document: document, index: index });
        },
        changed: function (oldDocument, newDocument, index) {
          changes.push({ kind: 'c', oldDocument: oldDocument, document: newDocument, index: index });
        },
        moved: function (document, oldIndex, newIndex) {
          changes.push({ kind: 'm', document: document, index: newIndex, oldIndex: oldIndex, newIndex: newIndex });
        }
      };
      require('viewdb').merge(oldRows, newRows, options);
      shared.snapshot = documents.map(function (document) {
        return normalizeDocument(document) || document;
      });
      shared.snapshotIdentities = identities || [];
      changes.forEach(function (change) {
        var identity = documentId(change.document);
        var document = publicRows.get(change.document) || change.document;
        var oldDocument = change.oldDocument ? publicRows.get(change.oldDocument) || change.oldDocument : undefined;
        shared.consumers.forEach(function (entry) {
          if (!entry.ready) return;
          if (change.kind === 'c') {
            if (entry.delta) delivered(entry.socket, entry, [changedFor(entry.socket, entry, document, change.index, identity)]);
            else if (entry.events.c) sendChange(entry.socket, { c: { o: oldDocument!, n: document, i: change.index } }, entry.request);
          } else if (change.kind === 'a') {
            if (entry.delta) {
              var added = cacheDocument(entry.socket, entry, document, identity) || document;
              delivered(entry.socket, entry, [{ a: { e: added, i: change.index, rowKey: rowKeyFor(entry, identity) } }]);
            } else if (entry.events.a) sendChange(entry.socket, { a: { e: document, i: change.index } }, entry.request);
          } else if (change.kind === 'r') {
            if (entry.delta) {
              if (identity !== undefined) getSharedSnapshotCache().delete(entry, identity);
              delivered(entry.socket, entry, [{ r: { e: document, i: change.index, rowKey: rowKeyFor(entry, identity) } }]);
            } else if (entry.events.r) sendChange(entry.socket, { r: { e: document, i: change.index } }, entry.request);
          } else if (entry.delta)
            delivered(entry.socket, entry, [{ m: { e: document, o: change.oldIndex, n: change.newIndex, rowKey: rowKeyFor(entry, identity) } }]);
          else if (entry.events.m) sendChange(entry.socket, { m: { e: document, o: change.oldIndex, n: change.newIndex } }, entry.request);
        });
      });
      stableObserver(shared);
      if (shared.reconcileDirty) reconcileObserver(shared, remainingAttempts);
    });
  };
  reconcile(attempts);
}
