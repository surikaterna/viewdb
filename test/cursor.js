var Cursor = require('../lib/cursor');
var should = require('should');

describe('Cursor', function () {
  it('#toArray', function (done) {
    var cursor = new Cursor(null, {}, null, function (query, callback) {
      callback(null, [1, 2, 3, 4]);
    });
    cursor.toArray(function (err, result) {
      result.length.should.equal(4);
      done();
    });
  });
  it('#forEach', function (done) {
    var cursor = new Cursor(null, {}, null, function (query, callback) {
      callback(null, [1, 2, 3, 4]);
    });
    var calls = 0;
    cursor.forEach(function (result) {
      result.should.be.ok;
      calls++;
    });
    setTimeout(function () {
      calls.should.equal(4);
      done();
    }, 0);
  });
  describe('#skip', function () {
    it.only('should skip x number of documents', function () {
      var cursor = new Cursor(null, {}, null, function (query, callback) {
        callback(null, [1, 2, 3, 4]);
      });
      cursor.skip(2);
      cursor.toArray(function(res) {
        res.length.should.equal(2);
      });
    });
  });
})