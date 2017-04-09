var _ = require('lodash');

var ViewDBVersioningPlugin = function (viewDb) {
  var oldCollection = viewDb.collection;
  viewDb.collection = function () {
    var coll = oldCollection.apply(this, arguments);
    if (!coll.__plugins_versioning) {
      coll.__plugins_versioning = true;
      var oldSave = coll.save;
      coll.save = function (doc) {
        doc.version = _getVersion(doc.version);
        oldSave.apply(this, arguments);
      }
      var oldInsert = coll.insert;
      coll.insert = function (doc) {
        doc.version = _getVersion(doc.version);
        oldInsert.apply(this, arguments);
      }
      var oldFindAndModify = coll.findAndModify;
      coll.findAndModify = function (query, sort, update, options, cb) {
        var inc = update.$inc || {};
        inc.version = 1;
        update.$inc = inc;
        if (update.$set && update.$set.version >= 0) {
          delete update.$set.version;
        }
        oldFindAndModify.apply(this, arguments);
      }
    }
    return coll;
  }
}

function _getVersion(version) {
  var newVersion;
  if (_.isUndefined(version)) {
    newVersion = 0;
  } else {
    newVersion = version + 1;
  }

  return newVersion;
}

module.exports = ViewDBVersioningPlugin;