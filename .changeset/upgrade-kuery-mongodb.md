---
'viewdb_persistence_store_mongodb': minor
---

Upgrade kuery to 2.0.0 and use .test(doc) for single-document matching in observer hot path, eliminating unnecessary array allocations per oplog event
