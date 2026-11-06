import _ = require('lodash');
import { applyPatch } from 'fast-json-patch';
import { Logger } from 'slf';
import { cloneDocument, documentId, normalizeDocument, validVersion } from '../deltaCache';
import type { DocumentId, ObserverChange, ObserverDocumentResponse, ObserverResponse, ObserverSnapshotResponse, WireDocument } from '../deltaProtocol';
import { isObserverDocumentResponse, isObserverResponse, isObserverSnapshotResponse } from './observe_protocol';
import { buildParams, copyDocuments, coveredByRecovery, isIndex, isStructural, RecoveryRequests, updatePendingTarget } from './observe_helpers';
import { bufferRecord as bufferRecoveryRecord, bufferRecords as bufferRecoveryRecords } from './observer_buffer';
import type { RecoveryBufferState } from './observer_buffer';
import { ObserverRowState } from './observer_row_state';
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
class Observer extends ObserverRowState implements RecoveryBufferState {
  handles: string[] = [];
  private readonly collection: RemoteCollection;
  private readonly callbacks: ObserverCallbacks;
  private readonly query: ObserverQuery;
  private readonly events: { i: boolean; a: boolean; r: boolean; c: boolean; m: boolean };
  private stopped = false;
  private generation = 0;
  private params: ObserverParams | null = null;
  private remoteHandle: string | null = null;
  private currentHandle: { stop: () => void } | null = null;
  private stopSent = false;
  private waitingForHandle: EventRecord[] = [];
  buffered: EventRecord[] = [];
  bufferedBytes = 0;
  private pendingDocuments = new Map<DocumentId, PendingDocumentRecovery>();
  private snapshotPending: object | null = null;
  private snapshotOnNextEvent = false;
  snapshotDirty = false;
  dirtyThroughSequence: number | undefined;
  dirtyUnknownSequence = false;
  private readonly recoveryRequests = new RecoveryRequests();
  private recoveryRetryCount = 0;

  constructor(collection: RemoteCollection, options: ObserverCallbacks, query: ObserverQuery) {
    super((collection._client.options || {}).deltaCache);
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
    this.startObserver();
  }

