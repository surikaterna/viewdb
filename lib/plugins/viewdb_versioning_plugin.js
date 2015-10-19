var _ = require('lodash');

var ViewDBVersioningPlugin = function(viewDb) {
	var oldCollection = viewDb.collection;		
	viewDb.collection = function() {
		var coll = oldCollection.apply(this,arguments);
		if(!coll.__plugins_versioning) {
			coll.__plugins_versioning = true;
			var oldSave = coll.save;
			coll.save = function(doc) {
				doc.version = _getVersion(doc.version);
				oldSave.apply(this,arguments);
			} 
			var oldInsert = coll.insert;
			coll.insert = function(doc) {
				doc.version = _getVersion(doc.version);
				oldInsert.apply(this,arguments);
			} 
		}
		return coll;
	}
}

function _getVersion(version) {
	var newVersion;
	if(_.isUndefined(version)) {
		newVersion = 0;
	} else {
		newVersion = version + 1;
	}
	
	return newVersion;
}

module.exports = ViewDBVersioningPlugin;