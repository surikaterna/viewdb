var Collection = require('./collection');

var ViewDB = function() {
	this._collections = {};
}

ViewDB.prototype.collection = function(collectionName) {
	var coll = this._collections[collectionName];
	if(coll === undefined) {
		coll = new Collection(collectionName);
		this._collections[collectionName] = coll;
	}
	return coll;
};

module.exports = ViewDB;