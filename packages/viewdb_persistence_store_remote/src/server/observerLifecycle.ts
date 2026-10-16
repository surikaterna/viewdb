import { documentId, normalizeDocument } from '../deltaCache';
import {
  cacheDocument,
  changedFor,
  ConsumerCallbacks,
  delivered,
  emitError,
  reconcileObserver,
  rowKeyFor,
  rowKeysFor,
  sendChange,
  SharedObserver,
  waitForObserverInitialization
} from './deltaDelivery';
import { getSharedSnapshotCache } from './sharedSnapshotCache';
import { projectionWithIdentity, ServerCursor, ServerDocument, queryStable } from './stableQuery';

export interface ObserveRegistration {
  i: number;
  key: string | null;
  consumerId: string | null;
  token: number;
}

interface ServerObserveCallbacks {
  init: (documents: ServerDocument[]) => void;
  added: (document: ServerDocument, index: number) => void;
  removed: (document: ServerDocument, index: number) => void;
  changed: (oldDocument: ServerDocument | null, newDocument: ServerDocument, index: number) => void;
  moved: (document: ServerDocument, oldIndex: number, newIndex: number) => void;
  oplog: boolean;
  batchMs: number;
}

interface ObservableCursor extends ServerCursor {
  observe(options: ServerObserveCallbacks): { stop: () => void };
}

export interface ObservableViewDb {
  collection(name: string): { find(query: Record<string, unknown>): ObservableCursor };
}

export function observeKey(
  collection: string,
  query: Record<string, unknown>,
  sort?: Record<string, unknown>,
  limit?: number,
  skip?: number,
  project?: Record<string, unknown>
): string {
  return JSON.stringify({ collection, query, sort, limit, skip, project });
}

function notifyInitializationWaiters(shared: SharedObserver, stable: boolean): void {
  var waiters = shared.initializationWaiters.splice(0);
  waiters.forEach(function (waiter) {
    waiter(stable);
  });
}

export function removeConsumer(registry: Map<string, SharedObserver>, key: string, consumerId: string): void {
  var shared = registry.get(key);
  if (!shared) return;
  var consumer = shared.consumers.get(consumerId);
  if (consumer) {
    getSharedSnapshotCache().clear(consumer);
    shared.consumers.delete(consumerId);
  }
  if (shared.consumers.size === 0) {
    if (shared.reconcileRetryTimer) clearTimeout(shared.reconcileRetryTimer);
    shared.reconcileWaiters.forEach(function (waiter) {
      waiter(false);
    });
    notifyInitializationWaiters(shared, false);
    shared.reconcileWaiters.length = 0;
    if (shared.handle) shared.handle.stop();
    registry.delete(key);
  }
}

export function stopRegisteredObserver(registry: Map<string, SharedObserver>, observer: ObserveRegistration): void {
  if (!observer.key || !observer.consumerId) return;
  var shared = registry.get(observer.key);
  var consumer = shared && shared.consumers.get(observer.consumerId);
  var pendingKey = consumer && consumer.pendingRebindKey;
  if (consumer) consumer.pendingRebindKey = undefined;
  if (pendingKey && pendingKey !== observer.key) removeConsumer(registry, pendingKey, observer.consumerId);
  removeConsumer(registry, observer.key, observer.consumerId);
}

