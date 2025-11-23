var _ = require('lodash/fp');

var QueryCompiler = require('./compiler');
var Kuery = function (query) {
  this._query = query || {};
  this._compiledQuery = new QueryCompiler().compile(this._query);
  this._options = {};
};
Kuery.prototype.skip = function (skip) {
  this._options.skip = skip;
  return this;
};

Kuery.prototype.limit = function (limit) {
  this._options.limit = limit;
  return this;
};

Kuery.prototype.sort = function (sort) {
  this._options.sort = sort;
  return this;
};

Kuery.prototype.find = function (collection) {
  var q = [this._compiledQuery];
  if (this._options.sort) {
    var self = this;
    var sortKeys = _.keys(this._options.sort);
    var sortDir = _.map(function (key) {
      if (self._options.sort[key] > 0) return 'asc';
      else return 'desc';
    })(sortKeys);
    q.push(_.orderBy(sortKeys, sortDir));
  }
  if (this._options.skip) {
    q.push(_.drop(this._options.skip));
  }
  if (this._options.limit) {
    q.push(_.take(this._options.limit));
  }
  if (q.length > 1) {
    q = _.flow(q);
  } else {
    q = q[0];
  }
  return q(collection);
};

Kuery.prototype.findOne = function (collection, options) {
  var result = this.find(collection, options);
  if (result.length !== 1) {
    throw new Error('findOne returned ' + result.length + ' results.');
  }
  return result[0];
};

module.exports = Kuery;
