import { DocumentId, ObserverDocumentResponse, ObserverSnapshotResponse, WireDocument } from '../deltaProtocol';
import { documentId } from '../deltaCache';
import { VdbSocket } from '../types';
import { cacheDocument, ConsumerCallbacks, emitError, QueryDecorator, ServerRequest, SharedObserver } from './deltaDelivery';
import { ServerDocument, StableQueryConfig, queryStable } from './stableQuery';

export function recoverObserver(
  socket: VdbSocket,
  request: ServerRequest,
  recoveryRequest: { documentId?: unknown },
  consumer: ConsumerCallbacks,
  shared: SharedObserver,
  decorateQuery: QueryDecorator,
  isCurrent: () => boolean
): void {
  var originalQuery = consumer.request.p.observe as Record<string, unknown>;
  decorateQuery(consumer.collection, originalQuery, function (decoratedQuery: Record<string, unknown>) {
    if (!isCurrent()) return;
    var recoveryView: StableQueryConfig = {
      viewdb: shared.viewdb,
      collection: shared.collection,
      query: decoratedQuery,
      sort: shared.sort,
      limit: shared.limit,
      skip: shared.skip,
      project: shared.project,
      readPreference: consumer.readPreference,
      get revision() {
        return shared.revision;
      }
    };
    queryStable(recoveryView, 2, function (error: Error | null, documents?: ServerDocument[], identities?: Array<DocumentId | undefined>) {
      if (!isCurrent()) return;
      if (error || !documents) {
        emitError(socket, request, 'RECOVERY_FAILED', 'Unable to obtain a stable observer result');
        return;
      }
      var sequence = consumer.sequence;
      if (request.p['observe.snapshot']) {
        var wireDocuments: WireDocument[] = [];
        for (var i = 0; i < documents.length; i++) {
          var wireDocument = serializeFullDocument(documents[i]);
          if (!wireDocument) {
            emitError(socket, request, 'RECOVERY_FAILED', 'Observer result contains a document that cannot be serialized');
            return;
          }
          wireDocuments.push(wireDocument);
        }
        wireDocuments.forEach(function (document, index) {
          cacheDocument(socket, consumer, document, identities && identities[index]);
        });
        var snapshot: ObserverSnapshotResponse = { documents: wireDocuments, sequence: sequence };
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
      var wireDocument = serializeFullDocument(documents[found]);
      if (!wireDocument) {
        emitError(socket, request, 'RECOVERY_FAILED', 'Observer document cannot be serialized');
        return;
      }
      cacheDocument(socket, consumer, wireDocument, identities && identities[found]);
      var response: ObserverDocumentResponse = { visible: true, document: wireDocument, index: found, sequence: sequence };
      socket.emit('/vdb/response', { i: request.i, p: response });
    });
  });
}

function serializeFullDocument(document: ServerDocument): WireDocument | undefined {
  try {
    var encoded = JSON.stringify(document);
    if (encoded === undefined) return undefined;
    var decoded = JSON.parse(encoded);
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return undefined;
    return decoded as WireDocument;
  } catch (_error) {
    return undefined;
  }
}
