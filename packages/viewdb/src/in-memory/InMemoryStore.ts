import type { Indexed, ViewDBStore } from "../interfaces";
import Collection from "./InMemoryCollection";

export class Store implements ViewDBStore {
  private readonly collections: Record<string, Collection<any>>;

  constructor() {
    this.collections = {};
  }

  collection<T extends Indexed>(name: string): Collection<T> {
    const existingCollection = this.collections[name];

    if (!existingCollection) {
      const collection = new Collection<T>(name);
      this.collections[name] = collection;
      return collection;
    }

    return existingCollection;
  }
}

export default Store;
