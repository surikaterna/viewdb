import { isArray } from 'lodash';
import ViewDB, {
  FindAndModifyCallback,
  FindAndModifyOptions,
  FindAndModifyResult,
  Nullable,
  Query,
  SortQuery,
  WriteCallback
} from '..';
import { BaseDocument, Collection, MaybeArray, WriteOptions } from '../Collection';
import { addPlugin, addProperties } from '../plugins/Plugin';

export default class ViewDBVersioningPlugin {
  constructor(viewDb: ViewDB) {
    mutateCollection(viewDb);
  }
}

interface WithVersion {
  version: number;
}

interface WithVersioning {
  versioning: boolean;
}

function mutateCollection(viewDb: ViewDB) {
  const oldCollection = viewDb.collection<any>;
  viewDb.collection = (...args) => {
    const collection = addPlugin<ReturnType<typeof oldCollection>, WithVersioning>(oldCollection.apply(viewDb, args));
    if (!collection.__plugins_versioning) {
      collection.__plugins_versioning = true;

      mutateFindAndModify(collection);
      mutateInsert(collection);
      mutateSave(collection);
    }
    return collection;
  };
}

function mutateFindAndModify<Document extends BaseDocument = Record<string, any>>(collection: Collection<Document>) {
  const oldFindAndModify = collection.findAndModify;

  function findAndModify(query: Query, sort: Nullable<SortQuery>, update: Query): Promise<FindAndModifyResult<Document>>;
  function findAndModify(query: Query, sort: Nullable<SortQuery>, update: Query, options: FindAndModifyOptions): Promise<FindAndModifyResult<Document>>;
  function findAndModify(query: Query, sort: Nullable<SortQuery>, update: Query, options: Nullable<FindAndModifyOptions>, cb: FindAndModifyCallback<Document>): void;
  function findAndModify(query: Query, sort: Nullable<SortQuery>, update: Query, options?: Nullable<FindAndModifyOptions>, cb?: FindAndModifyCallback<Document>): Promise<FindAndModifyResult<Document>> | void {
    if (!(options && options.skipVersioning)) {
      const inc = update.$inc || {};
      inc.version = 1;
      update.$inc = inc;

      if (update.$set && update.$set.version >= 0) {
        delete update.$set.version;
      }
    }

    return oldFindAndModify.apply(collection, [query, sort, update, options, cb]);
  }

  collection.findAndModify = findAndModify;
}

function mutateInsert<Document extends BaseDocument = Record<string, any>>(collection: Collection<Document>) {
  const oldInsert = collection.insert;

  function insert(documents: MaybeArray<Document>): Promise<Array<Document>>;
  function insert(documents: MaybeArray<Document>, callback: WriteCallback<Document>): void;
  function insert(documents: MaybeArray<Document>, options: WriteOptions): Promise<Array<Document>>;
  function insert(documents: MaybeArray<Document>, options: WriteOptions, callback: WriteCallback<Document>): void;
  function insert(documents: MaybeArray<Document>, options?: WriteOptions | WriteCallback<Document>, callback?: WriteCallback<Document>): Promise<Array<Document>> | void {
    setVersions(documents, options);
    return oldInsert.apply(collection, [documents, options, callback]);
  }

  collection.insert = insert;
}

function mutateSave<Document extends BaseDocument = Record<string, any>>(collection: Collection<Document>) {
  const oldSave = collection.save;

  function save(documents: MaybeArray<Document>): Promise<Array<Document>>;
  function save(documents: MaybeArray<Document>, callback: WriteCallback<Document>): void;
  function save(documents: MaybeArray<Document>, options: WriteOptions): Promise<Array<Document>>;
  function save(documents: MaybeArray<Document>, options: WriteOptions, callback: WriteCallback<Document>): void;
  function save(documents: MaybeArray<Document>, options?: WriteOptions | WriteCallback<Document>, callback?: WriteCallback<Document>): Promise<Array<Document>> | void {
    setVersions(documents, options);
    return oldSave.apply(collection, [documents, options, callback]);
  }

  collection.save = save;
}

function setVersions<Document>(docs: MaybeArray<Document>, options?: WriteOptions) {
  if (!(options && options.skipVersioning)) {
    const docArray = isArray(docs) ? docs : [docs];

    for (let i = 0; i < docArray.length; i++) {
      const doc = addProperties<Document, WithVersion>(docArray[i]);
      doc.version = getNewVersion(doc.version);
    }
  }
}

const getNewVersion = (version?: number): number => version === undefined ? 0 : version + 1;
