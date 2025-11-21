import forEach from "lodash/forEach";
import isArray from "lodash/isArray";
import isObject from "lodash/isObject";
import omit from "lodash/omit";
import type { Document } from "mongodb";

function includeKey(key: unknown): boolean {
  return key === "1" || key === true || key === 1;
}

function excludeKey(key: unknown): boolean {
  return key === "0" || key === false || key === 0;
}

function projectLayer<T extends object = Document, U extends object = Document>(document: T, projectObject: U): U {
  let projectedLayer = {} as U;
  const deletionKeys: string[] = [];

  forEach(projectObject, (value, key) => {
    if (excludeKey(value)) {
      deletionKeys.push(key);
    }
  });

  if (deletionKeys.length > 0) {
    projectedLayer = omit(document, deletionKeys) as U;
  }

  forEach(projectObject, (value, key) => {
    if (isArray(document[key])) {
      projectedLayer[key] = document[key].map((arrayValue) => {
        return projectLayer(arrayValue, projectObject[key]);
      });
    } else if (isObject(value)) {
      projectedLayer[key] = projectLayer(document[key], value);
    } else if (includeKey(value)) {
      projectedLayer[key] = document[key];
    }
  });

  return projectedLayer;
}

/**
 * Performs a MongoDb $project
 * @param {object} document MongoDb like document
 * @param {object} projectObject MongoDb like project object
 * @returns projected version of the document
 */
export function projectDocument<T extends object = Document, U extends object = Document>(document: T, projectObject: U): U {
  return projectLayer(document, projectObject);
}
