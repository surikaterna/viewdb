import Promise from 'bluebird';
import Collection from './collection';
import _ from 'lodash';
import type { Db } from 'mongodb';

class Store {
  _mongodb: Db;
  _oplogListeners: Record<string, any>;
  _collections: Record<string, any>;
  _oplogListener: any;
  _oplogEnabled: boolean;

  constructor(mongodb: Db, oplogEnabled?: boolean, oplogListener?: any) {
    this._mongodb = mongodb;
    this._oplogListeners = {};
    this._collections = {};
    this._oplogListener = oplogListener;
    this._oplogEnabled = !!oplogEnabled;
  }

  open(callback?: (err: Error | null, value?: Store) => void): any {
    var self = this;
    return Promise.resolve(self).nodeify(callback);
  }

  collection(collectionName: string, callback?: (coll: any) => void): any {
    var coll = this._collections[collectionName];
    if (coll === undefined) {
      if (this._oplogEnabled && this._oplogListener) {
        var dbName = _.get(this._mongodb, 'databaseName');
        var namespaceFilter;
        if (dbName) {
          namespaceFilter = dbName + '.' + collectionName;
        }
        this._oplogListeners[collectionName] = new this._oplogListener(this._mongodb, namespaceFilter, collectionName);
      } else if (this._oplogEnabled) {
        console.warn('oplog listener must be provided to enable listening for updates');
      }
      coll = new Collection(this._mongodb.collection(collectionName), this._oplogListeners[collectionName]);
      this._collections[collectionName] = coll;
    }
    if (callback) {
      callback(coll);
    }
    return coll;
  }
}

export default Store;
