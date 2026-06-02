import _ = require('lodash');
import { Logger } from 'slf';
import { v4 as uuid } from 'uuid';

var LOG = Logger.getLogger('viewdb:remote:observe');

var buildParams = function (defaults: any, query: any, collection: any): any {
  var skip: any, limit: any, sort: any, project: any;
  if (query.query) {
    skip = query.skip;
    limit = query.limit;
    sort = query.sort;
    project = query.project;
  }
  var params: any = _.defaults(
    {
      id: uuid(),
      observe: query.query || query,
      collection: collection._name,
      skip: skip,
      limit: limit,
      sort: sort
    },
    defaults
  );
  if (project) {
    params.project = project;
  }
  return params;
};

class Observer {
  handles: string[] = [];

  constructor(collection: any, options: any, query: any) {
    var remoteHandle: any = null;
    var self = this;
    var stopped = false;
    self.handles = [];
    var events = {
      i: !_.isNil(options.init),
      a: !_.isNil(options.added),
      r: !_.isNil(options.removed),
      c: !_.isNil(options.changed),
      m: !_.isNil(options.moved)
    };

    var params = buildParams({ events: events }, query, collection);
    var currentHandle: { stop: () => void } | null = null;

    var startObserver = function (): void {
      currentHandle = collection._client.subscribe(params, function (err: Error | null, result: any) {
        if (err) {
          if (stopped) return;
          currentHandle!.stop();
          startObserver();
          return;
        }
        if (stopped) return;
        if (remoteHandle || result.handle) {
          remoteHandle = result.handle || remoteHandle;

          if (self.handles.indexOf(params.id) > -1) {
            collection._client.request({ 'observe.stop': { h: params.id } });
            currentHandle!.stop();
            _.remove(self.handles, params.id);
          } else {
            _.forEach(result.changes, function (c: any) {
              if (c.i) {
                // init
                options.init(c.i.r);
              } else if (c.a) {
                // added
                options.added(c.a.e, c.a.i);
              } else if (c.r) {
                // removed
                options.removed(c.r.e, c.r.i);
              } else if (c.c) {
                // changed
                options.changed(c.c.o, c.c.n, c.c.i);
              } else if (c.m) {
                // moved
                options.moved(c.m.e, c.m.o, c.m.n);
              }
            });
          }
        }
      });
    };

    startObserver();

    return {
      stop: function () {
        stopped = true;
        if (!remoteHandle) {
          LOG.warn('WARN unsubscribing before receiving subscription handle from server');
          self.handles.push(params.id);
        } else {
          collection._client.request({ 'observe.stop': { h: params.id } });
        }
        if (currentHandle) {
          currentHandle.stop();
          currentHandle = null;
        }
      }
    } as any;
  }
}

export = Observer;
