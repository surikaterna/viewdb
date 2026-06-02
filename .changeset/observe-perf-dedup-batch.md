---
'viewdb_persistence_store_mongodb': minor
'viewdb_persistence_store_remote': minor
---

Add per-document leading+trailing edge batch throttle to oplog Observer (opt-in via batchMs option) and shared observer dedup registry in ViewDbSocketServer to reduce amplification during write bursts