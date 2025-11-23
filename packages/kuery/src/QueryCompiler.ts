import _ from "lodash/fp";
import hi from "./hidash";
import type { Document, Filter } from "./types";

export type AnyFunction = (...args: any[]) => any;

export class QueryCompiler<T extends Document = Document> {
  compile(query: Filter<T>) {
    const filters = this.compilePredicates(query);
    let filtered: AnyFunction;

    if (filters.length === 1) {
      filtered = _.filter(filters[0]);
    } else {
      filtered = _.flow(filters.map((v: any) => _.filter(v)));
    }

    return filtered;
  }

  /**
   * @internal
   */
  compilePredicates(query: Filter<T>): AnyFunction[] {
    const keys = _.keys(query);
    let filters: AnyFunction[] = [];

    // if empty query, operation = clone collection
    if (!keys.length) {
      // @ts-expect-error FIXME
      return _.clone;
    }

    _.forEach((key: string) => {
      filters = filters.concat(this.compilePart(key, query[key]));
    })(keys);

    return filters;
  }

  private compilePart(key: string, queryPart: any): AnyFunction {
    let op: any;
    let queryPartType = null;
    const type = getType(queryPart);
    let filter: AnyFunction;
    const filters = [];

    switch (type) {
      case "Object":
        loop: for (queryPartType in queryPart) {
          op = queryPart[queryPartType];
          switch (queryPartType) {
            case "$eq":
              filters.push(hi.compare(key, _.eq, op));
              break;
            case "$ne":
              filters.push(_.negate(this.compilePart(key, op)));
              break;
            case "$in":
              filters.push(hi.compare(key, _.includes, op));
              break;
            case "$nin":
              filters.push(_.negate(hi.compare(key, _.includes, op)));
              break;
            case "$regex":
              filters.push(this.regex(this.extractRegexp(op, queryPart.$options), key));
              break loop;
            case "$gte":
              filters.push(hi.compare(key, _.gte, op));
              break;
            case "$lte":
              filters.push(hi.compare(key, _.lte, op));
              break;
            case "$gt":
              filters.push(hi.compare(key, _.gt, op));
              break;
            case "$lt":
              filters.push(hi.compare(key, _.lt, op));
              break;
            case "$elemMatch":
              filters.push(_.flow([hi.collect(key, true), _.map(hi.and(this.compilePredicates(op))), _.some(Boolean)]));
              break;
            case "$exists":
              filters.push(hi.exists(key, op));
              break;
            case "$not":
              filters.push(_.negate(this.compilePart(key, op)));
              break;
            default:
              throw new Error(`No support for: ${queryPartType}`);
          }
        }
        break;
      case "RegExp":
        filters.push(this.regex(queryPart, key));
        break;
      case "Array":
        switch (key) {
          case "$or":
            filters.push(
              // OR
              hi.or(this.subQuery(queryPart))
            );
            break;
          case "$and":
            filters.push(hi.and(this.subQuery(queryPart)));
            break;
          default:
            throw new Error(`No support for: ${key}`);
        }
        break;
      // primitives
      case "Number":
      case "Boolean":
      case "String":
      case "Null":
        filters.push(hi.check(key, _.eq(queryPart)));
        break;
      default:
        throw new Error(`Unable to parse query + ${key} | ${queryPart}`);
    }
    if (filters.length > 1) {
      filter = hi.and(filters);
    } else {
      filter = filters[0];
    }
    return filter;
  }

  /**
   * @internal
   */
  subQuery(queries: any) {
    const res: any = _.map(this.compilePredicates.bind(this))(queries);
    // should check if there are bad side effects...
    for (let i = 0; i < res.length; i++) {
      if (res[i].length > 1) {
        res[i] = hi.and(res[i]);
      }
    }

    return _.flatten(res);
  }

  private regex(regex: RegExp, key: string) {
    return hi.check(key, (v: string) => regex.test(v));
  }

  private extractRegexp(regex: RegExp, options?: any) {
    const patternExtractor = /\/?(.*)\/.*/;
    let re = regex;

    if (_.isString(regex)) {
      re = new RegExp(regex, options);
    } else if (_.isRegExp(regex)) {
      if (options) {
        re = new RegExp(regex.toString().match(patternExtractor)[1], options);
      }
    } else {
      throw new Error(`Wrong with regexp: ${regex}`);
    }

    return re;
  }
}

function getType(val: any): string {
  const type = Object.prototype.toString.call(val).substr(8);
  return type.substr(0, type.length - 1);
}
