var _ = require('lodash');
var merge = require('../lib/merger');

var logger = {
	added: function() { console.log("added: "); console.log(arguments); },
	removed: function() { console.log("removed: "); console.log(arguments); },
	changed: function() { console.log("changed: "); console.log(arguments); },
	moved: function() { console.log("moved: "); console.log(arguments); },
}

describe('Merger', () => {
	it('#merge with remove element', done => {
		var l1 = [{a:1}, 'b', 'd'];
		var l2 = [{a:1}, 'b'];

		var res = merge(l1,l2, {
			removed: function(e) {
				expect(e).toBe('d');
				done();
			},
			comparatorId: _.isEqual,
			comparator: _.isEqual
		});
		expect(_.isEqual(l2, res)).toBe(true);

//		console.log(_.difference(l1,l2));
	});
	it('#merge with remove complex element', done => {
		var l1 = [{a:1}, 'b', 'd', {e:1}];
		var l2 = [{a:1}, 'b'];
		var removed = [];
		var res = merge(l1,l2, {
			removed: function(e) {
				removed.push(e);
			},
			comparatorId: _.isEqual,
			comparator: _.isEqual
		});
		expect(removed.length).toBe(2);
		expect(_.isEqual(l2, res)).toBe(true);
		done();

//		console.log(_.difference(l1,l2));
	});

	it('#merge with objects instead of arrays', done => {
		var l1 = {"0":{a:1}, "1":'b', "2":'d', "3":{e:1}};
		var l2 = [{a:1}, 'b'];
		var removed = [];
		var res = merge(l1,l2, {
			removed: function(e) {
				removed.push(e);
			},
			comparatorId: _.isEqual,
			comparator: _.isEqual
		});
		expect(removed.length).toBe(2);
		expect(_.isEqual(l2, res)).toBe(true);
		done();

//		console.log(_.difference(l1,l2));
	});


	it('#merge with one add element', done => {
		var l1 = [{a:1}, 'b'];
		var l2 = [{a:1}, 'b', 'c'];

		var res = merge(l1,l2, {
			added: function(e) {
				expect(e).toBe('c');
				done();
			},
			removed: function(e) {
				done(new Error('should not be called'));
			}
		});
		expect(_.isEqual(l2, res)).toBe(true);
	});
	it('#merge with one complex add element', done => {
		var l1 = [{a:1}, 'b'];
		var l2 = [{a:1}, 'b', {c:1}];

		var res = merge(l1,l2, {
			added: function(e) {
				expect(_.isEqual(e,{c:1})).toBe(true);
				done();
			},
			removed: function(e) {
				done(new Error('should not be called'));
			}
		});
		expect(_.isEqual(l2, res)).toBe(true);
	});
	it('#merge with one move element', done => {
		var l1 = [{a:1}, 'b', {c:1}];
		var l2 = [{a:1}, {c:1}, 'b'];
		var moved = [];
		var res = merge(l1,l2, {
			added: function(e) {
				done(new Error('should not be called'));
			},
			removed: function(e) {
				done(new Error('should not be called'));
			},
			moved: function(e, oldIndex, newIndex) {
				moved.push(arguments);
			}
		});
		expect(moved.length).toBe(1);

		expect(_.isEqual(l2, res)).toBe(true);

		done();
	});
	it('#merge with one changing elements', done => {
		var l1 = [{_id:1, a:'Hello'}];
		var l2 = [{_id:1, a:'Hej'}];
		var res = merge(l1,l2, {
			added: function(e) {
				done(new Error('should not be called'));
			},
			removed: function(e) {
				done(new Error('should not be called'));
			},
			moved: function(e, oldIndex, newIndex) {
				done(new Error('should not be called'));
			},
			changed: function(o, n, index) {
			},
			comparatorId: function(a,b) {return a._id === b._id}
		});
		expect(_.isEqual(l2, res)).toBe(true);
		done();
	});

	it('#merge true and false array', done => {
		var l1 = [true, false];
		var l2 = [false, true];
		var res = merge(l1,l2);
		expect(_.isEqual(l2, res)).toBe(true);
		done();
	});
	it('#merge complex moves', done => {
		var l1 = [{_id:1, a:'Hello1'}, {_id:2, a:'Hello2'}, {_id:3, a:'Hello3'}, {_id:4, a:'Hello4'}];
		var l2 = [{_id:4, a:'Hej4'}, {_id:3, a:'Hej3'}, {_id:2, a:'Hej2'}, {_id:1, a:'Hej1'}];

		var res = merge(l1,l2, _.defaults({comparatorId:  function(a,b) {return a._id === b._id}}, {}));
		expect(_.isEqual(l2, res)).toBe(true);
		done();
	});
	it('#merge complex moves and add and remove', done => {
		var l1 = [{_id:1, a:'Hello1'}, {_id:2, a:'Hello2'}, {_id:3, a:'Hello3'}, {_id:4, a:'Hello4'}];
		var l2 = [{_id:4, a:'Hej4'}, {_id:99, a:'Hej99'}, {_id:2, a:'Hej2'}, {_id:1, a:'Hej1'}, {_id:100, a:'Hej100'}];

		var res = merge(l1,l2, _.defaults({comparatorId:  function(a,b) {return a._id === b._id}}, {}));
		expect(_.isEqual(l2, res)).toBe(true);
		done();
	});

})

