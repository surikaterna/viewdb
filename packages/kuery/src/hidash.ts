import __ from "lodash";
import _ from "lodash/fp";

function __logN(name: string) {
  return (v: any) => {
    console.log(`>>(${name}) `, v);
    return v;
  };
}

function __log(v: any) {
  console.log(">>", v);
  return v;
}

function or(predicates: any[]) {
  return (v: any) => {
    for (let i = 0; i < predicates.length; i++) {
      if (predicates[i](v)) {
        return true;
      }
    }

    return false;
  };
}

function and(predicates: any[]) {
  return (v: any) => {
    for (let i = 0; i < predicates.length; i++) {
      if (!predicates[i](v)) {
        return false;
      }
    }

    return true;
  };
}

function check(key: string, op: any) {
  return key.indexOf(".") !== -1
    ? (v: any) => {
        const collected = hi.collect(key)(v);
        if (_.isArray(collected) && collected.length === 0) {
          return op(undefined);
        }

        return _.some(op)(collected);
      }
    : (v: any) => {
        if (!v) {
          return op(undefined);
        }

        return op(v[key]);
      };
}

function compare(key: string, op: any, arg: any) {
  return hi.check(key, op(_, arg));
}

function exists(key: string, op: any) {
  return hi.check(key, (v: any) => {
    return op ? !!v : !v;
  });
}

/**
 * Traverse an object/array graph and collect all elements matching {key}
 * @param {string} key path for all elements to collect
 * @returns an array of all elements collected
 */
function collect(key: string, lastPathMustBeArray?: boolean) {
  return (v: any) => {
    const path = key.split(".");
    const res = [];
    hi._collect(res, v, path, lastPathMustBeArray);
    return res;
  };
}

function _collect(result: any, object: any, path: any, lastPathMustBeArray?: boolean) {
  let index = 0;
  const length = path.length;
  let element = object;

  if (_.isArray(object)) {
    __.forEach(object, (e) => {
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
}

const hi = {
  __logN,
  __log,
  or,
  and,
  check,
  compare,
  exists,
  collect,
  _collect,
};

export default hi;
