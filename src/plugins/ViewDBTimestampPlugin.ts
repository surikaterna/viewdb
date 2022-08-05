import { clone, isArray } from 'lodash';
import ViewDB from '..';
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

interface WithDateTimeData {
  createDateTime: number;
  changeDateTime: number;
}

function mutateCollection(viewDb: ViewDB) {
  const oldCollection = viewDb.collection<any>;
  viewDb.collection = function (...args) {
    const collection = addPlugin<ReturnType<typeof oldCollection>, WithTimeStamp>(oldCollection.apply(this, args));

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
  collection.findAndModify = function (query, sort, update, options, cb) {
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
    oldFindAndModify.apply(this, [query, sort, clonedUpdate, options, cb]);
  };
}

function mutateInsert<Document extends BaseDocument = Record<string, any>>(collection: Collection<Document>) {
  const oldInsert = collection.insert;
  collection.insert = function (docs, options, callback) {
    if (!(options && options.skipTimestamp)) {
      if (!isArray(docs)) {
        docs = [docs];
      }

      const timestamp = new Date().valueOf();

      for (let i = 0; i < docs.length; i++) {
        const doc = addProperties<Document, WithDateTimeData>(docs[i]);
        doc.createDateTime = timestamp;
        doc.changeDateTime = timestamp;
      }
    }

    oldInsert.apply(this, [docs, options, callback]);
  };
}

function mutateSave<Document extends BaseDocument = Record<string, any>>(collection: Collection<Document>) {
  const oldSave = collection.save;
  collection.save = function (docs, options, callback) {
    let newDocs = docs;

    if (!(options && options.skipTimestamp)) {
      const timestamp = new Date().valueOf();

      if (!isArray(docs)) {
        newDocs = [docs];
      }

      for (let i = 0; i < newDocs.length; i++) {
        const doc = addProperties<Document, WithDateTimeData>(newDocs[i]);

        if (!doc.createDateTime) {
          doc.createDateTime = timestamp;
        }

        doc.changeDateTime = timestamp;
      }
    }

    oldSave.apply(this, [docs, options, callback]);
  };
}
