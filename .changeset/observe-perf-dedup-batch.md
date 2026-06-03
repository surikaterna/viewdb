---
'viewdb_persistence_store_mongodb': minor
'viewdb_persistence_store_remote': minor
---

Add per-document leading+trailing edge batch throttle to oplog Observer (opt-in via batchMs option), shared observer dedup registry in ViewDbSocketServer to reduce amplification during write bursts, and observer lifecycle hardening for duplicate IDs and stop/disconnect races. Remote duplicate observe replacements now log a warning with client query context.
