var _ = require('lodash');
var Observe = require('./observe');

var Cursor = function (collection, query, options, getDocuments) {
  this._collection = collection;
  this._query = query;
  this._options = options;
  this._getDocuments = getDocuments;
  this._isObserving = false;
}

Cursor.prototype.forEach = function (callback, thiz) {
  var docs = this._getDocuments(this._query, function (err, result) {
    _.forEach(result, function (n) {
      callback(result)
    });
  });
};

Cursor.prototype.toArray = function (callback) {
  var docs = this._getDocuments(this._query, callback);
};

Cursor.prototype.observe = function (options) {
  this._isObserving = true;
  return new Observe(this._query, this._options, this._collection, options);
};

Cursor.prototype.skip = function (skip) {
  this._query.skip = skip;
  if (this._isObserving) {
    this._refresh();
  }
  return this;
};

Cursor.prototype.limit = function (limit) {
  this._query.limit = limit;
  if (this._isObserving) {
    this._refresh();
  }
  return this;
};

Cursor.prototype.sort = function (sort) {
  this._query.sort = sort;
  if (this._isObserving) {
    this._refresh();
  }
  return this;
};

Cursor.prototype._refresh = function () {
  this._collection.emit('change', {});
};

Cursor.prototype.rewind = function (options) {
  //NOOP
};

Cursor.prototype.count = function (applySkipLimit, callback) {
  if (_.isFunction(applySkipLimit)) {
    callback = applySkipLimit;
    applySkipLimit = false;
  }
  var query = { query: this._query.query };
  if (applySkipLimit) {
    if (this._query.skip) {
      query.skip = this._query.skip;
    }
    if (this._query.limit) {
      query.limit = this._query.limit;
    }
  }
  this._getDocuments(query, function (err, res) {
    callback(err, res && res.length);
  })
};


module.exports = Cursor;