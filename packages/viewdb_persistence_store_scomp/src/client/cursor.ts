import type { QueryObject, VDocument, ObserveOptions, Callback, ObserveEvent, ScompCollectionLike } from '../types';

const BaseCursor = require('viewdb').Cursor;

/**
 * Scomp cursor extending core Cursor.
 * Overrides observe (feed-based), count (RPC), and _refresh (debounced).
 * Adds project() which core doesn't have.
 */
class ScompCursor extends BaseCursor {
  private _handle: { stop: () => void } | null;
  private _refreshTimer: ReturnType<typeof setTimeout> | null;

  constructor(
    collection: ScompCollectionLike,
    query: { query: Record<string, unknown> },
    options: Record<string, unknown>,
    getDocuments: (queryObject: QueryObject, callback: Callback<VDocument[]>) => void
  ) {
    super(collection, query, options, getDocuments);
    this._handle = null;
    this._refreshTimer = null;
  }

  private get _scompCollection(): ScompCollectionLike {
    return this._collection as unknown as ScompCollectionLike;
  }

  project(params: Record<string, 0 | 1>): this {
    this._query.project = params;
    return this;
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
    this._scompCollection.count(this._query.query, opts, callback!);
  }

  /**
   * Observe live changes via the scomp feed.
   * Returns a handle with stop() to end the subscription.
   */
  observe(options: ObserveOptions): { stop: () => void } {
    if (this._isObserving) {
      throw new Error('Already observing this cursor. Collection: ' + this._scompCollection._name);
    }
    this._isObserving = true;

    const refreshListener = () => {
      if (this._handle) {
        this._handle.stop();
      }
      this._handle = startFeedObserver(this._scompCollection, this._query, options);
    };
    this._scompCollection.on('change', refreshListener);

    this._handle = startFeedObserver(this._scompCollection, this._query, options);
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
        this._scompCollection.removeListener('change', refreshListener);
        this._isObserving = false;
      }
    };
  }

  _refresh(): void {
    if (this._isObserving) {
      if (this._refreshTimer) clearTimeout(this._refreshTimer);
      this._refreshTimer = setTimeout(() => {
        this._refreshTimer = null;
        this._scompCollection.emit('change');
      }, 50);
    }
  }
}

/** Start a scomp feed observer and return a handle to stop it */
function startFeedObserver(collection: ScompCollectionLike, query: QueryObject, callbacks: ObserveOptions): { stop: () => void } {
  const events = {
    i: callbacks.init != null,
    a: callbacks.added != null,
    r: callbacks.removed != null,
    c: callbacks.changed != null,
    m: callbacks.moved != null
  };

  const feed = collection._proxy.observe({
    collection: collection._name,
    query: query.query as Record<string, unknown>,
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

function dispatchEvent(event: ObserveEvent, callbacks: ObserveOptions): void {
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

export = ScompCursor;
