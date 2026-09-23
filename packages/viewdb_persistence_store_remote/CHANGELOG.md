# viewdb_persistence_store_remote

## 4.4.2

### Patch Changes

- Upgrade to Node v26, and upgrade dependencies to remove vulnerabilities.

## 4.4.1

### Patch Changes

-   Add `prepublishOnly` build hooks so package artifacts (including TypeScript declaration files) are reliably built before publishing.

    This republishes the latest versions as patch releases because the previous latest versions were published without guaranteed build output.

## 4.4.0

### Minor Changes

-   d0b8781: Add per-document leading+trailing edge batch throttle to oplog Observer (opt-in via batchMs option), shared observer dedup registry in ViewDbSocketServer to reduce amplification during write bursts, and observer lifecycle hardening for duplicate IDs and stop/disconnect races. Remote duplicate observe replacements now log a warning with client query context.
-   4057875: Raise lodash minimum to ^4.18.0 to exclude vulnerable versions. Standardize SLF logger namespaces to viewdb:{package}:{module} convention.

### Patch Changes

-   b88133d: Fix CJS exports to use module.exports instead of named exports, preventing \_\_esModule flag from appearing in compiled output
