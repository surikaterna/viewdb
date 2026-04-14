import _ = require('lodash');

function _includeKey(key: any): boolean {
  return key === '1' || key === true || key === 1;
}

function _excludeKey(key: any): boolean {
  return key === '0' || key === false || key === 0;
}

function _projectLayer(document: any, projectObject: any): any {
  var projectedLayer: any = {};
  var deletionKeys: string[] = [];

  _.forEach(projectObject, function (value: any, key: string) {
    if (_excludeKey(value)) {
      deletionKeys.push(key);
    }
  });

  if (deletionKeys.length > 0) {
    projectedLayer = _.omit(document, deletionKeys);
  }

  _.forEach(projectObject, function (value: any, key: string) {
    if (_.isArray(document[key])) {
      projectedLayer[key] = document[key].map(function (arrayValue: any) {
        return _projectLayer(arrayValue, projectObject[key]);
      });
    } else if (_.isObject(value)) {
      projectedLayer[key] = _projectLayer(document[key], value);
    } else if (_includeKey(value)) {
      projectedLayer[key] = document[key];
    }
  });

  return projectedLayer;
}

var nextTick: (cb: () => void) => void;
if (typeof setImmediate === 'function') {
  nextTick = setImmediate;
} else if (typeof process === 'object' && process && process.nextTick) {
  nextTick = process.nextTick;
} else {
  nextTick = function (cb: () => void) {
    setTimeout(cb, 0);
  };
}

function nodeify(promise: Promise<any>, cb?: Function): Promise<any> {
  if (typeof cb !== 'function') return promise;
  return promise
    .then(function (res: any) {
      nextTick(function () {
        cb(null, res);
      });
    })
    .catch(function (err: any) {
      nextTick(function () {
        cb(err);
      });
    });
}

/**
 * Performs a MongoDb $project
 * @param document MongoDb like document
 * @param projectObject MongoDb like project object
 * @returns projected version of the document
 */
function projectDocument(document: any, projectObject: any): any {
  return _projectLayer(document, projectObject);
}

export { projectDocument, nodeify };
