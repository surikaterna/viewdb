var _ = require('lodash');
var merge = require('./merger');

var Observer = function (query, queryOptions, collection, options) {
  this._query = query;
  this._queryOptions = queryOptions;

  this._options = options;
  //this._options = logger;
  this._collection = collection;
  this._cache = [];
  var self = this;
  var listener = function () {
    self.refresh();
  };
  collection.on('change', listener);
  this.refresh(true);
  return {
    stop: function () {
      self._cache = null;
      collection.removeListener('change', listener);
    }
  };
};

Observer.prototype.refresh = function (initial) {
  var self = this;

  this._collection._getDocuments(this._query, function (err, result) {
    if (initial && self._options.init) {
      self._cache = result;
      self._options.init(result);
    } else {
      var old = self._cache;

      self._cache = merge(
        old,
        result,
        _.defaults(
          {
            comparatorId: function (a, b) {
              return _.get(a, '_id') === _.get(b, '_id');
            }
          },
          self._options
        )
      );
      //rewind cursor for next query...
    }
  });
};

module.exports = Observer;
