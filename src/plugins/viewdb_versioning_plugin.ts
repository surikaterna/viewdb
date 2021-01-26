import { isArray, isUndefined } from 'lodash';

export var ViewDBVersioningPlugin = function (viewDb: any) {
  var oldCollection = viewDb.collection;
  viewDb.collection = function () {
    var coll = oldCollection.apply(this, arguments);
    if (!coll.__plugins_versioning) {
      coll.__plugins_versioning = true;

      var oldSave = coll.save;
      coll.save = function (docs: any, options: any) {
        var newdocs = docs;
        if (!(options && options.skipVersioning))
        {
          if (!isArray(docs)) {
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
      coll.insert = function (docs: any, options: any) {
        if (!(options && options.skipVersioning))
        {
          if (!isArray(docs)) {
            docs = [docs];
          }
          for (var i = 0; i < docs.length; i++) {
            var doc = docs[i];
            doc.version = _getVersion(doc.version);
          }
        }
        oldInsert.apply(this, arguments);
      }

      var oldFindAndModify = coll.findAndModify;
      coll.findAndModify = function (_query: any, _sort: any, update: any, options: any, _cb: any) {
        if (!(options && options.skipVersioning)) {
          var inc = update.$inc || {};
          inc.version = 1;
          update.$inc = inc;
          if (update.$set && update.$set.version >= 0) {
            delete update.$set.version;
          }
        }
        oldFindAndModify.apply(this, arguments);
      }
    }
    return coll;
  }
}

function _getVersion(version: any) {
  var newVersion;
  if (isUndefined(version)) {
    newVersion = 0;
  } else {
    newVersion = version + 1;
  }

  return newVersion;
}

export default ViewDBVersioningPlugin;
