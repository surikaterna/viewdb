import { EventEmitter } from "node:events";
import type { QueryObject, QueryOptions } from "kuery";
import isArray from "lodash/isArray";
import type {
  AnyBulkWriteOperation,
  Collection,
  CreateIndexesOptions,
  DeleteOptions,
  Document,
  Filter,
  FindCursor,
  FindOneAndUpdateOptions,
  IndexSpecification,
  OptionalId,
  OptionalUnlessRequiredId,
  Sort,
  UpdateFilter,
  UpdateOptions,
} from "mongodb";
import type { Indexed, MaybeArray, ViewDBCollection } from "viewdb";
import { MongoDBCursor } from "./MongoDBCursor";
import type { OplogListener } from "./OplogListener";

export class MongoDBCollection<T extends Indexed> extends EventEmitter implements ViewDBCollection<T> {
  constructor(
    private readonly collection: Collection<T>,
    private readonly oplogListener: OplogListener<T>
  ) {
    super();
  }

  get namespace(): string {
    return this.collection.namespace;
  }

  count(): Promise<number> {
    return this.collection.count.apply(this.collection);
  }

  find(query: Filter<T>, options?: QueryOptions): MongoDBCursor<T> {
    const cursor = this.collection.find(query, options) as FindCursor<T>;
    return new MongoDBCursor(this, { query } as QueryObject<T>, options, cursor, this.oplogListener);
  }

  async findAndModify(query: Filter<T>, sort: Pick<FindOneAndUpdateOptions, "sort"> | null, update: UpdateFilter<T>, options: FindOneAndUpdateOptions) {
    if (sort) {
      Object.assign(options, sort);
    }

    // TODO: Remove this and only call on success?
    const callback = () => {
      this.emit("change", { findAndModify: update });
    };

    try {
      const res = await this.collection.findOneAndUpdate(query, update, options);
      callback();
      return res;
    } catch (err) {
      callback();
      throw err;
    }
  }

  async updateMany(query: Filter<T>, update: UpdateFilter<T>, options?: UpdateOptions) {
    // TODO: Remove this and only call on success?
    const callback = () => {
      this.emit("change", { updateMany: update });
    };

    try {
      const result = await this.collection.updateMany(query, update, options);
      callback();
      return result;
    } catch (err) {
      callback();
      throw err;
    }
  }

  async updateOne(query: Filter<T>, update: UpdateFilter<T>, options?: UpdateOptions & { sort?: Sort }) {
    const callback = () => {
      this.emit("change", { updateOne: update });
    };

    try {
      const result = await this.collection.updateOne(query, update, options);
      callback();
      return result;
    } catch (err) {
      callback();
      throw err;
    }
  }

  /**
   * @deprecated use deleteMany or deleteOne instead
   */
  async remove(query: Filter<T>, options?: DeleteOptions): Promise<void> {
    console.warn("Deprecated: use deleteMany or deleteOne instead");

    const callback = () => {
      this.emit("change", { remove: query });
    };

    try {
      await this.collection.deleteMany(query, options);
      callback();
    } catch (err) {
      callback();
      throw err;
    }
  }

  async deleteMany(query?: Filter<T>, options?: DeleteOptions) {
    const callback = () => {
      this.emit("change", { remove: query });
    };

    try {
      const result = await this.collection.deleteMany(query, options);
      callback();
      return result;
    } catch (err) {
      callback();
      throw err;
    }
  }

  async deleteOne(query?: Filter<T>, options?: DeleteOptions) {
    const callback = () => {
      this.emit("change", { remove: query });
    };

    try {
      const result = await this.collection.deleteOne(query, options);
      callback();
      return result;
    } catch (err) {
      callback();
      throw err;
    }
  }

  async insert(doc: MaybeArray<T>) {
    const docs = isArray(doc) ? doc : [doc];

    const onFulfilled = () => {
      this.emit("change", { insert: docs });
    };

    if (Array.isArray(doc)) {
      await this.collection.insertMany(doc as OptionalUnlessRequiredId<T>[]);
    } else {
      await this.collection.insertOne(doc as OptionalUnlessRequiredId<T>);
    }

    onFulfilled();
    return docs;
  }

  async save(doc: MaybeArray<T>) {
    const docs = isArray(doc) ? doc : [doc];
    const operations: Array<AnyBulkWriteOperation<T>> = [];

    const isOptionalId = (doc: Document): doc is OptionalId<T> => {
      return !doc._id;
    };

    for (const doc of docs as Array<OptionalId<T> | T>) {
      if (isOptionalId(doc)) {
        operations.push({
          insertOne: {
            document: doc,
          },
        });
      } else {
        operations.push({
          replaceOne: {
            filter: { _id: doc._id } as Filter<T>,
            replacement: doc,
            upsert: true,
          },
        });
      }
    }

    // bulkWrite modifies docs and adds inserted _id if applicable
    await this.collection.bulkWrite(operations);
    this.emit("change", { save: docs });
    return docs;
  }

  async drop() {
    const callback = () => {
      this.emit("change", { drop: true });
    };

    try {
      await this.collection.drop.call(this.collection);
      callback();
    } catch (err) {
      callback();
      throw err;
    }
  }

  async createIndex(indexSpec: IndexSpecification, options?: CreateIndexesOptions): Promise<string> {
    return this.collection.createIndex(indexSpec, options);
  }

  async _getDocuments(queryObject: QueryObject<T>): Promise<T[]> {
    const query = queryObject.query ?? queryObject;
    const cursor = this.collection.find<T>(query);

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
