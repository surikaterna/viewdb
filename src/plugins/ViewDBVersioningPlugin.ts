var _ = require('lodash');

var ViewDBVersioningPlugin = function (viewDb) {
  var oldCollection = viewDb.collection;
  viewDb.collection = function () {
    var coll = oldCollection.apply(this, arguments);
    if (!coll.__plugins_versioning) {
      coll.__plugins_versioning = true;

      var oldSave = coll.save;
      coll.save = function (docs, options) {
        var newdocs = docs;
        if (!(options && options.skipVersioning)) {
          if (!_.isArray(docs)) {
            newdocs = [docs];
          }
          for (var i = 0; i < newdocs.length; i++) {
            var doc = newdocs[i];
            doc.version = _getVersion(doc.version);
          }
        }
        oldSave.apply(this, arguments);
      };

      var oldInsert = coll.insert;
      coll.insert = function (docs, options) {
        if (!(options && options.skipVersioning)) {
          if (!_.isArray(docs)) {
            docs = [docs];
          }
          for (var i = 0; i < docs.length; i++) {
            var doc = docs[i];
            doc.version = _getVersion(doc.version);
          }
        }
        oldInsert.apply(this, arguments);
      };

      var oldFindAndModify = coll.findAndModify;
      coll.findAndModify = function (query, sort, update, options, cb) {
        if (!(options && options.skipVersioning)) {
          var inc = update.$inc || {};
          inc.version = 1;
          update.$inc = inc;
          if (update.$set && update.$set.version >= 0) {
            delete update.$set.version;
          }
        }
        oldFindAndModify.apply(this, arguments);
      };

      var oldUpdateMany = coll.updateMany;
      coll.updateMany = function (query, update, options, cb) {
        if (!(options && options.skipVersioning)) {
          var inc = update.$inc || {};
          inc.version = 1;
          update.$inc = inc;
          if (update.$set && update.$set.version >= 0) {
            delete update.$set.version;
          }
        }
        oldUpdateMany.apply(this, arguments);
      };

      var oldUpdateOne = coll.updateOne;
      coll.updateOne = function (query, update, options, cb) {
        if (!(options && options.skipVersioning)) {
          var inc = update.$inc || {};
          inc.version = 1;
          update.$inc = inc;
          if (update.$set && update.$set.version >= 0) {
            delete update.$set.version;
          }
        }
        oldUpdateOne.apply(this, arguments);
      };
    }
    return coll;
  };
};

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
