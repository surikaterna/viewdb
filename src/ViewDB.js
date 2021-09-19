import Promise from 'bluebird';
import InMemoryStore from './inmemory/Store';

var ViewDB = function (store) {
  this._store = store || new InMemoryStore();
};

ViewDB.prototype.open = function () {
  if (this._store.open) {
    return this._store.open().then(function () {
      return this;
    });
  } else {
    return Promise.resolve(this);
  }
};

ViewDB.prototype.collection = function (collectionName, callback) {
  return this._store.collection(collectionName, callback);
};

export default ViewDB;
