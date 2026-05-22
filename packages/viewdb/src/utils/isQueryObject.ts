import type { TypedQuery } from "kuery";
import type { QueryObject, VDocument } from "../types";

export function isQueryObject<T extends VDocument = VDocument>(
  queryObject: QueryObject<T> | TypedQuery<T>
): queryObject is QueryObject<T> {
  return "query" in queryObject;
}
