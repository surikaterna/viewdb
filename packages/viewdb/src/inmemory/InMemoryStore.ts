import type { Store, VDocument } from "../types";
import InMemoryCollection from "./InMemoryCollection";

class InMemoryStore implements Store {
  readonly _collections: Record<string, InMemoryCollection<any>>;

  constructor() {
    this._collections = {};
  }

  collection<T extends VDocument = VDocument>(name: string): InMemoryCollection<T> {
    const existingCollection = this._collections[name];
    if (existingCollection) {
      return existingCollection;
    }

    const newCollection = new InMemoryCollection<T>(name);
    this._collections[name] = newCollection;
    return newCollection;
  }
}

export default InMemoryStore;
