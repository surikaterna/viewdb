# ViewDB

ViewDB is a database facade for JavaScript/TypeScript. It provides configurable persistence via store adapters. The default in-memory store works out of the box. Plug in IndexedDB, MongoDB, LokiJS, or remote (socket.io/REST/hybrid) stores for production use.

The API is callback-based. All packages compile to CommonJS (ES2018 target).

## Packages

| Package                              | Version | Description                                                            |
| ------------------------------------ | ------- | ---------------------------------------------------------------------- |
| `viewdb`                             | 0.12.0  | Core database facade with in-memory store, cursor, observer, and merge |
| `viewdb_persistence_store_indexeddb` | 0.5.0   | IndexedDB persistence store (browser)                                  |
| `viewdb_persistence_store_mongodb`   | 4.3.0   | MongoDB persistence store (server, driver v6)                          |
| `viewdb_persistence_store_remote`    | 4.3.0   | Remote persistence via socket.io, REST, or hybrid (local+remote)       |
| `viewdb_persistence_store_lokijs`    | 1.0.0   | LokiJS persistence store with partitioning and Cordova FS adapters     |

## Quick Start

```js
const ViewDB = require('viewdb');

// Default in-memory store
const db = new ViewDB();
const collection = db.collection('items');

collection.insert([{ _id: '1', name: 'foo' }], function (err) {
    collection.find({ name: 'foo' }).toArray(function (err, docs) {
        console.log(docs);
    });
});
```

Using a persistence store:

```js
const ViewDB = require('viewdb');
const { Store } = require('viewdb_persistence_store_lokijs');

const store = new Store('mydb', { inMemoryOnly: true });
const db = new ViewDB(store);
```

## Architecture

`ViewDB` accepts a `Store` in its constructor. The default is `InMemoryStore`.

```
ViewDB -> Store -> Collection -> Cursor / Observer
```

**Store** provides `.open()`, `.close()`, and `.collection(name)`.

**Collection** provides `.find(query)`, `.insert(docs, cb)`, `.save(docs, cb)`, `.remove(query, cb)`, `.drop(cb)`, and `.ensureIndex()`.

**Cursor** is returned by `.find()`. It supports `.toArray(cb)`, `.sort()`, `.skip()`, `.limit()`, `.count(cb)`, and `.observe(callbacks)`.

**Observer** is returned by `.observe()`. It returns a handle with `.stop()`. Callbacks: `init`, `added`, `changed`, `removed`.

```js
const handle = collection.find({ active: true }).observe({
    init: function (docs) {
        /* initial dataset */
    },
    added: function (doc) {
        /* new match */
    },
    changed: function (newDoc, oldDoc) {
        /* updated match */
    },
    removed: function (doc) {
        /* removed from result set */
    }
});

// Later:
handle.stop();
```

## Plugins

Plugins attach via constructor and modify the database instance directly.

```js
const ViewDB = require('viewdb');
const db = new ViewDB();

new ViewDB.plugins.TimestampPlugin(db); // adds createdAt/updatedAt
new ViewDB.plugins.VersioningPlugin(db); // adds _version tracking
```

## Development

This monorepo is managed with Turborepo and npm workspaces.

```bash
npm install        # install all dependencies
npx turbo build    # build all packages
npx turbo test     # run all tests
```

All packages are TypeScript, compiled to CommonJS targeting ES2018.

## License

MIT
