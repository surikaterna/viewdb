import _ = require('lodash');
import { applyPatch } from 'fast-json-patch';
import { Logger } from 'slf';
import { BaselineCache, cloneDocument, documentId, normalizeDocument, validVersion } from '../deltaCache';
import type {
  DocumentId,
  ObserverChange,
  ObserverDocumentResponse,
  ObserverResponse,
  ObserverSnapshotResponse,
  SocketClientOptions,
  WireDocument
} from '../deltaProtocol';
import { isObserverDocumentResponse, isObserverResponse, isObserverSnapshotResponse } from './observe_protocol';
import {
  buildParams,
  copyDocuments,
  coveredByRecovery,
  isIndex,
  isStructural,
  reconcileSnapshot,
  RecoveryRequests,
  updatePendingTarget
} from './observe_helpers';
import type {
  EventRecord,
  ObserverCallbacks,
  ObserverDefaults,
  ObserverParams,
  ObserverQuery,
  PendingDocumentRecovery,
  RemoteCollection
} from './observe_helpers';

var LOG = Logger.getLogger('viewdb:remote:observe');

class Observer {
  handles: string[] = [];
  private readonly collection: RemoteCollection;
  private readonly callbacks: ObserverCallbacks;
  private readonly query: ObserverQuery;
  private readonly events: { i: boolean; a: boolean; r: boolean; c: boolean; m: boolean };
  private readonly cache: BaselineCache;
  private readonly clientOptions: SocketClientOptions;
  private stopped = false;
  private generation = 0;
  private params: ObserverParams | null = null;
  private remoteHandle: string | null = null;
  private currentHandle: { stop: () => void } | null = null;
  private stopSent = false;
  private deltaSupported = false;
  private scope = '';
  private currentResult: WireDocument[] = [];
  private resultInitialized = false;
  private currentResultKnown = false;
  private waitingForHandle: EventRecord[] = [];
  private buffered: EventRecord[] = [];
  private pendingDocuments = new Map<DocumentId, PendingDocumentRecovery>();
  private snapshotPending: object | null = null;
  private snapshotOnNextEvent = false;
  private readonly recoveryRequests = new RecoveryRequests();
  private recoveryRetryCount = 0;

  constructor(collection: RemoteCollection, options: ObserverCallbacks, query: ObserverQuery) {
    this.collection = collection;
    this.callbacks = options || {};
    this.query = query;
    this.events = {
      i: !_.isNil(this.callbacks.init),
      a: !_.isNil(this.callbacks.added),
      r: !_.isNil(this.callbacks.removed),
      c: !_.isNil(this.callbacks.changed),
      m: !_.isNil(this.callbacks.moved)
    };
    this.clientOptions = collection._client.options || {};
    this.cache = new BaselineCache(this.clientOptions.deltaCache);
    this.startObserver();
  }

  private resetGeneration(): void {
    this.cache.clear();
    this.recoveryRequests.cancelAll(this.collection._client);
    this.remoteHandle = null;
    this.deltaSupported = false;
    this.scope = '';
    this.currentResult = [];
    this.currentResultKnown = false;
    this.resultInitialized = false;
    this.waitingForHandle = [];
    this.buffered = [];
    this.pendingDocuments.clear();
    this.snapshotPending = null;
    this.snapshotOnNextEvent = false;
    this.recoveryRetryCount = 0;
  }

  private startObserver(): void {
    if (this.stopped) return;
    this.generation++;
    var generation = this.generation;
    this.resetGeneration();
    this.stopSent = false;
    var events = this.events;
    var defaults: ObserverDefaults = {
      events: events,
      deltaVersion: 1
    };
    this.params = buildParams(defaults, this.query, this.collection);
    this.scope = this.params.id;
    this.currentHandle = this.collection._client.subscribe(this.params, (err: Error | string | null, rawResponse?: unknown) => {
      if (generation !== this.generation || this.stopped) return;
      if (err) {
        if (this.currentHandle) {
          this.sendStopRequest();
          this.currentHandle.stop();
          this.currentHandle = null;
        }
        LOG.warn('Remote observer failed; restarting', err);
        this.startObserver();
        return;
      }
      if (!isObserverResponse(rawResponse)) {
        if (this.deltaSupported) this.requestSnapshot();
        return;
      }
      this.receiveResponse(generation, rawResponse);
    });
  }
  private sendStopRequest(): void {
    if (this.stopSent || !this.params) return;
    this.stopSent = true;
    this.collection._client.request({ 'observe.stop': { h: this.params.id } });
  }

