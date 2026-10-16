import type { DeltaCacheLimits, DocumentId, JsonValue, WireDocument } from './deltaProtocol';
import { cloneFullValue } from './fullDocument';

export const DEFAULT_CACHE_BYTES = 8 * 1024 * 1024;
export const DEFAULT_CACHE_ENTRIES = 2048;

export function validVersion(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function documentId(document: unknown): DocumentId | undefined {
  if (!document || typeof document !== 'object' || !('_id' in document)) return undefined;
  const id = document._id;
  return typeof id === 'string' || (typeof id === 'number' && Number.isFinite(id)) ? id : undefined;
}

function isJson(value: unknown, ancestors: Set<object>): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || ancestors.has(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return false;
  ancestors.add(value);
  const keys = Object.keys(value);
  let valid = !Array.isArray(value) || keys.length === value.length;
  for (const key of keys) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      valid = false;
      break;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor) || !isJson(descriptor.value, ancestors)) {
      valid = false;
      break;
    }
  }
  ancestors.delete(value);
  return valid;
}

export function normalizeDocument(document: unknown): WireDocument | undefined {
  try {
    if (!document || typeof document !== 'object' || Array.isArray(document) || !isJson(document, new Set())) return undefined;
    return JSON.parse(JSON.stringify(document));
  } catch {
    return undefined;
  }
}

/** Isolate full-event callbacks, including Socket.IO binary fields. */
export function cloneDocument<T>(document: T): T {
  return cloneFullValue(document);
}

export function encodedBytes(value: unknown): number {
  const json = JSON.stringify(value);
  if (json === undefined) return 0;
  // UTF-8 length without requiring Node's Buffer in browser bundles.
  let bytes = 0;
  for (let index = 0; index < json.length; index++) {
    const code = json.charCodeAt(index);
    if (code < 0x80) bytes++;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < json.length && json.charCodeAt(index + 1) >= 0xdc00 && json.charCodeAt(index + 1) <= 0xdfff) {
      bytes += 4;
      index++;
    } else bytes += 3;
  }
  return bytes;
}

export function cacheLimit(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

interface BaselineEntry {
  scope: string;
  document: WireDocument;
  bytes: number;
}

/** LRU scoped entries; eviction changes optimization only, never public results. */
export class BaselineCache {
  private readonly entries = new Map<string, BaselineEntry>();
  private readonly maxBytes: number;
  private readonly maxEntries: number;
  private byteCount = 0;

  constructor(limits: DeltaCacheLimits = {}) {
    this.maxBytes = cacheLimit(limits.maxBytes, DEFAULT_CACHE_BYTES);
    this.maxEntries = cacheLimit(limits.maxEntries, DEFAULT_CACHE_ENTRIES);
  }

  get size(): number {
    return this.entries.size;
  }

  get bytes(): number {
    return this.byteCount;
  }

  private key(scope: string, id: DocumentId): string {
    return JSON.stringify([scope, 'id', id]);
  }

  private rowKey(scope: string, rowKey: string): string {
    return JSON.stringify([scope, 'row', rowKey]);
  }

  get(scope: string, id: DocumentId): WireDocument | undefined {
    return this.getEntry(this.key(scope, id));
  }

  getForRow(scope: string, rowKey: string): WireDocument | undefined {
    return this.getEntry(this.rowKey(scope, rowKey));
  }

  private getEntry(key: string): WireDocument | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.document;
  }

  set(scope: string, value: unknown): void {
    const id = documentId(value);
    if (id === undefined) return;
    this.setEntry(scope, this.key(scope, id), value);
  }

  setForRow(scope: string, rowKey: string, value: unknown): void {
    this.setEntry(scope, this.rowKey(scope, rowKey), value);
  }

  private setEntry(scope: string, key: string, value: unknown): void {
    const document = normalizeDocument(value);
    if (!document || !validVersion(document.version)) {
      this.deleteEntry(key);
      return;
    }
    const previous = this.entries.get(key);
    if (previous && validVersion(previous.document.version) && previous.document.version > document.version) return;
    this.deleteEntry(key);
    if (this.maxEntries === 0 || this.maxBytes === 0) return;
    const bytes = encodedBytes(document);
    if (bytes > this.maxBytes) return;
    this.entries.set(key, { scope, document, bytes });
    this.byteCount += bytes;
    while (this.entries.size > this.maxEntries || this.byteCount > this.maxBytes) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      const entry = this.entries.get(oldest)!;
      this.byteCount -= entry.bytes;
      this.entries.delete(oldest);
    }
  }

  delete(scope: string, id: DocumentId): void {
    this.deleteEntry(this.key(scope, id));
  }

  deleteForRow(scope: string, rowKey: string): void {
    this.deleteEntry(this.rowKey(scope, rowKey));
  }

  private deleteEntry(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.byteCount -= entry.bytes;
    this.entries.delete(key);
  }

  clear(scope?: string): void {
    if (scope === undefined) {
      this.entries.clear();
      this.byteCount = 0;
      return;
    }
    this.entries.forEach((entry, key) => {
      if (entry.scope === scope) {
        this.byteCount -= entry.bytes;
        this.entries.delete(key);
      }
    });
  }
}
