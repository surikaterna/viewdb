var _ = require('lodash');

function contains(list, element, comparator) {
	for(var i in list) {
		var n = list[i];
		if(comparator(element, n)) {
			return n;
		}
	}
	return undefined;
}

function merge(asis, tobe, options) {
	options = options || {};
	var comparator = options.comparator || _.isEqual
	var comparatorId = options.comparatorId || comparator;
	var list = _.slice(asis);
	//check removed
	_.forEach(asis, function(e) {
		var found = contains(tobe, e, comparatorId);
		if(found === undefined) {
			var index = list.indexOf(e);
			list.splice(index, 1);
			if(options.removed) {
				options.removed(e, index);
			}
		}
	});
	var indexInNew = -1;
	_.forEach(tobe, function(e) {
		indexInNew++;
		var found = contains(list, e, comparatorId);
		//added
		if(found === undefined) {
			list.splice(indexInNew, 0, e);
			if(options.added) {
				options.added(e, indexInNew);
			}
		} else {
			//existed before
			var indexInOld = list.indexOf(found);
			if(indexInOld!==indexInNew) {
				//remove
				list.splice(indexInOld, 1);
				//add
				list.splice(indexInNew, 0, e);
				if(options.moved) {
					options.moved(e, indexInOld, indexInNew);
				}
			} //else not moved
			if(!comparator(found, e)) {
				list[indexInNew] = e;
				if(options.changed) {
					options.changed(found, e, indexInNew);
				}
			}

		}
	});
	return list;
	//list = _.exclude()v
}
module.exports=merge;