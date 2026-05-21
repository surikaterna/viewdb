import { find, forEach, get, includes } from "lodash";
import Loki from "lokijs";
import { LoggerFactory } from "slf";
import LokiJSCollection from "./LokiJSCollection";

const LOG = LoggerFactory.getLogger("viewdb:lokijs:store");

class LokiJSStore {
  _collections: any;
  _fixLokiInterval: any;
  _fixLokiRunCount: any;
  _lokiJs: any;
  _lokiOptions: any;
  _name: any;
  _onBeforeUnloadFunc: any;
  _openPromise: any;
  _options: any;
  adapter: any;
  autosaveHandle: any;
  constructor(name?: any, options?: any, registerCleanUpHandler?: any) {
    this._name = name ? "vdb_" + name : "vdb";
    this._lokiOptions = {
      autosave: false,
    };
    if (options && options.inMemoryOnly) {
      this._lokiOptions = {};
      this.adapter = null;
    } else {
      if (typeof options?.adapter === "function") {
        this.adapter = options.adapter(this._name);
      } else {
        this.adapter = options?.adapter ?? null;
      }
      if (this.adapter) {
        this._lokiOptions.adapter = this.adapter;
      }
    }

    this._lokiJs = new Loki(options?.dbName ?? this._name, this._lokiOptions);
    this._options = options;
    this._collections = {};
    this._onBeforeUnloadFunc = (event: any) => {
      event.preventDefault();
      event.returnValue = "";
    };
    this._fixLokiRunCount = 0;
    this._fixLokiInterval = setInterval(() => {
      try {
        this._fixLokiCollections();
      } catch (e: any) {
        LOG.error("Error while trying to fix lokijs collections: %s", e?.message);
      }
    }, 10 * 1000);

    registerCleanUpHandler?.(() => {
      LOG.info("Flush and clear all intervals on cleanup");
      this._flush();
      this.clearAllIntervals();
    });
  }

  // there is some kind of timing issue where loki loses collection references. Add them back in if missing. Stop after 3 checks.
  _fixLokiCollections() {
    this._fixLokiRunCount++;
    if (this._fixLokiRunCount > 2) {
      clearInterval(this._fixLokiInterval); // dont run more than 3 times
    }
    const collections = this._lokiJs.listCollections();
    Object.keys(this._collections).forEach((collectionName) => {
      const lokiCollection = find(collections, { name: collectionName });
      if (!lokiCollection) {
        LOG.info("failed to find collection in loki, but existed in store ", collectionName);
        if (this._collections[collectionName]._collection) {
          this._lokiJs.loadCollection(this._collections[collectionName]._collection);
        }
      }
    });
  }

  // displays a box "Are you sure you want to leave this page? Changes might not be saved"
  _addBeforeUnloadListener() {
    window.addEventListener("beforeunload", this._onBeforeUnloadFunc);
  }
  _removeBeforeUnloadListener() {
    window.removeEventListener("beforeunload", this._onBeforeUnloadFunc);
  }

  // autosave function that adds warning on beforeunload if user closes window while database is persisting
  _setupAutosave() {
    if (this._lokiOptions.autosave) {
      return;
    }
    const delay = 10 * 1000;
    LOG.info("Setting up autosave interval");
    if (this.autosaveHandle) {
      clearInterval(this.autosaveHandle);
    }
    this.autosaveHandle = setInterval(() => {
      this._flush().catch((err: any) => {
        LOG.info("Error flushing database: %s", err);
      });
    }, delay);
  }

  _repairBrokenIndex() {
    forEach(this._collections, (collection) => {
      const seen: any = {};
      const coll = collection._collection;
      forEach(coll.data, (item) => {
        if (!item) {
          return;
        }
        if (seen[item._id]) {
          coll.remove(item);
          LOG.info("removed duplicate unique document from collection %s - id: %s", coll.name, item._id);
          this._lokiJs.throttledSavePending = false;
          this._lokiJs.throttledCallbacks = [];
        } else {
          seen[item._id] = true;
        }
      });
    });
  }

  _flush() {
    return new Promise((resolve: any, reject: any) => {
      if (this._lokiJs.autosaveDirty()) {
        LOG.info("Saving database");
        this._addBeforeUnloadListener();
        try {
          this._lokiJs.saveDatabase((err: any) => {
            if (err) {
              reject(err);
            } else {
              LOG.info("Database saved.");
              this._removeBeforeUnloadListener();
              resolve();
            }
          });
        } catch (e: any) {
          const msg = get(e, "message");
          if (includes(msg, "Duplicate key for property")) {
            this._repairBrokenIndex();
          } else {
            LOG.error("Error while saving database ", msg);
          }
        }
      } else {
        resolve();
      }
    });
  }

  open(callback?: any) {
    if (this._openPromise) {
      return this._openPromise;
    } else {
      return this._openOnce(callback);
    }
  }

  _openOnce(callback: any) {
    this._openPromise = new Promise((resolve: any, reject: any) => {
      LOG.debug("loading database %s ...", this._name);
      this._lokiJs.loadDatabase({}, (err: any) => {
        if (err) {
          // retry stupidly one time in case it might help
          setTimeout(() => {
            this._lokiJs.loadDatabase({}, (err: any) => {
              if (err) {
                LOG.error("Failed to load database: error %s", err);
                reject();
              } else {
                LOG.warn("database %s loaded after retrying", this._name);
                resolve();
              }
            });
          }, 500);
        } else {
          LOG.debug("database %s loaded", this._name);
          this._setupAutosave();
          resolve();
        }
      });
    });
    if (callback) {
      this._openPromise.then(
        () => callback(null),
        (err: any) => callback(err)
      );
    }
    return this._openPromise;
  }

  close(callback: any) {
    const promise = Promise.resolve();
    if (callback) {
      promise.then(
        () => callback(null),
        (err) => callback(err)
      );
    }
    return promise;
  }

  delete(callback: any) {
    // noop
  }

  collection(name: any, callback?: any) {
    let collection = this._collections[name];
    if (!collection) {
      collection = this._collections[name] = new LokiJSCollection(name, this._lokiJs, this._options);
    }
    if (callback) {
      callback(collection);
    }
    return collection;
  }

  clearAllIntervals() {
    if (this._fixLokiInterval) {
      clearInterval(this._fixLokiInterval);
    }
    if (this.autosaveHandle) {
      clearInterval(this.autosaveHandle);
    }
    forEach(this._collections, (collection) => {
      if (collection?.ttl?.daemon) {
        clearInterval(collection.ttl.daemon);
      }
    });
  }
}

export default LokiJSStore;
