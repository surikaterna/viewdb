import { clone, isArray } from 'lodash';
import ViewDB, {
  FindAndModifyCallback,
  FindAndModifyOptions,
  FindAndModifyResult,
  MaybeArray,
  Nullable,
  Query,
  SortQuery,
  WriteCallback,
  WriteOptions
} from '..';
import { BaseDocument, Collection } from '../Collection';
import { addPlugin, addProperties } from '../plugins/Plugin';

export default class ViewDBTimestampPlugin {
  constructor(viewDb: ViewDB) {
    mutateCollection(viewDb);
  }
}

interface WithTimeStamp {
  timestamp: boolean;
}

export interface WithDateTimeData {
  createDateTime: number;
  changeDateTime: number;
}

function mutateCollection(viewDb: ViewDB) {
  const oldCollection = viewDb.collection<any>;
  viewDb.collection = (...args) => {
    const collection = addPlugin<ReturnType<typeof oldCollection>, WithTimeStamp>(oldCollection.apply(viewDb, args));

    if (!collection.__plugins_timestamp) {
      collection.__plugins_timestamp = true;

      mutateSave(collection);
      mutateInsert(collection);
      mutateFindAndModify(collection);
    }

    return collection;
  };
}

function mutateFindAndModify<Document extends BaseDocument = Record<string, any>>(collection: Collection<Document>) {
  const oldFindAndModify = collection.findAndModify;

  function findAndModify(query: Query, sort: Nullable<SortQuery>, update: Query): Promise<FindAndModifyResult<Document>>;
  function findAndModify(query: Query, sort: Nullable<SortQuery>, update: Query, options: FindAndModifyOptions): Promise<FindAndModifyResult<Document>>;
  function findAndModify(
    query: Query,
    sort: Nullable<SortQuery>,
    update: Query,
    options: Nullable<FindAndModifyOptions>,
    cb: FindAndModifyCallback<Document>
  ): void;
  function findAndModify(
    query: Query,
    sort: Nullable<SortQuery>,
    update: Query,
    options?: Nullable<FindAndModifyOptions>,
    cb?: FindAndModifyCallback<Document>
  ): Promise<FindAndModifyResult<Document>> | void {
    const timestamp = new Date().valueOf();
    const clonedUpdate = clone(update);
    const setOnInsert = clonedUpdate.$setOnInsert || {};
    setOnInsert.createDateTime = timestamp;
    clonedUpdate.$setOnInsert = setOnInsert;

    const set = clonedUpdate.$set || {};
    set.changeDateTime = timestamp;

    // if consumer tries to $set createDateTime it will lead to conflict. remove it
    if (set.createDateTime) {
      delete set.createDateTime;
    }

    clonedUpdate.$set = set;
    oldFindAndModify.apply(collection, [query, sort, clonedUpdate, options, cb]);
  }

  collection.findAndModify = findAndModify;
}

function mutateInsert<Document extends BaseDocument = Record<string, any>>(collection: Collection<Document>) {
  const oldInsert = collection.insert;

  function insert(documents: MaybeArray<Document>): Promise<Array<Document>>;
  function insert(documents: MaybeArray<Document>, callback: WriteCallback<Document>): void;
  function insert(documents: MaybeArray<Document>, options: WriteOptions): Promise<Array<Document>>;
  function insert(documents: MaybeArray<Document>, options: WriteOptions, callback: WriteCallback<Document>): void;
  function insert(
    documents: MaybeArray<Document>,
    options?: WriteOptions | WriteCallback<Document>,
    callback?: WriteCallback<Document>
  ): Promise<Array<Document>> | void {
    if (!(options && 'skipTimestamp' in options)) {
      if (!isArray(documents)) {
        documents = [documents];
      }

      const timestamp = new Date().valueOf();

      for (let i = 0; i < documents.length; i++) {
        const doc = addProperties<Document, WithDateTimeData>(documents[i]);
        doc.createDateTime = timestamp;
        doc.changeDateTime = timestamp;
      }
    }

    oldInsert.apply(collection, [documents, options, callback]);
  }

  collection.insert = insert;
}

function mutateSave<Document extends BaseDocument = Record<string, any>>(collection: Collection<Document>) {
  const oldSave = collection.save;

  function save(documents: MaybeArray<Document>): Promise<Array<Document>>;
  function save(documents: MaybeArray<Document>, callback: WriteCallback<Document>): void;
  function save(documents: MaybeArray<Document>, options: WriteOptions): Promise<Array<Document>>;
  function save(documents: MaybeArray<Document>, options: WriteOptions, callback: WriteCallback<Document>): void;
  function save(
    documents: MaybeArray<Document>,
    options?: WriteOptions | WriteCallback<Document>,
    callback?: WriteCallback<Document>
  ): Promise<Array<Document>> | void {
    if (!(options && 'skipTimestamp' in options)) {
      const timestamp = new Date().valueOf();
      const newDocs = isArray(documents) ? documents : [documents];

      for (let i = 0; i < newDocs.length; i++) {
        const doc = addProperties<Document, WithDateTimeData>(newDocs[i]);

        if (!doc.createDateTime) {
          doc.createDateTime = timestamp;
        }

        doc.changeDateTime = timestamp;
      }
    }

    oldSave.apply(collection, [documents, options, callback]);
  }

  collection.save = save;
}
