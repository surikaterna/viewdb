# viewdb_persistence_store_lokijs

## 1.2.0

### Minor Changes

- Fix audit issues by upgrading dependencies and replacing unnecessary dependencies.

## 1.1.1

### Patch Changes

- Add `prepublishOnly` build hooks so package artifacts (including TypeScript declaration files) are reliably built before publishing.

  This republishes the latest versions as patch releases because the previous latest versions were published without guaranteed build output.

## 1.1.0

### Minor Changes

- 4057875: Add LokiJS persistence store package, extracted from lx-react-client. Includes partitioning adapter and Cordova FS adapter with adapter injection via constructor options.

### Patch Changes

- b88133d: Fix CJS exports to use module.exports instead of named exports, preventing \_\_esModule flag from appearing in compiled output
