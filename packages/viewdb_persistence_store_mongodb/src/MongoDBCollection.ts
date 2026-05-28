import { EventEmitter } from "events";
import type { TypedQuery } from "kuery";
import type {
  AnyBulkWriteOperation,
  Filter,
  Collection as MongoCollection,
  OptionalId,
  OptionalUnlessRequiredId,
} from "mongodb";
import {
  type Collection,
  type CountDocumentsOptions,
  type CreateIndexOptions,
  type DeleteOptions,
  type DeleteResult,
  type FindOneAndUpdateOptions,
  type IndexSpecification,
  type InsertManyOptions,
  type InsertManyResult,
  type InsertOneOptions,
  type InsertOneResult,
  isQueryObject,
  type QueryObject,
  type SortSpec,
  type UpdateFilter,
  type UpdateManyOptions,
  type UpdateOneOptions,
  type UpdateResult,
  type VDocument,
} from "viewdb";
import MongoDBCursor from "./MongoDBCursor";
import type { OplogListener } from "./MongoDBObserver";

class MongoDBCollection<T extends VDocument = VDocument> extends EventEmitter implements Collection<T> {
  _collection: MongoCollection<T>;
  _oplogListener?: OplogListener<T>;

  constructor(collection: MongoCollection<T>, oplogListener?: OplogListener<T>) {
    super();
    this._collection = collection;
    this._oplogListener = oplogListener;
  }

  count(query?: TypedQuery<T>, options?: CountDocumentsOptions): Promise<number> {
    return this._collection.count(query as Filter<T>, options);
  }

  countDocuments(query: TypedQuery<T>, options?: CountDocumentsOptions): Promise<number> {
    return this._collection.countDocuments(query as Filter<T>, options);
  }

  estimatedDocumentCount(): Promise<number> {
    return this._collection.estimatedDocumentCount();
  }

  find(query: TypedQuery<T>, options?: Record<string, any>): MongoDBCursor<T> {
    const cursor = this._collection.find(query as Filter<T>, options);
    return new MongoDBCursor<T>(this, { query }, options, cursor, this._oplogListener);
  }

  async findAndModify(
    query: TypedQuery<T>,
    sort: SortSpec | null,
    update: UpdateFilter,
    options: FindOneAndUpdateOptions
  ): Promise<T> {
    if (sort) {
      Object.assign(options, sort);
    }

    const result = await this._collection.findOneAndUpdate(query as Filter<T>, update, options);
    this.emit("change", { findAndModify: update });
    return result as T;
  }

  async updateMany(query: TypedQuery<T>, update: UpdateFilter, options?: UpdateManyOptions): Promise<UpdateResult> {
    const result = await this._collection.updateMany(query as Filter<T>, update, options);
    this.emit("change", { updateMany: update });
    return result as UpdateResult;
  }

  async updateOne(query: TypedQuery<T>, update: UpdateFilter, options?: UpdateOneOptions): Promise<UpdateResult> {
    const result = await this._collection.updateOne(query as Filter<T>, update, options);
    this.emit("change", { updateOne: update });
    return result as UpdateResult;
  }

  async remove(query: TypedQuery<T>, options?: DeleteOptions): Promise<any> {
    console.warn("Deprecated: use deleteMany or deleteOne instead");

    const result = await this._collection.deleteMany(query as Filter<T>, options);
    this.emit("change", { remove: query });
    return result;
  }

  async deleteMany(query?: TypedQuery<T>, options?: DeleteOptions): Promise<DeleteResult> {
    const result = await this._collection.deleteMany(query as Filter<T>, options);
    this.emit("change", { remove: query });
    return result;
  }

  async deleteOne(query?: TypedQuery<T>, options?: DeleteOptions): Promise<DeleteResult> {
    const result = await this._collection.deleteOne(query as Filter<T>, options);
    this.emit("change", { remove: query });
    return result;
  }

  async insert(docs: T | T[]): Promise<any> {
    await (Array.isArray(docs)
      ? this._collection.insertMany(docs as Array<OptionalUnlessRequiredId<T>>)
      : this._collection.insertOne(docs as OptionalUnlessRequiredId<T>));

    this.emit("change", { insert: docs });
    return docs;
  }

  async insertMany(docs: T[], options?: InsertManyOptions): Promise<InsertManyResult> {
    const result = (await this._collection.insertMany(
      docs as Array<OptionalUnlessRequiredId<T>>,
      options
    )) as InsertManyResult;

    this.emit("change", { insertMany: docs });
    return result;
  }

  async insertOne(doc: T, options?: InsertOneOptions): Promise<InsertOneResult> {
    const result = (await this._collection.insertOne(doc as OptionalUnlessRequiredId<T>, options)) as InsertOneResult;

    this.emit("change", { insertOne: doc });
    return result;
  }

  async save(documents: T | T[]): Promise<any> {
    const docs = Array.isArray(documents) ? documents : [documents];
    const operations: Array<AnyBulkWriteOperation<T>> = [];

    for (const doc of docs) {
      if (!doc._id) {
        operations.push({ insertOne: { document: doc as OptionalId<T> } });
      } else {
        operations.push({ replaceOne: { filter: { _id: doc._id } as Filter<T>, replacement: doc, upsert: true } });
      }
    }

    await this._collection.bulkWrite(operations);
    this.emit("change", { save: docs });
    return docs;
  }

  async drop(): Promise<boolean> {
    const result = await this._collection.drop();
    this.emit("change", { drop: true });
    return result;
  }

  createIndex(indexSpec: IndexSpecification, options?: CreateIndexOptions): Promise<string> {
    return this._collection.createIndex(indexSpec, options);
  }

  _getDocuments(queryObject: QueryObject<T> | TypedQuery<T>): Promise<T[]> {
    const query = isQueryObject(queryObject) ? (queryObject.query as TypedQuery<T>) : queryObject;
    const cursor = this._collection.find(query as Filter<T>);
    if (isQueryObject(queryObject)) {
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
    }

    return cursor.toArray() as Promise<T[]>;
  }
}

export default MongoDBCollection;
