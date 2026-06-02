import _ = require('lodash');
import { VdbSocket } from '../types';

function sendChange(socket: VdbSocket, change: any, request: any): void {
  socket.emit('/vdb/response', {
    i: request.i,
    p: {
      changes: [change]
    }
  });
}

interface ConsumerCallbacks {
  request: any;
  socket: VdbSocket;
  events: { i?: boolean; a?: boolean; r?: boolean; c?: boolean; m?: boolean };
}

interface SharedObserver {
  handle: { stop: () => void; getStats?: () => { evalCount: number; matchCount: number; rawChangedCount: number; emittedChangedCount: number } };
  consumers: Map<string, ConsumerCallbacks>;
}

function observeKey(collection: string, query: any, sort?: any, limit?: any, skip?: any, project?: any): string {
  return JSON.stringify({ collection, query, sort, limit, skip, project });
}

function getSharedRegistry(viewdb: any): Map<string, SharedObserver> {
  if (!viewdb._vdbSharedObservers) {
    viewdb._vdbSharedObservers = new Map<string, SharedObserver>();
    viewdb._getObserverStats = function() { return getObserverStats(viewdb); };
  }
  return viewdb._vdbSharedObservers;
}

interface ObserverStats {
  sharedObserverCount: number;
  totalConsumerCount: number;
  perCollection: Record<string, {
    sharedObservers: number;
    consumers: number;
    evalCount: number;
    matchCount: number;
    missCount: number;
    rawChangedCount: number;
    emittedChangedCount: number;
  }>;
}

function getObserverStats(viewdb: any): ObserverStats {
  var registry = getSharedRegistry(viewdb);
  var stats: ObserverStats = {
    sharedObserverCount: registry.size,
    totalConsumerCount: 0,
    perCollection: {}
  };

  registry.forEach(function (shared, key) {
    var parsed = JSON.parse(key);
    var collection = parsed.collection;
    var consumerCount = shared.consumers.size;
    stats.totalConsumerCount += consumerCount;

    if (!stats.perCollection[collection]) {
      stats.perCollection[collection] = {
        sharedObservers: 0,
        consumers: 0,
        evalCount: 0,
        matchCount: 0,
        missCount: 0,
        rawChangedCount: 0,
        emittedChangedCount: 0
      };
    }

    var colStats = stats.perCollection[collection];
    colStats.sharedObservers++;
    colStats.consumers += consumerCount;

    // Access observer stats if available
    if (shared.handle && shared.handle.getStats) {
      var observerStats = shared.handle.getStats();
      colStats.evalCount += observerStats.evalCount;
      colStats.matchCount += observerStats.matchCount;
      colStats.missCount += (observerStats.evalCount - observerStats.matchCount);
      colStats.rawChangedCount += observerStats.rawChangedCount;
      colStats.emittedChangedCount += observerStats.emittedChangedCount;
    }
  });

  return stats;
}

function removeConsumer(registry: Map<string, SharedObserver>, key: string, consumerId: string): void {
  var shared = registry.get(key);
  if (!shared) return;
  shared.consumers.delete(consumerId);
  if (shared.consumers.size === 0) {
    shared.handle.stop();
    registry.delete(key);
  }
}

