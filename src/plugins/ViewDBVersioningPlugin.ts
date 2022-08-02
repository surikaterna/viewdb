import { isArray, isUndefined } from 'lodash';

export default class ViewDBVersioningPlugin {
  constructor(viewDb) {
    mutateCollection(viewDb);
  }
}

function mutateCollection(viewDb) {
  const oldCollection = viewDb.collection;
  viewDb.collection = function () {
    const collection = oldCollection.apply(this, arguments);
    if (!collection.__plugins_versioning) {
      collection.__plugins_versioning = true;

      mutateFindAndModify(collection);
      mutateInsert(collection);
      mutateSave(collection);
    }
    return collection;
  };
}

function mutateFindAndModify(collection) {
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

    oldFindAndModify.apply(collection, arguments);
  };
}

function mutateInsert(collection) {
  const oldInsert = collection.insert;
  collection.insert = function (docs, options) {
    setVersions(docs, options);
    oldInsert.apply(collection, arguments);
  };
}

function mutateSave(collection) {
  const oldSave = collection.save;
  collection.save = function (docs, options) {
    setVersions(docs, options);
    oldSave.apply(this, arguments);
  };
}

function setVersions(docs, options) {
  if (!(options && options.skipVersioning)) {
    if (!isArray(docs)) {
      docs = [docs];
    }

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      doc.version = getNewVersion(doc.version);
    }
  }
}

function getNewVersion(version) {
  return isUndefined(version) ? 0 : version + 1;
}
