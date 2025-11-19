import type { Query, SortObject } from "kuery";
import isArray from "lodash/isArray";
import isUndefined from "lodash/isUndefined";
import type {
  CollectionFindAndModifyOptions,
  CollectionInsertOptions,
  CollectionSaveOptions,
  CollectionUpdateManyOptions,
  CollectionUpdateOneOptions,
  FindAndModifyResult,
  Indexed,
  UpdateFilter,
  ViewDBCollection,
} from "../interfaces";
import type { MaybeArray } from "../types";
import type { ViewDB } from "../ViewDB";

export class ViewDBVersioningPlugin {
  constructor(viewDb: ViewDB) {
    const oldCollection = viewDb.collection;

    viewDb.collection = function <T extends Indexed>(name: string): ViewDBCollection<T> {
      const collection = oldCollection.call(this, name);

      if (!collection.__plugins_versioning) {
        collection.__plugins_versioning = true;

        const oldSave = collection.save as ViewDBCollection<T>["save"];
        collection.save = async function (docs: MaybeArray<T>, options?: CollectionSaveOptions): Promise<T[]> {
          if (!options?.skipVersioning) {
            const newDocs = isArray(docs) ? docs : [docs];

            for (const doc of newDocs) {
              // @ts-expect-error FIXME?
              doc.version = getVersion(doc.version);
            }
          }

          return oldSave.call(this, docs, options);
        };

        const oldInsert = collection.insert as ViewDBCollection<T>["insert"];
        collection.insert = async function (docs: MaybeArray<T>, options: CollectionInsertOptions): Promise<T[]> {
          if (!options?.skipVersioning) {
            if (!isArray(docs)) {
              docs = [docs];
            }

            for (const doc of docs) {
              // @ts-expect-error FIXME?
              doc.version = getVersion(doc.version);
            }
          }

          return oldInsert.call(this, docs, options);
        };

        const oldFindAndModify = collection.findAndModify as ViewDBCollection<T>["findAndModify"];
        collection.findAndModify = async function (
          query: Query<T>,
          sort: SortObject | null,
          update: UpdateFilter,
          options: CollectionFindAndModifyOptions
        ): Promise<FindAndModifyResult> {
          if (!options?.skipVersioning) {
            const inc = update.$inc || {};
            inc.version = 1;
            update.$inc = inc;

            if (update.$set && update.$set.version >= 0) {
              delete update.$set.version;
            }
          }

          return oldFindAndModify.call(this, query, sort, update, options);
        };

        const oldUpdateMany = collection.updateMany as ViewDBCollection<T>["updateMany"];
        collection.updateMany = async function (query: Query<T>, update: UpdateFilter, options: CollectionUpdateManyOptions): Promise<T[]> {
          if (!options?.skipVersioning) {
            const inc = update.$inc || {};
            inc.version = 1;
            update.$inc = inc;

            if (update.$set && update.$set.version >= 0) {
              delete update.$set.version;
            }
          }

          return oldUpdateMany.call(this, query, update, options);
        };

        const oldUpdateOne = collection.updateOne as ViewDBCollection<T>["updateOne"];
        collection.updateOne = async function (query: Query<T>, update: UpdateFilter, options?: CollectionUpdateOneOptions): Promise<T> {
          if (!options?.skipVersioning) {
            const inc = update.$inc || {};
            inc.version = 1;
            update.$inc = inc;

            if (update.$set && update.$set.version >= 0) {
              delete update.$set.version;
            }
          }

          return oldUpdateOne.call(this, query, update, options);
        };
      }

      return collection as ViewDBCollection<T>;
    };
  }
}

function getVersion(version?: number) {
  return isUndefined(version) ? 0 : version + 1;
}
