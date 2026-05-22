import _ from "lodash";
import { VdbSocket } from "../types";

function sendChange(socket: VdbSocket, change: any, request: any): void {
  socket.emit("/vdb/response", {
    i: request.i,
    p: {
      changes: [change],
    },
  });
}

class ViewDBSocketServer {
  constructor(viewdb: any, socket: VdbSocket, queryDecorator?: any, globalLimit?: number, readPreference?: any) {
    const _observers: Record<string, { i: number; handle: { stop: () => void } }> = {};
    let _queryDecorator: any;
    if (!queryDecorator) {
      _queryDecorator = (_col: any, q: any, cb: any) => {
        cb(q);
      };
    } else {
      _queryDecorator = queryDecorator;
    }
    socket.on("disconnect", () => {
      _.forOwn(_observers, (observer: any, handle: string) => {
        observer.handle.stop();
        delete _observers[handle];
      });
    });
    socket.on("/vdb/request", (request: any) => {
      if (request.p.find) {
        _queryDecorator(request.p.collection, request.p.find, (decoratedQuery: any) => {
          const cursor = viewdb.collection(request.p.collection).find(decoratedQuery);
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
              console.log("warn: no support for project on cursor");
            }
          }
          cursor
            .toArray()
            .then((result: any) => {
              socket.emit("/vdb/response", {
                i: request.i,
                p: result,
              });
            })
            .catch((err: Error) => {
              console.log(err);
            });
        });
      } else if (request.p.count) {
        _queryDecorator(request.p.collection, request.p.count, (decoratedQuery: any) => {
          const cursor = viewdb.collection(request.p.collection).find(decoratedQuery);
          if (readPreference && cursor.setReadPreference) {
            cursor.setReadPreference(readPreference);
          }
          if (_.isNumber(request.p.limit)) {
            cursor.limit(request.p.limit);
          }
          if (_.isNumber(request.p.skip)) {
            cursor.skip(request.p.skip);
          }
          cursor
            .count()
            .then((result: any) => {
              socket.emit("/vdb/response", {
                i: request.i,
                p: result,
              });
            })
            .catch((err: Error) => {
              console.log(err);
            })
            .finally(() => {
              if (cursor.close) {
                cursor.close();
              }
            });
        });
      } else if (request.p.observe) {
        const observeId = request.p.id;
        _queryDecorator(request.p.collection, request.p.observe, (decoratedQuery: any) => {
          const cursor = viewdb.collection(request.p.collection).find(decoratedQuery);
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
            cursor.project(request.p.project);
          }
          const observeOptions: any = {
            init: (result: any) => {
              sendChange(socket, { i: { r: result } }, request);
            },
            added: (e: any, index: number) => {
              sendChange(socket, { a: { e: e, i: index } }, request);
            },
            removed: (e: any, index: number) => {
              sendChange(socket, { r: { e: e, i: index } }, request);
            },
            changed: (asis: any, tobe: any, index: number) => {
              sendChange(socket, { c: { o: asis, n: tobe, i: index } }, request);
            },
            moved: (e: any, oldIndex: number, newIndex: number) => {
              sendChange(socket, { m: { e: e, o: oldIndex, n: newIndex } }, request);
            },
            oplog: true,
          };

          if (request.p.events) {
            if (!request.p.events.i) {
              delete observeOptions.init;
            }

            if (!request.p.events.a) {
              delete observeOptions.added;
            }

            if (!request.p.events.r) {
              delete observeOptions.removed;
            }

            if (!request.p.events.c) {
              delete observeOptions.changed;
            }

            if (!request.p.events.m) {
              delete observeOptions.moved;
            }
          }

          const observeHandle = cursor.observe(observeOptions);
          _observers[observeId] = {
            i: request.i,
            handle: observeHandle,
          };
          socket.emit("/vdb/response", {
            i: request.i,
            p: {
              handle: observeId,
            },
          });
          if (cursor.close) {
            cursor.close();
          }
        });
      } else if (request.p["observe.stop"]) {
        const handle = request.p["observe.stop"].h;
        if (handle) {
          if (_observers[handle]) {
            _observers[handle].handle.stop();
            delete _observers[handle];
          } else {
            console.error(`Observer not registered on this server: ${handle}`);
          }
        } else {
          console.log(`Observe stopped failed: ${request.p["observe.stop"].h}`);
        }
      } else {
        throw new Error(`Unknown request from client: ${_.keys(request)} || ${JSON.stringify(request.p)}`);
      }
    });
  }
}

export default ViewDBSocketServer;
