# ViewDB

[ViewDB](https://github.com/surikaterna/viewdb) is a database facade for JavaScript. It can be configured with a custom Store to provide support for different persistence sources, such as MongoDB or IndexedDB, and comes with a default in-memory Store for easy testing.

## Monorepo Structure

This repository contains the viewdb ecosystem:

| Package                              | Description                                                        |
| ------------------------------------ | ------------------------------------------------------------------ |
| `viewdb`                             | Core in-memory database with cursor, observer, and merge utilities |
| `viewdb_persistence_store_indexeddb` | IndexedDB persistence adapter                                      |
| `viewdb_persistence_store_mongodb`   | MongoDB persistence adapter                                        |
| `viewdb_persistence_store_remote`    | Remote persistence adapter (socket, REST, hybrid)                  |

### Development

```bash
npm install        # Install all dependencies
npx turbo build    # Build all packages
npx turbo test     # Run all tests
```

## License

MIT
