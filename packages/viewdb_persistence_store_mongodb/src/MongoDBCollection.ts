import { EventEmitter } from "events";
import { forEach, isArray, isFunction } from "lodash";
import type { Collection as MongoCollection, Document as MongoDocument } from "mongodb";
import MongoDBCursor from "./MongoDBCursor";
import { nodeify } from "./utils";

class MongoDBCollection extends EventEmitter {
  _collection: MongoCollection<MongoDocument>;
  _oplogListener: any;

  constructor(collection: MongoCollection<MongoDocument>, oplogListener?: any) {
    super();
    this._collection = collection;
    this._oplogListener = oplogListener;
  }

  count(): any {
    return (this._collection as any).count.apply(this._collection, arguments);
  }

  find(query: any, options?: any): MongoDBCursor {
    const cursor = (this._collection as any).find.apply(this._collection, arguments);
    return new MongoDBCursor(this, { query: query }, options, cursor, this._oplogListener);
  }

  findAndModify(
    query: any,
    sort: any,
    update: any,
    options: any,
    cb?: (err: Error | null, doc?: any) => void
  ): Promise<any> {
    if (sort) {
      Object.assign(options, sort);
    }
    const self = this;
    function callback(err: Error | null, doc?: any) {
      self.emit("change", { findAndModify: update });
      if (isFunction(cb)) {
        cb(err, doc);
      }
    }
    return new Promise((resolve, reject) => {
      this._collection
        .findOneAndUpdate(query, update, options)
        .then((res: any) => {
          resolve(res);
          callback(null, res);
        })
        .catch((err: Error) => {
          reject(err);
          callback(err);
        });
    });
  }

  updateMany(query: any, update: any, options?: any, cb?: (err: Error | null, result?: any) => void): any {
    if (isFunction(options)) {
      cb = options;
      options = undefined;
    }
    const promise = this._collection.updateMany(query, update, options);
    return nodeify(
      promise.then((res: any) => {
        this.emit("change", { updateMany: update });
        return res;
      }),
      cb
    );
  }

  updateOne(query: any, update: any, options?: any, cb?: (err: Error | null, result?: any) => void): any {
    if (isFunction(options)) {
      cb = options;
      options = undefined;
    }
    const promise = this._collection.updateOne(query, update, options);
    return nodeify(
      promise.then((res: any) => {
        this.emit("change", { updateOne: update });
        return res;
      }),
      cb
    );
  }

  remove(query: any, options?: any, cb?: (err: Error | null, result?: any) => void): any {
    console.warn("Deprecated: use deleteMany or deleteOne instead");

    if (isFunction(options)) {
      cb = options;
      options = undefined;
    }
    const promise = this._collection.deleteMany(query, options);
    return nodeify(
      promise.then((res: any) => {
        this.emit("change", { remove: query });
        return res;
      }),
      cb
    );
  }

  deleteMany(query: any, options?: any): any {
    return this._collection.deleteMany(query, options).then((res: any) => {
      this.emit("change", { remove: query });
      return res;
    });
  }

  deleteOne(query: any, options?: any): any {
    return this._collection.deleteOne(query, options).then((res: any) => {
      this.emit("change", { remove: query });
      return res;
    });
  }

  insert(docs: any, cb?: (err: Error | null, docs?: any) => void): any {
    const onFulfilled = () => {
      this.emit("change", { insert: docs });
      if (isFunction(cb)) {
        cb(null, docs);
      }
    };
    const onRejected = (err: Error) => {
      if (isFunction(cb)) {
        cb(err);
      }
    };
    let promise;
    if (isArray(docs)) {
      promise = this._collection.insertMany(docs).then(onFulfilled).catch(onRejected);
    } else {
      promise = this._collection.insertOne(docs).then(onFulfilled).catch(onRejected);
    }
    return promise;
  }

  save(docs: any, cb?: (err: Error | null, docs?: any) => void): any {
    if (!isArray(docs)) {
      docs = [docs];
    }
    const operations: any[] = [];
    forEach(docs, (d: any) => {
      if (!d._id) {
        operations.push({ insertOne: { document: d } });
      } else {
        operations.push({ replaceOne: { filter: { _id: d._id }, replacement: d, upsert: true } });
      }
    });
    return this._collection
      .bulkWrite(operations)
      .then(() => {
        this.emit("change", { save: docs });
        if (isFunction(cb)) {
          cb(null, docs);
        }
      })
      .catch((err: Error) => {
        if (isFunction(cb)) {
          cb(err);
        }
      });
  }

  drop(cb?: (err: Error | null, result?: any) => void): any {
    const promise = this._collection.drop();
    return nodeify(
      promise.then((res: any) => {
        this.emit("change", { drop: true });
        return res;
      }),
      cb
    );
  }

  createIndex(indexSpec: any, options?: any, cb?: (err: Error | null, result?: any) => void): any {
    if (isFunction(options)) {
      cb = options;
      options = {};
    }
    return nodeify(this._collection.createIndex(indexSpec, options), cb);
  }

  _getDocuments(queryObject: any): Promise<any[]> {
    const query = queryObject.query || queryObject;
    const cursor = this._collection.find(query);
    if (queryObject.skip) {
      cursor.skip(queryObject.skip);
    }
    if (queryObject.limit) {
      cursor.limit(queryObject.limit);
    }
    if (queryObject.sort) {
      cursor.sort(queryObject.sort);
    }
    if (queryObject.project) {
      cursor.project(queryObject.project);
    }
    return cursor.toArray();
  }
}

export default MongoDBCollection;
