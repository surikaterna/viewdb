import { forEach, isEqual, slice } from 'lodash';
import { Nullable } from './Collection';

export interface MergerOptions<Element> {
  comparator?: Function;
  comparatorId?: Function;

  added?(element: Element, index: number): void;

  changed?(currentElement: Element, newElement: Element, index: number): void;

  moved?(element: Element, oldIndex: number, newIndex: number): void;

  removed?(element: Element, index: number): void;
}

export default function merge<Element>(asis: Nullable<ArrayLike<Element> | undefined>, tobe: ArrayLike<Element>, options: MergerOptions<Element> = {}): Array<Element> {
  const comparator = options.comparator || isEqual;
  const comparatorId = options.comparatorId || comparator;
  const list = slice(asis) as Array<Element>;
  //check removed
  forEach(asis, (e) => {
    const found = contains(tobe, e, comparatorId);
    if (found === undefined) {
      const index = list.indexOf(e);
      list.splice(index, 1);
      if (options.removed) {
        options.removed(e, index);
      }
    }
  });
  let indexInNew = -1;
  forEach(tobe, (e) => {
    indexInNew++;
    const found = contains(list, e, comparatorId);
    //added
    if (found === undefined) {
      list.splice(indexInNew, 0, e);
      if (options.added) {
        options.added(e, indexInNew);
      }
    } else {
      //existed before
      const indexInOld = list.indexOf(found);
      if (indexInOld !== indexInNew) {
        //remove
        list.splice(indexInOld, 1);
        //add
        list.splice(indexInNew, 0, e);
        if (options.moved) {
          options.moved(e, indexInOld, indexInNew);
        }
      } //else not moved
      if (!comparator(found, e)) {
        list[indexInNew] = e;
        if (options.changed) {
          options.changed(found, e, indexInNew);
        }
      }
    }
  });
  return list;
}

function contains<Document>(list: ArrayLike<Document>, element: Document, comparator: Function): Document | undefined {
  for (let i in list) {
    const n = list[i];

    if (comparator(element, n)) {
      return n;
    }
  }
  return undefined;
}
