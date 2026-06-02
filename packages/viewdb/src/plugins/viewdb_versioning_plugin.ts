import _ from 'lodash';

type ViewDBPlugin = {
  (viewDb: any): void;
  new (viewDb: any): void;
};

function _getVersion(version: number | undefined): number {
  if (_.isUndefined(version)) {
    return 0;
  }
  return version + 1;
}

const ViewDBVersioningPlugin = (function (viewDb: any): void {
  const oldCollection = viewDb.collection;
  viewDb.collection = function (this: any) {
    const coll = oldCollection.apply(this, arguments);
    if (!coll.__plugins_versioning) {
      coll.__plugins_versioning = true;

      const oldSave = coll.save;
      coll.save = function (this: any, docs: any, options: any) {
        let newdocs = docs;
        if (!(options && options.skipVersioning)) {
          if (!_.isArray(docs)) {
            newdocs = [docs];
          }
          for (let i = 0; i < newdocs.length; i++) {
            const doc = newdocs[i];
            doc.version = _getVersion(doc.version);
          }
        }
        return oldSave.apply(this, arguments);
      };

      const oldInsert = coll.insert;
      coll.insert = function (this: any, docs: any, options: any) {
        if (!(options && options.skipVersioning)) {
          if (!_.isArray(docs)) {
            docs = [docs];
          }
          for (let i = 0; i < docs.length; i++) {
            const doc = docs[i];
            doc.version = _getVersion(doc.version);
          }
        }
        return oldInsert.apply(this, arguments);
      };

      const oldFindAndModify = coll.findAndModify;
      coll.findAndModify = function (this: any, query: any, sort: any, update: any, options: any, cb: any) {
        if (!(options && options.skipVersioning)) {
          const inc = update.$inc || {};
          inc.version = 1;
          update.$inc = inc;
          if (update.$set && update.$set.version >= 0) {
            delete update.$set.version;
          }
        }
        return oldFindAndModify.apply(this, arguments);
      };

      const oldUpdateMany = coll.updateMany;
      coll.updateMany = function (this: any, query: any, update: any, options: any, cb: any) {
        if (!(options && options.skipVersioning)) {
          const inc = update.$inc || {};
          inc.version = 1;
          update.$inc = inc;
          if (update.$set && update.$set.version >= 0) {
            delete update.$set.version;
          }
        }
        return oldUpdateMany.apply(this, arguments);
      };

      const oldUpdateOne = coll.updateOne;
      coll.updateOne = function (this: any, query: any, update: any, options: any, cb: any) {
        if (!(options && options.skipVersioning)) {
          const inc = update.$inc || {};
          inc.version = 1;
          update.$inc = inc;
          if (update.$set && update.$set.version >= 0) {
            delete update.$set.version;
          }
        }
        return oldUpdateOne.apply(this, arguments);
      };
    }
    return coll;
  };
}) as unknown as ViewDBPlugin;

export = ViewDBVersioningPlugin;
