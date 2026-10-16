import SHA256 = require('crypto-js/sha256');
import { DeltaCacheLimits, DocumentId, WireDocument } from '../deltaProtocol';
import { documentId, validVersion } from '../deltaCache';

interface SnapshotEntry {
  key: string;
  namespace: number;
  collection: string;
  document: WireDocument;
  bytes: number;
}
interface BaselinePointer {
  key: string;
  version?: number;
}
interface ConsumerBaselines {
  rows: Map<DocumentId, BaselinePointer>;
}

const DEFAULT_SERVER_BYTES = 256 * 1024 * 1024;
const DEFAULT_SERVER_ENTRIES = 65536;
const MAX_BASELINES_PER_CONSUMER = 2048;
const viewdbNamespaces = new WeakMap<object, number>();
let nextNamespace = 1;
let singleton: SharedSnapshotCache | undefined;

export function viewdbNamespace(viewdb: object): number {
  let namespace = viewdbNamespaces.get(viewdb);
  if (namespace === undefined) {
    namespace = nextNamespace++;
    viewdbNamespaces.set(viewdb, namespace);
  }
  return namespace;
}

function freezeValue(value: unknown): void {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach((child) => {
      freezeValue(child);
    });
    Object.freeze(value);
  }
}

function immutableDocument(document: WireDocument): WireDocument {
  freezeValue(document);
  return document;
}

export class SharedSnapshotCache {
  private maxBytes = 256 * 1024 * 1024;
  private maxEntries = 65536;
  private bytes = 0;
  private entries = new Map<string, SnapshotEntry>();
  private baselines = new WeakMap<object, ConsumerBaselines>();

  configure(limits: DeltaCacheLimits = {}): void {
    if (limits.maxBytes !== undefined && (!Number.isSafeInteger(limits.maxBytes) || limits.maxBytes < 0)) {
      throw new RangeError('maxBytes must be a nonnegative safe integer');
    }
    if (limits.maxEntries !== undefined && (!Number.isSafeInteger(limits.maxEntries) || limits.maxEntries < 0)) {
      throw new RangeError('maxEntries must be a nonnegative safe integer');
    }
    this.maxBytes = limits.maxBytes === undefined ? DEFAULT_SERVER_BYTES : limits.maxBytes;
    this.maxEntries = limits.maxEntries === undefined ? DEFAULT_SERVER_ENTRIES : limits.maxEntries;
    this.evict();
  }

  stats(): { size: number; bytes: number } {
    return { size: this.entries.size, bytes: this.bytes };
  }

  seed(consumer: object, namespace: number, collection: string, document: WireDocument, identity?: DocumentId): void {
    const id = identity === undefined ? documentId(document) : identity;
    if (id === undefined) return;
    const metadata = this.metadata(consumer);
    const version = validVersion(document.version) ? document.version : undefined;
    const prior = metadata.rows.get(id);
    if (version === undefined) {
      metadata.rows.delete(id);
      return;
    }
    if (prior && prior.version !== undefined && prior.version > version) return;
    const json = JSON.stringify(document);
    const bytes = Buffer.byteLength(json, 'utf8');
    const digest = SHA256(`${namespace}\0${collection}\0${json}`).toString();
    let key = digest;
    let suffix = 0;
    while (true) {
      const existing = this.entries.get(key);
      if (!existing || (existing.namespace === namespace && existing.collection === collection && JSON.stringify(existing.document) === json)) break;
      key = digest + ':' + ++suffix;
    }
    let entry = this.entries.get(key);
    if (entry) {
      this.entries.delete(key);
      this.entries.set(key, entry);
    } else if (bytes <= this.maxBytes && this.maxEntries > 0) {
      entry = { key, namespace, collection, document: immutableDocument(JSON.parse(json) as WireDocument), bytes };
      this.entries.set(key, entry);
      this.bytes += bytes;
      this.evict();
      if (!this.entries.has(key)) entry = undefined;
    }
    metadata.rows.delete(id);
    if (entry) metadata.rows.set(id, { key, version });
    while (metadata.rows.size > MAX_BASELINES_PER_CONSUMER) {
      const oldest = metadata.rows.keys().next().value as DocumentId | undefined;
      if (oldest === undefined) break;
      metadata.rows.delete(oldest);
    }
  }

  get(consumer: object, namespace: number, collection: string, id: DocumentId): { document: WireDocument; version?: number } | undefined {
    const metadata = this.baselines.get(consumer);
    const pointer = metadata && metadata.rows.get(id);
    if (!pointer) return undefined;
    const entry = this.entries.get(pointer.key);
    if (!entry || entry.namespace !== namespace || entry.collection !== collection) return undefined;
    this.entries.delete(entry.key);
    this.entries.set(entry.key, entry);
    return { document: entry.document, version: pointer.version };
  }

  delete(consumer: object, id: DocumentId): void {
    this.baselines.get(consumer)?.rows.delete(id);
  }

  clear(consumer: object): void {
    this.baselines.delete(consumer);
  }

  private metadata(consumer: object): ConsumerBaselines {
    let value = this.baselines.get(consumer);
    if (!value) {
      value = { rows: new Map<DocumentId, BaselinePointer>() };
      this.baselines.set(consumer, value);
    }
    return value;
  }

  private evict(): void {
    while (this.entries.size > this.maxEntries || this.bytes > this.maxBytes) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      const entry = this.entries.get(oldest)!;
      this.entries.delete(oldest);
      this.bytes -= entry.bytes;
    }
  }
}

export function getSharedSnapshotCache(): SharedSnapshotCache {
  if (!singleton) singleton = new SharedSnapshotCache();
  return singleton;
}
