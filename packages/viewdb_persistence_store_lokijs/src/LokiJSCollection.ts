import { EventEmitter } from "events";
import {
  findIndex,
  first,
  forEach,
  get,
  isArray,
  isNaN,
  isNumber,
  pick,
  range,
  remove,
  some,
  throttle,
  uniq,
  unset,
  values,
} from "lodash";
import { LoggerFactory } from "slf";
import { ViewDBCursor } from "viewdb";
import parseLokiSort from "./parseLokiSort";

const LOG = LoggerFactory.getLogger("viewdb:lokijs:collection");

const fixCorruptedLoki = (collection: any) => {
  if (!collection.idIndex) {
    return;
  }
  const isCorrupted = uniq(collection.idIndex).length !== collection.idIndex.length;
  if (isCorrupted) {
    const newIdIndex = range(collection.idIndex.length);
    forEach(collection.data, (item, index: number) => {
      item.$loki = newIdIndex[index];
    });
    collection.idIndex = newIdIndex;
  }
};

class LokiJSCollection extends EventEmitter {
  private db: any;
  private collection: any;
  private name: any;
  private emitThrottled: (eventName: string | symbol, ...args: any[]) => boolean;
  private ttl: { daemonInterval: number; fields: any; daemon: any };

  constructor(name: any, db: any, options: any) {
    super();
    this.db = db;
    const collection = this.db.addCollection(name);
    this.collection = collection;
    if (this.collection.constraints?.unique?.["_id"]) {
      try {
        unset(this.collection.constraints.unique, "_id");
        remove(this.collection.uniqueNames, (key) => key === "_id");
      } catch (e: any) {
        LOG.error("Error trying to remove uniqueIndex _id: %s", e?.message);
      }
    }
    fixCorruptedLoki(collection);
    this.name = name;
    if (options && options.disableThrottle) {
      this.emitThrottled = this.emit;
    } else {
      this.emitThrottled = throttle(this.emit, 1000 * 2);
    }
    this.ttl = {
      fields: {},
      daemonInterval: 1000 * 60,
      daemon: undefined,
    };
  }

  find(query: Record<string, any>, options?: any) {
    return new ViewDBCursor(this, { query: query }, options, this._getDocuments.bind(this));
  }

  insert(documents: any, _options?: any) {
    LOG.info("Inserting document to collection %s", this.name);

    try {
      const insert = this.collection.insert(documents);
      this.emitThrottled("change", documents);
      return Promise.resolve(insert);
    } catch (e) {
      LOG.warn("insert failed, docments: %j. Error:", documents, e);
      return Promise.reject(e);
    }
  }

  _updateSingle(doc: any, options: any) {
    // since we have unique index on _id, we need to ensure that _id exists.
    if (!doc._id) {
      if (!doc.id) {
        if (doc.commitId) {
          doc._id = doc.commitId;
        } else {
          LOG.warn("Failed to insert/update doc to collection. Missing id %j", doc);
          return;
        }
      } else {
        doc._id = doc.id;
      }
    }
    const query = doc._id ? { _id: doc._id } : { id: doc.id };

    const toUpdate = this.collection.findOne(query);

    if (!toUpdate) {
      this.collection.insert(doc);
    } else {
      if (get(options, "versionCheck", false)) {
        const prevVersion = get(toUpdate, "version");
        const nextVersion = get(doc, "version");
        if (isNumber(prevVersion) && isNumber(nextVersion)) {
          const skipUpdate = get(options, "acceptSameVersion", false)
            ? prevVersion > nextVersion
            : prevVersion >= nextVersion;
          if (skipUpdate) {
            LOG.debug(
              "Skipping update of document id %s . prev version: %s next version: %s",
              doc._id,
              prevVersion,
              nextVersion
            );
            return;
          }
        }
      }
      if (!toUpdate.meta || !toUpdate.$loki) {
        // To fix bad data saved in collection
        const collectionData = get(this.collection, "data", []);
        const collectionIdIndex = get(this.collection, "idIndex", []);
        const index = findIndex(collectionData, { _id: doc._id });
        if (index > -1) {
          if (
            collectionIdIndex &&
            get(collectionIdIndex, `[${index}]`) === undefined &&
            (!get(collectionData, `[${index}].$loki`) || !get(collectionData, `[${index}].meta`))
          ) {
            LOG.debug("Remove bad data from collection and insert. %j", doc);
            collectionData.splice(index, 1);
            collectionIdIndex.splice(index, 1);
            unset(this.collection, `constraints.unique._id.keyMap.${doc._id}`);
            unset(this.collection, "constraints.unique._id.lokiMap.undefined");
            this.collection.insert(doc);
          }
        }
      } else {
        const meta = pick(toUpdate, ["meta", "$loki"]);
        const updated = Object.assign(meta, doc); // add lokijs metada to object
        try {
          this.collection.update(updated);
        } catch (e: any) {
          LOG.warn("Update error in _updateSingle. %s .. try to fix corrupted $loki data", e?.message);
          // try fix corrupt and update again
          fixCorruptedLoki(this.collection);
          const toUpdates = this.collection.find(query);
          const toUpdate = first(toUpdates);
          const duplicates = toUpdates.slice(1, toUpdates.length);
          forEach(duplicates, (duplicate) => {
            try {
              this.collection.remove(duplicates.$loki);
            } catch (e: any) {
              LOG.error("Failed to remove duplicates with _id: %s. Error: %s", duplicate._id, e?.message);
            }
          });
          const meta = pick(toUpdate, ["meta", "$loki"]);
          const updated = Object.assign(meta, doc);
          try {
            this.collection.update(updated);
          } catch (e: any) {
            LOG.warn("Update error in _updateSingle after fix corrupted $loki. Error: %s", e?.message);
          }
        }
      }
    }
  }

