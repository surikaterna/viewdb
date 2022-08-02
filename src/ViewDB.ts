import { BaseDocument, Collection } from './Collection';
import { CollectionCallback, Store } from './Store';
import InMemoryStore from './inmemory/InMemoryStore';

export default class ViewDB {
  private readonly store: Store;

  constructor(store: Store) {
    this.store = store || new InMemoryStore();
  }

  collection = <Document extends BaseDocument = Record<string, any>>(collectionName: string, callback: CollectionCallback<Document>): Collection<Document> => {
    return this.store.collection(collectionName, callback);
  };

  open = async (): Promise<ViewDB> => {
    if (this.store.open) {
      await this.store.open();
      return this;
    } else {
      return this;
    }
  };
}
