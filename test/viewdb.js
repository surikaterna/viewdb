var should = require('should');

var ViewDB = require('..');


describe('ViewDB', function() {
	describe('#count', function() {
		it('should return 0 for empty collection', function(done) {
			var db = new ViewDB();
			var collection = db.collection('documents');
	      // Perform a total count command
			collection.count(function(err, count) {
				count.should.equal(0);
				done();
			});
		});	
	});	
	describe('#insert', function() {
		it('should store a document and include it in count', function(done) {
			var db = new ViewDB();
			var collection = db.collection('documents');
 			collection.insert({a:1}, function(err, ids) {
 				should.not.exist(err);
	      // Perform a total count command
				collection.count(function(err, count) {
			    	count.should.equal(1);
			    	done();
			    	//assert.equal(null, err);
					//assert.equal(1, count);
				});
			});
		});
		it('should add id on insert if missing', function(done) {
			var db = new ViewDB();
			var collection = db.collection('documents');
 			collection.insert({a:1}, function(err, ids) {
 				should.exist(ids._id);
 				done();
			});
		});
		it('should fail at storing a previously stored document', function(done) {
			var db = new ViewDB();
			var collection = db.collection('documents');
			collection.insert({'_id':1,a:1});
 			collection.insert({'_id':1,a:1}, function(err, ids) {
 				should.exist(err);
 				done();
			});
		});

		it('should fail at storing an empty document', function(done) {
			var db = new ViewDB();
			var collection = db.collection('documents');
 			collection.insert(1, function(err, ids) {
 				should.exist(err);
 				done();
	      	});
		});
		it('should fail at storing a list of document', function(done) {
			var db = new ViewDB();
			var collection = db.collection('documents');
 			collection.insert([{a:1},{b:2}], function(err, ids) {
 				should.exist(err);
 				done();
	      	});
		});
	});
	describe('#save', function() {
		it('should add id on insert if missing', function(done) {
			var db = new ViewDB();
			var collection = db.collection('documents');
 			collection.save({a:1});
 			collection.save({b:1});
 			collection.count(function(err, result) {
 				result.should.equal(2);
 				done();
 			})
		});
		it('should add document on save', function(done) {
			var db = new ViewDB();
			var collection = db.collection('documents');
 			collection.save({a:1}, function(err, ids) {
 				collection.count(function(err, count) {
				    	count.should.equal(1);
				    	done();
				});
 				//should.exist(ids._id);
 				//done();
			});
		});		
		it('should merge if id exists', function(done) {
			var db = new ViewDB();
			var collection = db.collection('documents');
 			collection.save({a:1}, function(err, ids) {
 				ids['b'] = 2;
 				collection.save(ids, function(err, ids) {
	 				collection.count(function(err, count) {
				    	count.should.equal(1);
				    	done();
					});
				});
 			
			});
		});
	});	
	describe('#find', function() {
		it('find all documents', function(done) {
			var db = new ViewDB();
			var collection = db.collection('documents');
 			collection.insert({a:1}, function(err, ids) {
 				collection.find({}).toArray(function(err, docs) {
 					docs.length.should.equal(1);
 					docs[0].a.should.equal(1);
 					done();
 				});
			});		
 		});
 		it('find one document', function(done) {
			var db = new ViewDB();
			var collection = db.collection('documents');
 			collection.insert({a:1}, function(err, ids) {
 				collection.find({_id:ids._id}).toArray(function(err, docs) {
 					docs.length.should.equal(1);
 					docs[0].a.should.equal(1);
 					done();
 				});
			});		
 		});
 		it('should return empty collection if query does not match', function(done) {
			var db = new ViewDB();
			var collection = db.collection('documents');
 			collection.insert({a:1}, function(err, ids) {
 				collection.find({_id:5}).toArray(function(err, docs) {
 					docs.length.should.equal(0);
 					done();
 				});
			});		
 		});
	});	
});