export function createSharedObserver(
  viewdb: ObservableViewDb,
  registry: Map<string, SharedObserver>,
  key: string,
  query: Record<string, unknown>,
  consumer: ConsumerCallbacks,
  readPreference: unknown,
  batchMs: number,
  onRegistered?: () => void,
  onInitializationFailure?: () => void
): SharedObserver | undefined {
  var sort = consumer.sort;
  var skip = consumer.skip;
  var project = consumer.project;
  var shared: SharedObserver = {
    handle: null,
    consumers: new Map(),
    viewdb: viewdb,
    collection: consumer.collection,
    query: query,
    sort: sort,
    limit: consumer.limit,
    skip: skip,
    project: project,
    revision: 0,
    snapshot: null,
    snapshotIdentities: [],
    windowed: consumer.windowed,
    pendingChanges: false,
    initializing: true,
    reconciling: false,
    reconcileDirty: false,
    reconcileWaiters: [],
    initializationWaiters: [],
    reconcileRetryDelay: 100
  };
  shared.consumers.set(consumer.id, consumer);

  var cursor = viewdb.collection(consumer.collection).find(query);
  if (readPreference && cursor.setReadPreference) cursor.setReadPreference(readPreference);
  if (sort) cursor.sort(sort);
  if (consumer.limit !== undefined) cursor.limit(consumer.limit);
  if (skip !== undefined) cursor.skip(skip);
  if (project) {
    if (cursor.project) cursor.project(projectionWithIdentity(project));
    else throw new Error('Cursor does not support the observer projection');
  }

  var observeOptions: ServerObserveCallbacks = {
    init: function (result: ServerDocument[]) {
      var initialize = function (documents: ServerDocument[], identities?: Array<string | number | undefined>) {
        shared.pendingChanges = false;
        shared.snapshot = shared.windowed
          ? documents.map(function (doc) {
              return normalizeDocument(doc) || doc;
            })
          : [];
        shared.snapshotIdentities = identities || [];
        var initialConsumers: Array<[string, ConsumerCallbacks]> = [];
        shared.consumers.forEach(function (entry, id) {
          initialConsumers.push([id, entry]);
        });
        shared.initializing = false;
        initialConsumers.forEach(function (pair) {
          var entry = pair[1];
          if (shared.consumers.get(pair[0]) !== entry || entry.rebindPending) return;
          entry.ready = true;
          if (entry.delta) {
            var docs = documents.map(function (doc, index) {
              return cacheDocument(entry.socket, entry, doc, identities && identities[index]) || doc;
            });
            var rowKeys = rowKeysFor(entry, documents, identities);
            var initial = { r: docs, rowKeys: rowKeys };
            delivered(entry.socket, entry, [entry.events.i ? { i: initial } : { s: initial }]);
          } else if (entry.events.i) sendChange(entry.socket, { i: { r: documents } }, entry.request);
        });
        notifyInitializationWaiters(shared, true);
      };
      if (!shared.pendingChanges && !shared.windowed) {
        initialize(result);
        return;
      }
      queryStable(shared, 2, function (error: Error | null, documents?: ServerDocument[], identities?: Array<string | number | undefined>) {
        if (!error && documents) {
          initialize(documents, identities);
          return;
        }
        shared.initializing = false;
        shared.consumers.forEach(function (entry, id) {
          if (!entry.rebindPending) emitError(entry.socket, entry.request, 'RECOVERY_FAILED', 'Unable to obtain a stable observer initialization');
          removeConsumer(registry, key, id);
        });
        if (onInitializationFailure) onInitializationFailure();
        notifyInitializationWaiters(shared, false);
      });
    },
    added: function (document: ServerDocument, index: number) {
      if (!shared.snapshot) {
        shared.pendingChanges = true;
        shared.revision++;
        return;
      }
      if (shared.windowed) return reconcileObserver(shared);
      shared.revision++;
      shared.consumers.forEach(function (entry) {
        if (!entry.ready || (!entry.delta && !entry.events.a)) return;
        var addedDocument = entry.delta ? cacheDocument(entry.socket, entry, document) || document : document;
        if (entry.delta) delivered(entry.socket, entry, [{ a: { e: addedDocument, i: index, rowKey: rowKeyFor(entry, documentId(document)) } }]);
        else sendChange(entry.socket, { a: { e: addedDocument, i: index } }, entry.request);
      });
    },
    removed: function (document: ServerDocument, index: number) {
      if (!shared.snapshot) {
        shared.pendingChanges = true;
        shared.revision++;
        return;
      }
      if (shared.windowed) return reconcileObserver(shared);
      shared.revision++;
      shared.consumers.forEach(function (entry) {
        if (entry.delta) {
          var removedId = documentId(document);
          if (removedId !== undefined) getSharedSnapshotCache().delete(entry, removedId);
          if (entry.ready) delivered(entry.socket, entry, [{ r: { e: document, i: index, rowKey: rowKeyFor(entry, removedId) } }]);
        } else if (entry.ready && entry.events.r) sendChange(entry.socket, { r: { e: document, i: index } }, entry.request);
      });
    },
    changed: function (oldDocument: ServerDocument | null, newDocument: ServerDocument, index: number) {
      if (!shared.snapshot) {
        shared.pendingChanges = true;
        shared.revision++;
        return;
      }
      if (shared.windowed) return reconcileObserver(shared);
      shared.revision++;
      shared.consumers.forEach(function (entry) {
        if (!entry.ready || (!entry.delta && !entry.events.c)) return;
        var change = entry.delta ? changedFor(entry.socket, entry, newDocument, index) : { c: { o: oldDocument, n: newDocument, i: index } };
        if (entry.delta) delivered(entry.socket, entry, [change]);
        else sendChange(entry.socket, change, entry.request);
      });
    },
    moved: function (document: ServerDocument, oldIndex: number, newIndex: number) {
      if (!shared.snapshot) {
        shared.pendingChanges = true;
        shared.revision++;
        return;
      }
      if (shared.windowed) return reconcileObserver(shared);
      shared.revision++;
      shared.consumers.forEach(function (entry) {
        if (!entry.ready) return;
        if (entry.delta) delivered(entry.socket, entry, [{ m: { e: document, o: oldIndex, n: newIndex, rowKey: rowKeyFor(entry, documentId(document)) } }]);
        else if (entry.events.m) sendChange(entry.socket, { m: { e: document, o: oldIndex, n: newIndex } }, entry.request);
      });
    },
    oplog: true,
    batchMs: batchMs
  };

  registry.set(key, shared);
  if (onRegistered) onRegistered();
  var observeHandle: { stop: () => void };
  try {
    observeHandle = cursor.observe(observeOptions);
  } catch {
    cursor.close(function (_closeError: Error | null) {});
    shared.initializing = false;
    if (registry.get(key) === shared) registry.delete(key);
    notifyInitializationWaiters(shared, false);
    return undefined;
  }
  if (registry.get(key) !== shared || shared.consumers.size === 0) {
    observeHandle.stop();
    if (registry.get(key) === shared) registry.delete(key);
    cursor.close(function (_closeError: Error | null) {});
    return undefined;
  }
  shared.handle = observeHandle;
  cursor.close(function (_closeError: Error | null) {});
  return shared;
}

