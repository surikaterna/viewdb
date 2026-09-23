# viewdb_persistence_store_indexeddb

## 0.6.2

### Patch Changes

- Upgrade to Node v26, and upgrade dependencies to remove vulnerabilities.

## 0.6.1

### Patch Changes

-   Add `prepublishOnly` build hooks so package artifacts (including TypeScript declaration files) are reliably built before publishing.

    This republishes the latest versions as patch releases because the previous latest versions were published without guaranteed build output.

## 0.6.0

### Minor Changes

-   4057875: Raise lodash minimum to ^4.18.0 to exclude vulnerable versions. Standardize SLF logger namespaces to viewdb:{package}:{module} convention.
