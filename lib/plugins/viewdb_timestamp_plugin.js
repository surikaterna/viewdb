var ViewDBTimestampPlugin = function (viewDb) {
  var oldCollection = viewDb.collection;
  viewDb.collection = function () {
    var coll = oldCollection.apply(this, arguments);
    if (!coll.__plugins_timestamp) {
      coll.__plugins_timestamp = true;
      var timestamp = new Date().valueOf();

      var oldSave = coll.save;
      coll.save = function (doc) {
        if (!doc.createDateTime) {
          doc.createDateTime = timestamp;
        }
        doc.changeDateTime = timestamp;
        oldSave.apply(this, arguments);
      };

      var oldInsert = coll.insert;
      coll.insert = function (doc) {
        doc.createDateTime = timestamp;
        doc.changeDateTime = timestamp;
        oldInsert.apply(this, arguments);
      }

      var oldFindAndModify = coll.findAndModify;
      coll.findAndModify = function (query, sort, update, options, cb) {
        var setOnInsert = update.$setOnInsert || {};
        setOnInsert.createDateTime = timestamp;
        update.$setOnInsert = setOnInsert;

        var set = update.$set || {};
        set.changeDateTime = timestamp;
        update.$set = set;
        oldFindAndModify.apply(this, arguments);
      }
    }
    return coll;
  }
};

module.exports = ViewDBTimestampPlugin;
