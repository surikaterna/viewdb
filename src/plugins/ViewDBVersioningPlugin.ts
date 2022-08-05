import { isArray } from 'lodash';
import ViewDB from '..';
import { BaseDocument, Collection, SaveOptions } from '../Collection';
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
  viewDb.collection = function (...args) {
    const collection = addPlugin<ReturnType<typeof oldCollection>, WithVersioning>(oldCollection.apply(this, args));
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
  collection.findAndModify = function (query, sort, update, options, cb) {
    if (!(options && options.skipVersioning)) {
      const inc = update.$inc || {};
      inc.version = 1;
      update.$inc = inc;

      if (update.$set && update.$set.version >= 0) {
        delete update.$set.version;
      }
    }

    oldFindAndModify.apply(this, [query, sort, update, options, cb]);
  };
}

function mutateInsert<Document extends BaseDocument = Record<string, any>>(collection: Collection<Document>) {
  const oldInsert = collection.insert;
  collection.insert = function (docs, options, callback) {
    setVersions(docs, options);
    oldInsert.apply(this, [docs, options, callback]);
  };
}

function mutateSave<Document extends BaseDocument = Record<string, any>>(collection: Collection<Document>) {
  const oldSave = collection.save;
  collection.save = function (docs, options, callback) {
    setVersions(docs, options);
    oldSave.apply(this, [docs, options, callback]);
  };
}

function setVersions<Document>(docs: Array<Document>, options: SaveOptions) {
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

function getNewVersion(version?: number): number {
  return !version ? 0 : version + 1;
}
