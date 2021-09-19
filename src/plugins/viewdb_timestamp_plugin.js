var _ = require('lodash');

var ViewDBTimestampPlugin = function (viewDb) {
  var oldCollection = viewDb.collection;
  viewDb.collection = function () {
    var coll = oldCollection.apply(this, arguments);
    if (!coll.__plugins_timestamp) {
      coll.__plugins_timestamp = true;

      var oldSave = coll.save;
      coll.save = function (docs, options) {
        var newdocs = docs;
        if (!(options && options.skipTimestamp)) {
          var timestamp = new Date().valueOf();
          if (!_.isArray(docs)) {
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
      coll.insert = function (docs, options) {
        if (!(options && options.skipTimestamp)) {
          if (!_.isArray(docs)) {
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
      coll.findAndModify = function (query, sort, update, options, cb) {
        var timestamp = new Date().valueOf();
        var clonedUpdate = _.clone(update);
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

module.exports = ViewDBTimestampPlugin;
