import { isArray } from 'lodash';
import ViewDB from '..';
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
  collection.findAndModify = (query, sort, update, options, cb) => {
    if (!(options && options.skipVersioning)) {
      const inc = update.$inc || {};
      inc.version = 1;
      update.$inc = inc;

      if (update.$set && update.$set.version >= 0) {
        delete update.$set.version;
      }
    }

    oldFindAndModify.apply(collection, [query, sort, update, options, cb]);
  };
}

function mutateInsert<Document extends BaseDocument = Record<string, any>>(collection: Collection<Document>) {
  const oldInsert = collection.insert;
  collection.insert = (docs, options, callback) => {
    setVersions(docs, options);
    oldInsert.apply(collection, [docs, options, callback]);
  };
}

function mutateSave<Document extends BaseDocument = Record<string, any>>(collection: Collection<Document>) {
  const oldSave = collection.save;
  collection.save = (docs, options, callback) => {
    setVersions(docs, options);
    oldSave.apply(collection, [docs, options, callback]);
  };
}

function setVersions<Document>(docs: MaybeArray<Document>, options?: WriteOptions) {
  if (!(options && options.skipVersioning)) {
    if (!isArray(docs)) {
      docs = [docs];
    }

    for (let i = 0; i < docs.length; i++) {
      const doc = addProperties<Document, WithVersion>(docs[i]);
      doc.version = getNewVersion(doc.version);
    }
  }
}

const getNewVersion = (version?: number): number => version === undefined ? 0 : version + 1;
