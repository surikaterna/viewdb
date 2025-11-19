import { Query, SortObject } from "kuery";
import clone from "lodash/clone";
import isArray from "lodash/isArray";
import { ViewDB } from "../ViewDB";
import {
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
import { MaybeArray } from "../types";

export class ViewDBTimestampPlugin {
  constructor(viewDb: ViewDB) {
    const oldCollection = viewDb.collection;

    viewDb.collection = function <T extends Indexed>(name: string): ViewDBCollection<T> {
      const newCollection = oldCollection.call(this, name);

      if (!newCollection.__plugins_timestamp) {
        newCollection.__plugins_timestamp = true;

        const oldSave = newCollection.save as ViewDBCollection<T>["save"];
        newCollection.save = async function (docs: MaybeArray<T>, options?: CollectionSaveOptions): Promise<T[]> {
          if (!options?.skipTimestamp) {
            const timestamp = new Date().valueOf();
            const newDocs = isArray(docs) ? docs : [docs];

            for (const doc of newDocs) {
              if (!("createDateTime" in doc)) {
                // @ts-expect-error FIXME?
                doc.createDateTime = timestamp;
              }
              // @ts-expect-error FIXME?
              doc.changeDateTime = timestamp;
            }
          }
          return oldSave.call(this, docs, options);
        };

        const oldInsert = newCollection.insert as ViewDBCollection<T>["insert"];
        newCollection.insert = async function (docs: MaybeArray<T>, options: CollectionInsertOptions): Promise<T[]> {
          if (!options?.skipTimestamp) {
            if (!isArray(docs)) {
              docs = [docs];
            }

            const timestamp = new Date().valueOf();

            for (const doc of docs) {
              // @ts-expect-error FIXME?
              doc.createDateTime = timestamp;
              // @ts-expect-error FIXME?
              doc.changeDateTime = timestamp;
            }
          }

          return oldInsert.call(this, docs, options);
        };

        const oldFindAndModify = newCollection.findAndModify as ViewDBCollection<T>["findAndModify"];
        newCollection.findAndModify = async function (
          query: Query<T>,
          sort: SortObject | null,
          update: UpdateFilter,
          options: CollectionFindAndModifyOptions
        ): Promise<FindAndModifyResult> {
          const timestamp = new Date().valueOf();
          const clonedUpdate = clone(update);
          const setOnInsert = clonedUpdate.$setOnInsert || {};
          setOnInsert.createDateTime = timestamp;
          clonedUpdate.$setOnInsert = setOnInsert;

          const set = clonedUpdate.$set || {};
          set.changeDateTime = timestamp;

          // if consumer tries to $set createDateTime it will lead to conflict. remove it
          if (set.createDateTime) {
            delete set.createDateTime;
          }

          clonedUpdate.$set = set;
          return oldFindAndModify.call(this, query, sort, clonedUpdate, options);
        };

        const oldUpdateMany = newCollection.updateMany as ViewDBCollection<T>["updateMany"];
        newCollection.updateMany = async function (query: Query<T>, update: UpdateFilter, options: CollectionUpdateManyOptions): Promise<T[]> {
          const timestamp = new Date().valueOf();
          const clonedUpdate = clone(update);
          const setOnInsert = clonedUpdate.$setOnInsert || {};
          setOnInsert.createDateTime = timestamp;
          clonedUpdate.$setOnInsert = setOnInsert;

          const set = clonedUpdate.$set || {};
          set.changeDateTime = timestamp;

          // if consumer tries to $set createDateTime it will lead to conflict. remove it
          if (set.createDateTime) {
            delete set.createDateTime;
          }

          clonedUpdate.$set = set;
          return oldUpdateMany.call(this, query, clonedUpdate, options);
        };

        const oldUpdateOne = newCollection.updateOne as ViewDBCollection<T>["updateOne"];
        newCollection.updateOne = async function (query: Query<T>, update: UpdateFilter, options?: CollectionUpdateOneOptions): Promise<T> {
          const timestamp = new Date().valueOf();
          const clonedUpdate = clone(update);
          const setOnInsert = clonedUpdate.$setOnInsert || {};
          setOnInsert.createDateTime = timestamp;
          clonedUpdate.$setOnInsert = setOnInsert;

          const set = clonedUpdate.$set || {};
          set.changeDateTime = timestamp;

          // if consumer tries to $set createDateTime it will lead to conflict. remove it
          if (set.createDateTime) {
            delete set.createDateTime;
          }

          clonedUpdate.$set = set;
          return oldUpdateOne.call(this, query, clonedUpdate, options);
        };
      }

      return newCollection as ViewDBCollection<T>;
    };
  }
}
