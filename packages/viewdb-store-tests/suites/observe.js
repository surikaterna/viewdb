import assert from 'assert';

// Inline replacement for _.after(n, fn) — no lodash dependency
function after(n, fn) {
  var count = 0;
  return function () {
    if (++count >= n) {
      fn.apply(this, arguments);
    }
  };
}

export default function (config) {
  var COLL = 'test_shared';
  var delay = config.observeOptions.settleDelay;

  describe('observe', function () {
    var store;

    beforeEach(function () {
      return new Promise(function (resolve) {
        config.createStore(function (s) {
          store = s;
          resolve();
        });
      });
    });

    afterEach(function () {
      return new Promise(function (resolve) {
        config.destroyStore(store, resolve);
      });
    });

    it('init fires with empty collection', function () {
      return new Promise(function (resolve) {
        var cursor = store.collection(COLL).find({});
        var handle = cursor.observe({
          init: function (coll) {
            assert.strictEqual(coll.length, 0);
            setTimeout(function () {
              handle.stop();
              resolve();
            }, delay);
          }
        });
      });
    });

    it('added fires on insert', function () {
      return new Promise(function (resolve) {
        var cursor = store.collection(COLL).find({});
        var handle = cursor.observe({
          added: function (x) {
            assert.strictEqual(x._id, 'echo');
            setTimeout(function () {
              handle.stop();
              resolve();
            }, delay);
          }
        });
        store.collection(COLL).insert({ _id: 'echo' });
      });
    });

    it('removed fires on remove', function () {
      return new Promise(function (resolve) {
        store.collection(COLL).insert({ _id: 'echo' }, function () {
          var cursor = store.collection(COLL).find({});
          var handle = cursor.observe({
            removed: function (x) {
              assert.strictEqual(x._id, 'echo');
              handle.stop();
              resolve();
            }
          });
          store.collection(COLL).remove({ _id: 'echo' });
        });
      });
    });

    it('added fires for matching query on insert', function () {
      return new Promise(function (resolve) {
        store.collection(COLL).insert({ _id: 'echo' }, function () {
          var cursor = store.collection(COLL).find({ _id: 'echo2' });
          var handle = cursor.observe({
            added: function (x) {
              assert.strictEqual(x._id, 'echo2');
              setTimeout(function () {
                handle.stop();
                resolve();
              }, delay);
            }
          });
          store.collection(COLL).insert({ _id: 'echo2' });
        });
      });
    });

    it('changed fires on update', function () {
      return new Promise(function (resolve) {
        var cursor = store.collection(COLL).find({ _id: 'echo' });
        var handle = cursor.observe({
          added: function (x) {
            assert.strictEqual(x.age, 10);
          },
          changed: function (o, n) {
            assert.strictEqual(o.age, 10);
            assert.strictEqual(n.age, 100);
            handle.stop();
            resolve();
          }
        });
        store.collection(COLL).insert({ _id: 'echo', age: 10 }, function () {
          store.collection(COLL).save({ _id: 'echo', age: 100 });
        });
      });
    });

    it('observe with skip updates correctly', function () {
      return new Promise(function (resolve) {
        store.collection(COLL).insert({ _id: 'echo' }, function () {
          store.collection(COLL).insert({ _id: 'echo2' }, function () {
            store.collection(COLL).insert({ _id: 'echo3' }, function () {
              var cursor = store.collection(COLL).find({});
              var skip = 0;
              cursor.limit(1);
              var realDone = after(3, function () {
                cursor.toArray(function (err, res) {
                  assert.strictEqual(res.length, 0);
                  setTimeout(function () {
                    handle.stop();
                    resolve();
                  }, delay);
                });
              });
              var handle = cursor.observe({
                added: function () {
                  cursor.skip(++skip);
                  realDone();
                }
              });
            });
          });
        });
      });
    });
  });
};
