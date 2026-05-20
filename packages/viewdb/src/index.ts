import ViewDB from './viewdb';
import Cursor from './cursor';
import Observer from './observe';
import merge from './merger';
import InMemoryStore from './inmemory/store';
import * as plugins from './plugins';

export { ViewDB, Cursor, Observer, merge, InMemoryStore, plugins };
export type {
  VDocument,
  QueryObject,
  SortSpec,
  ProjectionSpec,
  Callback,
  MergeOptions,
  ObserveOptions,
  ObserveHandle,
  GetDocumentsFn,
  CollectionLike
} from './types';
