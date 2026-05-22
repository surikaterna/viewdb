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
      (this._collection as any)._client.request(params, (err: Error | null, result: any) => {
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
    if (this._isObserving) {
      LOG.error(
        "Already observing this cursor. Collection: %s - Query: %j",
        _.get(this, "_collection._name"),
        this._query
      );
      throw new Error(`Already observing this cursor. Collection: ${_.get(this, "_collection._name")}`);
    }
    this._isObserving = true;

    const refreshListener = () => {
      LOG.info("restarting observer due to change");
      this._handle.stop();
      this._handle = new RemoteObserver(this._collection, options, this._query) as any;
    };
    this._collection.on("change", refreshListener);

    this._handle = new RemoteObserver(this._collection, options, this._query) as any;
    return {
      stop: () => {
        this._handle.stop();
        this._collection.removeListener("change", refreshListener);
      },
    };
  }
}

export default RemoteCursor;
