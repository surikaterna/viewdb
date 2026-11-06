import { ObserverChange, ObserverDocumentResponse, ObserverResponse, ObserverSnapshotResponse, WireDocument } from '../deltaProtocol';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isWireDocument(value: unknown): value is WireDocument {
  return isRecord(value);
}

function hasDocumentList(value: unknown): value is { r: WireDocument[] } {
  return isRecord(value) && Array.isArray(value.r) && value.r.every(isWireDocument);
}

function hasIndexedDocument(value: unknown): value is { e: WireDocument; i: number } {
  return isRecord(value) && isWireDocument(value.e) && typeof value.i === 'number';
}

function isObserverChange(value: unknown): value is ObserverChange {
  if (!isRecord(value)) return false;
  if ('i' in value) return hasDocumentList(value.i);
  if ('s' in value) return hasDocumentList(value.s);
  if ('a' in value || 'r' in value) {
    var item = 'a' in value ? value.a : value.r;
    return hasIndexedDocument(item);
  }
  if ('c' in value) {
    var changed = value.c;
    return (
      isRecord(changed) &&
      isWireDocument(changed.n) &&
      typeof changed.i === 'number' &&
      (!('o' in changed) || changed.o === undefined || changed.o === null || isWireDocument(changed.o))
    );
  }
  if ('m' in value) {
    var moved = value.m;
    return isRecord(moved) && isWireDocument(moved.e) && typeof moved.o === 'number' && typeof moved.n === 'number';
  }
  if ('d' in value) {
    var delta = value.d;
    return (
      isRecord(delta) &&
      (typeof delta.documentId === 'string' || (typeof delta.documentId === 'number' && Number.isFinite(delta.documentId))) &&
      typeof delta.baseVersion === 'number' &&
      typeof delta.version === 'number' &&
      Array.isArray(delta.patch) &&
      typeof delta.i === 'number'
    );
  }
  return false;
}

export function isObserverResponse(value: unknown): value is ObserverResponse {
  if (!isRecord(value)) return false;
  if ('handle' in value && typeof value.handle !== 'string') return false;
  if ('deltaVersion' in value && typeof value.deltaVersion !== 'number') return false;
  if ('sequence' in value && typeof value.sequence !== 'number') return false;
  if ('changes' in value && (!Array.isArray(value.changes) || !value.changes.every(isObserverChange))) return false;
  return true;
}

export function isObserverDocumentResponse(value: unknown): value is ObserverDocumentResponse {
  if (!isRecord(value) || typeof value.visible !== 'boolean' || typeof value.sequence !== 'number') return false;
  if (!value.visible) return true;
  return isWireDocument(value.document) && typeof value.index === 'number';
}

export function isObserverSnapshotResponse(value: unknown): value is ObserverSnapshotResponse {
  return isRecord(value) && typeof value.sequence === 'number' && Array.isArray(value.documents) && value.documents.every(isWireDocument);
}
