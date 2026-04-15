// parses mongo sort syntax to lokijs sort syntax
// i.e { 'a.b.c': -1, 'd.e.f': 1 } becomes [['a.b.c', true], ['d.e.f']]
const parseSort = (mongoSort: any) => {
  return Object.keys(mongoSort).map((k) => [k, mongoSort[k] && mongoSort[k] > 0 ? false : true]);
};

export = parseSort;
