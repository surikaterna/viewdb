# viewdb_persistence_store_remote

## Hybrid cursor counts

`hybrid.collection('items').find(query).count(callback)` counts matching remote documents even when the local query cache is empty. Cursor `.skip(n)` and `.limit(n)` apply to the count. Pass `{ skip, limit }` as the first argument to `count(options, callback)` to set bounds when the cursor has none; cursor bounds take precedence over count options. Explicit count bounds are evaluated remotely rather than using a cached result.
