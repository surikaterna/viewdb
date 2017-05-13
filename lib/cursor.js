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
};

Cursor.prototype.observe = function(options) {
	return new Observe(this._query, this._options, this._collection, options);
};

Cursor.prototype.skip = function(skip) {
	this._query.skip = skip;
	this._refresh();
	return this;
};

Cursor.prototype.limit = function(limit) {
	this._query.limit = limit;
	this._refresh();
	return this;
};

Cursor.prototype.sort = function(sort) {
	this._query.sort = sort;
	this._refresh();
	return this;
};

Cursor.prototype._refresh = function() {
	this._collection.emit('change',{});
};

Cursor.prototype.rewind = function(options) {
	//NOOP
};

module.exports = Cursor;