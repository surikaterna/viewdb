# viewdb_persistence_store_mongodb

## 4.5.2

### Patch Changes

- Upgrade to Node v26, and upgrade dependencies to remove vulnerabilities.

## 4.5.1

### Patch Changes

-   Add `prepublishOnly` build hooks so package artifacts (including TypeScript declaration files) are reliably built before publishing.

    This republishes the latest versions as patch releases because the previous latest versions were published without guaranteed build output.

## 4.5.0

### Minor Changes

-   d0b8781: Add per-document leading+trailing edge batch throttle to oplog Observer (opt-in via batchMs option), shared observer dedup registry in ViewDbSocketServer to reduce amplification during write bursts, and observer lifecycle hardening for duplicate IDs and stop/disconnect races. Remote duplicate observe replacements now log a warning with client query context.
-   4057875: Raise lodash minimum to ^4.18.0 to exclude vulnerable versions. Standardize SLF logger namespaces to viewdb:{package}:{module} convention.
-   b08da3a: Upgrade kuery to 2.0.0 and use .test(doc) for single-document matching in observer hot path, eliminating unnecessary array allocations per oplog event

## 4.4.0

### Minor Changes

-   Add index to cache
