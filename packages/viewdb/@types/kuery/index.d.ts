declare module 'kuery' {
  type Primitive = string | number | boolean | null | undefined | Date;

  export type Query<T> = {
    [P in keyof T & string]?: T[P] extends Primitive
      ?
          | T[P]
          | {
              $eq?: T[P];
              $ne?: T[P];
              $in?: T[P][];
              $nin?: T[P][];
              $regex?: string | RegExp;
              $gte?: T[P];
              $gt?: T[P];
              $lte?: T[P];
              $lt?: T[P];
              $exists?: boolean;
              $not?: Query<T[P]>;
            }
      : T[P] extends Array<infer U>
      ? Query<U> | { $elemMatch?: Query<U> }
      : Query<T[P]>;
  } & {
    // Support for string paths such as 'identifiers.identifier'
    [key: string]: any;
  } & {
    $and?: Query<T>[];
    $or?: Query<T>[];
  };

  export type QueryOptions = {
    limit?: number;
    skip?: number;
    sort?: SortObject;
  };

  export type QueryObject<T> = QueryOptions & {
    query?: Query<T>;
  };

  export type SortObject = Record<string, 1 | -1>;

  export class Kuery<T> {
    constructor(query: Query<T>);
    find: (coll: T[]) => T[];
    limit(amount: number): void;
    skip(amount: number): void;
    sort(sortObject: SortObject): void;
  }

  export default Kuery;
}
