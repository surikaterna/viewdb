import { BaseDocument, Collection, CollectionCallback } from './Collection';

export interface Store {
  collection<Document extends BaseDocument = Record<string, any>>(collectionName: string, callback?: CollectionCallback<Document>): Collection<Document>;

  open?(): Promise<void>;
}
