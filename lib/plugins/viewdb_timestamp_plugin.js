var ViewDBTimestampPlugin = function (viewDb) {
  var oldCollection = viewDb.collection;
  viewDb.collection = function () {
    var coll = oldCollection.apply(this, arguments);
    if (!coll.__plugins_timestamp) {
      coll.__plugins_timestamp = true;
      var oldSave = coll.save;
      coll.save = function (doc) {
        doc.changeDateTime = new Date().valueOf();
        oldSave.apply(this, arguments);
      };
      var oldInsert = coll.insert;
      coll.insert = function (doc) {
        var timestamp = new Date().valueOf();
        doc.createDateTime = timestamp;
        doc.changeDateTime = timestamp;
        oldInsert.apply(this, arguments);
      }
      var oldFindAndModify = coll.findAndModify;
      coll.findAndModify = function (query, sort, update, options, cb) {
        var timestamp = new Date().valueOf();
        var set = update.$set || {};
        var setOnInsert = update.$setOnInsert || {};
        setOnInsert.createDateTime = timestamp;
        set.changeDateTime = timestamp;
        update.$set = set;
        update.$setOnInsert = setOnInsert;
        oldFindAndModify.apply(this,arguments);
      }
    }
    return coll;
  }
};

module.exports = ViewDBTimestampPlugin;
