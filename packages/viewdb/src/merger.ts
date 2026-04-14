import _ = require('lodash');

interface MergeOptions {
  comparator?: (a: any, b: any) => boolean;
  comparatorId?: (a: any, b: any) => boolean;
  added?: (element: any, index: number) => void;
  removed?: (element: any, index: number) => void;
  changed?: (oldElement: any, newElement: any, index: number) => void;
  moved?: (element: any, fromIndex: number, toIndex: number) => void;
}

function contains(list: any[], element: any, comparator: (a: any, b: any) => boolean): any | undefined {
  for (const i in list) {
    const n = list[i];
    if (comparator(element, n)) {
      return n;
    }
  }
  return undefined;
}

function merge(asis: any[] | null, tobe: any[], options?: MergeOptions): any[] {
  options = options || {};
  const comparator = options.comparator || _.isEqual;
  const comparatorId = options.comparatorId || comparator;
  const list = _.slice(asis as any[]);

  // check removed
  _.forEach(asis, function (e: any) {
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
  _.forEach(tobe, function (e: any) {
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
