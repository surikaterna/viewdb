import InMemoryStore from "./in-memory/InMemoryStore";
import type { Indexed, ViewDBCollection, ViewDBStore } from "./interfaces";

export class ViewDB {
  private store: ViewDBStore;

  constructor(store?: ViewDBStore) {
    this.store = store || new InMemoryStore();
  }

  async open(): Promise<this> {
    await this.store.open?.();
    return this;
  }

  collection<T extends Indexed>(name: string): ViewDBCollection<T> {
    return this.store.collection(name);
  }
}
