var _ = require('lodash');
var MongoClient = require('mongodb').MongoClient;
var ViewDb = require('viewdb');
var Store = require('../dist/store');
var Observer = require('../src/observe');

describe('Observe', function () {
  const COLLECTION_NAME = 'observe';

  let _mongoClient;
  let _db;

  const getDb = () => _db;
  const getVDb = () => new ViewDb(new Store(getDb()));

  beforeAll(async () => {
    const mongoClient = await MongoClient.connect(global.__MONGO_URI__);
    const db = await mongoClient.db('db_test_suite');

    _mongoClient = mongoClient;
    _db = db;
  });

  beforeEach(async () => {
    try {
      await _db.collection(COLLECTION_NAME).drop();
    } catch (err) {
      // No-op
    }
  });

  afterAll(async () => {
    await _mongoClient.close();
  });

  it('#observe with query and update', () =>
    new Promise((resolve, reject) => {
      var store = getVDb();
      store.open().then(function () {
        var cursor = store.collection(COLLECTION_NAME).find({ _id: 'echo' });
        var handle = cursor.observe({
          added: function (x) {
            expect(x.age).toBe(10);
            expect(x._id).toBe('echo');
          },
          changed: function (asis, tobe) {
            expect(asis.age).toBe(10);
            expect(tobe.age).toBe(100);
            handle.stop();
            resolve();
          }
        });
        store.collection(COLLECTION_NAME).insert({ _id: 'echo', age: 10 }, function () {
          store.collection(COLLECTION_NAME).save({ _id: 'echo', age: 100 }, function () {});
        });
      });
    }));
  it('#observe with insert', () =>
    new Promise((resolve, reject) => {
      var handle;
      var store = getVDb();
      store.open().then(function () {
        var collection = store.collection(COLLECTION_NAME);
        var cursor = collection.find({});
        handle = cursor.observe({
          added: function (x) {
            expect(x._id).toBe('echo');
            handle.stop();
            resolve();
          }
        });
        collection.insert({ _id: 'echo' });
      });
    }));
  it('#observe with remove', () =>
    new Promise((resolve, reject) => {
      var realDone = _.after(2, resolve);
      var store = getVDb();
      store.open().then(function () {
        var cursor = store.collection(COLLECTION_NAME).find({});
        var handle = cursor.observe({
          added: function (x) {
            expect(x._id).toBe('echo');
            realDone();
          },
          removed: function () {
            handle.stop();
            realDone();
          }
        });
        var coll = store.collection(COLLECTION_NAME);
        coll.insert({ _id: 'echo' }, function () {
          coll.remove({ _id: 'echo' }, function () {});
        });
      });
    }));
  it('#observe with query and insert', () =>
    new Promise((resolve, reject) => {
      var store = getVDb();
      store.open().then(function () {
        store.collection(COLLECTION_NAME).insert({ _id: 'echo1' }, function () {
          var cursor = store.collection(COLLECTION_NAME).find({ _id: 'echo2' });
          var handle = cursor.observe({
            added: function (x) {
              expect(x._id).toBe('echo2');
              resolve();
              handle.stop();
            }
          });
        });
        store.collection(COLLECTION_NAME).insert({ _id: 'echo4' }, function () {
          store.collection(COLLECTION_NAME).insert({ _id: 'echo2' });
        });
      });
    }));
  it('#observe with query and skip', () =>
    new Promise((resolve, reject) => {
      var store = getVDb();
      store.open().then(function () {
        store.collection(COLLECTION_NAME).insert({ _id: 'echo' });
        store.collection(COLLECTION_NAME).insert({ _id: 'echo2' });
        store.collection(COLLECTION_NAME).insert({ _id: 'echo3' });
        var cursor = store.collection(COLLECTION_NAME).find({});
        var skip = 0;
        var handle;
        cursor.limit(1);
        var realDone = _.after(3, function () {
          cursor.toArray(function (err, res) {
            expect(res).toHaveLength(0);
            handle.stop();
            resolve();
          });
        });

        handle = cursor.observe({
          added: function () {
            cursor.skip(++skip);
            realDone();
          }
        });
      });
    }));

  it('#oplog observe keeps cache index in sync after remove shifts and update', () => {
    var buildDoc = function (id) {
      return {
        _id: id,
        status: 'created',
        shipTo: 'SE'
      };
    };

    var setupObserver = function (initialDocs, options) {
      var capturedHandler;
      var capturedContext;

      var oplogListener = {
        listen: function (namespace, onOperation, context) {
          capturedHandler = onOperation;
          capturedContext = context;

          return {
            dispose: function () {}
          };
        }
      };

      var collection = {
        _collection: {
          s: {
            namespace: {
              db: 'db_test_suite',
              collection: COLLECTION_NAME
            }
          }
        },
        _getDocuments: function (query, cb) {
          cb(null, initialDocs);
        }
      };

      new Observer({ query: {} }, {}, collection, options, oplogListener);

      return {
        observerContext: function () {
          return capturedContext;
        },
        emit: function (payload) {
          capturedHandler.call(capturedContext, payload);
        }
      };
    };

    var docA = buildDoc('A');
    var docB = buildDoc('B');
    var docC = buildDoc('C');

    var addedCalls = [];
    var changedCalls = [];
    var removedCalls = [];

    var observerSetup = setupObserver([docA, docB], {
      added: function (doc, index) {
        addedCalls.push([doc, index]);
      },
      changed: function (asis, doc, index) {
        changedCalls.push([asis, doc, index]);
      },
      removed: function (doc, index) {
        removedCalls.push([doc, index]);
      }
    });

    // Initial load may invoke callbacks through merge(); clear to validate oplog updates only.
    addedCalls = [];
    changedCalls = [];
    removedCalls = [];

    observerSetup.emit({ op: 'i', o: docC });

    var observer = observerSetup.observerContext();

    expect(addedCalls).toHaveLength(1);
    expect(addedCalls[0][0]._id).toBe('C');
    expect(addedCalls[0][1]).toBe(2);
    expect(observer._cacheIndex.get('C')).toBe(2);

    observerSetup.emit({ op: 'd', o: { _id: 'A' } });

    expect(removedCalls).toHaveLength(1);
    expect(removedCalls[0][0]).toEqual({ _id: 'A' });
    expect(removedCalls[0][1]).toBe(0);

    expect(observer._cache).toEqual(['B', 'C']);
    expect(observer._cacheIndex.get('B')).toBe(0);
    expect(observer._cacheIndex.get('C')).toBe(1);

    observerSetup.emit({ op: 'u', o: docB });

    expect(changedCalls).toHaveLength(1);
    expect(changedCalls[0][0]).toBe(null);
    expect(changedCalls[0][1]).toEqual(docB);
    expect(changedCalls[0][2]).toBe(0);
  });
});
