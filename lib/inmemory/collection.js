var _ = require('lodash');
var uuid = require('uuid').v4;

var EventEmitter = require('events').EventEmitter;
var util = require('util');

var Kuery = require('kuery');

var Cursor = require('../cursor');

var Collection = function (collectionName) {
  EventEmitter.call(this);

  this._documents = [];
  this._name = collectionName;
};

util.inherits(Collection, EventEmitter);

Collection.prototype.count = function (callback) {
  callback(null, this._documents.length);
};

Collection.prototype._write = function (op, documents, options, callback) {
  if (_.isFunction(options)) {
    callback = options;
    options = undefined;
  }
  if (!_.isArray(documents)) {
    documents = [documents];
  }
  var self = this;
  for (var i = 0; i < documents.length; i++) {
    var document = documents[i];
    if (!_.isObject(document)) {
      return callback(new Error('Document must be object'));
    }
    if (!_.has(document, '_id')) {
      document['_id'] = document['id'] || uuid();
    }
    var idx = _.findIndex(self._documents, { _id: document['_id'] });
    if (op === 'insert' && idx >= 0) {
      return callback(new Error('Unique constraint!'));
    }
    // not stored before
    if (idx === -1) {
      self._documents.push(document);
    } else {
      this._documents[idx] = document;
    }
  }
  this.emit('change', documents);
  if (callback) {
    callback(null, documents);
  }
};

Collection.prototype.insert = function (documents, options, callback) {
  return this._write('insert', documents, options, callback);
};

Collection.prototype.save = function (documents, options, callback) {
  return this._write('save', documents, options, callback);
};

Collection.prototype.drop = function (callback) {
  this._documents = [];

  if (callback) {
    callback(null);
  }
};

Collection.prototype.find = function (query, options) {
  return new Cursor(this, { query: query }, options, this._getDocuments.bind(this));
};

Collection.prototype.remove = function (query, options, callback) {
  var q = new Kuery(query);
  var documents = q.find(this._documents);
  this._documents = _.pullAll(this._documents, documents);

  process.nextTick(function () {
    callback(null);
  });
};
Collection.prototype.ensureIndex = function (options, callback) {
  throw new Error('ensureIndex not supported!');
};
Collection.prototype.createIndex = function (options, callback) {
  throw new Error('createIndex not supported!');
};

Collection.prototype._getDocuments = function (queryObject, callback) {
  var self = this;
  var query = queryObject.query || queryObject;
  var q = new Kuery(query);
  if (queryObject.sort) {
    q.sort(queryObject.sort);
  }
  if (queryObject.skip) {
    q.skip(queryObject.skip);
  }
  if (queryObject.limit) {
    q.limit(queryObject.limit);
  }
  var documents = q.find(self._documents);
  process.nextTick(function () {
    callback(null, _.cloneDeep(documents));
  });
};

module.exports = Collection;
