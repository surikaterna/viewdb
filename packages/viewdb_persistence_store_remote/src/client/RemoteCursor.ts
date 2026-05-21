import _ from "lodash";
import { Logger } from "slf";
import { v4 as uuid } from "uuid";
import RemoteObserver from "./RemoteObserver";

const LOG = Logger.getLogger("viewdb:remote:cursor");

import { ViewDBCursor } from "viewdb";

class RemoteCursor extends ViewDBCursor {
  _handle!: { stop: () => void };

  constructor(collection: any, query: any, options: any, getDocuments: any) {
    super(collection, query, options, getDocuments);
  }

  count(options?: Record<string, any>): Promise<number> {
    const skip = _.get(this, "_query.skip", _.get(options, "skip", 0));
    const limit = _.get(this, "_query.limit", _.get(options, "limit", 0));

    const params: any = {
      id: uuid(),
      count: this._query.query || this._query,
      collection: (this._collection as any)._name,
    };

    params.skip = skip;
    params.limit = limit;

    return new Promise((resolve, reject) => {
      (this._collection as any)._client.request(params, function (err: Error | null, result: any) {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      });
    });
  }

  sort(params: Record<string, 1 | -1>): this {
    this._query.sort = params;
    this._refresh();
    return this;
  }

  project(params: Record<string, 0 | 1>): this {
    this._query.project = params;
    return this;
  }

  _refresh(): void {
    if (this._isObserving) {
      this._collection.emit("change");
    }
  }

  observe(options: any): { stop: () => void } {
    const self = this;
    if (self._isObserving) {
      LOG.error(
        "Already observing this cursor. Collection: %s - Query: %j",
        _.get(self, "_collection._name"),
        self._query
      );
      throw new Error("Already observing this cursor. Collection: " + _.get(self, "_collection._name"));
    }
    self._isObserving = true;

    const refreshListener = function () {
      LOG.info("restarting observer due to change");
      self._handle.stop();
      self._handle = new RemoteObserver(self._collection, options, self._query) as any;
    };
    self._collection.on("change", refreshListener);

    self._handle = new RemoteObserver(self._collection, options, self._query) as any;
    return {
      stop: function () {
        self._handle.stop();
        self._collection.removeListener("change", refreshListener);
      },
    };
  }
}

export default RemoteCursor;
