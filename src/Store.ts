import { BaseDocument, Collection } from './Collection';

export interface CollectionCallback<Document extends BaseDocument = Record<string, any>> {
  (collection: Collection<Document>): void;
}

export interface Store {
  collection<Document extends BaseDocument = Record<string, any>>(collectionName: string, callback: CollectionCallback<Document>): Collection<Document>;
  open?(): Promise<void>;
}
