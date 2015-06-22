var InMemoryStore = require('./inmemory/store');

var ViewDB = function(store) {
	this._store = store || new InMemoryStore();
}

ViewDB.prototype.collection = function(collectionName, callback) {
	return this._store.collection(collectionName, callback);
};

module.exports = ViewDB;