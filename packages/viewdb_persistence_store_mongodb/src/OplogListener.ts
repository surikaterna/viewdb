import type { Db } from "mongodb";
import type { Indexed, ViewDBObserver } from "viewdb";

export type OplogListenerConstructor<T extends Indexed = any> = new (db: Db, namespace: string, collectionName: string) => OplogListener<T>;

// this.oplogListeners[collectionName] = new this.oplogListener(this.db, namespaceFilter, collectionName);

export interface OplogListener<T extends Indexed> {
  listen(namespace: string, onOperation: OperationHandler<T>, context: ViewDBObserver): Disposable;
}

export type OperationHandler<T extends Indexed> = (payload: OperationPayload<T>) => void;

export type OperationPayload<T extends Indexed> = {
  /**
   * The DB operation performed.
   * i = insert
   * u = update
   * d = delete
   */
  op: "i" | "u" | "d";
  o: T;
};

export type Disposable = {
  dispose: DisposeFunc;
};

type DisposeFunc = () => void;
