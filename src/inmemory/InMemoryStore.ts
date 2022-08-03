import { BaseDocument, Collection, CollectionCallback } from '../Collection';
import { Store } from '../Store';
import InMemoryCollection from './InMemoryCollection';

export default class InMemoryStore implements Store {
  _collections: Record<string, InMemoryCollection<any>>;

  constructor() {
    this._collections = {};
  }

  collection = <Document extends BaseDocument = Record<string, any>>(collectionName: string, callback: CollectionCallback<Document>): Collection<Document> => {
    let coll: InMemoryCollection<Document> | undefined = this._collections[collectionName];

    if (coll === undefined) {
      coll = new InMemoryCollection<Document>(collectionName);
      this._collections[collectionName] = coll;
    }

    if (callback) {
      callback(coll);
    }

    return coll;
  };
}
