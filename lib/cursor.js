var _ = require('lodash');
var Observe = require('./observe');

var Cursor = function(collection, query, options, getDocuments) {
	this._collection = collection;
	this._query = query;
	this._options = options;
	this._getDocuments = getDocuments;
}

Cursor.prototype.forEach = function(callback, thiz) {
	var docs = this._getDocuments(this._query, function(err, result){
		_.forEach(result, function(n) {
			callback(result)
		});
	});	
};

Cursor.prototype.toArray = function(callback) {
	var docs = this._getDocuments(this._query, callback);
}

Cursor.prototype.observe = function(options) {
	return new Observe(this, this._collection, options);
};

module.exports = Cursor;