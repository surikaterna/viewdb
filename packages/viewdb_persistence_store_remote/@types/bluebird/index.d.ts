declare module 'bluebird' {
  class Bluebird<T> extends Promise<T> {
    static resolve<U>(value?: U): Bluebird<U>;
    static reject<U>(reason?: any): Bluebird<U>;
    static all<U>(values: Array<U | PromiseLike<U>>): Bluebird<U[]>;
    nodeify(callback?: (err: any, value?: T) => void): Bluebird<T>;
  }
  export = Bluebird;
}