  private resetGeneration(): void {
    this.cache.clear();
    this.recoveryRequests.cancelAll(this.collection._client);
    this.remoteHandle = null;
    this.deltaSupported = false;
    this.scope = '';
    this.currentRows = [];
    this.currentResultKnown = false;
    this.resultInitialized = false;
    this.waitingForHandle = [];
    this.buffered = [];
    this.bufferedBytes = 0;
    this.pendingDocuments.clear();
    this.snapshotPending = null;
    this.snapshotOnNextEvent = false;
    this.snapshotDirty = false;
    this.dirtyThroughSequence = undefined;
    this.dirtyUnknownSequence = false;
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
      // Removed callbacks carry their full payload on structural events. Keep
      // those observers on the full protocol so retention never hides removals.
      deltaVersion: this.callbacks.removed ? undefined : 1
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
        if (generation === this.generation && !this.stopped) this.acceptRecord(record);
      });
    }
    records.forEach((record) => {
      if (generation === this.generation && !this.stopped) this.acceptRecord(record);
    });
  }
  private bufferRecord(record: EventRecord): void {
    bufferRecoveryRecord(this, record, () => this.requestSnapshot());
  }

  private bufferRecords(records: EventRecord[]): void {
    bufferRecoveryRecords(this, records, () => this.requestSnapshot());
  }

  private isRecovering(): boolean {
    return this.snapshotPending !== null || this.pendingDocuments.size > 0;
  }

  private acceptAuthoritativeSnapshot(record: EventRecord): void {
    this.recoveryRequests.cancelAll(this.collection._client);
    this.pendingDocuments.clear();
    this.snapshotPending = null;
    this.snapshotOnNextEvent = false;
    this.snapshotDirty = false;
    this.dirtyThroughSequence = undefined;
    this.dirtyUnknownSequence = false;
    var barrier = record.sequence;
    var later = this.buffered.filter((entry) => barrier === undefined || entry.sequence === undefined || entry.sequence > barrier);
    this.buffered = [];
    this.bufferedBytes = 0;
    var generation = this.generation;
    this.processRecord(record);
    if (generation !== this.generation || this.stopped) return;
    later.forEach((entry) => {
      if (generation === this.generation && !this.stopped) this.acceptRecord(entry);
    });
  }

  private acceptRecord(record: EventRecord): void {
    if (this.stopped) return;
    if (record.change.s && this.resultInitialized) {
      this.acceptAuthoritativeSnapshot(record);
      return;
    }
    if (this.snapshotOnNextEvent) {
      this.snapshotOnNextEvent = false;
      this.bufferRecord(record);
      this.requestSnapshot();
      return;
    }
    if (this.isRecovering()) {
      this.bufferRecord(record);
      if (isStructural(record.change) && this.deltaSupported) this.requestSnapshot();
      else if (record.change.d) updatePendingTarget(this.pendingDocuments, record.change.d.documentId, record.change.d.version);
      return;
    }
    this.processRecord(record);
  }

  private processRecord(record: EventRecord): void {
    var change = record.change;
    var generation = this.generation;
    if (change.i) {
      this.installResult(change.i.r, change.i.rowKeys);
      if (generation === this.generation && !this.stopped && this.callbacks.init) this.callbacks.init(copyDocuments(change.i.r));
    } else if (change.s) {
      if (this.resultInitialized) {
        this.installSnapshotResult(change.s.r, change.s.rowKeys, () => this.generation === generation && !this.stopped, this.callbacks);
      } else this.installResult(change.s.r, change.s.rowKeys);
    } else if (change.a) {
      if (this.addDocument(change.a.e, change.a.i, change.a.rowKey) && this.callbacks.added) {
        this.callbacks.added(cloneDocument(change.a.e), change.a.i);
      }
    } else if (change.r) {
      if (this.removeDocument(change.r.e, change.r.i, change.r.rowKey) && this.callbacks.removed) {
        this.callbacks.removed(cloneDocument(change.r.e), change.r.i);
      }
    } else if (change.c) {
      if (this.applyFullChange(change.c.n, change.c.i, change.c.rowKey) && this.callbacks.changed) {
        var oldDocument = change.c.o;
        this.callbacks.changed(
          oldDocument === null || oldDocument === undefined ? oldDocument : cloneDocument(oldDocument),
          cloneDocument(change.c.n),
          change.c.i
        );
      }
    } else if (change.m) {
      if (this.moveDocument(change.m.e, change.m.o, change.m.n, change.m.rowKey) && this.callbacks.moved) {
        this.callbacks.moved(cloneDocument(change.m.e), change.m.o, change.m.n);
      }
    } else if (change.d) {
      this.applyDelta(record, change.d);
    }
  }

  private applyDelta(record: EventRecord, delta: NonNullable<ObserverChange['d']>): void {
    if (!this.deltaSupported) return;
    var id = delta.documentId;
    if (typeof id !== 'string' && !(typeof id === 'number' && Number.isFinite(id))) {
      this.requestSnapshot();
      return;
    }
    var rowKey = record.change.rowKey;
    var position = this.currentResultKnown ? this.currentRows.findIndex((row) => (rowKey ? row.rowKey === rowKey : row.id === id)) : -1;
    var deliveredVersion = position >= 0 ? this.currentRows[position].version : undefined;
    if (validVersion(delta.version) && validVersion(deliveredVersion) && deliveredVersion >= delta.version) return;
    var projectedRow = position >= 0 && this.currentRows[position].id === undefined;
    var baseline = projectedRow ? this.cache.getForRow(this.scope, rowKey!) : this.cache.get(this.scope, id);
    if (baseline && validVersion(baseline.version) && validVersion(delta.version) && baseline.version >= delta.version) return;
    if (!validVersion(delta.version)) {
      this.bufferRecord(record);
      this.requestSnapshot();
      return;
    }
    if (!validVersion(delta.baseVersion) || delta.version <= delta.baseVersion || !isIndex(delta.i) || !Array.isArray(delta.patch)) {
      this.bufferRecord(record);
      this.beginDocumentRecovery(id, delta.version);
      return;
    }
    if (!baseline || !validVersion(baseline.version) || baseline.version !== delta.baseVersion) {
      this.bufferRecord(record);
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
      this.bufferRecord(record);
      this.beginDocumentRecovery(id, delta.version);
      return;
    }
    if ((documentId(patched) !== id && !projectedRow) || !validVersion(patched.version) || patched.version !== delta.version) {
      this.bufferRecord(record);
      this.beginDocumentRecovery(id, delta.version);
      return;
    }
    if (this.currentResultKnown && (position < 0 || position !== delta.i)) {
      this.bufferRecord(record);
      this.requestSnapshot();
      return;
    }
    if (projectedRow && rowKey) this.cache.setForRow(this.scope, rowKey, patched);
    else this.cache.set(this.scope, patched);
    if (position >= 0) {
      if (rowKey) this.currentRows[position].rowKey = rowKey;
      this.currentRows[position].version = delta.version;
    }
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
    var position = -1;
    if (this.currentResultKnown) {
      position = this.currentRows.findIndex((row) => (response.rowKey ? row.rowKey === response.rowKey : row.id === id));
      if (position < 0 || position !== response.index) {
        this.requestSnapshot();
        return;
      }
    }
    if (
      (documentId(document) !== id && (!response.rowKey || position < 0)) ||
      !validVersion(version) ||
      (pending.targetVersion !== undefined && version < pending.targetVersion)
    ) {
      this.requestSnapshot();
      return;
    }
    var projectedRow = response.rowKey !== undefined && position >= 0 && this.currentRows[position].id === undefined;
    var old = projectedRow ? this.cache.getForRow(this.scope, response.rowKey!) : this.cache.get(this.scope, id);
    if (old && validVersion(old.version) && version < old.version) {
      this.requestSnapshot();
      return;
    }
    if (response.rowKey && position >= 0) this.currentRows[position].rowKey = response.rowKey;
    if (position >= 0) this.currentRows[position].version = version;
    if (projectedRow && response.rowKey) this.cache.setForRow(this.scope, response.rowKey, document);
    else this.cache.set(this.scope, document);
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
    var generation = this.generation;
    var records = this.buffered;
    this.buffered = [];
    this.bufferedBytes = 0;
    for (var index = 0; index < records.length; index++) {
      if (generation !== this.generation || this.stopped) return;
      var record = records[index];
      if (coveredByRecovery(record, recoveredId, recoveredVersion, recoverySequence)) continue;
      if (this.isRecovering()) {
        this.bufferRecords(records.slice(index));
        return;
      }
      this.acceptRecord(record);
    }
  }

  protected requestSnapshot(): void {
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
    if (this.snapshotDirty && (this.dirtyUnknownSequence || (this.dirtyThroughSequence !== undefined && response.sequence < this.dirtyThroughSequence))) {
      this.dirtyUnknownSequence = false;
      this.snapshotPending = null;
      this.requestSnapshot();
      return;
    }
    this.snapshotDirty = false;
    this.dirtyThroughSequence = undefined;
    this.dirtyUnknownSequence = false;
    if (!this.installSnapshotResult(response.documents, response.rowKeys, () => generation === this.generation && !this.stopped, this.callbacks)) return;
    this.recoveryRetryCount = 0;
    var later: EventRecord[] = [];
    this.buffered.forEach((record) => {
      if (record.sequence === undefined || record.sequence > response.sequence) later.push(record);
    });
    this.buffered = [];
    this.bufferedBytes = 0;
    this.snapshotPending = null;
    later.forEach((record) => {
      if (generation === this.generation && !this.stopped) this.acceptRecord(record);
    });
  }

  private failRecovery(generation: number): void {
    if (generation !== this.generation || this.stopped) return;
    this.recoveryRequests.cancelAll(this.collection._client);
    this.pendingDocuments.clear();
    this.snapshotPending = null;
    this.buffered = [];
    this.bufferedBytes = 0;
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
