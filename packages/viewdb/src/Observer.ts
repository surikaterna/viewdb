import type { QueryObject, QueryOptions } from "kuery";
import defaults from "lodash/defaults";
import type { Indexed, ObserverOptions, ViewDBCollection, ViewDBObserver } from "./interfaces";
import { merge } from "./merge";
import type { Nullish } from "./types";

export class Observer<T extends Indexed> implements ViewDBObserver {
  private readonly query: QueryObject<T>;
  _queryOptions: Nullish<QueryOptions>;
  private readonly collection: ViewDBCollection<T>;
  private readonly options: ObserverOptions<T>;
  private cache: T[];
  private readonly listener: () => void;

  constructor(query: QueryObject<T>, queryOptions: Nullish<QueryOptions>, collection: ViewDBCollection<T>, options: ObserverOptions<T>) {
    this.query = query;
    this._queryOptions = queryOptions;
    this.collection = collection;
    this.options = options;
    this.cache = [];

    this.listener = () => {
      this.refresh();
    };

    collection.on("change", this.listener);
    this.refresh(true);
  }

  stop() {
    this.cache = [];
    this.collection.removeListener("change", this.listener);
  }

  private refresh(initial?: boolean) {
    this.collection._getDocuments(this.query).then((result) => {
      if (initial && this.options.init) {
        this.cache = result;
        this.options.init(result);
        return;
      }
      const old = this.cache;

      this.cache = merge(
        old,
        result,
        defaults(
          {
            comparatorId: (a: T, b: T) => a?._id === b?._id,
          },
          this.options
        )
      );
    });
  }
}
