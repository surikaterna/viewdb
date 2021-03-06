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
      collection.insert(obj, function () {
        collection.find({ id: '123' }).toArray(function (err, objects) {
          var object = objects[0];
          should.exists(object.createDateTime);
          if (currentTime < object.createDateTime) {
            done();
          } else {
            done(new Error('Timestamp was not renewed'))
          }
        });
      });
    }, 5);
  });
  it('should add changeDateTime and createDateTime timestamp on bulk insert', function (done) {
    var viewDb = new ViewDb();
    new ViewDbTimestampPlugin(viewDb);
    new ViewDBVersioningPlugin(viewDb);
    var collection = viewDb.collection('test');
    var currentTime = (new Date().valueOf());

    // wait 1ms until update operation to check for lastModified updated
    setTimeout(function () {
      collection.insert([{ _id: '123' }, { _id: '999' }], function () {
        collection.find({}).toArray(function (err, objects) {
          var object = objects[0];
          var hasError = false;
          objects.forEach(function (object) {
            should.exists(object.createDateTime);
            if (currentTime >= object.createDateTime) {
              hasError = true;
            }
          });
          hasError && done(new Error('Timestamp was not renewed')) || done();
        });
      });
    });
  });
  it('should update changeDateTime on builk save', function (done) {
    var viewDb = new ViewDb();
    new ViewDbTimestampPlugin(viewDb);
    new ViewDBVersioningPlugin(viewDb);
    var collection = viewDb.collection('test');

    collection.insert([{ _id: '123' }, { _id: '999' }]);
    collection.find({}).toArray(function (err, objects) {
      var insertTime = objects[0].createDateTime;
      var updateTime = objects[0].changeDateTime;
      should.exist(insertTime);
      insertTime.should.equal(updateTime);
      setTimeout(function () {
        collection.save([{ _id: '123', name: 'Pelle', createDateTime: insertTime, changeDateTime: insertTime }, { _id: '999', name: 'Kalle', createDateTime: insertTime, changeDateTime: insertTime }], function () {
          collection.find({}).toArray(function (err, objects) {
            objects.forEach(function (object) {
              object.createDateTime.should.equal(insertTime);
              object.changeDateTime.should.greaterThan(insertTime);
            });
            done();
          });
        })
      }, 100);
    });

    // wait 1ms until update operation to check for lastModified updated
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

  it('should skip changing timestamp with skipTimestamp option on save', function (done) {
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
      collection.save(obj, { skipTimestamp: true }, function () {
        collection.find({ id: '123' }).toArray(function (err, objects) {
          var object = objects[0];
          object.createDateTime.should.equal(insertTime);
          object.changeDateTime.should.equal(insertTime);
          done();
        });
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
