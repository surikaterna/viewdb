import InMemoryStore from "./inmemory/InMemoryStore";
import merge from "./merge";
import * as plugins from "./plugins";
import ViewDB from "./ViewDB";
import ViewDBCursor from "./ViewDBCursor";
import ViewDBObserver from "./ViewDBObserver";

export type {
  Callback,
  Collection,
  CountDocumentsOptions,
  Cursor,
  GetDocumentsFn,
  MergeOptions,
  ObserveHandle,
  ObserveOptions,
  Observer,
  ProjectionSpec,
  QueryObject,
  SortSpec,
  Store,
  VDocument,
} from "./types";
export * from "./utils";
export { InMemoryStore, merge, plugins, ViewDB, ViewDBCursor, ViewDBObserver };
