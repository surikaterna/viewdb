var _ = require('lodash');

var ViewDBTimestampPlugin = function(viewDb) {
	var oldCollection = viewDb.collection;		
	viewDb.collection = function() {
		var coll = oldCollection.apply(this, arguments);
		if(!coll.__plugins_timestamp) {
			coll.__plugins_timestamp = true;
			var oldSave = coll.save;
			coll.save = function(doc) {
				doc.lastModified = new Date().valueOf();
				oldSave.apply(this, arguments);
			};
			var oldInsert = coll.insert;
			coll.insert = function(doc) {
				doc.lastModified = new Date().valueOf();
				oldInsert.apply(this,arguments);
			} 
		}
		return coll;
	}
};

module.exports = ViewDBTimestampPlugin;
