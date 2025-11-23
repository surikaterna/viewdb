var _ = require("lodash/fp");
var __ = require("lodash");

var hi = {
  __logN: function (name) {
    return function (v) {
      console.log(">>(" + name + ") ", v);
      return v;
    };
  },
  __log: function (v) {
    console.log(">>", v);
    return v;
  },
  or: function OR(predicates) {
    return function (v) {
      var i;
      for (i = 0; i < predicates.length; i++) {
        if (predicates[i](v)) {
          return true;
        }
      }
      return false;
    };
  },
  and: function AND(predicates) {
    return function (v) {
      var i;
      for (i = 0; i < predicates.length; i++) {
        if (!predicates[i](v)) {
          return false;
        }
      }
      return true;
    };
  },
  check: function check(key, op) {
    var res;
    if (key.indexOf(".") !== -1) {
      res = function (v) {
        var collected = hi.collect(key)(v);
        if (_.isArray(collected) && collected.length === 0) {
          return op(undefined);
        }
        return _.some(op)(collected);
      };
    } else {
      res = function (v) {
        if (!v) {
          return op(undefined);
        }

        return op(v[key]);
      };
    }
    return res;
  },
  compare: function COMP(key, op, arg) {
    return hi.check(key, op(_, arg));
  },
  exists: function exists(key, op) {
    return hi.check(key, function (v) {
      return op ? !!v : !v;
    });
  },
  /**
   * Traverse an object/array graph and collect all elements matching {key}
   * @param {string} key path for all elements to collect
   * @returns an array of all elements collected
   */
  collect: function collect(key, lastPathMustBeArray) {
    return function (v) {
      var path = key.split(".");
      var res = [];
      hi._collect(res, v, path, lastPathMustBeArray);
      return res;
    };
  },
  _collect: function _collect(result, object, path, lastPathMustBeArray) {
    var index = 0;
    var length = path.length;
    var element = object;

    if (_.isArray(object)) {
      __.forEach(object, function (e) {
        hi._collect(result, e, path, lastPathMustBeArray);
      });
    } else {
      while (element !== null && element !== undefined && index < length) {
        element = element[path[index++]];
        if (_.isArray(element)) {
          hi._collect(result, element, __.slice(path, index), path.length > 1 && lastPathMustBeArray);
          element = null;
        } else {
          if (path.length === 1 && lastPathMustBeArray) {
            return;
          }
        }
      }
      if (element) {
        result.push(element);
      }
    }
  },
};

module.exports = hi;
