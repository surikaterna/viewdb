import { BaselineCache, documentId, validVersion } from '../deltaCache';
import type { DeltaCacheLimits, ObserverRowKeys, WireDocument } from '../deltaProtocol';
import type { ObserverCallbacks } from './observe_helpers';
import { reconcileSnapshotRows } from './observe_helpers';
import type { ObserverRowIdentity } from './observe_helpers';

export abstract class ObserverRowState {
  protected readonly cache: BaselineCache;
  protected scope = '';
  protected currentRows: ObserverRowIdentity[] = [];
  protected currentResultKnown = false;
  protected resultInitialized = false;
  protected deltaSupported = false;

  constructor(limits: DeltaCacheLimits = {}) {
    this.cache = new BaselineCache(limits);
  }

  protected abstract requestSnapshot(): void;

  protected installResult(documents: WireDocument[], rowKeys?: ObserverRowKeys): void {
    this.cache.clear(this.scope);
    this.currentRows = documents.map((document, index) => ({
      id: documentId(document),
      version: validVersion(document.version) ? document.version : undefined,
      rowKey: rowKeys && rowKeys.length === documents.length ? rowKeys[index] : undefined
    }));
    this.currentResultKnown = true;
    this.resultInitialized = true;
    documents.forEach((document, index) => {
      var rowKey = rowKeys && rowKeys.length === documents.length ? rowKeys[index] : undefined;
      if (documentId(document) === undefined && rowKey) this.cache.setForRow(this.scope, rowKey, document);
      else this.cache.set(this.scope, document);
    });
  }

  protected installSnapshotResult(
    documents: WireDocument[],
    rowKeys: string[] | undefined,
    shouldContinue: () => boolean,
    callbacks: ObserverCallbacks
  ): boolean {
    var rows = reconcileSnapshotRows(
      this.resultInitialized ? this.currentRows : null,
      documents,
      rowKeys,
      (row) => (row.id !== undefined ? this.cache.get(this.scope, row.id) : row.rowKey ? this.cache.getForRow(this.scope, row.rowKey) : undefined),
      callbacks,
      shouldContinue
    );
    if (!shouldContinue()) return false;
    this.currentRows = rows;
    this.currentResultKnown = true;
    this.resultInitialized = true;
    this.cache.clear(this.scope);
    documents.forEach((document, index) => {
      var rowKey = rows[index].rowKey;
      if (documentId(document) === undefined && rowKey) this.cache.setForRow(this.scope, rowKey, document);
      else this.cache.set(this.scope, document);
    });
    return true;
  }

  protected addDocument(document: WireDocument, index: number, rowKey?: string): boolean {
    if (documentId(document) === undefined && rowKey) this.cache.setForRow(this.scope, rowKey, document);
    else this.cache.set(this.scope, document);
    var id = documentId(document);
    if (!this.currentResultKnown || !validVersion(index) || index > this.currentRows.length) {
      this.invalidateResult();
      return !this.deltaSupported;
    }
    if (
      (id !== undefined && this.currentRows.some((item) => item.id === id)) ||
      (rowKey !== undefined && this.currentRows.some((item) => item.rowKey === rowKey))
    ) {
      this.invalidateResult();
      return !this.deltaSupported;
    }
    this.currentRows.splice(index, 0, { id: id, rowKey: rowKey, version: validVersion(document.version) ? document.version : undefined });
    return true;
  }

  protected removeDocument(document: WireDocument, index: number, rowKey?: string): boolean {
    var id = documentId(document);
    if (rowKey) this.cache.deleteForRow(this.scope, rowKey);
    if (id !== undefined) this.cache.delete(this.scope, id);
    if (
      !this.currentResultKnown ||
      !validVersion(index) ||
      index >= this.currentRows.length ||
      (rowKey ? this.currentRows[index].rowKey !== rowKey : id !== undefined && this.currentRows[index].id !== id)
    ) {
      this.invalidateResult();
      return !this.deltaSupported;
    }
    this.currentRows.splice(index, 1);
    return true;
  }

  protected applyFullChange(document: WireDocument, index: number, rowKey?: string): boolean {
    var id = documentId(document);
    if (!this.currentResultKnown) {
      if (id === undefined) {
        if (rowKey) this.cache.setForRow(this.scope, rowKey, document);
      } else this.cache.set(this.scope, document);
      if (this.deltaSupported) this.requestSnapshot();
      return !this.deltaSupported;
    }
    if (!validVersion(index) || index >= this.currentRows.length) {
      this.invalidateResult();
      return !this.deltaSupported;
    }
    var existingId = this.currentRows[index].id;
    if (existingId !== undefined && id !== undefined && existingId !== id) {
      this.cache.delete(this.scope, existingId);
      this.cache.set(this.scope, document);
      this.invalidateResult();
      return !this.deltaSupported;
    }
    if (id === undefined) {
      if (rowKey) this.cache.setForRow(this.scope, rowKey, document);
    } else this.cache.set(this.scope, document);
    this.currentRows[index] = {
      id: id,
      rowKey: rowKey || this.currentRows[index].rowKey,
      version: validVersion(document.version) ? document.version : undefined
    };
    return true;
  }

  protected invalidateResult(): void {
    this.currentResultKnown = false;
    if (this.deltaSupported) this.requestSnapshot();
  }

  protected moveDocument(document: WireDocument, oldIndex: number, newIndex: number, rowKey?: string): boolean {
    if (
      !this.currentResultKnown ||
      !validVersion(oldIndex) ||
      !validVersion(newIndex) ||
      oldIndex >= this.currentRows.length ||
      newIndex > this.currentRows.length ||
      (rowKey ? this.currentRows[oldIndex].rowKey !== rowKey : documentId(document) !== undefined && this.currentRows[oldIndex].id !== documentId(document))
    ) {
      this.invalidateResult();
      return !this.deltaSupported;
    }
    var moved = this.currentRows.splice(oldIndex, 1)[0];
    this.currentRows.splice(newIndex, 0, moved);
    return true;
  }
}
