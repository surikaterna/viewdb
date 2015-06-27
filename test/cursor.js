var Cursor = require('../lib/cursor');
var should = require('should');

describe('Cursor', function() {
	it('#toArray', function(done) {
		var cursor = new Cursor(null, {}, null, function(query, callback) {
			callback(null, [1,2,3,4]);
		});
		cursor.toArray(function(err, result) {
			result.length.should.equal(4);
			done();
		});
	});
	it('#forEach', function(done) {
		var cursor = new Cursor(null, {}, null, function(query, callback) {
			callback(null, [1,2,3,4]);
		});
		var calls = 0;
		cursor.forEach(function(result) {
			result.should.be.ok;
			calls++;
		});
		setTimeout(function() {
			calls.should.equal(4);
			done();
		}, 0);
	});
})