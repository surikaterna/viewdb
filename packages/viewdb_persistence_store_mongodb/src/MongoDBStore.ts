import type { Db } from "mongodb";
import type { Indexed } from "viewdb";
import { MongoDBCollection } from "./MongoDBCollection";
import type { OplogListener, OplogListenerConstructor } from "./OplogListener";

export class MongoDBStore {
  private readonly db: Db;
  private readonly oplogListeners: Record<string, OplogListener<any>>;
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: it is used in the collection method
  private readonly collections: Record<string, MongoDBCollection<any>>;
  private readonly oplogListener?: OplogListenerConstructor<any>;
  private readonly oplogEnabled: boolean;

  constructor(mongodb: Db, oplogEnabled = false, oplogListener?: OplogListenerConstructor<any>) {
    this.db = mongodb;
    this.oplogListeners = {};
    this.collections = {};
    this.oplogListener = oplogListener;
    this.oplogEnabled = oplogEnabled;
  }

  async open() {
    return this;
  }

  collection<T extends Indexed>(collectionName: string): MongoDBCollection<T> {
    const existingCollection = this.collections[collectionName];

    if (existingCollection) {
      return existingCollection;
    }

    if (this.oplogEnabled && this.oplogListener) {
      const dbName = this.db.databaseName;
      const namespaceFilter = dbName ? `${dbName}.${collectionName}` : undefined;
      this.oplogListeners[collectionName] = new this.oplogListener(this.db, namespaceFilter, collectionName);
    } else if (this.oplogEnabled) {
      console.warn("oplog listener must be provided to enable listening for updates");
    }

    const collection = new MongoDBCollection<T>(this.db.collection(collectionName), this.oplogListeners[collectionName]);
    this.collections[collectionName] = collection;
    return collection;
  }
}
