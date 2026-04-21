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

function removeAt<T>(list: T[], indexMap: Map<T, number>, index: number): void {
  const removed = list[index];
  list.splice(index, 1);
  indexMap.delete(removed);
  for (let i = index; i < list.length; i++) {
    indexMap.set(list[i], i);
  }
}

function insertAt<T>(list: T[], indexMap: Map<T, number>, index: number, element: T): void {
  list.splice(index, 0, element);
  for (let i = index; i < list.length; i++) {
    indexMap.set(list[i], i);
  }
}

function merge<T>(asis: T[] | null, tobe: T[], options?: MergeOptions<T>): T[] {
  options = options || {};
  const comparator = options.comparator || _.isEqual;
  const comparatorId = options.comparatorId || comparator;
  const list = _.slice(asis as T[]);
  const indexMap = new Map<T, number>();
  list.forEach((e, i) => indexMap.set(e, i));

  // check removed
  _.forEach(asis, function (e: T) {
    const found = contains(tobe, e, comparatorId);
    if (found === undefined) {
      const index = indexMap.get(e)!;
      removeAt(list, indexMap, index);
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
      insertAt(list, indexMap, indexInNew, e);
      if (options!.added) {
        options!.added(e, indexInNew);
      }
    } else {
      // existed before
      const indexInOld = indexMap.get(found)!;
      if (indexInOld !== indexInNew) {
        // remove
        removeAt(list, indexMap, indexInOld);
        // add
        insertAt(list, indexMap, indexInNew, e);
        if (options!.moved) {
          options!.moved(e, indexInOld, indexInNew);
        }
      }
      if (!comparator(found, e)) {
        indexMap.delete(found);
        list[indexInNew] = e;
        indexMap.set(e, indexInNew);
        if (options!.changed) {
          options!.changed(found, e, indexInNew);
        }
      }
    }
  });
  return list;
}

export = merge;
