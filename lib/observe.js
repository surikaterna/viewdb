var _ = require('lodash');
var merge = require('./merger');

var logger = {
	added: function() { console.log("added: "); console.log(arguments); },
	removed: function() { console.log("removed: "); console.log(arguments); },
	changed: function() { console.log("changed: "); console.log(arguments); },
	moved: function() { console.log("moved: "); console.log(arguments); },
}

var Observer = function(query, queryOptions, collection, options) {
	this._query = query;
	this._queryOptions = queryOptions;

	this._options = options;
//this._options = logger;
	this._collection = collection;
	this._cache = [];
	var self = this;
	var listener = function() {
		self.refresh();
	};
	collection.on("change", listener);
	this.refresh();
	return {
		stop: function() {
			this._cache = null;
			collection.removeListener("change", listener);
		}
	}
}

Observer.prototype.refresh = function() {
	var self = this;
	
	this._collection._getDocuments(this._query, function(err, result) {
		var old = self._cache;
/*		
		console.log("REFRESH");
		console.log(old);
		console.log(result);
*/		
		self._cache = merge(old, result, _.defaults({comparatorId:  function(a,b) {return a._id === b._id}}, self._options));
		//rewind cursor for next query...

	});
}

module.exports = Observer;