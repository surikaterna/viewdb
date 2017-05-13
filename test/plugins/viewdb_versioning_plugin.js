var should = require('should');
var _ = require('lodash');

var ViewDb = require('../..');
var ViewDbVersioningPlugin = require('../..').plugins.VersioningPlugin;

describe('Viewdb versioning plugin', function () {
  it('should add version on insert', function (done) {
    var viewDb = new ViewDb();
    new ViewDbVersioningPlugin(viewDb);
    var obj = { id: '123' };

    var collection = viewDb.collection('test');
    collection.insert(obj);

    collection.find({ id: '123' }).toArray(function (err, objects) {
      var object = objects[0];

      object.version.should.equal(0);
      done();
    });
  });
  it('should add version on builk insert', function (done) {
    var viewDb = new ViewDb();
    new ViewDbVersioningPlugin(viewDb);

    var collection = viewDb.collection('test');
    collection.insert([{ id: '123' }, { id: '999' }]);

    collection.find({}).toArray(function (err, objects) {
      objects[0].version.should.equal(0);
      objects[1].version.should.equal(0);
      done();
    });
  });
  it('should increase version on save', function (done) {
    var viewDb = new ViewDb();
    new ViewDbVersioningPlugin(viewDb);
    var obj = { id: '123' };

    var collection = viewDb.collection('test');
    collection.insert(obj);
    obj.name = 'Pelle';
    collection.save(obj);

    collection.find({ id: '123' }).toArray(function (err, objects) {
      var object = objects[0];
      object.version.should.equal(1);
      object.name.should.equal('Pelle');
      done();
    });
  });

  it('should increase version on bulk save', function (done) {
    var viewDb = new ViewDb();
    new ViewDbVersioningPlugin(viewDb);

    var collection = viewDb.collection('test');
    collection.insert([{ _id: '123', version: 10 }, { _id: '999', version: 101 }]);
    collection.find({}).toArray(function (err, objects) {
      _.forEach(objects, function (o, i) {
        o.name = i === 0 ? 'Pelle' : 'Kalle';
      })
      collection.save(objects, function () {
        collection.find({}).toArray(function (err, objects) {
          objects[0].version.should.equal(12) // add 1 version for insert and one for save
          objects[0].name.should.equal('Pelle');
          objects[1].version.should.equal(103);
          objects[1].name.should.equal('Kalle');
          done();
        });
      });
    });
  });
  it('should skip changing version with skipVersioning option on save', function (done) {
    var viewDb = new ViewDb();
    new ViewDbVersioningPlugin(viewDb);
    var obj = { id: '123' };

    var collection = viewDb.collection('test');
    collection.insert(obj);
    obj.name = 'Pelle';
    collection.save(obj, {skipVersioning: true});

    collection.find({ id: '123' }).toArray(function (err, objects) {
      var object = objects[0];
      object.version.should.equal(0); // still version 0
      object.name.should.equal('Pelle');
      done();
    });
  });  
  it('should add version on save', function (done) {
    var viewDb = new ViewDb();
    new ViewDbVersioningPlugin(viewDb);
    var obj = { id: '123' };

    var collection = viewDb.collection('test');
    collection.insert(obj);
    obj.name = 'Pelle';
    obj.version = undefined;
    collection.save(obj);

    collection.find({ id: '123' }).toArray(function (err, objects) {
      var object = objects[0];
      object.version.should.equal(0);
      object.name.should.equal('Pelle');
      done();
    });
  });


})