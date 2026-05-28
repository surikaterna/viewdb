import { forEach, isArray, isObject, omit } from "lodash";
import type { ProjectionSpec, VDocument } from "viewdb";

function _includeKey(key: string | number | boolean): boolean {
  return key === "1" || key === true || key === 1;
}

function _excludeKey(key: string | number | boolean): boolean {
  return key === "0" || key === false || key === 0;
}

function _projectLayer<T extends VDocument = VDocument, U extends VDocument = T>(
  document: T,
  projectObject: Record<string, any>
): U {
  let projectedLayer: any = {};
  const deletionKeys: string[] = [];

  forEach(projectObject, (value: any, key: string) => {
    if (_excludeKey(value)) {
      deletionKeys.push(key);
    }
  });

  if (deletionKeys.length > 0) {
    projectedLayer = omit(document, deletionKeys);
  }

  forEach(projectObject, (value: any, key: string) => {
    if (isArray(document[key])) {
      projectedLayer[key] = document[key].map((arrayValue: any) => _projectLayer(arrayValue, projectObject[key]));
    } else if (isObject(value)) {
      projectedLayer[key] = _projectLayer(document[key], value);
    } else if (_includeKey(value)) {
      projectedLayer[key] = document[key];
    }
  });

  return projectedLayer;
}

/**
 * Performs a MongoDB $project
 * @param document MongoDB like document
 * @param projectObject MongoDB like project object
 * @returns projected version of the document
 */
export function projectDocument<T extends VDocument = VDocument, U extends VDocument = T>(
  document: T,
  projectObject: ProjectionSpec
): U {
  return _projectLayer(document, projectObject);
}