  private receiveResponse(generation: number, response: ObserverResponse): void {
    if (generation !== this.generation || this.stopped) return;
    if (response.deltaVersion === 1) this.deltaSupported = true;
    if (response.handle) this.remoteHandle = response.handle;
    var records: EventRecord[] = [];
    if (Array.isArray(response.changes)) {
      response.changes.forEach((change) => {
        records.push({ change: change, sequence: response.sequence });
      });
    }
    if (!this.remoteHandle) {
      this.waitingForHandle.push.apply(this.waitingForHandle, records);
      return;
    }
    if (this.waitingForHandle.length) {
      var queued = this.waitingForHandle;
      this.waitingForHandle = [];
      queued.forEach((record) => {
        this.acceptRecord(record);
      });
    }
    records.forEach((record) => {
      this.acceptRecord(record);
    });
  }
  private isRecovering(): boolean {
    return this.snapshotPending !== null || this.pendingDocuments.size > 0;
  }

  private acceptRecord(record: EventRecord): void {
    if (this.stopped) return;
    if (this.snapshotOnNextEvent) {
      this.snapshotOnNextEvent = false;
      this.buffered.push(record);
      this.requestSnapshot();
      return;
    }
    if (this.isRecovering()) {
      this.buffered.push(record);
      if (isStructural(record.change) && this.deltaSupported) this.requestSnapshot();
      else if (record.change.d) updatePendingTarget(this.pendingDocuments, record.change.d.documentId, record.change.d.version);
      return;
    }
    this.processRecord(record);
  }
  private processRecord(record: EventRecord): void {
    var change = record.change;
    if (change.i) {
      this.installResult(change.i.r);
      if (this.callbacks.init) this.callbacks.init(copyDocuments(change.i.r));
    } else if (change.s) {
      this.installResult(change.s.r);
    } else if (change.a) {
      if (this.addDocument(change.a.e, change.a.i) && this.callbacks.added) {
        this.callbacks.added(cloneDocument(change.a.e), change.a.i);
      }
    } else if (change.r) {
      if (this.removeDocument(change.r.e, change.r.i) && this.callbacks.removed) {
        this.callbacks.removed(cloneDocument(change.r.e), change.r.i);
      }
    } else if (change.c) {
      if (this.applyFullChange(change.c.n, change.c.i) && this.callbacks.changed) {
        var oldDocument = change.c.o;
        this.callbacks.changed(
          oldDocument === null || oldDocument === undefined ? oldDocument : cloneDocument(oldDocument),
          cloneDocument(change.c.n),
          change.c.i
        );
      }
    } else if (change.m) {
      if (this.moveDocument(change.m.e, change.m.o, change.m.n) && this.callbacks.moved) {
        this.callbacks.moved(cloneDocument(change.m.e), change.m.o, change.m.n);
      }
    } else if (change.d) {
      this.applyDelta(record, change.d);
    }
  }

  private installResult(documents: WireDocument[]): void {
    this.cache.clear(this.scope);
    this.currentResult = copyDocuments(documents);
    this.currentResultKnown = true;
    this.resultInitialized = true;
    this.currentResult.forEach((document) => {
      this.cache.set(this.scope, document);
    });
  }

  private addDocument(document: WireDocument, index: number): boolean {
    this.cache.set(this.scope, document);
    var id = documentId(document);
    if (!this.currentResultKnown || !isIndex(index) || index > this.currentResult.length) {
      this.invalidateResult();
      return !this.deltaSupported;
    }
    if (id !== undefined && this.currentResult.some((item) => documentId(item) === id)) {
      this.invalidateResult();
      return !this.deltaSupported;
    }
    this.currentResult.splice(index, 0, cloneDocument(document));
    return true;
  }

  private removeDocument(document: WireDocument, index: number): boolean {
    var id = documentId(document);
    if (id !== undefined) this.cache.delete(this.scope, id);
    if (
      !this.currentResultKnown ||
      !isIndex(index) ||
      index >= this.currentResult.length ||
      (id !== undefined && documentId(this.currentResult[index]) !== id)
    ) {
      this.invalidateResult();
      return !this.deltaSupported;
    }
    this.currentResult.splice(index, 1);
    return true;
  }

