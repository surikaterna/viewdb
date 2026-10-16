# viewdb_persistence_store_remote

Remote and hybrid persistence for ViewDb. Query server-side data, subscribe to live updates over Socket.IO, or combine remote data with a local store.

## Live updates

Observers keep application data up to date while continuing to deliver complete documents. For versioned documents, compatible clients and servers automatically send smaller incremental updates when possible, with full-document delivery as a fallback.

The server shares a bounded document cache across connections to reduce memory usage when many users observe the same data. Authorization and field projections still apply to every observer.

Subscriptions with removal callbacks use full-document updates so removed records remain available without retaining an unbounded client-side history.

## Hybrid cursor counts

`hybrid.collection('items').find(query).count(callback)` counts matching remote documents even when the local query cache is empty. Cursor `.skip(n)` and `.limit(n)` apply to the count. With the remote client cursor, pass `{ skip, limit }` as the first argument to `count(options, callback)` to set bounds when the cursor has none; cursor bounds take precedence over count options. Explicit count bounds bypass cached results. A plain ViewDb remote cursor accepts only `count(callback)`, so use cursor `.skip()` and `.limit()` to bound its count.
