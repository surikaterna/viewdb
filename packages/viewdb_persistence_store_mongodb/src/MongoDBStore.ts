import type { Db } from "mongodb";
import type { Store, VDocument } from "viewdb";
import MongoDBCollection from "./MongoDBCollection";
import type { OplogListener } from "./MongoDBObserver";

type Constructor<T = object> = new (...args: any[]) => T;

class MongoDBStore implements Store {
  private readonly db: Db;
  private readonly oplogListeners: Record<string, OplogListener<any>>;
  private readonly collections: Record<string, any>;
  private readonly oplogListener?: Constructor<OplogListener<any>>;
  private readonly oplogEnabled: boolean;

  constructor(db: Db, oplogEnabled?: boolean, oplogListener?: Constructor<OplogListener<any>>) {
    this.db = db;
    this.oplogListeners = {};
    this.collections = {};
    this.oplogListener = oplogListener;
    this.oplogEnabled = !!oplogEnabled;
  }

  async open(): Promise<this> {
    return this;
  }

  collection<T extends VDocument = VDocument>(name: string): MongoDBCollection<T> {
    const existingCollection = this.collections[name];
    if (existingCollection) {
      return existingCollection;
    }

    if (this.oplogEnabled && this.oplogListener) {
      const dbName = this.db.databaseName;
      const namespaceFilter = `${dbName}.${name}`;

      console.log("****store.collection", { dbName, namespaceFilter });
      this.oplogListeners[name] = new this.oplogListener(this.db, namespaceFilter, name);
    } else if (this.oplogEnabled) {
      console.warn("oplog listener must be provided to enable listening for updates");
    }
    const newCcollection = new MongoDBCollection<T>(this.db.collection(name), this.oplogListeners[name]);
    this.collections[name] = newCcollection;

    return newCcollection;
  }
}

export default MongoDBStore;
