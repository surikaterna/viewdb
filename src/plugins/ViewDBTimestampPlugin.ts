import { clone, isArray } from 'lodash';

export default class ViewDBTimestampPlugin {
  constructor(viewDb) {
    mutateCollection(viewDb);
  }
}

function mutateCollection(viewDb) {
  const oldCollection = viewDb.collection;
  viewDb.collection = function () {
    const collection = oldCollection.apply(viewDb, arguments);

    if (!collection.__plugins_timestamp) {
      collection.__plugins_timestamp = true;

      mutateSave(collection);
      mutateInsert(collection);
      mutateFindAndModify(collection);
    }

    return collection;
  };
}

function mutateFindAndModify(collection) {
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

function mutateInsert(collection) {
  const oldInsert = collection.insert;
  collection.insert = function (docs, options) {
    if (!(options && options.skipTimestamp)) {
      if (!isArray(docs)) {
        docs = [docs];
      }

      const timestamp = new Date().valueOf();

      for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];
        doc.createDateTime = timestamp;
        doc.changeDateTime = timestamp;
      }
    }

    oldInsert.apply(collection, arguments);
  };
}

function mutateSave(collection) {
  const oldSave = collection.save;
  collection.save = function (docs, options) {
    let newDocs = docs;

    if (!(options && options.skipTimestamp)) {
      const timestamp = new Date().valueOf();

      if (!isArray(docs)) {
        newDocs = [docs];
      }

      for (let i = 0; i < newDocs.length; i++) {
        const doc = newDocs[i];

        if (!doc.createDateTime) {
          doc.createDateTime = timestamp;
        }

        doc.changeDateTime = timestamp;
      }
    }

    oldSave.apply(collection, arguments);
  };
}
