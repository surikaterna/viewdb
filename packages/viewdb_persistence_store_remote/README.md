# viewdb_persistence_store_remote

## Socket observer deltas

Socket.IO observers negotiate version-1 JSON Patch delivery automatically. The public API remains `cursor.observe({ init, added, changed, removed, moved })`: callbacks receive full documents, never patches. Ordinary `find`, `count`, and REST polling are unchanged.

Both peers must support deltas. A client requests `deltaVersion: 1`; the server acknowledges it with the observer handle before sending delta events. Mixed-version deployments retain full events, and clients do not request recovery from a server that has not acknowledged support.

### Versions and projections

- Documents need a stable string or numeric `_id` and a finite, nonnegative safe-integer `version`. Increment `version` whenever document content changes.
- A patch requires an exact cached base version, a strictly newer target version, and a smaller encoded event than the full change. Cold or evicted baselines, unsupported JSON values, invalid versions, and equal/decreasing versions use full events. Equal-version full updates remain authoritative.
- Initialization and structural events remain full. Baselines are private copies: mutations in callbacks do not alter later patch bases.
- Projection is preserved for initialization, updates, and recovery. Excluding `_id` or `version` disables deltas; hidden fields are not added to callback documents.
- Sorted, projected, or paginated observers re-query and reconcile their observed window before delivering changes. This preserves membership and indexes, but adds database reads compared with an unprojected, unlimited observer.

### Cache limits and server configuration

The browser's private patch-baseline cache is configurable per `SocketClient`:

```js
const { SocketClient, Client } = require('viewdb_persistence_store_remote');

const transport = new SocketClient(socket, {
  deltaCache: {
    maxBytes: 4 * 1024 * 1024,
    maxEntries: 1024
  }
});
const store = new Client(transport);
```

`deltaCache` bounds the client's private patch baselines **per observer**. It defaults to 8 MiB of serialized documents and 2,048 entries. Either limit may be zero to disable retention; invalid limits use the defaults.

The server retains immutable projected snapshots in a **process-wide** shared cache, defaulting to 256 MiB of serialized snapshots and 65,536 entries. Consumers retain only their own delivered key/version metadata, so identical projected content can be shared without sharing consumer baselines. Configure the server once during startup, or resize/disable it at runtime:

```js
const { Server } = require('viewdb_persistence_store_remote');

Server.configureDeltaCache({ maxBytes: 256 * 1024 * 1024, maxEntries: 65536 });
const { size, bytes } = Server.getDeltaCacheStats();
```

Server limits must be nonnegative safe integers; invalid values throw `RangeError`. Setting either limit to zero disables retention. Each call resets omitted limits to their defaults. Per-observer delivery metadata is capped at 2,048 document references and does not retain snapshot objects. Shared-cache limits count unique snapshots, including older versions still useful to other consumers.

The stats report retained snapshot entry and serialized-byte counts, not consumer metadata. The cache is shared only within one process/worker; it is not distributed across workers. Eviction affects optimization only: a server cache miss sends a full change, while a browser cache miss recovers a full document. Neither cache limit caps current result arrays needed for observer reconciliation or hybrid storage.

### Recovery and lifecycle

Missing bases, version gaps, and malformed patches trigger a one-shot `observe.document` request scoped to the live observer registration. The server reapplies authorization and searches the same projected, sorted, skipped, and limited result window—not an independent ID query.

Recovery coalesces updates and guards against stale responses. If membership or ordering changes, or the document leaves the window, `observe.snapshot` obtains a consistent replacement and uses ViewDb merge callbacks to reconcile it without an extra public `init`. The previous result stays visible until replacement is ready, including for consumers without an init callback.

Stopping, restarting, or reconnecting clears private baselines and invalidates pending recovery. After authentication/setup on a reconnected socket, continue to call `transport.onClientReconnected()` as before. Recovery errors reach request callbacks rather than throwing globally; a subsequent event can retry snapshot recovery without an immediate retry loop.

## Hybrid cursor counts

`hybrid.collection('items').find(query).count(callback)` counts matching remote documents even when the local query cache is empty. Cursor `.skip(n)` and `.limit(n)` apply to the count. With the remote client cursor, pass `{ skip, limit }` as the first argument to `count(options, callback)` to set bounds when the cursor has none; cursor bounds take precedence over count options. Explicit count bounds bypass cached results. A plain ViewDb remote cursor accepts only `count(callback)`, so use cursor `.skip()` and `.limit()` to bound its count.
