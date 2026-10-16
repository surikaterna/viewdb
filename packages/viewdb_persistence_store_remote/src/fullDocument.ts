import type { WireDocument } from './deltaProtocol';

/** Copy Socket.IO values without sharing binary storage; retain JSON transport semantics. */
export function cloneFullValue<T>(value: T): T {
  return copyValue(value, new Set()) as T;
}

function copyValue(value: unknown, ancestors: Set<object>): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') throw new TypeError('BigInt cannot be transported as JSON');
  if (typeof value !== 'object') return undefined;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof ArrayBuffer) return value.slice(0);
  if (ArrayBuffer.isView(value)) {
    const bytes = new Uint8Array(value.byteLength);
    bytes.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
    if (value instanceof DataView) return new DataView(bytes.buffer);
    const Constructor = value.constructor as new (buffer: ArrayBuffer) => ArrayBufferView;
    return new Constructor(bytes.buffer);
  }
  if (typeof Blob !== 'undefined' && value instanceof Blob) return value.slice(0, value.size, value.type);
  if (ancestors.has(value)) throw new TypeError('Circular full document');
  ancestors.add(value);
  try {
    if ('toJSON' in value && typeof value.toJSON === 'function') return copyValue(value.toJSON(), ancestors);
    if (Array.isArray(value)) return Array.from(value, (item) => copyValue(item, ancestors) ?? null);
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      const item = copyValue((value as Record<string, unknown>)[key], ancestors);
      if (item !== undefined) Object.defineProperty(result, key, { value: item, enumerable: true, writable: true, configurable: true });
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
}

export function cloneFullDocument(value: unknown): WireDocument | undefined {
  try {
    const result = cloneFullValue(value);
    if (!result || typeof result !== 'object' || Array.isArray(result) || ArrayBuffer.isView(result) || result instanceof ArrayBuffer) return undefined;
    return result as WireDocument;
  } catch {
    return undefined;
  }
}
