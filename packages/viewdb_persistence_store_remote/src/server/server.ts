import _ = require('lodash');
import { v4 as uuid } from 'uuid';
import { Logger } from 'slf';
import { DeltaCacheLimits } from '../deltaProtocol';
import { VdbSocket } from '../types';
import { getObserverStats } from './observerStats';
import { cacheDocument, ConsumerCallbacks, delivered, emitError, QueryDecorator, rowKeysFor, sendChange, SharedObserver } from './deltaDelivery';
import { ServerDocument, queryStable } from './stableQuery';
import { recoverObserver } from './recovery';
import { getSharedSnapshotCache, viewdbNamespace } from './sharedSnapshotCache';
import {
  createSharedObserver,
  observeKey,
  ObserveRegistration,
  rebindConsumerToAuthorizedQuery,
  removeConsumer,
  stopRegisteredObserver
} from './observerLifecycle';
var LOG = Logger.getLogger('viewdb:remote:server');

function getSharedRegistry(viewdb: any): Map<string, SharedObserver> {
  if (!viewdb._vdbSharedObservers) {
    viewdb._vdbSharedObservers = new Map<string, SharedObserver>();
    viewdb._getObserverStats = function () {
      return getObserverStats(viewdb);
    };
  }
  return viewdb._vdbSharedObservers;
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
        delete _observers[observeId];
        stopRegisteredObserver(registry, observer);
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
          delete _observers[observeId];
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
            id: consumerId,
            request: request,
            socket: socket,
            events: events,
            ready: false,
            delta: deltaEnabled,
            collection: request.p.collection,
            namespace: namespace,
            sequence: 0,
            rowKeySecret: deltaEnabled ? uuid() : undefined,
            sort: request.p.sort,
            skip: _.isNumber(request.p.skip) ? request.p.skip : undefined,
            project: request.p.project,
            limit: effectiveLimit,
            windowed: needsWindow
          };

          var shared = registry.get(key);
          if (shared) {
            const joiningShared = shared;
            // Join existing shared observer - send fresh init to this consumer
            shared.consumers.set(consumerId, consumer);
            _observers[observeId] = { i: request.i, key: key, consumerId: consumerId, token: registrationToken };
            socket.emit('/vdb/response', { i: request.i, p: request.p.deltaVersion === 1 ? { handle: observeId, deltaVersion: 1 } : { handle: observeId } });
            if (shared.snapshot && !shared.initializing && (events.i || consumer.delta)) {
              if (shared.windowed) {
                setTimeout(function () {
                  var currentObserver = _observers[observeId];
                  if (!currentObserver || currentObserver.token !== registrationToken || !joiningShared.consumers.has(consumerId)) return;
                  var committedDocuments = joiningShared.snapshot!;
                  var committedIdentities = joiningShared.snapshotIdentities;
                  consumer.ready = true;
                  if (consumer.delta) {
                    var docs = committedDocuments.map(function (doc, index) {
                      return cacheDocument(socket, consumer, doc, committedIdentities[index]) || doc;
                    });
                    var rowKeys = rowKeysFor(consumer, committedDocuments, committedIdentities);
                    var initial = { r: docs, rowKeys: rowKeys };
                    delivered(socket, consumer, [events.i ? { i: initial } : { s: initial }]);
                  } else sendChange(socket, { i: { r: committedDocuments } }, request);
                }, 0);
              } else
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
                    var rowKeys = rowKeysFor(consumer, result, identities);
                    var initial = { r: docs, rowKeys: rowKeys };
                    delivered(socket, consumer, [events.i ? { i: initial } : { s: initial }]);
                  } else sendChange(socket, { i: { r: result } }, request);
                  consumer.ready = true;
                });
            } else if (!events.i && !consumer.delta && !shared.initializing) consumer.ready = true;
          } else {
            var initializationFailureSent = false;
            try {
              shared = createSharedObserver(
                viewdb,
                registry,
                key,
                decoratedQuery,
                consumer,
                readPreference,
                _batchMs,
                function () {
                  _observers[observeId] = { i: request.i, key: key, consumerId: consumerId, token: registrationToken };
                  socket.emit('/vdb/response', {
                    i: request.i,
                    p: request.p.deltaVersion === 1 ? { handle: observeId, deltaVersion: 1 } : { handle: observeId }
                  });
                },
                function () {
                  initializationFailureSent = true;
                  var current = _observers[observeId];
                  if (current && current.token === registrationToken) delete _observers[observeId];
                }
              );
            } catch {
              shared = undefined;
            }
            if (!shared) {
              var currentRegistration = _observers[observeId];
              if (currentRegistration && currentRegistration.token === registrationToken) {
                if (!initializationFailureSent) emitError(socket, request, 'RECOVERY_FAILED', 'Unable to initialize observer');
                delete _observers[observeId];
              }
            }
          }
        });
      } else if (request.p['observe.document'] || request.p['observe.snapshot']) {
        var recoveryRequest = request.p['observe.document'] || request.p['observe.snapshot'];
        var registration = _observers[recoveryRequest.h];
        var recoveryShared = registration && registration.key ? registry.get(registration.key) : undefined;
        var recoveryConsumer = registration && registration.consumerId && recoveryShared ? recoveryShared.consumers.get(registration.consumerId) : undefined;
        if (!registration || !recoveryShared || !recoveryConsumer || (!recoveryConsumer.ready && !recoveryConsumer.rebindPending) || !recoveryConsumer.delta) {
          emitError(socket, request, 'OBSERVER_NOT_FOUND', 'Observer is not registered on this socket');
        } else {
          const activeRecoveryConsumer = recoveryConsumer;
          var token = registration.token;
          var registeredConsumerId = registration.consumerId!;
          var isCurrent = function () {
            var current = _observers[recoveryRequest.h];
            if (_disconnected || !current || current.token !== token || current.consumerId !== registeredConsumerId || !current.key) return false;
            var owner = registry.get(current.key);
            return Boolean(owner && owner.consumers.get(registeredConsumerId) === recoveryConsumer);
          };
          var rebindAuthorizedQuery = function (query: Record<string, unknown>, callback: (error: Error | null, shared?: SharedObserver) => void) {
            rebindConsumerToAuthorizedQuery(viewdb, registry, registration, activeRecoveryConsumer, query, readPreference, _batchMs, isCurrent, callback);
          };
          recoverObserver(socket, request, recoveryRequest, recoveryConsumer, recoveryShared, _queryDecorator, isCurrent, rebindAuthorizedQuery);
        }
      } else if (request.p['observe.stop']) {
        var handle = request.p['observe.stop'].h;
        if (handle) {
          if (_observers[handle]) {
            var obs = _observers[handle];
            delete _observers[handle];
            stopRegisteredObserver(registry, obs);
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
