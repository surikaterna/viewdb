import _ from "lodash";

function _includeKey(key: string | number | boolean): boolean {
  return key === "1" || key === true || key === 1;
}

function _excludeKey(key: string | number | boolean): boolean {
  return key === "0" || key === false || key === 0;
}

function _projectLayer(document: Record<string, any>, projectObject: Record<string, any>): Record<string, any> {
  let projectedLayer: any = {};
  const deletionKeys: string[] = [];

  _.forEach(projectObject, (value: any, key: string) => {
    if (_excludeKey(value)) {
      deletionKeys.push(key);
    }
  });

  if (deletionKeys.length > 0) {
    projectedLayer = _.omit(document, deletionKeys);
  }

  _.forEach(projectObject, (value: any, key: string) => {
    if (_.isArray(document[key])) {
      projectedLayer[key] = document[key].map((arrayValue: any) => _projectLayer(arrayValue, projectObject[key]));
    } else if (_.isObject(value)) {
      projectedLayer[key] = _projectLayer(document[key], value);
    } else if (_includeKey(value)) {
      projectedLayer[key] = document[key];
    }
  });

  return projectedLayer;
}

let nextTick: (cb: () => void) => void;
if (typeof setImmediate === "function") {
  nextTick = setImmediate;
} else if (typeof process === "object" && process && process.nextTick) {
  nextTick = process.nextTick;
} else {
  nextTick = (cb: () => void) => {
    setTimeout(cb, 0);
  };
}

function nodeify<T>(promise: Promise<T>, cb?: Function): Promise<T> | Promise<void> {
  if (typeof cb !== "function") return promise;
  return promise
    .then((res: T) => {
      nextTick(() => {
        cb(null, res);
      });
    })
    .catch((err: Error) => {
      nextTick(() => {
        cb(err);
      });
    });
}

/**
 * Performs a MongoDB $project
 * @param document MongoDB like document
 * @param projectObject MongoDB like project object
 * @returns projected version of the document
 */
function projectDocument(document: Record<string, any>, projectObject: Record<string, any>): Record<string, any> {
  return _projectLayer(document, projectObject);
}

export { nodeify, projectDocument };
