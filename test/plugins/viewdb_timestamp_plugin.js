var should = require('should');
var ViewDb = require('../..');
var ViewDbTimestampPlugin = require('../..').plugins.TimestampPlugin;
var ViewDBVersioningPlugin = require('../..').plugins.VersioningPlugin;

describe('Viewdb timestamp plugin', function () {
  it('should add changeDateTime and createDateTime timestamp on insert', function (done) {
    var viewDb = new ViewDb();
    new ViewDbTimestampPlugin(viewDb);
    new ViewDBVersioningPlugin(viewDb);
    var obj = { id: '123' };
    var collection = viewDb.collection('test');
    var currentTime = (new Date().valueOf());

    // wait 1ms until update operation to check for lastModified updated
    setTimeout(function () {
      collection.insert(obj);
      collection.find({ id: '123' }).toArray(function (err, objects) {
        var object = objects[0];
        should.exists(object.createDateTime);
        if (currentTime < object.createDateTime) {
          done();
        } else {
          done(new Error('Timestamp was not renewed'))
        }
      });
    }, 1);
  });

  it('should update changeDateTime on save', function (done) {
    var viewDb = new ViewDb();
    new ViewDbTimestampPlugin(viewDb);
    new ViewDBVersioningPlugin(viewDb);
    var obj = { id: '123' };
    var insertTime;
    var collection = viewDb.collection('test');

    collection.insert(obj);
    collection.find({ id: '123' }).toArray(function (err, objects) {
      var object = objects[0];
      insertTime = object.createDateTime;
    });

    // wait 1ms until update operation to check for changeDateTime updated
    setTimeout(function () {
      obj.name = 'Pelle';
      collection.save(obj);
      collection.find({ id: '123' }).toArray(function (err, objects) {
        var object = objects[0];
        object.createDateTime.should.equal(insertTime);
        object.changeDateTime.should.greaterThan(insertTime);
        done();
      });
    }, 1)
  });

  it('should work together with version plugin', function (done) {
    var viewDb = new ViewDb();
    new ViewDbTimestampPlugin(viewDb);
    new ViewDBVersioningPlugin(viewDb);
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
      should.exists(object.createDateTime);
      should.exists(object.changeDateTime);
      done();
    });
  });
});
