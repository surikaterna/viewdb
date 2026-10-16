import type { EventRecord } from './observe_helpers';

export const MAX_BUFFERED_EVENTS = 256;
export const MAX_BUFFERED_BYTES = 1024 * 1024;

export interface RecoveryBufferState {
  buffered: EventRecord[];
  bufferedBytes: number;
  snapshotDirty: boolean;
  dirtyThroughSequence: number | undefined;
  dirtyUnknownSequence: boolean;
}

function estimateRetainedBytes(value: unknown, seen: Set<object> = new Set<object>()): number {
  if (value === null || value === undefined) return 8;
  if (typeof value === 'string') return value.length * 2;
  if (typeof value === 'number' || typeof value === 'boolean') return 8;
  if (typeof value !== 'object' || seen.has(value)) return 0;
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.byteLength;
  if (typeof Blob !== 'undefined' && value instanceof Blob) return value.size;
  seen.add(value);
  var bytes = 0;
  Object.keys(value).forEach((key) => {
    bytes += key.length * 2 + estimateRetainedBytes((value as Record<string, unknown>)[key], seen);
  });
  seen.delete(value);
  return bytes;
}

function markDirtySequence(state: RecoveryBufferState, record: EventRecord): void {
  if (record.sequence === undefined) {
    state.dirtyUnknownSequence = true;
    return;
  }
  if (state.dirtyThroughSequence === undefined || record.sequence > state.dirtyThroughSequence) {
    state.dirtyThroughSequence = record.sequence;
  }
}

function discard(state: RecoveryBufferState, record: EventRecord | undefined, requestSnapshot: () => void): void {
  state.snapshotDirty = true;
  state.buffered.forEach((entry) => {
    markDirtySequence(state, entry);
  });
  if (record) markDirtySequence(state, record);
  state.buffered = [];
  state.bufferedBytes = 0;
  requestSnapshot();
}

export function bufferRecord(state: RecoveryBufferState, record: EventRecord, requestSnapshot: () => void): void {
  if (state.snapshotDirty) {
    markDirtySequence(state, record);
    return;
  }
  var bytes = estimateRetainedBytes(record);
  if (state.buffered.length >= MAX_BUFFERED_EVENTS || state.bufferedBytes + bytes > MAX_BUFFERED_BYTES) {
    discard(state, record, requestSnapshot);
    return;
  }
  state.buffered.push(record);
  state.bufferedBytes += bytes;
}

export function bufferRecords(state: RecoveryBufferState, records: EventRecord[], requestSnapshot: () => void): void {
  if (state.snapshotDirty) {
    records.forEach((record) => {
      markDirtySequence(state, record);
    });
    return;
  }
  var bytes = 0;
  records.forEach((record) => {
    bytes += estimateRetainedBytes(record);
  });
  if (state.buffered.length + records.length > MAX_BUFFERED_EVENTS || state.bufferedBytes + bytes > MAX_BUFFERED_BYTES) {
    records.forEach((record) => {
      markDirtySequence(state, record);
    });
    discard(state, undefined, requestSnapshot);
    return;
  }
  state.buffered.push.apply(state.buffered, records);
  state.bufferedBytes += bytes;
}