  private applyFullChange(document: WireDocument, index: number): boolean {
    var id = documentId(document);
    if (!this.currentResultKnown) {
      if (id === undefined) this.cache.clear(this.scope);
      else this.cache.set(this.scope, document);
      if (this.deltaSupported) this.requestSnapshot();
      return !this.deltaSupported;
    }
    if (!isIndex(index) || index >= this.currentResult.length) {
      this.invalidateResult();
      return !this.deltaSupported;
    }
    var existingId = documentId(this.currentResult[index]);
    if (existingId !== undefined && id !== undefined && existingId !== id) {
      this.cache.delete(this.scope, existingId);
      this.cache.set(this.scope, document);
      this.invalidateResult();
      return !this.deltaSupported;
    }
    if (id === undefined) this.cache.clear(this.scope);
    else this.cache.set(this.scope, document);
    this.currentResult[index] = cloneDocument(document);
    return true;
  }

  private invalidateResult(): void {
    this.currentResultKnown = false;
    if (this.deltaSupported) this.requestSnapshot();
  }

  private moveDocument(document: WireDocument, oldIndex: number, newIndex: number): boolean {
    if (
      !this.currentResultKnown ||
      !isIndex(oldIndex) ||
      !isIndex(newIndex) ||
      oldIndex >= this.currentResult.length ||
      newIndex > this.currentResult.length ||
      (documentId(document) !== undefined && documentId(this.currentResult[oldIndex]) !== documentId(document))
    ) {
      this.invalidateResult();
      return !this.deltaSupported;
    }
    var moved = this.currentResult.splice(oldIndex, 1)[0];
    this.currentResult.splice(newIndex, 0, moved);
    return true;
  }

  private applyDelta(record: EventRecord, delta: NonNullable<ObserverChange['d']>): void {
    if (!this.deltaSupported) return;
    var id = delta.documentId;
    if (typeof id !== 'string' && !(typeof id === 'number' && Number.isFinite(id))) {
      this.requestSnapshot();
      return;
    }
    var baseline = this.cache.get(this.scope, id);
    if (validVersion(delta.version) && this.currentResultKnown) {
      var current = this.currentResult.find((document) => documentId(document) === id);
      if (current && validVersion(current.version) && current.version >= delta.version) return;
    }
    if (baseline && validVersion(baseline.version) && validVersion(delta.version) && baseline.version >= delta.version) return;
    if (!validVersion(delta.version)) {
      this.buffered.push(record);
      this.requestSnapshot();
      return;
    }
    if (!validVersion(delta.baseVersion) || delta.version <= delta.baseVersion || !isIndex(delta.i) || !Array.isArray(delta.patch)) {
      this.buffered.push(record);
      this.beginDocumentRecovery(id, delta.version);
      return;
    }
    if (!baseline || !validVersion(baseline.version) || baseline.version !== delta.baseVersion) {
      this.buffered.push(record);
      this.beginDocumentRecovery(id, delta.version);
      return;
    }
    var patched: WireDocument;
    try {
      var result = applyPatch(cloneDocument(baseline), delta.patch, true, true, true).newDocument;
      var normalized = normalizeDocument(result);
      if (!normalized) throw new Error('Patch did not produce a JSON document');
      patched = normalized;
    } catch (error) {
      this.buffered.push(record);
      this.beginDocumentRecovery(id, delta.version);
      return;
    }
    if (documentId(patched) !== id || !validVersion(patched.version) || patched.version !== delta.version) {
      this.buffered.push(record);
      this.beginDocumentRecovery(id, delta.version);
      return;
    }
    if (this.currentResultKnown) {
      var position = this.currentResult.findIndex((document) => documentId(document) === id);
      if (position < 0 || position !== delta.i) {
        this.buffered.push(record);
        this.requestSnapshot();
        return;
      }
    }
    this.cache.set(this.scope, patched);
    if (this.currentResultKnown) this.currentResult[delta.i] = cloneDocument(patched);
    if (this.callbacks.changed) {
      this.callbacks.changed(cloneDocument(baseline), cloneDocument(patched), delta.i);
    }
  }

  private beginDocumentRecovery(id: DocumentId, targetVersion?: number): void {
    if (!this.remoteHandle || !this.deltaSupported) return;
    var existing = this.pendingDocuments.get(id);
    if (existing) {
      updatePendingTarget(this.pendingDocuments, id, targetVersion);
      return;
    }
    var pending: PendingDocumentRecovery = { targetVersion: targetVersion };
    this.pendingDocuments.set(id, pending);
    var generation = this.generation;
    this.recoveryRequests.request(
      this.collection._client,
      { 'observe.document': { h: this.remoteHandle, documentId: id } },
      (err, rawResponse) => {
        if (generation !== this.generation || this.stopped || this.pendingDocuments.get(id) !== pending) return;
        if (err || !isObserverDocumentResponse(rawResponse) || !isIndex(rawResponse.sequence)) {
          this.failRecovery(generation);
          return;
        }
        this.finishDocumentRecovery(id, pending, rawResponse);
      },
      () => generation === this.generation && !this.stopped && this.pendingDocuments.get(id) === pending
    );
  }

