import _ from "lodash";
import { Logger } from "slf";
import { v4 as uuid } from "uuid";
import Observer from "./observe";

const LOG = Logger.getLogger("viewdb:remote:cursor");

import { Cursor } from "viewdb";

class RemoteCursor extends Cursor {
  _handle!: { stop: () => void };

  constructor(collection: any, query: any, options: any, getDocuments: any) {
    super(collection, query, options, getDocuments);
  }

  count(
    applySkipLimit?: boolean | ((err: Error | null, result?: number) => void),
    options?: Record<string, any> | ((err: Error | null, result?: number) => void),
    callback?: (err: Error | null, result?: number) => void
  ): void {
    if (_.isFunction(applySkipLimit)) {
      callback = applySkipLimit;
      applySkipLimit = true;
    }
    if (_.isFunction(options)) {
      callback = options;
      options = {};
    }

    const skip = _.get(this, "_query.skip", _.get(options, "skip", 0));
    const limit = _.get(this, "_query.limit", _.get(options, "limit", 0));

    const params: any = {
      id: uuid(),
      count: this._query.query || this._query,
      collection: (this._collection as any)._name,
    };

    if (applySkipLimit) {
      params.skip = skip;
      params.limit = limit;
    }

    (this._collection as any)._client.request(params, function (err: Error | null, result: any) {
      callback!(err, result);
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
      self._handle = new Observer(self._collection, options, self._query) as any;
    };
    self._collection.on("change", refreshListener);

    self._handle = new Observer(self._collection, options, self._query) as any;
    return {
      stop: function () {
        self._handle.stop();
        self._collection.removeListener("change", refreshListener);
      },
    };
  }
}

export default RemoteCursor;
