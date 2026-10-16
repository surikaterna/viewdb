---
"viewdb_persistence_store_remote": minor
---

Add negotiated, version-gated JSON Patch delivery for Socket.IO observers while preserving full-document remote and hybrid callbacks and legacy full-event compatibility. Keep browser patch baselines private per observer with an 8 MiB/2,048-entry default. Share immutable projected server snapshots in a process-wide cache defaulting to 256 MiB/65,536 entries, with per-consumer delivered key/version metadata and operator configuration/statistics. Recover missing bases with authorized projected document reads or ordered snapshot reconciliation. Preserve shared-consumer isolation and initialization races, protect patch application from caller mutation and prototype modification, and route request errors through callbacks.

Keep recovery conservative: authorize each request for its requesting consumer, retain later full corrections, and fall back to full snapshots after transient recovery errors. Cancel obsolete recovery requests, invalidate unsupported delta baselines, serialize full recovery payloads independently of patch eligibility, and coalesce shared window reconciliations.
