/**
 * Portions of this file are derived from the @types/mongodb package,
 * licensed under the Apache License, Version 2.0.
 *
 * See the NOTICE file and licenses/apache-2.0.txt for details.
 *
 * Modifications in this file are © Surikat AB.
 */

import type { BSONRegExp, ObjectId } from "bson";

export type Document = Record<string, any>;

type RootFilterOperators<TSchema> = Document & {
  $and?: Filter<TSchema>[];
  $or?: Filter<TSchema>[];
};

export type Filter<TSchema> = {
  [P in keyof WithId<TSchema>]?: Condition<WithId<TSchema>[P]>;
} & RootFilterOperators<WithId<TSchema>>;

type WithId<TSchema> = EnhancedOmit<TSchema, "_id"> & {
  _id: InferIdType<TSchema>;
};

type EnhancedOmit<TRecordOrUnion, KeyUnion> = string extends keyof TRecordOrUnion
  ? TRecordOrUnion
  : TRecordOrUnion extends any
    ? Pick<TRecordOrUnion, Exclude<keyof TRecordOrUnion, KeyUnion>>
    : never;

type InferIdType<TSchema> = TSchema extends {
  _id: infer IdType;
}
  ? Record<any, never> extends IdType
    ? never
    : IdType
  : TSchema extends {
        _id?: infer IdType;
      }
    ? unknown extends IdType
      ? ObjectId
      : IdType
    : ObjectId;

type Condition<T> = AlternativeType<T> | FilterOperators<AlternativeType<T>>;

type AlternativeType<T> = T extends ReadonlyArray<infer U> ? T | RegExpOrString<U> : RegExpOrString<T>;

type RegExpOrString<T> = T extends string ? BSONRegExp | RegExp | T : T;

export type FilterOperators<TValue> = NonObjectIdLikeDocument & {
  $eq?: TValue;
  $gt?: TValue;
  $gte?: TValue;
  $in?: ReadonlyArray<TValue>;
  $lt?: TValue;
  $lte?: TValue;
  $ne?: TValue;
  $nin?: ReadonlyArray<TValue>;
  $not?: TValue extends string ? FilterOperators<TValue> | RegExp : FilterOperators<TValue>;
  $exists?: boolean;
  $regex?: TValue extends string ? RegExp | BSONRegExp | string : never;
  $elemMatch?: Document;
};

type NonObjectIdLikeDocument = {
  [key in keyof ObjectIdLike]?: never;
} & Document;

type ObjectIdLike = {
  id: string | Uint8Array;
  __id?: string;
  toHexString(): string;
};
