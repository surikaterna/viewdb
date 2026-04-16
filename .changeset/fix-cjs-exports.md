---
'viewdb_persistence_store_remote': patch
'viewdb_persistence_store_lokijs': patch
---

Fix CJS exports to use module.exports instead of named exports, preventing \_\_esModule flag from appearing in compiled output