  // options.versionCheck - will not store to db if not a higher version (if version does not exist - will store)
  save(documents: any, options?: any) {
    if (isArray(documents)) {
      const self = this;
      documents.forEach((doc: any) => {
        self._updateSingle(doc, options);
      });
    } else {
      this._updateSingle(documents, options);
    }
    this.emitThrottled("change", documents);
    return Promise.resolve(documents);
  }

  drop() {
    this.db.removeCollection(this.name);
    return Promise.resolve();
  }

  remove(query: any, _options?: any) {
    this.collection.chain().find(query).remove();
    this.emitThrottled("change", { remove: query });
    return Promise.resolve();
  }

  _getDocuments(query: any) {
    const qry = query.query || query;
    LOG.info("Collection: %s - Executing query: %j", this.name, qry);
    let chain = this.collection.chain().find(qry);
    if (query.sort) {
      const parsedSort = parseLokiSort(query.sort);
      chain = chain.compoundsort(parsedSort);
    }
    if (query.skip) {
      chain = chain.offset(query.skip);
    }
    if (query.limit) {
      chain = chain.limit(query.limit);
    }
    const data = chain.data({ removeMeta: true });
    LOG.info("query completed. Results: %s", data.length);
    return Promise.resolve(data);
  }

  ensureIndex(options: any, _callback?: any) {
    if (options.expireAfterSeconds) {
      this.setTTL(options.fieldName, options.expireAfterSeconds * 1000);
    } else {
      this.collection.ensureIndex(options.fieldName, false);
    }
  }

  createIndex(_options: any, _callback?: any) {}

  /*----------------------------+
  | TTL daemon                  |
  +----------------------------*/
  _ttlDaemonFuncGen() {
    const collection = this.collection;
    const ttlFields = this.ttl.fields;
    return () => {
      const removedIds: any[] = [];
      LOG.info("[ttl-daemon] - cleanup running for fields %j", ttlFields);
      const now = Date.now();
      const toRemove = collection.chain().where((doc: any) => {
        let shouldRemove = false;
        forEach(ttlFields, (maxAgeMs, field) => {
          const value = get(doc, field);
          const timestamp = new Date(value).getTime();
          if (!isNaN(timestamp)) {
            const diff = now - timestamp;
            if (maxAgeMs < diff) {
              shouldRemove = true;
              LOG.info("[ttl-daemon] - removing expired document %j", doc);
              removedIds.push(doc.id || doc._id);
            }
          }
        });
        return shouldRemove;
      });
      if (removedIds.length > 0) {
        LOG.info("[ttl-daemon] - removed expired documents for ids %j", removedIds);
      }
      toRemove.remove();
      this.emitThrottled("change", { remove: { _id: { $in: removedIds } } });
    };
  }

  /**
   * Updates or applies collection TTL settings.
   * @param {string} field - field to use for checking age
   * @param {int} age - age (in ms) to expire document from collection
   */
  setTTL(field: any, age: any) {
    if (this.ttl.daemon) {
      clearInterval(this.ttl.daemon);
    }
    if (age < 0) {
      this.ttl.fields[field] = false;
    } else {
      this.ttl.fields[field] = age;
    }
    // if no value is a number, no daemon is necessary.
    const activeTtl = some(values(this.ttl.fields), isNumber);
    if (activeTtl) {
      this.ttl.daemon = setInterval(this._ttlDaemonFuncGen(), this.ttl.daemonInterval);
    }
  }
}

export default LokiJSCollection;