export function rebindConsumerToAuthorizedQuery(
  viewdb: ObservableViewDb,
  registry: Map<string, SharedObserver>,
  registration: ObserveRegistration,
  consumer: ConsumerCallbacks,
  query: Record<string, unknown>,
  readPreference: unknown,
  batchMs: number,
  isCurrent: () => boolean,
  callback: (error: Error | null, shared?: SharedObserver) => void
): void {
  if (!isCurrent()) return;
  if (!registration.key || !registration.consumerId) {
    callback(new Error('Observer registration is no longer active'));
    return;
  }
  var consumerId = registration.consumerId;
  var oldKey = registration.key;
  var oldShared = registry.get(oldKey);
  if (!oldShared || oldShared.consumers.get(consumerId) !== consumer) {
    callback(new Error('Observer registration is no longer active'));
    return;
  }
  var targetKey = observeKey(consumer.collection, query, consumer.sort, consumer.limit, consumer.skip, consumer.project);
  if (targetKey === oldKey) {
    consumer.rebindPending = false;
    consumer.ready = true;
    callback(null, oldShared);
    return;
  }
  consumer.ready = false;
  consumer.rebindPending = true;
  consumer.pendingRebindKey = targetKey;
  var targetShared = registry.get(targetKey);
  if (targetShared) {
    var occupant = targetShared.consumers.get(consumerId);
    if (occupant && occupant !== consumer) {
      consumer.pendingRebindKey = undefined;
      callback(new Error('Authorized observer registration conflicts with an existing consumer'));
      return;
    }
    targetShared.consumers.set(consumerId, consumer);
  } else {
    try {
      targetShared = createSharedObserver(viewdb, registry, targetKey, query, consumer, readPreference, batchMs);
    } catch {
      targetShared = undefined;
    }
  }
  if (!targetShared) {
    consumer.pendingRebindKey = undefined;
    callback(new Error('Unable to create the authorized observer'));
    return;
  }
  const activeTarget = targetShared;
  var failRebind = function () {
    if (activeTarget.consumers.get(consumerId) === consumer) removeConsumer(registry, targetKey, consumerId);
    consumer.pendingRebindKey = undefined;
    consumer.ready = false;
    consumer.rebindPending = true;
    callback(new Error('Unable to initialize the authorized observer'));
  };
  var completeRebind = function (stable: boolean) {
    if (!isCurrent()) {
      if (activeTarget.consumers.get(consumerId) === consumer) removeConsumer(registry, targetKey, consumerId);
      consumer.pendingRebindKey = undefined;
      return;
    }
    if (!stable || registry.get(targetKey) !== activeTarget || activeTarget.consumers.get(consumerId) !== consumer) {
      failRebind();
      return;
    }
    consumer.pendingRebindKey = undefined;
    consumer.rebindPending = false;
    consumer.ready = true;
    removeConsumer(registry, oldKey, consumerId);
    registration.key = targetKey;
    callback(null, activeTarget);
  };
  if (activeTarget.initializing) waitForObserverInitialization(activeTarget, completeRebind);
  else completeRebind(true);
}
