import Store from '../src/store';
import getDb from './util';
import { runStoreTests } from 'viewdb-store-tests';

runStoreTests({
  name: 'indexeddb',
  createStore: function (done) {
    var idb = getDb();
    var store = new Store(idb);
    store.open().then(function () {
      done(store);
    });
  },
  destroyStore: function (store, done) {
    store.close().then(function () {
      var idb = store._idb;
      idb._databases.clear();
      done();
    });
  },
  suites: ['crud', 'query', 'cursor', 'count']
});
