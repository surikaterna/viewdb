import _ = require('lodash');
import { Logger } from 'slf';
import { DeltaCacheLimits } from '../deltaProtocol';
import { documentId, normalizeDocument } from '../deltaCache';
import { VdbSocket } from '../types';
import { getObserverStats } from './observerStats';
import {
  cacheDocument,
  changedFor,
  ConsumerCallbacks,
  delivered,
  emitError,
  QueryDecorator,
  reconcileObserver,
  sendChange,
  SharedObserver
} from './deltaDelivery';
import { projectionWithIdentity, ServerDocument, queryStable } from './stableQuery';
import { recoverObserver } from './recovery';
import { getSharedSnapshotCache, viewdbNamespace } from './sharedSnapshotCache';
var LOG = Logger.getLogger('viewdb:remote:server');

interface ObserveRegistration {
  i: number;
  key: string | null;
  consumerId: string | null;
  token: number;
}
interface ServerObserveCallbacks {
  init: (documents: ServerDocument[]) => void;
  added: (document: ServerDocument, index: number) => void;
  removed: (document: ServerDocument, index: number) => void;
  changed: (oldDocument: ServerDocument | null, newDocument: ServerDocument, index: number) => void;
  moved: (document: ServerDocument, oldIndex: number, newIndex: number) => void;
  oplog: boolean;
  batchMs: number;
}

function observeKey(collection: string, query: any, sort?: any, limit?: any, skip?: any, project?: any): string {
  return JSON.stringify({ collection, query, sort, limit, skip, project });
}

function getSharedRegistry(viewdb: any): Map<string, SharedObserver> {
  if (!viewdb._vdbSharedObservers) {
    viewdb._vdbSharedObservers = new Map<string, SharedObserver>();
    viewdb._getObserverStats = function () {
      return getObserverStats(viewdb);
    };
  }
  return viewdb._vdbSharedObservers;
}

function removeConsumer(registry: Map<string, SharedObserver>, key: string, consumerId: string): void {
  var shared = registry.get(key);
  if (!shared) return;
  var consumer = shared.consumers.get(consumerId);
  if (consumer) {
    getSharedSnapshotCache().clear(consumer);
    shared.consumers.delete(consumerId);
  }
  if (shared.consumers.size === 0) {
    if (shared.handle) shared.handle.stop();
    registry.delete(key);
  }
}

function stopRegisteredObserver(registry: Map<string, SharedObserver>, observer: ObserveRegistration): void {
  if (observer.key && observer.consumerId) removeConsumer(registry, observer.key, observer.consumerId);
}

class ViewDbSocketServer {
  static configureDeltaCache(limits: DeltaCacheLimits = {}): void {
    getSharedSnapshotCache().configure(limits);
  }

  static getDeltaCacheStats(): { size: number; bytes: number } {
    return getSharedSnapshotCache().stats();
  }

