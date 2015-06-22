var _ = require('lodash');
var uuid = require('node-uuid').v4;

var Collection = function(collectionName) {
	this._documents = [];
	this._name = collectionName;
}

Collection.prototype.count = function(callback) {
	callback(null, this._documents.length);
};

Collection.prototype.insert = function(document, callback) {
	var err, ids;
	try{
		validateInsert(document);
		if(!_.has(document, '_id')) {
			document['_id'] = uuid();
		}
		
		if(this._findDocument(document['_id'])) {
			throw new Error('Unique constraint!');
		}
		
		this._documents.push(document);
		ids = document;
	}catch(error){
		err = error
	}
	if(callback) {
		callback(err, ids);
	}
};
	
Collection.prototype.save = function(document, callback) {
	var err, ids, stored;
	if(!_.has(document, '_id')) {
		return this.insert(document, callback);
	} else {
		try{
			validateSave(document);
			var index = _.findIndex(this._documents, identityFind);
			if(index != -1) {
				this._documents[index] = document;
			} else {
				throw new Error('A document with the _id does not exist');
			}
			ids = document;
		}catch(error){
			err = error
		}
		callback(err, ids);	
	}
}

Collection.prototype.find = function(query){
	var foundDocuments;
	var err;
	try{
		validateFind(query);
		if(_.isEmpty(query)) {
			foundDocuments = this._documents.slice();
		} else {
			foundDocuments = _.filter(this._documents, _.matches(query));
		}
	}catch(error){
		err = error
		foundDocuments = [];
	}
	return {toArray:function(callback){callback(err, foundDocuments)}};
}

Collection.prototype.cloneDocumentsArray = function(){
	var documents = [];
	_(this._documents).forEach(function(document) {
  		documents.push(document);
	}).value();
	return documents;
}

Collection.prototype._findDocument = function(id){
	return _.find(this._documents, identityFind);
}

var identityFind = function(doc) {return doc['_id'] == id;}

var validateFind = function(document)
{
	if(_.isArray(document)){
		throw new Error('Lists of document is not yet implemented for find');	
	}
}

var validateSave = function(document){
	validateNotEmpty(document);
	validateNotList(document);
}

var validateInsert = function(document){
	validateNotEmpty(document);
	validateNotList(document);
//	validateNotHasId(document);
}

var validateNotEmpty = function(document){
	if(_.isEmpty(document)){
		throw new Error('The inserted document may not be null');
	}
}

var validateNotList = function(document){
	if(_.isArray(document)){
		throw new Error('Insertion of lists is not yet implemented');	
	}	
}

var validateNotHasId = function(document){
	if(_.has(document, '_id')){
		throw new Error('The inserted document may not have an id');	
	}
}



module.exports = Collection;