  private finishDocumentRecovery(id: DocumentId, pending: PendingDocumentRecovery, response: ObserverDocumentResponse): void {
    var generation = this.generation;
    if (response.visible !== true || !response.document || !isIndex(response.index)) {
      this.requestSnapshot();
      return;
    }
    var document = response.document;
    var version = document.version;
    if (documentId(document) !== id || !validVersion(version) || (pending.targetVersion !== undefined && version < pending.targetVersion)) {
      this.requestSnapshot();
      return;
    }
    var old = this.cache.get(this.scope, id);
    if (old && validVersion(old.version) && version < old.version) {
      this.requestSnapshot();
      return;
    }
    if (this.currentResultKnown) {
      var position = this.currentResult.findIndex((item) => documentId(item) === id);
      if (position < 0 || position !== response.index) {
        this.requestSnapshot();
        return;
      }
    }
    this.cache.set(this.scope, document);
    if (this.currentResultKnown) this.currentResult[response.index] = cloneDocument(document);
    if (this.callbacks.changed) {
      this.callbacks.changed(old ? cloneDocument(old) : null, cloneDocument(document), response.index);
    }
    if (generation !== this.generation || this.stopped) return;
    this.pendingDocuments.delete(id);
    if (this.pendingDocuments.size === 0) {
      this.recoveryRetryCount = 0;
      this.replayBuffered(id, version, response.sequence);
    }
  }

  private replayBuffered(recoveredId: DocumentId, recoveredVersion: number, recoverySequence: number): void {
    var records = this.buffered;
    this.buffered = [];
    for (var index = 0; index < records.length; index++) {
      var record = records[index];
      if (coveredByRecovery(record, recoveredId, recoveredVersion, recoverySequence)) continue;
      if (this.isRecovering()) {
        this.buffered.push.apply(this.buffered, records.slice(index));
        return;
      }
      this.acceptRecord(record);
    }
  }

  private requestSnapshot(): void {
    if (this.snapshotPending || !this.remoteHandle || !this.deltaSupported) return;
    this.recoveryRequests.cancelAll(this.collection._client);
    this.pendingDocuments.clear();
    var pending = {};
    this.snapshotPending = pending;
    var generation = this.generation;
    this.recoveryRequests.request(
      this.collection._client,
      { 'observe.snapshot': { h: this.remoteHandle } },
      (err, rawResponse) => {
        if (generation !== this.generation || this.stopped || this.snapshotPending !== pending) return;
        if (err || !isObserverSnapshotResponse(rawResponse) || !isIndex(rawResponse.sequence)) {
          this.failRecovery(generation);
          return;
        }
        this.finishSnapshot(rawResponse);
      },
      () => generation === this.generation && !this.stopped && this.snapshotPending === pending
    );
  }

  private finishSnapshot(response: ObserverSnapshotResponse): void {
    var generation = this.generation;
    var documents = reconcileSnapshot(this.resultInitialized ? this.currentResult : null, response.documents, this.callbacks);
    if (generation !== this.generation || this.stopped) return;
    this.currentResult = documents;
    this.currentResultKnown = true;
    this.resultInitialized = true;
    this.recoveryRetryCount = 0;
    this.cache.clear(this.scope);
    this.currentResult.forEach((document) => {
      this.cache.set(this.scope, document);
    });
    var later: EventRecord[] = [];
    this.buffered.forEach((record) => {
      if (record.sequence === undefined || record.sequence > response.sequence) later.push(record);
    });
    this.buffered = [];
    this.snapshotPending = null;
    later.forEach((record) => {
      this.acceptRecord(record);
    });
  }

  private failRecovery(generation: number): void {
    if (generation !== this.generation || this.stopped) return;
    this.recoveryRequests.cancelAll(this.collection._client);
    this.pendingDocuments.clear();
    this.snapshotPending = null;
    this.buffered = [];
    this.currentResultKnown = false;
    if (this.recoveryRetryCount < 1 && this.deltaSupported) {
      this.recoveryRetryCount++;
      this.requestSnapshot();
      return;
    }
    this.snapshotOnNextEvent = this.deltaSupported;
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.generation++;
    if (!this.remoteHandle && this.params) this.handles.push(this.params.id);
    this.sendStopRequest();
    if (this.currentHandle) {
      this.currentHandle.stop();
      this.currentHandle = null;
    }
    this.resetGeneration();
  }
}

export = Observer;
