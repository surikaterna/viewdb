import _ from "lodash/fp";
import { type AnyFunction, QueryCompiler } from "./QueryCompiler";
import type { Document, Filter, QueryOptions, SortObject } from "./types";

export class Kuery<T extends Document = Document> {
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: The type is used in methods
  private readonly compiledQuery: AnyFunction;
  private readonly queryOptions: QueryOptions;

  constructor(query: Filter<T> = {}) {
    this.compiledQuery = new QueryCompiler<T>().compile(query);
    this.queryOptions = {};
  }

  skip(skip: number) {
    this.queryOptions.skip = skip;
    return this;
  }

  limit(limit: number) {
    this.queryOptions.limit = limit;
    return this;
  }

  sort(sortObject: SortObject) {
    this.queryOptions.sort = sortObject;
    return this;
  }

  find(collection: T[]): T[] {
    const queryFuncs = [this.compiledQuery];

    if (this.queryOptions.sort) {
      const sortKeys = _.keys(this.queryOptions.sort);
      const sortDir = _.map((key: string) => (this.queryOptions.sort[key] > 0 ? "asc" : "desc"))(sortKeys);
      queryFuncs.push(_.orderBy(sortKeys, sortDir));
    }

    if (this.queryOptions.skip) {
      queryFuncs.push(_.drop(this.queryOptions.skip));
    }

    if (this.queryOptions.limit) {
      queryFuncs.push(_.take(this.queryOptions.limit));
    }

    const queryFunc = queryFuncs.length > 1 ? _.flow(queryFuncs) : queryFuncs[0];
    return queryFunc(collection);
  }

  findOne(collection: T[]): T {
    const result = this.find(collection);
    if (result.length !== 1) {
      throw new Error(`findOne returned ${result.length} results.`);
    }

    return result[0];
  }
}