  constructor(viewdb: any, socket: VdbSocket, queryDecorator?: QueryDecorator, globalLimit?: number, readPreference?: any, batchMs?: number) {
    var namespace = viewdbNamespace(viewdb);
    var _observers: Record<string, ObserveRegistration> = Object.create(null);
    var _queryDecorator: QueryDecorator;
    var _socketId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    var _batchMs = batchMs || 0;
    var _disconnected = false;
    var _cancelledObserves = new Set<string>();
    var _observeRegistrationSeq = 0;

    if (!queryDecorator)
      _queryDecorator = function (_collection, query, callback) {
        callback(query);
      };
    else _queryDecorator = queryDecorator;

    var registry = getSharedRegistry(viewdb);

    socket.on('disconnect', function () {
      _disconnected = true;
      _.forOwn(_observers, function (observer: any, observeId: string) {
        stopRegisteredObserver(registry, observer);
        delete _observers[observeId];
      });
    });

    socket.on('/vdb/request', function (request: any) {
      if (request.p.find) {
        _queryDecorator(request.p.collection, request.p.find, function (decoratedQuery: any) {
          var cursor = viewdb.collection(request.p.collection).find(decoratedQuery);
          if (readPreference && cursor.setReadPreference) {
            cursor.setReadPreference(readPreference);
          }
          if (request.p.sort) {
            cursor.sort(request.p.sort);
          }
          if (_.isNumber(request.p.limit)) {
            cursor.limit(request.p.limit);
          } else if (globalLimit && _.isNumber(globalLimit)) {
            cursor.limit(globalLimit);
          }
          if (_.isNumber(request.p.skip)) {
            cursor.skip(request.p.skip);
          }
          if (request.p.project) {
            if (cursor.project) {
              cursor.project(request.p.project);
            } else {
              console.log('warn: no support for project on cursor');
            }
          }
          cursor.toArray(function (err: Error | null, result: any) {
            if (err) {
              console.log(err);
            } else {
              socket.emit('/vdb/response', {
                i: request.i,
                p: result
              });
            }
          });
        });
      } else if (request.p.count) {
        _queryDecorator(request.p.collection, request.p.count, function (decoratedQuery: any) {
          var cursor = viewdb.collection(request.p.collection).find(decoratedQuery);
          if (readPreference && cursor.setReadPreference) {
            cursor.setReadPreference(readPreference);
          }
          if (_.isNumber(request.p.limit)) {
            cursor.limit(request.p.limit);
          }
          if (_.isNumber(request.p.skip)) {
            cursor.skip(request.p.skip);
          }
          cursor.count(function (err: Error | null, result: any) {
            if (err) {
              console.log(err);
            } else {
              socket.emit('/vdb/response', {
                i: request.i,
                p: result
              });
            }
            cursor.close(function (_err: Error | null) {});
          });
        });
      } else if (request.p.observe) {
        var observeId = request.p.id;
        var existingObserver = _observers[observeId];
        if (existingObserver) {
          LOG.warn('Duplicate observe id replaced %j', {
            observeId: observeId,
            query: request.p.observe,
            requestIndex: request.i,
            socketId: _socketId
          });
          stopRegisteredObserver(registry, existingObserver);
        }
        var registrationToken = ++_observeRegistrationSeq;
        _observers[observeId] = {
          i: request.i,
          key: null,
          consumerId: null,
          token: registrationToken
        };
        _queryDecorator(request.p.collection, request.p.observe, function (decoratedQuery: any) {
          var pendingObserver = _observers[observeId];
          if (_disconnected || !pendingObserver || pendingObserver.token !== registrationToken || _cancelledObserves.has(observeId)) {
            _cancelledObserves.delete(observeId);
            if (pendingObserver && pendingObserver.token === registrationToken) {
              delete _observers[observeId];
            }
            return;
          }
          var effectiveLimit = _.isNumber(request.p.limit) ? request.p.limit : globalLimit && _.isNumber(globalLimit) ? globalLimit : undefined;
          var needsWindow = Boolean(request.p.project || request.p.sort || _.isNumber(request.p.skip) || effectiveLimit !== undefined);

          var key = observeKey(request.p.collection, decoratedQuery, request.p.sort, effectiveLimit, request.p.skip, request.p.project);

          var consumerId = _socketId + ':' + observeId;
          var events = request.p.events || { i: true, a: true, r: true, c: true, m: true };
          var deltaEnabled = request.p.deltaVersion === 1;

          var consumer: ConsumerCallbacks = {
            request: request,
            socket: socket,
            events: events,
            ready: false,
            delta: deltaEnabled,
            collection: request.p.collection,
            namespace: namespace,
            sequence: 0,
            readPreference: readPreference
          };

          var shared = registry.get(key);
          if (shared) {
            const joiningShared = shared;
            // Join existing shared observer - send fresh init to this consumer
            shared.consumers.set(consumerId, consumer);
            _observers[observeId] = { i: request.i, key: key, consumerId: consumerId, token: registrationToken };
            socket.emit('/vdb/response', { i: request.i, p: request.p.deltaVersion === 1 ? { handle: observeId, deltaVersion: 1 } : { handle: observeId } });
            if (shared.snapshot && !shared.initializing && (events.i || consumer.delta)) {
              queryStable(shared, 2, function (err: Error | null, result?: ServerDocument[], identities?: Array<string | number | undefined>) {
                var currentObserver = _observers[observeId];
                if (!currentObserver || currentObserver.token !== registrationToken || !joiningShared.consumers.has(consumerId)) return;
                if (err || !result) {
                  emitError(socket, request, 'RECOVERY_FAILED', 'Unable to obtain observer initialization');
                  removeConsumer(registry, key, consumerId);
                  delete _observers[observeId];
                  return;
                }
                if (consumer.delta) {
                  var docs = result.map(function (doc, index) {
                    return cacheDocument(socket, consumer, doc, identities && identities[index]) || doc;
                  });
                  delivered(socket, consumer, [events.i ? { i: { r: docs } } : { s: { r: docs } }]);
                } else sendChange(socket, { i: { r: result } }, request);
                consumer.ready = true;
              });
            } else if (!events.i && !consumer.delta && !shared.initializing) consumer.ready = true;
          } else {
            // Create new shared observer
            var newShared: SharedObserver = {
              handle: null,
              consumers: new Map(),
              viewdb: viewdb,
              collection: request.p.collection,
              query: decoratedQuery,
              sort: request.p.sort,
              limit: effectiveLimit,
              skip: request.p.skip,
              project: request.p.project,
              readPreference: readPreference,
              revision: 0,
              snapshot: null,
              snapshotIdentities: [],
              windowed: needsWindow,
              pendingChanges: false,
              initializing: true,
              reconciling: false,
              reconcileDirty: false
            };
            newShared.consumers.set(consumerId, consumer);
            registry.set(key, newShared);
            _observers[observeId] = { i: request.i, key: key, consumerId: consumerId, token: registrationToken };
            socket.emit('/vdb/response', { i: request.i, p: request.p.deltaVersion === 1 ? { handle: observeId, deltaVersion: 1 } : { handle: observeId } });

            var cursor = viewdb.collection(request.p.collection).find(decoratedQuery);
            if (readPreference && cursor.setReadPreference) {
              cursor.setReadPreference(readPreference);
            }
            if (request.p.sort) {
              cursor.sort(request.p.sort);
            }
            if (effectiveLimit !== undefined) {
              cursor.limit(effectiveLimit);
            }
            if (_.isNumber(request.p.skip)) {
              cursor.skip(request.p.skip);
            }
            if (request.p.project) {
              cursor.project(projectionWithIdentity(request.p.project));
            }

            var observeOptions: ServerObserveCallbacks = {
              init: function (result: ServerDocument[]) {
                var initialize = function (documents: ServerDocument[], identities?: Array<string | number | undefined>) {
                  newShared.pendingChanges = false;
                  newShared.snapshot = newShared.windowed
                    ? documents.map(function (doc) {
                        return normalizeDocument(doc) || doc;
                      })
                    : [];
                  newShared.snapshotIdentities = identities || [];
                  var initialConsumers: Array<[string, ConsumerCallbacks]> = [];
                  newShared.consumers.forEach(function (entry, id) {
                    initialConsumers.push([id, entry]);
                  });
                  newShared.initializing = false;
                  initialConsumers.forEach(function (pair) {
                    var entry = pair[1];
                    if (newShared.consumers.get(pair[0]) !== entry) return;
                    entry.ready = true;
                    if (entry.delta) {
                      var docs = documents.map(function (doc, index) {
                        return cacheDocument(entry.socket, entry, doc, identities && identities[index]) || doc;
                      });
                      if (entry.events.i) delivered(entry.socket, entry, [{ i: { r: docs } }]);
                      else delivered(entry.socket, entry, [{ s: { r: docs } }]);
                    } else if (entry.events.i) sendChange(entry.socket, { i: { r: documents } }, entry.request);
                  });
                };
                if (!newShared.pendingChanges && !newShared.windowed) {
                  initialize(result);
                  return;
                }
                queryStable(newShared, 2, function (error: Error | null, documents?: ServerDocument[], identities?: Array<string | number | undefined>) {
                  if (!error && documents) {
                    initialize(documents, identities);
                    return;
                  }
                  newShared.consumers.forEach(function (entry, id) {
                    emitError(entry.socket, entry.request, 'RECOVERY_FAILED', 'Unable to obtain a stable observer initialization');
                    removeConsumer(registry, key, id);
                  });
                });
              },
              added: function (document: ServerDocument, index: number) {
                if (!newShared.snapshot) {
                  newShared.pendingChanges = true;
                  newShared.revision++;
                  return;
                }
                if (newShared.windowed) return reconcileObserver(newShared);
                newShared.revision++;
                newShared.consumers.forEach(function (entry) {
                  if (!entry.ready || (!entry.delta && !entry.events.a)) return;
                  var addedDocument = entry.delta ? cacheDocument(entry.socket, entry, document) || document : document;
                  if (entry.delta) delivered(entry.socket, entry, [{ a: { e: addedDocument, i: index } }]);
                  else sendChange(entry.socket, { a: { e: addedDocument, i: index } }, entry.request);
                });
              },
              removed: function (document: ServerDocument, index: number) {
                if (!newShared.snapshot) {
                  newShared.pendingChanges = true;
                  newShared.revision++;
                  return;
                }
                if (newShared.windowed) return reconcileObserver(newShared);
                newShared.revision++;
                newShared.consumers.forEach(function (entry) {
                  if (entry.delta) {
                    var removedId = documentId(document);
                    if (removedId !== undefined) getSharedSnapshotCache().delete(entry, removedId);
                    if (entry.ready) delivered(entry.socket, entry, [{ r: { e: document, i: index } }]);
                  } else if (entry.ready && entry.events.r) sendChange(entry.socket, { r: { e: document, i: index } }, entry.request);
                });
              },
              changed: function (oldDocument: ServerDocument | null, newDocument: ServerDocument, index: number) {
                if (!newShared.snapshot) {
                  newShared.pendingChanges = true;
                  newShared.revision++;
                  return;
                }
                if (newShared.windowed) return reconcileObserver(newShared);
                newShared.revision++;
                newShared.consumers.forEach(function (entry) {
                  if (!entry.ready || (!entry.delta && !entry.events.c)) return;
                  var change = entry.delta ? changedFor(entry.socket, entry, newDocument, index) : { c: { o: oldDocument, n: newDocument, i: index } };
                  if (entry.delta) delivered(entry.socket, entry, [change]);
                  else sendChange(entry.socket, change, entry.request);
                });
              },
              moved: function (document: ServerDocument, oldIndex: number, newIndex: number) {
                if (!newShared.snapshot) {
                  newShared.pendingChanges = true;
                  newShared.revision++;
                  return;
                }
                if (newShared.windowed) return reconcileObserver(newShared);
                newShared.revision++;
                newShared.consumers.forEach(function (entry) {
                  if (!entry.ready) return;
                  var change = { m: { e: document, o: oldIndex, n: newIndex } };
                  if (entry.delta) delivered(entry.socket, entry, [change]);
                  else if (entry.events.m) sendChange(entry.socket, change, entry.request);
                });
              },
              oplog: true,
              batchMs: _batchMs
            };

            var observeHandle = cursor.observe(observeOptions);
            if (_disconnected || registry.get(key) !== newShared || newShared.consumers.size === 0) {
              observeHandle.stop();
              if (registry.get(key) === newShared) registry.delete(key);
              cursor.close(function (_err: Error | null) {});
              return;
            }
            newShared.handle = observeHandle;
            cursor.close(function (_err: Error | null) {});
            shared = newShared;
          }
        });
      } else if (request.p['observe.document'] || request.p['observe.snapshot']) {
        var recoveryRequest = request.p['observe.document'] || request.p['observe.snapshot'];
        var registration = _observers[recoveryRequest.h];
        var recoveryShared = registration && registration.key ? registry.get(registration.key) : undefined;
        var recoveryConsumer = registration && registration.consumerId && recoveryShared ? recoveryShared.consumers.get(registration.consumerId) : undefined;
        if (!registration || !recoveryShared || !recoveryConsumer || !recoveryConsumer.ready || !recoveryConsumer.delta) {
          emitError(socket, request, 'OBSERVER_NOT_FOUND', 'Observer is not registered on this socket');
        } else {
          var token = registration.token;
          var registeredKey = registration.key!;
          var registeredConsumerId = registration.consumerId!;
          recoverObserver(socket, request, recoveryRequest, recoveryConsumer, recoveryShared, _queryDecorator, function () {
            var current = _observers[recoveryRequest.h];
            return Boolean(
              current &&
                current.token === token &&
                current.key === registeredKey &&
                current.consumerId === registeredConsumerId &&
                registry.get(registeredKey) === recoveryShared &&
                recoveryShared?.consumers.get(registeredConsumerId) === recoveryConsumer
            );
          });
        }
      } else if (request.p['observe.stop']) {
        var handle = request.p['observe.stop'].h;
        if (handle) {
          if (_observers[handle]) {
            var obs = _observers[handle];
            stopRegisteredObserver(registry, obs);
            delete _observers[handle];
          } else {
            _cancelledObserves.add(handle);
          }
        } else {
          console.log('Observe stopped failed: ' + request.p['observe.stop'].h);
        }
      } else {
        throw new Error('Unknown request from client: ' + _.keys(request) + ' || ' + JSON.stringify(request.p));
      }
    });
  }
}

export = ViewDbSocketServer;
