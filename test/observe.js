var should = require('should');

var ViewDb = require('..');
var _ = require('lodash');


describe('Observe', function() {
	it('#observe with insert', function(done) {
		var store = new ViewDb();
		store.open().then(function() {
			var cursor = store.collection('dollhouse').find({});
			var handle = cursor.observe({
				added:function(x) {
					x._id.should.equal('echo');
					done();
				}
			});
			store.collection('dollhouse').insert({_id:'echo'});
		});
	});
	it('#observe with query and insert', function(done) {
		var store = new ViewDb();
		store.open().then(function() {
			store.collection('dollhouse').insert({_id:'echo'});
			var cursor = store.collection('dollhouse').find({_id:'echo2'});
			var handle = cursor.observe({
				added:function(x) {
					x._id.should.equal('echo2');
					done();
				}
			});
			store.collection('dollhouse').insert({_id:'echo2'});
		});
	});	
	it('#observe with query and update', function(done) {
		var store = new ViewDb();
		store.open().then(function() {
				var cursor = store.collection('dollhouse').find({_id:'echo'});
				var handle = cursor.observe({
					added:function(x) {
						x.age.should.equal(10);
						x._id.should.equal('echo');
					}, changed:function(o,n) {
						o.age.should.equal(10);
						n.age.should.equal(100);
						handle.stop();
						done();
					}
				});
			
			store.collection('dollhouse').insert({_id:'echo', age:10}, function() {
				store.collection('dollhouse').save({_id:'echo', age:100});
			});			
		});
	});
	it('#observe with query and skip', function(done) {
		var store = new ViewDb();
		store.open().then(function () {
			store.collection('dollhouse').insert({ _id: 'echo' });
			store.collection('dollhouse').insert({ _id: 'echo2' });
			store.collection('dollhouse').insert({ _id: 'echo3' });
			var cursor = store.collection('dollhouse').find({});
			var skip = 0;
			cursor.limit(1);
			var realDone = _.after(3, function () {
				cursor.toArray(function (err, res) {
					res.length.should.equal(0);
					done();
				})
			});
			var handle = cursor.observe({
				added: function (x) {
					cursor.skip(++skip);
					realDone();
				}
			});
		});
	});
})
