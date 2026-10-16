import { documentId } from '../deltaCache';
import type { DocumentId } from '../deltaProtocol';

export interface ServerDocument {
  [key: string]: unknown;
}

export interface ServerCursor {
  setReadPreference?(value: unknown): ServerCursor;
  sort(value: Record<string, unknown>): ServerCursor;
  limit(value: number): ServerCursor;
  skip(value: number): ServerCursor;
  project?(value: Record<string, unknown>): ServerCursor;
  toArray(callback: (error: Error | null, documents?: ServerDocument[]) => void): void;
  close(callback: (error: Error | null) => void): void;
}

export interface ServerViewDb {
  collection(name: string): { find(query: Record<string, unknown>): ServerCursor };
}

export interface StableQueryConfig {
  viewdb: ServerViewDb;
  collection: string;
  query: Record<string, unknown>;
  sort?: Record<string, unknown>;
  limit?: number;
  skip?: number;
  project?: Record<string, unknown>;
  readPreference?: unknown;
  revision: number;
}

export function projectionWithIdentity(project: Record<string, unknown>): Record<string, unknown> {
  if (project._id !== 0 && project._id !== false) return project;
  var adjusted: Record<string, unknown> = {};
  var includesFields = Object.keys(project).some(function (key) {
    return key !== '_id' && (project[key] === 1 || project[key] === true);
  });
  Object.keys(project).forEach(function (key) {
    if (key !== '_id') adjusted[key] = project[key];
  });
  if (includesFields) adjusted._id = 1;
  return adjusted;
}

function queryCursor(shared: StableQueryConfig): ServerCursor {
  var cursor = shared.viewdb.collection(shared.collection).find(shared.query);
  if (shared.readPreference !== undefined && cursor.setReadPreference) cursor.setReadPreference(shared.readPreference);
  if (shared.sort) cursor.sort(shared.sort);
  if (shared.limit !== undefined) cursor.limit(shared.limit);
  if (shared.skip !== undefined) cursor.skip(shared.skip);
  if (shared.project) {
    if (cursor.project) cursor.project(projectionWithIdentity(shared.project));
    else throw new Error('Cursor does not support the observer projection');
  }
  return cursor;
}

function publicDocuments(documents: ServerDocument[], hideIdentity: boolean): { documents: ServerDocument[]; identities: Array<DocumentId | undefined> } {
  var identities: Array<DocumentId | undefined> = [];
  var visible: ServerDocument[] = documents.map(function (document) {
    identities.push(documentId(document));
    if (!hideIdentity || !('_id' in document)) return document;
    var copy: ServerDocument = {};
    Object.keys(document).forEach(function (key) {
      if (key !== '_id') copy[key] = document[key];
    });
    return copy;
  });
  return { documents: visible, identities: identities };
}

export function queryStable(
  shared: StableQueryConfig,
  retries: number,
  callback: (error: Error | null, documents?: ServerDocument[], identities?: Array<DocumentId | undefined>) => void
): void {
  var revision = shared.revision;
  var cursor: ServerCursor;
  try {
    cursor = queryCursor(shared);
  } catch (error) {
    callback(error instanceof Error ? error : new Error(String(error)));
    return;
  }
  cursor.toArray(function (error: Error | null, documents?: ServerDocument[]) {
    cursor.close(function (_closeError: Error | null) {});
    if (!error && revision !== shared.revision && retries > 0) queryStable(shared, retries - 1, callback);
    else if (error || revision !== shared.revision) callback(error || new Error('Observer changed during recovery'));
    else if (documents) {
      var result = publicDocuments(documents, Boolean(shared.project && (shared.project._id === 0 || shared.project._id === false)));
      callback(null, result.documents, result.identities);
    } else callback(null, documents);
  });
}
