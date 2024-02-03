var Promise = require('bluebird');
var _ = require('lodash');
var uuid = require('node-uuid').v4;
var Kuery = require('kuery');
var Cursor = require('viewdb').Cursor;
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var Collection = function (db, name) {
  EventEmitter.call(this);
  this._db = db;
  this._name = name;
}

util.inherits(Collection, EventEmitter);

Collection.Cursor = Cursor;

Collection.prototype._isIdentityQuery = function (query, options) {
  var keys = Object.keys(query);
  if (keys.length === 1 && (keys[0] === 'id' || keys[0] === '_id') && (typeof query['id'] === 'string' || typeof query['_id'] === 'string')) {
    return true;
  } else {
    return false;
  }
}

Collection.prototype.find = function (query, options) {
  if (this._isIdentityQuery(query)) {
    return new Cursor(this, { query: query }, options, this._getByKey.bind(this));
  } else {
    return new Cursor(this, { query: query }, options, this._getDocuments.bind(this));
  }
};

Collection.prototype._getKey = function (document) {
  return this._name + "_" + document['_id'];
}

Collection.prototype.insert = function (documents, options, callback) {
  return this._write('add', documents, options, callback);
}

Collection.prototype._write = function (op, documents, options, callback) {
  var self = this;
  if (_.isFunction(options)) {
    callback = options;
    options = null;
  }

  if (!_.isArray(documents)) {
    documents = [documents];
  }

  return new Promise(function (resolve, reject) {
    var txn = self._db.transaction(['documents'], 'readwrite');
    var docs = txn.objectStore('documents');

    txn.oncomplete = txn.onsuccess = function () {
      self.emit("change", documents);
      process.nextTick(function () {
        resolve(documents);
      });
    }

    txn.onerror = function (event) {
      reject(new Error(event));
    }
    var currentIndex = 0;
    var numberOfDocs = documents.length;
    function addNext() {
      var document = documents[currentIndex++];
      if (!_.has(document, '_id')) {
        document['_id'] = document['id'] || uuid();
      }
      document.$collection = self._name;
      document.$collectionKey = self._getKey(document);
      var request = docs[op](document);
      request.onsuccess = function () {
        if (currentIndex < numberOfDocs) {
          addNext();
        }
      };
      request.onerror = function (event) {
        reject(new Error(event));
      };
    }
    addNext();
  }).nodeify(callback);
}


Collection.prototype.save = function (documents, options, callback) {
  return this._write('put', documents, options, callback);
}

Collection.prototype.drop = function (callback) {
  var txn = this._db.transaction(['documents'], 'readwrite');
  var docs = txn.objectStore('documents');
  var cursor = docs.index('$collection').openCursor(this._name);
  cursor.onerror = function (event) {
    if (callback) {
      callback(new Error(event));
    } else {
      console.log(event);
    }
  };
  cursor.onsuccess = function (event) {
    var c = event.target.result;
    if (c) {
      c.delete();
      c.continue();
    } else {
      if (callback) {
        callback(null);
      }
    }
  }
};

Collection.prototype.remove = function (query, options, callback) {
  var self = this;
  if (_.isFunction(options)) {
    callback = options;
    options = null;
  }
  if (!callback) {
    callback = function () {
    };
  }

  this._getDocuments(query, function (err, res) {
    if (err) {
      callback(err);
    } else {
      var txn = self._db.transaction(['documents'], 'readwrite');
      txn.oncomplete = txn.onsuccess = function () {
        self.emit("change", { remove: query });
        callback(null);
      }

      txn.onerror = function (event) {
        callback(new Error(event));
      }
      var docs = txn.objectStore('documents');
      _.forEach(res, function (doc) {
        var key = self._getKey(doc);
        var delReq = docs.delete(key);
        // delReq.onsuccess = delReq.onerror = delReq.oncomplete =  function() {
        // }
      });
    }
  });
};

Collection.prototype._getDocuments = function (query, callback) {
  var qry = query.query || query;
  var txn = this._db.transaction(['documents'], 'readonly');
  var docs = txn.objectStore('documents');
  var cursor = docs.index('$collection').openCursor(this._name);
  var result = [];
  cursor.onerror = function (event) {
    callback(new Error(event));
  };
  cursor.onsuccess = function (event) {
    var c = event.target.result;
    if (c) {
      result.push(c.value);
      c.continue();
    } else {
      var q = new Kuery(qry);
      query.sort && q.sort(query.sort);
      query.skip && q.skip(query.skip);
      query.limit && q.limit(query.limit);
      callback(null, q.find(result));
    }
  }
};
Collection.prototype._getByKey = function (query, callback) {
  var qry = query.query || query;
  var txn = this._db.transaction(['documents'], 'readonly');
  var docs = txn.objectStore('documents');
  var key = qry['id'] || qry['_id'];
  key = this._name + "_" + key;
  var request = docs.get(key);
  request.onsuccess = function (event) {
    var result = [];
    if (request.result !== undefined) {
      result.push(request.result)
    }
    callback(null, result);

  }
  request.onerror = function (event) {
    callback(new Error('Unable to _getByKey ' + key));
  }
};
module.exports = Collection;