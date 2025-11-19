import forEach from 'lodash/forEach';
import isEqual from 'lodash/isEqual';
import slice from 'lodash/slice';

type Comparator<T> = (a: T, b: T) => boolean;

function contains<T>(list: T[], element: T, comparator: Comparator<T>): T | undefined {
  for (const item of list) {
    if (comparator(element, item)) {
      return item;
    }
  }
}

type MergeOptions<T> = {
  added?: (element: T, index: number) => void;
  changed?: (oldElement: T, newElement: T, index: number) => void;
  comparator?: Comparator<T>;
  comparatorId?: Comparator<T>;
  moved?: (element: T, from: number, to: number) => void;
  removed?: (element: T, index: number) => void;
};

export function merge<T>(asis: T[], tobe: T[], options: MergeOptions<T> = {}): T[] {
  const comparator = options.comparator || isEqual;
  const comparatorId = options.comparatorId || comparator;
  const list = slice(asis);

  // check removed
  forEach(asis, (e) => {
    const found = contains(tobe, e, comparatorId);

    if (found === undefined) {
      const index = list.indexOf(e);
      list.splice(index, 1);

      options.removed?.(e, index);
    }
  });

  let indexInNew = -1;
  forEach(tobe, function (e) {
    indexInNew++;
    const found = contains(list, e, comparatorId);

    // check added
    if (found === undefined) {
      list.splice(indexInNew, 0, e);
      options.added?.(e, indexInNew);
    } else {
      // existed before
      const indexInOld = list.indexOf(found);

      if (indexInOld !== indexInNew) {
        list.splice(indexInOld, 1);
        list.splice(indexInNew, 0, e);

        options.moved?.(e, indexInOld, indexInNew);
      }

      // not moved
      if (!comparator(found, e)) {
        list[indexInNew] = e;
        options.changed?.(found, e, indexInNew);
      }
    }
  });

  return list;
}
