# viewdb_persistence_store_remote

## Hybrid cursor counts

`hybrid.collection('items').find(query).count(callback)` counts matching remote documents even when the local query cache is empty. Cursor `.skip(n)` and `.limit(n)` apply to the count. With the remote client cursor, pass `{ skip, limit }` as the first argument to `count(options, callback)` to set bounds when the cursor has none; cursor bounds take precedence over count options. Explicit count bounds bypass cached results. A plain ViewDb remote cursor accepts only `count(callback)`, so use cursor `.skip()` and `.limit()` to bound its count.
