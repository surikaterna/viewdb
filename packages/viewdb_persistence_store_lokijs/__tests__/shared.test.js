import { Store } from '..';
import { runStoreTests } from 'viewdb-store-tests';

runStoreTests({
  name: 'lokijs',
  createStore: function (done) {
    var store = new Store('test-shared', { inMemoryOnly: true, disableThrottle: true });
    store.open().then(function () {
      done(store);
    });
  },
  destroyStore: function (store, done) {
    store.collection('test_shared').drop(function () {
      store.close(function () {
        store.clearAllIntervals();
        done();
      });
    });
  },
  suites: ['crud', 'query', 'cursor', 'count', 'observe'],
  observeOptions: {
    settleDelay: 50
  }
});
