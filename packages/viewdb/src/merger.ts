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

function mergeWithMap<T>(asis: T[], tobe: T[], options: MergeOptions<T>, keyFn: (e: T) => string): T[] {
  const comparator = options.comparator || _.isEqual;
  const list = _.slice(asis);

  // Build map of tobe keys for O(1) lookup
  const tobeMap = new Map<string, T>();
  for (const e of tobe) {
    tobeMap.set(keyFn(e), e);
  }

  // Build map of current list keys with indices
  const listMap = new Map<string, T>();
  for (const e of asis) {
    listMap.set(keyFn(e), e);
  }

  // check removed
  for (const e of asis) {
    const key = keyFn(e);
    if (!tobeMap.has(key)) {
      const index = list.indexOf(e);
      list.splice(index, 1);
      if (options.removed) {
        options.removed(e, index);
      }
    }
  }

  let indexInNew = -1;
  for (const e of tobe) {
    indexInNew++;
    const key = keyFn(e);
    const found = listMap.get(key);
    // Check if found element is actually still in list (not removed)
    const inList = found !== undefined && list.indexOf(found) !== -1 ? found : undefined;

    if (inList === undefined) {
      // added
      list.splice(indexInNew, 0, e);
      if (options.added) {
        options.added(e, indexInNew);
      }
    } else {
      // existed before
      const indexInOld = list.indexOf(inList);
      if (indexInOld !== indexInNew) {
        list.splice(indexInOld, 1);
        list.splice(indexInNew, 0, e);
        if (options.moved) {
          options.moved(e, indexInOld, indexInNew);
        }
      }
      if (!comparator(inList, e)) {
        list[indexInNew] = e;
        if (options.changed) {
          options.changed(inList, e, indexInNew);
        }
      }
    }
  }
  return list;
}

function merge<T>(asis: T[] | null, tobe: T[], options?: MergeOptions<T>): T[] {
  options = options || {};
  const comparator = options.comparator || _.isEqual;
  const comparatorId = options.comparatorId || comparator;
  const keyFn = options.keyFn;

  if (keyFn) {
    return mergeWithMap(asis as T[], tobe, { ...options, comparator }, keyFn);
  }

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
