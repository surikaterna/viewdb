import _ from "lodash";

function TimestampPlugin(viewDb: any): void {
  const oldCollection = viewDb.collection;
  viewDb.collection = function (this: any) {
    const coll = oldCollection.apply(this, arguments);
    if (!coll.__plugins_timestamp) {
      coll.__plugins_timestamp = true;

      const oldSave = coll.save;
      coll.save = function (this: any, docs: any, options: any) {
        let newdocs = docs;
        if (!options?.skipTimestamp) {
          const timestamp = Date.now();
          if (!_.isArray(docs)) {
            newdocs = [docs];
          }
          for (let i = 0; i < newdocs.length; i++) {
            const doc = newdocs[i];
            if (!doc.createDateTime) {
              doc.createDateTime = timestamp;
            }
            doc.changeDateTime = timestamp;
          }
        }
        return oldSave.apply(this, arguments);
      };

      const oldInsert = coll.insert;
      coll.insert = function (this: any, docs: any, options: any) {
        if (!options?.skipTimestamp) {
          if (!_.isArray(docs)) {
            docs = [docs];
          }
          const timestamp = Date.now();
          for (let i = 0; i < docs.length; i++) {
            const doc = docs[i];
            doc.createDateTime = timestamp;
            doc.changeDateTime = timestamp;
          }
        }
        return oldInsert.apply(this, arguments);
      };

      const oldFindAndModify = coll.findAndModify;
      coll.findAndModify = function (this: any, query: any, sort: any, update: any, options: any, cb: any) {
        const timestamp = Date.now();
        const clonedUpdate = _.clone(update);
        const setOnInsert = clonedUpdate.$setOnInsert || {};
        setOnInsert.createDateTime = timestamp;
        clonedUpdate.$setOnInsert = setOnInsert;

        const set = clonedUpdate.$set || {};
        set.changeDateTime = timestamp;

        if (set.createDateTime) {
          delete set.createDateTime;
        }
        clonedUpdate.$set = set;
        return oldFindAndModify.apply(this, [query, sort, clonedUpdate, options, cb]);
      };

      const oldUpdateMany = coll.updateMany;
      coll.updateMany = function (this: any, query: any, update: any, options: any, cb: any) {
        const timestamp = Date.now();
        const clonedUpdate = _.clone(update);
        const setOnInsert = clonedUpdate.$setOnInsert || {};
        setOnInsert.createDateTime = timestamp;
        clonedUpdate.$setOnInsert = setOnInsert;

        const set = clonedUpdate.$set || {};
        set.changeDateTime = timestamp;

        if (set.createDateTime) {
          delete set.createDateTime;
        }
        clonedUpdate.$set = set;
        return oldUpdateMany.apply(this, [query, clonedUpdate, options, cb]);
      };

      const oldUpdateOne = coll.updateOne;
      coll.updateOne = function (this: any, query: any, update: any, options: any, cb: any) {
        const timestamp = Date.now();
        const clonedUpdate = _.clone(update);
        const setOnInsert = clonedUpdate.$setOnInsert || {};
        setOnInsert.createDateTime = timestamp;
        clonedUpdate.$setOnInsert = setOnInsert;

        const set = clonedUpdate.$set || {};
        set.changeDateTime = timestamp;

        if (set.createDateTime) {
          delete set.createDateTime;
        }
        clonedUpdate.$set = set;
        return oldUpdateOne.apply(this, [query, clonedUpdate, options, cb]);
      };
    }
    return coll;
  };
}

export default TimestampPlugin;
