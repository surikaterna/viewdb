import InMemoryStore from "./inmemory/InMemoryStore";
import merge from "./merge";
import * as plugins from "./plugins";
import ViewDB from "./ViewDB";
import ViewDBCursor from "./ViewDBCursor";
import ViewDBObserver from "./ViewDBObserver";

export type {
  Callback,
  Collection,
  GetDocumentsFn,
  MergeOptions,
  ObserveHandle,
  ObserveOptions,
  ProjectionSpec,
  QueryObject,
  SortSpec,
  VDocument,
} from "./types";
export {
  InMemoryStore,
  merge,
  plugins,
  ViewDB,
  ViewDBCursor,
  ViewDBCursor as Cursor,
  ViewDBObserver,
  ViewDBObserver as Observer,
};
