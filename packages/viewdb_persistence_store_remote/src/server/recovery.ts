import { DocumentId, ObserverDocumentResponse, ObserverSnapshotResponse, WireDocument } from '../deltaProtocol';
import { documentId } from '../deltaCache';
import { cloneFullDocument } from '../fullDocument';
import { VdbSocket } from '../types';
import { getSharedSnapshotCache } from './sharedSnapshotCache';
import {
  cacheDocument,
  ConsumerCallbacks,
  emitError,
  QueryDecorator,
  rowKeyFor,
  rowKeysFor,
  ServerRequest,
  SharedObserver,
  waitForObserverCommit
} from './deltaDelivery';
import { ServerDocument, StableQueryConfig, queryStable } from './stableQuery';

export type AuthorizedQueryRebinder = (query: Record<string, unknown>, callback: (error: Error | null, shared?: SharedObserver) => void) => void;

export function recoverObserver(
  socket: VdbSocket,
  request: ServerRequest,
  recoveryRequest: { documentId?: unknown },
  consumer: ConsumerCallbacks,
  shared: SharedObserver,
  decorateQuery: QueryDecorator,
  isCurrent: () => boolean,
  rebindAuthorizedQuery: AuthorizedQueryRebinder
): void {
  var originalQuery = consumer.request.p.observe as Record<string, unknown>;
  decorateQuery(consumer.collection, originalQuery, function (decoratedQuery: Record<string, unknown>) {
    if (!isCurrent()) return;
    var continueRecovery = function (currentShared: SharedObserver) {
      var sharedQueryMatches = sameQuery(decoratedQuery, currentShared.query);
      if (consumer.rebindPending && sharedQueryMatches) {
        consumer.rebindPending = false;
        consumer.ready = true;
      }
      var recoveryView: StableQueryConfig = {
        viewdb: currentShared.viewdb,
        collection: currentShared.collection,
        query: decoratedQuery,
        sort: currentShared.sort,
        limit: currentShared.limit,
        skip: currentShared.skip,
        project: currentShared.project,
        get revision() {
          return currentShared.revision;
        }
      };
      var respond = function (documents: ServerDocument[], identities?: Array<DocumentId | undefined>) {
        if (!isCurrent()) return;
        var sequence = consumer.sequence;
        if (request.p['observe.snapshot']) {
          var wireDocuments: WireDocument[] = [];
          for (var index = 0; index < documents.length; index++) {
            var fullDocument = cloneFullDocument(documents[index]);
            if (!fullDocument) {
              emitError(socket, request, 'RECOVERY_FAILED', 'Observer result contains a document that cannot be serialized');
              return;
            }
            wireDocuments.push(fullDocument);
          }
          getSharedSnapshotCache().clear(consumer);
          wireDocuments.forEach(function (document, index) {
            cacheDocument(socket, consumer, document, identities && identities[index]);
          });
          var snapshot: ObserverSnapshotResponse = {
            documents: wireDocuments,
            sequence: sequence,
            rowKeys: rowKeysFor(consumer, documents, identities)
          };
          socket.emit('/vdb/response', { i: request.i, p: snapshot });
          return;
        }
        var found = documents.findIndex(function (document, index) {
          var identity = identities && identities[index];
          return (identity === undefined ? documentId(document) : identity) === recoveryRequest.documentId;
        });
        if (found < 0) {
          var missing: ObserverDocumentResponse = { visible: false, sequence: sequence };
          socket.emit('/vdb/response', { i: request.i, p: missing });
          return;
        }
        var wireDocument = cloneFullDocument(documents[found]);
        if (!wireDocument) {
          emitError(socket, request, 'RECOVERY_FAILED', 'Observer document cannot be serialized');
          return;
        }
        var identity = identities && identities[found];
        if (identity === undefined) identity = documentId(documents[found]);
        cacheDocument(socket, consumer, wireDocument, identity);
        var response: ObserverDocumentResponse = {
          visible: true,
          document: wireDocument,
          index: found,
          sequence: sequence,
          rowKey: rowKeyFor(consumer, identity)
        };
        socket.emit('/vdb/response', { i: request.i, p: response });
      };
      var fail = function () {
        if (isCurrent()) emitError(socket, request, 'RECOVERY_FAILED', 'Unable to obtain a stable observer result');
      };
      var queryAuthorized = function (remaining: number) {
        if (!isCurrent()) return;
        var runQuery = function () {
          if (!isCurrent()) return;
          if (sharedQueryMatches && currentShared.windowed && currentShared.snapshot) {
            respond(currentShared.snapshot, currentShared.snapshotIdentities);
            return;
          }
          var revision = currentShared.revision;
          queryStable(recoveryView, 2, function (error: Error | null, documents?: ServerDocument[], identities?: Array<DocumentId | undefined>) {
            if (!isCurrent()) return;
            if (!error && documents && currentShared.revision === revision && !currentShared.reconciling) {
              respond(documents, identities);
              return;
            }
            if (remaining > 0) {
              queryAuthorized(remaining - 1);
              return;
            }
            fail();
          });
        };
        if (currentShared.windowed) {
          waitForObserverCommit(currentShared, function (stable) {
            if (!isCurrent()) return;
            if (!stable) {
              fail();
              return;
            }
            runQuery();
          });
        } else runQuery();
      };
      queryAuthorized(2);
    };
    if (sameQuery(decoratedQuery, shared.query)) {
      continueRecovery(shared);
      return;
    }
    rebindAuthorizedQuery(decoratedQuery, function (error: Error | null, reboundShared?: SharedObserver) {
      if (!isCurrent()) return;
      if (error || !reboundShared) {
        emitError(socket, request, 'RECOVERY_FAILED', 'Unable to rebind observer to the authorized query');
        return;
      }
      continueRecovery(reboundShared);
    });
  });
}

function sameQuery(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}
