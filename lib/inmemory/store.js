var Collection = require('./collection');

var Store = function() {
	this._collections = {};
};

Store.prototype.collection = function(collectionName, callback) {
	var coll = this._collections[collectionName];
	if(coll === undefined) {
		coll = new Collection(collectionName);
		this._collections[collectionName] = coll;
	}
	if(callback) {
		callback(coll);
	}
	return coll;
};

module.exports = Store;
