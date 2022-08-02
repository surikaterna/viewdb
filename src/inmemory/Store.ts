import Collection, { BaseDocument } from './Collection';

export interface CollectionCallback<Document extends BaseDocument = Record<string, any>> {
  (collection: Collection<Document>): void;
}

export default class Store {
  _collections: Record<string, Collection<any>>;

  constructor() {
    this._collections = {};
  }

  collection = <Document extends BaseDocument = Record<string, any>>(collectionName: string, callback: CollectionCallback<Document>) => {
    let coll: Collection<Document> | undefined = this._collections[collectionName];

    if (coll === undefined) {
      coll = new Collection<Document>(collectionName);
      this._collections[collectionName] = coll;
    }

    if (callback) {
      callback(coll);
    }

    return coll;
  };
}
