var Store = require('../dist/store');
var getDb = require('./util');
var runStoreTests = require('viewdb-store-tests').runStoreTests;

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
