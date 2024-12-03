var _ = require('lodash/fp');
var hi = require('./hidash');

var QueryCompiler = function () {};

QueryCompiler.prototype.compile = function (query) {
  var filters = this._compilePredicates(query);
  var filtered;
  if (filters.length === 1) {
    filtered = _.filter(filters[0]);
  } else {
    filtered = filters.map(function (v) {
      return _.filter(v);
    });
    filtered = _.flow(filtered);
  }
  return filtered;
};

QueryCompiler.prototype._compilePredicates = function (query) {
  var self = this;
  var keys = _.keys(query);
  var filters = [];
  // if empty query, operation = clone collection
  if (!keys.length) {
    return _.clone;
  }
  _.forEach(function (key) {
    filters = filters.concat(self._compilePart(key, query[key]));
  })(keys);
  return filters;
};

function getType(val) {
  var type;
  type = Object.prototype.toString.call(val).substr(8);
  return type.substr(0, type.length - 1);
}

QueryCompiler.prototype._compilePart = function (key, queryPart) {
  var op;
  var queryPartType = null;
  var type = getType(queryPart);
  var filter;
  var filters = [];
  switch (type) {
    case 'Object':
      loop: for (queryPartType in queryPart) {
        op = queryPart[queryPartType];
        switch (queryPartType) {
          case '$eq':
            filters.push(hi.compare(key, _.eq, op));
            break;
          case '$ne':
            filters.push(_.negate(this._compilePart(key, op)));
            break;
          case '$in':
            filters.push(hi.compare(key, _.includes, op));
            break;
          case '$nin':
            filters.push(_.negate(hi.compare(key, _.includes, op)));
            break;
          case '$regex':
            filters.push(this._regex(this._extractRegexp(op, queryPart['$options']), key));
            break loop;
          case '$gte':
            filters.push(hi.compare(key, _.gte, op));
            break;
          case '$lte':
            filters.push(hi.compare(key, _.lte, op));
            break;
          case '$gt':
            filters.push(hi.compare(key, _.gt, op));
            break;
          case '$lt':
            filters.push(hi.compare(key, _.lt, op));
            break;
          case '$elemMatch':
            filters.push(_.flow([hi.collect(key, true), _.map(hi.and(this._compilePredicates(op))), _.some(Boolean)]));
            break;
          case '$exists':
            filters.push(hi.exists(key, op));
            break;
          case '$not':
            filters.push(_.negate(this._compilePart(key, op)));
            break;
          default:
            throw new Error('No support for: ' + queryPartType);
        }
      }
      break;
    case 'RegExp':
      filters.push(this._regex(queryPart, key));
      break;
    case 'Array':
      switch (key) {
        case '$or':
          filters.push(
            // OR
            hi.or(this._subQuery(queryPart))
          );
          break;
        case '$and':
          filters.push(hi.and(this._subQuery(queryPart)));
          break;
        default:
          throw new Error('No support for: ' + key);
      }
      break;
    // primitives
    case 'Number':
    case 'Boolean':
    case 'String':
    case 'Null':
      filters.push(hi.check(key, _.eq(queryPart)));
      break;
    default:
      throw new Error('Unable to parse query + ' + key + ' | ' + queryPart);
  }
  if (filters.length > 1) {
    filter = hi.and(filters);
  } else {
    filter = filters[0];
  }
  return filter;
};

QueryCompiler.prototype._subQuery = function (queries) {
  var res = _.map(this._compilePredicates.bind(this))(queries);
  // should check if there are bad side effects...
  for (var i = 0; i < res.length; i++) {
    if (res[i].length > 1) {
      res[i] = hi.and(res[i]);
    }
  }

  return _.flatten(res);
};

QueryCompiler.prototype._regex = function regexp(regex, key) {
  return hi.check(key, function (v) {
    return regex.test(v);
  });
};

QueryCompiler.prototype._extractRegexp = function (regex, options) {
  var patternExtractor = /\/?(.*)\/.*/;
  var re = regex;
  if (_.isString(regex)) {
    re = new RegExp(regex, options);
  } else if (_.isRegExp(regex)) {
    if (options) {
      re = regex.toString().match(patternExtractor);
      re = new RegExp(re[1], options);
    }
  } else {
    throw new Error('Wrong with regexp: ' + regex);
  }
  return re;
};

module.exports = QueryCompiler;
