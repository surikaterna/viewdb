import _ = require('lodash');
import { MergeOptions } from './types';

function contains<T>(list: T[], element: T, comparator: (a: T, b: T) => boolean): T | undefined {
  for (const i in list) {
    const n = list[i];
    if (comparator(element, n)) {
      return n;
    }
  }
  return undefined;
}

function merge<T>(asis: T[] | null, tobe: T[], options?: MergeOptions<T>): T[] {
  options = options || {};
  const comparator = options.comparator || _.isEqual;
  const comparatorId = options.comparatorId || comparator;
  const list = _.slice(asis as T[]);

  // check removed
  _.forEach(asis, function (e: T) {
    const found = contains(tobe, e, comparatorId);
    if (found === undefined) {
      const index = list.indexOf(e);
      list.splice(index, 1);
      if (options!.removed) {
        options!.removed(e, index);
      }
    }
  });

  let indexInNew = -1;
  _.forEach(tobe, function (e: T) {
    indexInNew++;
    const found = contains(list, e, comparatorId);
    // added
    if (found === undefined) {
      list.splice(indexInNew, 0, e);
      if (options!.added) {
        options!.added(e, indexInNew);
      }
    } else {
      // existed before
      const indexInOld = list.indexOf(found);
      if (indexInOld !== indexInNew) {
        // remove
        list.splice(indexInOld, 1);
        // add
        list.splice(indexInNew, 0, e);
        if (options!.moved) {
          options!.moved(e, indexInOld, indexInNew);
        }
      }
      if (!comparator(found, e)) {
        list[indexInNew] = e;
        if (options!.changed) {
          options!.changed(found, e, indexInNew);
        }
      }
    }
  });
  return list;
}

export = merge;
