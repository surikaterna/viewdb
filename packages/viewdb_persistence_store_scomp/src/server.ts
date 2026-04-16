import { createScompService, createScompFeed } from '@scomp/core';
import { ViewDbContract } from './contract';
import type { FindRequest, CountRequest, InsertRequest, SaveRequest, RemoveRequest, ObserveRequest, ObserveEvent, WriteResponse, VDocument } from './types';

/** Options for the scomp ViewDB server */
export interface ServerOptions {
  queryDecorator?: (collection: string, query: unknown, cb: (decoratedQuery: unknown) => void) => void;
  globalLimit?: number;
  readPreference?: unknown;
}

type ViewDbLike = {
  collection(name: string): CollectionLike;
};

type CollectionLike = {
  find(query: unknown): CursorLike;
  insert(documents: unknown, options: unknown, callback: (err: Error | null, result?: unknown) => void): void;
  save(documents: unknown, options: unknown, callback: (err: Error | null, result?: unknown) => void): void;
  remove(query: unknown, options: unknown, callback: (err: Error | null) => void): void;
};

type CursorLike = {
  sort(params: Record<string, 1 | -1>): CursorLike;
  limit(n: number): CursorLike;
  skip(n: number): CursorLike;
  project?(params: Record<string, 0 | 1>): CursorLike;
  setReadPreference?(pref: unknown): CursorLike;
  toArray(callback: (err: Error | null, result?: VDocument[]) => void): void;
  count(callback: (err: Error | null, result?: number) => void): void;
  observe(options: Record<string, unknown>): { stop: () => void };
  close(callback: (err: Error | null) => void): void;
};

function defaultQueryDecorator(_col: string, q: unknown, cb: (dq: unknown) => void): void {
  cb(q);
}

function decorateQuery(decorator: NonNullable<ServerOptions['queryDecorator']>, collection: string, query: unknown): Promise<unknown> {
  return new Promise((resolve) => {
    decorator(collection, query, resolve);
  });
}

function applyCursorOptions(
  cursor: CursorLike,
  input: { sort?: Record<string, 1 | -1>; limit?: number; skip?: number; project?: Record<string, 0 | 1> },
  options: ServerOptions
): CursorLike {
  if (options.readPreference && cursor.setReadPreference) {
    cursor.setReadPreference(options.readPreference);
  }
  if (input.sort) {
    cursor.sort(input.sort);
  }
  if (typeof input.limit === 'number') {
    cursor.limit(input.limit);
  } else if (options.globalLimit && typeof options.globalLimit === 'number') {
    cursor.limit(options.globalLimit);
  }
  if (typeof input.skip === 'number') {
    cursor.skip(input.skip);
  }
  if (input.project && cursor.project) {
    cursor.project(input.project);
  }
  return cursor;
}

function handleFind(viewdb: ViewDbLike, decorator: NonNullable<ServerOptions['queryDecorator']>, options: ServerOptions) {
  return async (input: FindRequest): Promise<VDocument[]> => {
    const decoratedQuery = await decorateQuery(decorator, input.collection, input.query);
    const cursor = viewdb.collection(input.collection).find(decoratedQuery);
    applyCursorOptions(cursor, input, options);
    return new Promise((resolve, reject) => {
      cursor.toArray((err, result) => {
        if (err) return reject(err);
        resolve(result || []);
      });
    });
  };
}

function handleCount(viewdb: ViewDbLike, decorator: NonNullable<ServerOptions['queryDecorator']>, options: ServerOptions) {
  return async (input: CountRequest): Promise<number> => {
    const decoratedQuery = await decorateQuery(decorator, input.collection, input.query);
    const cursor = viewdb.collection(input.collection).find(decoratedQuery);
    // globalLimit from applyCursorOptions applies here too — counts what you'd actually get back
    applyCursorOptions(cursor, input, options);
    return new Promise((resolve, reject) => {
      cursor.count((err, result) => {
        if (err) return reject(err);
        resolve(result ?? 0);
      });
    });
  };
}

