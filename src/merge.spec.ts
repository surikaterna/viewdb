import { defaults, isEqual } from 'lodash';
import merge from './merge';

type StringOrObj = string | Record<string, any>;

describe('Merger', () => {
  it('#merge with remove element', (done) => {
    const list1: ArrayLike<StringOrObj> = [{ a: 1 }, 'b', 'd'];
    const list2: ArrayLike<StringOrObj> = [{ a: 1 }, 'b'];

    const res = merge(list1, list2, {
      removed: (element) => {
        expect(element).toBe('d');
        done();
      },
      comparatorId: isEqual,
      comparator: isEqual
    });
    expect(res).toEqual(list2);
  });

  it('#merge with remove complex element', () => {
    const list1: ArrayLike<StringOrObj> = [{ a: 1 }, 'b', 'd', { e: 1 }];
    const list2: ArrayLike<StringOrObj> = [{ a: 1 }, 'b'];
    const removed = [];
    const res = merge(list1, list2, {
      removed: (element) => {
        removed.push(element);
      },
      comparatorId: isEqual,
      comparator: isEqual
    });
    expect(removed.length).toBe(2);
    expect(res).toEqual(list2);
  });

  it('#merge with objects instead of arrays', () => {
    const list1: ArrayLike<StringOrObj> = { '0': { a: 1 }, '1': 'b', '2': 'd', '3': { e: 1 }, length: 4 };
    const list2: ArrayLike<StringOrObj> = [{ a: 1 }, 'b'];
    const removed = [];
    const res = merge(list1, list2, {
      removed: (element) => {
        removed.push(element);
      },
      comparatorId: isEqual,
      comparator: isEqual
    });
    expect(removed.length).toBe(2);
    expect(res).toEqual(list2);
  });

  it('#merge with one add element', (done) => {
    const list1: ArrayLike<StringOrObj> = [{ a: 1 }, 'b'];
    const list2: ArrayLike<StringOrObj> = [{ a: 1 }, 'b', 'c'];

    const res = merge(list1, list2, {
      added: (element) => {
        expect(element).toBe('c');
        done();
      },
      removed: () => {
        done(new Error('should not be called'));
      }
    });
    expect(res).toEqual(list2);
  });

  it('#merge with one complex add element', (done) => {
    const list1: ArrayLike<StringOrObj> = [{ a: 1 }, 'b'];
    const list2: ArrayLike<StringOrObj> = [{ a: 1 }, 'b', { c: 1 }];

    const res = merge(list1, list2, {
      added: (element) => {
        expect(element).toEqual({ c: 1 });
        done();
      },
      removed: () => {
        done(new Error('should not be called'));
      }
    });
    expect(res).toEqual(list2);
  });

  it('#merge with one move element', (done) => {
    const list1: ArrayLike<StringOrObj> = [{ a: 1 }, 'b', { c: 1 }];
    const list2: ArrayLike<StringOrObj> = [{ a: 1 }, { c: 1 }, 'b'];
    const moved = [];
    const res = merge(list1, list2, {
      added: () => {
        done(new Error('should not be called'));
      },
      removed: () => {
        done(new Error('should not be called'));
      },
      moved: (element) => {
        moved.push(element);
      }
    });
    expect(moved.length).toBe(1);

    expect(res).toEqual(list2);

    done();
  });

  it('#merge with one changing elements', (done) => {
    const list1: ArrayLike<StringOrObj> = [{ _id: 1, a: 'Hello' }];
    const list2: ArrayLike<StringOrObj> = [{ _id: 1, a: 'Hej' }];
    const res = merge(list1, list2, {
      added: () => {
        done(new Error('should not be called'));
      },
      removed: () => {
        done(new Error('should not be called'));
      },
      moved: () => {
        done(new Error('should not be called'));
      },
      changed: () => {},
      comparatorId: (a: Record<string, any>, b: Record<string, any>) => {
        return a._id === b._id;
      }
    });
    expect(res).toEqual(list2);
    done();
  });

  it('#merge true and false array', () => {
    const list1 = [true, false];
    const list2 = [false, true];
    const res = merge(list1, list2);
    expect(res).toEqual(list2);
  });

  it('#merge complex moves', () => {
    const list1: ArrayLike<Record<string, any>> = [
      { _id: 1, a: 'Hello1' },
      { _id: 2, a: 'Hello2' },
      { _id: 3, a: 'Hello3' },
      { _id: 4, a: 'Hello4' }
    ];
    const list2: ArrayLike<Record<string, any>> = [
      { _id: 4, a: 'Hej4' },
      { _id: 3, a: 'Hej3' },
      { _id: 2, a: 'Hej2' },
      { _id: 1, a: 'Hej1' }
    ];

    const res = merge(
      list1,
      list2,
      defaults(
        {
          comparatorId: (a: Record<string, any>, b: Record<string, any>) => {
            return a._id === b._id;
          }
        },
        {}
      )
    );
    expect(res).toEqual(list2);
  });

  it('#merge complex moves and add and remove', () => {
    const list1: ArrayLike<Record<string, any>> = [
      { _id: 1, a: 'Hello1' },
      { _id: 2, a: 'Hello2' },
      { _id: 3, a: 'Hello3' },
      { _id: 4, a: 'Hello4' }
    ];
    const list2: ArrayLike<Record<string, any>> = [
      { _id: 4, a: 'Hej4' },
      { _id: 99, a: 'Hej99' },
      { _id: 2, a: 'Hej2' },
      { _id: 1, a: 'Hej1' },
      { _id: 100, a: 'Hej100' }
    ];

    const res = merge(
      list1,
      list2,
      defaults(
        {
          comparatorId: (a: Record<string, any>, b: Record<string, any>) => {
            return a._id === b._id;
          }
        },
        {}
      )
    );
    expect(res).toEqual(list2);
  });
});
