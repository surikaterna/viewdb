var _ = require('lodash');
var uuid = require('node-uuid').v4;

var EventEmitter = require('events').EventEmitter;
var util = require('util');

var Kuery = require('kuery');

var Cursor = require('../cursor');

var Collection = function(collectionName) {
	EventEmitter.call(this);

	this._documents = [];
	this._name = collectionName;
}

util.inherits(Collection, EventEmitter);


Collection.prototype.count = function(callback) {
	callback(null, this._documents.length);
};

Collection.prototype.insert = function(document, callback) {
	if(_.isArray(document)) {
		return callback(new Error('cannot store array'));
	}
	if(!_.isObject(document)) {
		return callback(new Error('cannot store non-object'));
	}	
	if(!_.has(document, '_id')) {
		document['_id'] = uuid();
	}
	if(_.findIndex(this._documents, {_id:document['_id']}) !== -1) {
		return callback(Error('Unique constraint!'));
	}
	this._documents.push(document);
	this.emit("change", document);
	if(callback) {
		callback(null, document);
	}
};
	
Collection.prototype.save = function(document, callback) {
	if(!_.has(document, '_id')) {
		return this.insert(document, callback);
	} else {
		var index = _.findIndex(this._documents, function(doc) {return doc['_id'] === document['_id'];});
		if(index != -1) {
			this._documents[index] = document;
			this.emit("change", document);
		} else {
			return callback(new Error('A document with the _id does not exist'));
		}
		if(callback) {
			callback(null, document);	
		}
	}
}

Collection.prototype.drop = function(callback) {
	this._documents = [];
	
	if(callback) {
		callback(null);	
	}
}


Collection.prototype.find = function(query, options){
	return new Cursor(this, query, options, this._getDocuments.bind(this));
}


Collection.prototype._getDocuments = function(query, callback) {
	var q = new Kuery(query);
	callback(null, q.find(this._documents));
};


module.exports = Collection;