function handleInsert(viewdb: ViewDbLike) {
  return async (input: InsertRequest): Promise<WriteResponse> => {
    return new Promise((resolve, reject) => {
      viewdb.collection(input.collection).insert(input.documents, {}, (err, result) => {
        if (err) return reject(err);
        resolve({ ok: true, documents: result as VDocument[] | undefined });
      });
    });
  };
}

function handleSave(viewdb: ViewDbLike) {
  return async (input: SaveRequest): Promise<WriteResponse> => {
    return new Promise((resolve, reject) => {
      viewdb.collection(input.collection).save(input.documents, {}, (err, result) => {
        if (err) return reject(err);
        resolve({ ok: true, documents: result as VDocument[] | undefined });
      });
    });
  };
}

function handleRemove(viewdb: ViewDbLike) {
  return async (input: RemoveRequest): Promise<WriteResponse> => {
    return new Promise((resolve, reject) => {
      viewdb.collection(input.collection).remove(input.query, {}, (err) => {
        if (err) return reject(err);
        resolve({ ok: true });
      });
    });
  };
}

function handleObserve(viewdb: ViewDbLike, decorator: NonNullable<ServerOptions['queryDecorator']>, options: ServerOptions) {
  return (input: ObserveRequest): AsyncIterable<ObserveEvent> => {
    const feed = createScompFeed<ObserveEvent>();

    void (async () => {
      const decoratedQuery = await decorateQuery(decorator, input.collection, input.query);
      const cursor = viewdb.collection(input.collection).find(decoratedQuery);
      applyCursorOptions(cursor, input, options);

      let pendingEvents: ObserveEvent[] = [];
      let flushScheduled = false;

      function enqueue(event: ObserveEvent): void {
        pendingEvents.push(event);
        if (!flushScheduled) {
          flushScheduled = true;
          queueMicrotask(() => {
            const batch = pendingEvents;
            pendingEvents = [];
            flushScheduled = false;
            for (const e of batch) {
              feed.next(e);
            }
          });
        }
      }

      const observeOptions: Record<string, unknown> = {
        init: (result: VDocument[]) => {
          // Init bypasses batching — it's the initial state delivery
          feed.next({ type: 'init', documents: result });
        },
        added: (e: VDocument, index: number) => {
          enqueue({ type: 'added', document: e, index });
        },
        removed: (e: VDocument, index: number) => {
          enqueue({ type: 'removed', document: e, index });
        },
        changed: (oldDoc: VDocument, newDoc: VDocument, index: number) => {
          enqueue({ type: 'changed', oldDocument: oldDoc, newDocument: newDoc, index });
        },
        moved: (e: VDocument, fromIndex: number, toIndex: number) => {
          enqueue({ type: 'moved', document: e, fromIndex, toIndex });
        },
        oplog: true
      };

      if (input.events) {
        if (!input.events.i) delete observeOptions.init;
        if (!input.events.a) delete observeOptions.added;
        if (!input.events.r) delete observeOptions.removed;
        if (!input.events.c) delete observeOptions.changed;
        if (!input.events.m) delete observeOptions.moved;
      }

      const handle = cursor.observe(observeOptions);

      feed.onUnsubscribe(() => {
        handle.stop();
      });

      // Cursor stays alive — the observe handle owns its lifecycle
    })();

    return feed;
  };
}

/**
 * Creates a scomp ServiceDefinition that serves viewdb over RPC.
 * The returned definition can be provided to a scomp peer.
 */
export function createServer(viewdb: ViewDbLike, options: ServerOptions = {}) {
  const decorator = options.queryDecorator || defaultQueryDecorator;

  return createScompService(ViewDbContract).implement({
    requests: {
      find: handleFind(viewdb, decorator, options),
      count: handleCount(viewdb, decorator, options),
      insert: handleInsert(viewdb),
      save: handleSave(viewdb),
      remove: handleRemove(viewdb)
    },
    feeds: {
      observe: handleObserve(viewdb, decorator, options)
    },
    signals: {}
  });
}
