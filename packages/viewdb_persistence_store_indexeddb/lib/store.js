var Promise = require('bluebird');
var Collection = require('./collection');


var Store = function (idb, name) {
  this._idb = idb;
  this._db;
  this._name = (name ? 'vdb_' + name : 'vdb');
  this._collections = {};
}

Store.prototype.open = function (callback) {
  var self = this;
  var request = this._idb.open(this._name, 2);
  return new Promise(function (resolve, reject) {
    request.onsuccess = function (event) {
      self._db = event.target.result;
      resolve(self);
    }
    request.onupgradeneeded = function (event) {
      var db = event.target.result;
      if (event.oldVersion < 1) {
        var documents = db.createObjectStore('documents', { keyPath: '$collectionKey', unique: true });
        documents.createIndex('$collection', '$collection', { unique: false });
      }
      //fix for _id being keypath...
      if (event.oldVersion < 2) {
        db.deleteObjectStore('documents');
        var documents = db.createObjectStore('documents', { keyPath: '$collectionKey', unique: true });
        documents.createIndex('$collection', '$collection', { unique: false });
      }
      //self._documents.createIndex('streamIdCommitSequence', 'streamIdCommitSequence', {unique:true});
      //db.createObjectStore('commits', {keyPath: 'id'});
    }
    request.onerror = function (event) {
      reject(new Error(event));
    }
    request.onblocked = function (event) {
      reject(new Error(event));
    }
  }).nodeify(callback);
}

Store.prototype.close = function (callback) {
  var self = this;
  return new Promise(function (resolve, reject) {
    var req = self._db.close();
    resolve();
  }).nodeify(callback);
}

Store.prototype.delete = function (callback) {
  var self = this;
  return new Promise(function (resolve, reject) {
    var req = self._idb.deleteDatabase(this._name);
    req.onsuccess = function () {
      resolve();
    };
    req.onerror = function (event) {
      reject();
    }
  }).nodeify(callback);
}

Store.prototype.collection = function (name, callback) {
  var collection = this._collections[name];
  if (!collection) {
    collection = this._collections[name] = new Collection(this._db, name);
  }
  if (callback) {
    callback(collection);
  }
  return collection;
}

module.exports = Store;