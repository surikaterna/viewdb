var should = require('should');

var ViewDb = require('../..');
var ViewDbVersioningPlugin = require('../..').plugins.VersioningPlugin;

describe('Viewdb versioning plugin', function() {
	it('should add version on insert', function(done) {
		var viewDb = new ViewDb();
		new ViewDbVersioningPlugin(viewDb);
		var obj = {id: '123'};
		
		var collection = viewDb.collection('test');
		collection.insert(obj);
		
		collection.find({id: '123'}).toArray(function(err, objects) {
			var object = objects[0];
			
			object.version.should.equal(0);
			done();
		});
	});
	it('should increase version on save', function(done) {
		var viewDb = new ViewDb();
		new ViewDbVersioningPlugin(viewDb);
		var obj = {id: '123'};
		
		var collection = viewDb.collection('test');
		collection.insert(obj);
		obj.name = 'Pelle';
		collection.save(obj);
		
		collection.find({id: '123'}).toArray(function(err, objects) {
			var object = objects[0];
			object.version.should.equal(1);
			object.name.should.equal('Pelle');
			done();
		});
	});
	
	it('should add version on save', function(done) {
		var viewDb = new ViewDb();
		new ViewDbVersioningPlugin(viewDb);
		var obj = {id: '123'};
		
		var collection = viewDb.collection('test');
		collection.insert(obj);
		obj.name = 'Pelle';
		obj.version = undefined;
		collection.save(obj);
		
		collection.find({id: '123'}).toArray(function(err, objects) {
			var object = objects[0];
			object.version.should.equal(0);
			object.name.should.equal('Pelle');
			done();
		});
	});
	
		
})