class ViewDbSocketServer {
  constructor(viewdb: any, socket: VdbSocket, queryDecorator?: any, globalLimit?: number, readPreference?: any) {
    var _observers: Record<string, { i: number; key: string; consumerId: string }> = {};
    var _queryDecorator: any;
    var _socketId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    var _disconnected = false;
    var _cancelledObserves = new Set<string>();

    if (!queryDecorator) {
      _queryDecorator = function (_col: any, q: any, cb: any) {
        cb(q);
      };
    } else {
      _queryDecorator = queryDecorator;
    }

    var registry = getSharedRegistry(viewdb);

    socket.on('disconnect', function () {
      _disconnected = true;
      _.forOwn(_observers, function (observer: any, observeId: string) {
        removeConsumer(registry, observer.key, observer.consumerId);
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
        _queryDecorator(request.p.collection, request.p.observe, function (decoratedQuery: any) {
          if (_disconnected || _cancelledObserves.has(observeId)) {
            _cancelledObserves.delete(observeId);
            return;
          }
          var effectiveLimit = _.isNumber(request.p.limit) ? request.p.limit :
            (globalLimit && _.isNumber(globalLimit) ? globalLimit : undefined);

          var key = observeKey(
            request.p.collection,
            decoratedQuery,
            request.p.sort,
            effectiveLimit,
            request.p.skip,
            request.p.project
          );

          var consumerId = _socketId + ':' + observeId;
          var events = request.p.events || { i: true, a: true, r: true, c: true, m: true };

          var consumer: ConsumerCallbacks = {
            request: request,
            socket: socket,
            events: events
          };

          var shared = registry.get(key);
          if (shared) {
            // Join existing shared observer � send fresh init to this consumer
            shared.consumers.set(consumerId, consumer);
            if (events.i) {
              var initCursor = viewdb.collection(request.p.collection).find(decoratedQuery);
              if (readPreference && initCursor.setReadPreference) {
                initCursor.setReadPreference(readPreference);
              }
              if (request.p.sort) {
                initCursor.sort(request.p.sort);
              }
              if (effectiveLimit !== undefined) {
                initCursor.limit(effectiveLimit);
              }
              if (_.isNumber(request.p.skip)) {
                initCursor.skip(request.p.skip);
              }
              if (request.p.project && initCursor.project) {
                initCursor.project(request.p.project);
              }
              initCursor.toArray(function (err: Error | null, result: any) {
                if (!err && result) {
                  sendChange(socket, { i: { r: result } }, request);
                }
                initCursor.close(function (_err: Error | null) {});
              });
            }
          } else {
            // Create new shared observer
            var newShared: SharedObserver = {
              handle: null as any,
              consumers: new Map()
            };
            newShared.consumers.set(consumerId, consumer);
            registry.set(key, newShared);

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
              cursor.project(request.p.project);
            }

            var observeOptions: any = {
              init: function (result: any) {
                newShared.consumers.forEach(function (entry) {
                  if (entry.events.i) {
                    sendChange(entry.socket, { i: { r: result } }, entry.request);
                  }
                });
              },
              added: function (e: any, index: number) {
                newShared.consumers.forEach(function (entry) {
                  if (entry.events.a) {
                    sendChange(entry.socket, { a: { e: e, i: index } }, entry.request);
                  }
                });
              },
              removed: function (e: any, index: number) {
                newShared.consumers.forEach(function (entry) {
                  if (entry.events.r) {
                    sendChange(entry.socket, { r: { e: e, i: index } }, entry.request);
                  }
                });
              },
              changed: function (asis: any, tobe: any, index: number) {
                newShared.consumers.forEach(function (entry) {
                  if (entry.events.c) {
                    sendChange(entry.socket, { c: { o: asis, n: tobe, i: index } }, entry.request);
                  }
                });
              },
              moved: function (e: any, oldIndex: number, newIndex: number) {
                newShared.consumers.forEach(function (entry) {
                  if (entry.events.m) {
                    sendChange(entry.socket, { m: { e: e, o: oldIndex, n: newIndex } }, entry.request);
                  }
                });
              },
              oplog: true,
              batchMs: 50
            };

            var observeHandle = cursor.observe(observeOptions);
            newShared.handle = observeHandle;
            cursor.close(function (_err: Error | null) {});
            shared = newShared;
          }

          _observers[observeId] = {
            i: request.i,
            key: key,
            consumerId: consumerId
          };
          socket.emit('/vdb/response', {
            i: request.i,
            p: {
              handle: observeId
            }
          });
        });
      } else if (request.p['observe.stop']) {
        var handle = request.p['observe.stop'].h;
        if (handle) {
          if (_observers[handle]) {
            var obs = _observers[handle];
            removeConsumer(registry, obs.key, obs.consumerId);
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
