import { isArray, clone } from 'lodash';

export var ViewDBTimestampPlugin = function (viewDb: any) {
  var oldCollection = viewDb.collection;
  viewDb.collection = function () {
    var coll = oldCollection.apply(this, arguments);
    if (!coll.__plugins_timestamp) {
      coll.__plugins_timestamp = true;

      var oldSave = coll.save;
      coll.save = function (docs: any, options: any) {
        var newdocs = docs;
        if (!(options && options.skipTimestamp)) {
          var timestamp = new Date().valueOf();
          if (!isArray(docs)) {
            newdocs = [docs];
          }
          for (var i = 0; i < newdocs.length; i++) {
            var doc = newdocs[i];
            if (!doc.createDateTime) {
              doc.createDateTime = timestamp;
            }
            doc.changeDateTime = timestamp;
          }
        }
        oldSave.apply(this, arguments);
      };

      var oldInsert = coll.insert;
      coll.insert = function (docs: any, options: any) {
        if (!(options && options.skipTimestamp)) {
          if (!isArray(docs)) {
            docs = [docs];
          }
          var timestamp = new Date().valueOf();
          for (var i = 0; i < docs.length; i++) {
            var doc = docs[i];
            doc.createDateTime = timestamp;
            doc.changeDateTime = timestamp;
          }
        }
        oldInsert.apply(this, arguments);
      };

      var oldFindAndModify = coll.findAndModify;
      coll.findAndModify = function (query: any, sort: any, update: any, options: any, cb: any) {
        var timestamp = new Date().valueOf();
        var clonedUpdate = clone(update);
        var setOnInsert = clonedUpdate.$setOnInsert || {};
        setOnInsert.createDateTime = timestamp;
        clonedUpdate.$setOnInsert = setOnInsert;

        var set = clonedUpdate.$set || {};
        set.changeDateTime = timestamp;

        // if consumer tries to $set createDateTime it will lead to conflict. remove it
        if (set.createDateTime) {
          delete set.createDateTime;
        }
        clonedUpdate.$set = set;
        oldFindAndModify.apply(this, [query, sort, clonedUpdate, options, cb]);
      };
    }
    return coll;
  };
};

export default ViewDBTimestampPlugin;
