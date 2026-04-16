import type { VDocument, ObserveEvent, CollectionRef } from '../types';

/** Query state accumulated by cursor methods */
interface QueryState {
  query: Record<string, unknown>;
  sort?: Record<string, 1 | -1>;
  limit?: number;
  skip?: number;
  project?: Record<string, 0 | 1>;
}

type GetDocumentsFn = (queryState: QueryState, callback: (err: Error | null, result?: VDocument[]) => void) => void;

interface ObserveCallbacks {
  init?: (documents: VDocument[]) => void;
  added?: (document: VDocument, index: number) => void;
  removed?: (document: VDocument, index: number) => void;
  changed?: (oldDoc: VDocument, newDoc: VDocument, index: number) => void;
  moved?: (document: VDocument, fromIndex: number, toIndex: number) => void;
}

/**
 * Standalone cursor for the scomp client.
 * Does NOT extend viewdb's Cursor — uses direct proxy calls instead of socket messages.
 */
class Cursor {
  _collection: CollectionRef;
  _query: QueryState;
  _getDocuments: GetDocumentsFn;
  _isObserving: boolean;
  private _handle: { stop: () => void } | null;
  private _refreshTimer: ReturnType<typeof setTimeout> | null;

  constructor(collection: CollectionRef, query: { query: Record<string, unknown> }, _options: Record<string, unknown>, getDocuments: GetDocumentsFn) {
    this._collection = collection;
    this._query = { query: query.query };
    this._getDocuments = getDocuments;
    this._isObserving = false;
    this._handle = null;
    this._refreshTimer = null;
  }

  sort(params: Record<string, 1 | -1>): this {
    this._query.sort = params;
    this._refresh();
    return this;
  }

  limit(n: number): this {
    this._query.limit = n;
    this._refresh();
    return this;
  }

  skip(n: number): this {
    this._query.skip = n;
    this._refresh();
    return this;
  }

  project(params: Record<string, 0 | 1>): this {
    this._query.project = params;
    return this;
  }

  toArray(callback: (err: Error | null, result?: VDocument[]) => void): void {
    this._getDocuments(this._query, callback);
  }

  count(
    applySkipLimit?: boolean | ((err: Error | null, result?: number) => void),
    options?: Record<string, unknown> | ((err: Error | null, result?: number) => void),
    callback?: (err: Error | null, result?: number) => void
  ): void {
    if (typeof applySkipLimit === 'function') {
      callback = applySkipLimit;
      applySkipLimit = true;
    }
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    const opts: Record<string, unknown> = {};
    if (applySkipLimit) {
      if (this._query.skip) opts.skip = this._query.skip;
      if (this._query.limit) opts.limit = this._query.limit;
    }
    this._collection.count(this._query.query, opts, callback!);
  }

  close(callback?: (err: Error | null) => void): void {
    if (callback) callback(null);
  }

  /**
   * Observe live changes via the scomp feed.
   * Returns a handle with stop() to end the subscription.
   */
  observe(options: ObserveCallbacks): { stop: () => void } {
    if (this._isObserving) {
      throw new Error('Already observing this cursor. Collection: ' + this._collection._name);
    }
    this._isObserving = true;

    const refreshListener = () => {
      if (this._handle) {
        this._handle.stop();
      }
      this._handle = startFeedObserver(this._collection, this._query, options);
    };
    this._collection.on('change', refreshListener);

    this._handle = startFeedObserver(this._collection, this._query, options);
    return {
      stop: () => {
        if (this._refreshTimer) {
          clearTimeout(this._refreshTimer);
          this._refreshTimer = null;
        }
        if (this._handle) {
          this._handle.stop();
          this._handle = null;
        }
        this._collection.removeListener('change', refreshListener);
        this._isObserving = false;
      }
    };
  }

  private _refresh(): void {
    if (this._isObserving) {
      if (this._refreshTimer) clearTimeout(this._refreshTimer);
      this._refreshTimer = setTimeout(() => {
        this._refreshTimer = null;
        this._collection.emit('change');
      }, 50);
    }
  }
}

/** Start a scomp feed observer and return a handle to stop it */
function startFeedObserver(collection: CollectionRef, query: QueryState, callbacks: ObserveCallbacks): { stop: () => void } {
  const events = {
    i: callbacks.init != null,
    a: callbacks.added != null,
    r: callbacks.removed != null,
    c: callbacks.changed != null,
    m: callbacks.moved != null
  };

  const feed = collection._proxy.observe({
    collection: collection._name,
    query: query.query,
    sort: query.sort,
    limit: query.limit,
    skip: query.skip,
    project: query.project,
    events
  });

  let stopped = false;
  const iterator = (feed as AsyncIterable<ObserveEvent>)[Symbol.asyncIterator]();

  void (async () => {
    try {
      while (!stopped) {
        const result = await iterator.next();
        if (result.done || stopped) break;
        dispatchEvent(result.value, callbacks);
      }
    } catch (_err) {
      // Feed closed or errored — ignore when stopped
    }
  })();

  return {
    stop() {
      stopped = true;
      if (iterator.return) {
        void iterator.return();
      }
    }
  };
}

function dispatchEvent(event: ObserveEvent, callbacks: ObserveCallbacks): void {
  switch (event.type) {
    case 'init':
      callbacks.init?.(event.documents);
      break;
    case 'added':
      callbacks.added?.(event.document, event.index);
      break;
    case 'removed':
      callbacks.removed?.(event.document, event.index);
      break;
    case 'changed':
      callbacks.changed?.(event.oldDocument, event.newDocument, event.index);
      break;
    case 'moved':
      callbacks.moved?.(event.document, event.fromIndex, event.toIndex);
      break;
  }
}

export = Cursor;
