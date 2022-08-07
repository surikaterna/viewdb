import { Nullable } from '../Collection';

export interface Callback<T, R = T> {
  (err: Nullable<Error>, result?: R): void;
}

/**
 * Will return a Promise if callback is undefined, and void if a callback is provided.
 */
export function maybePromise<T, R = T>(
  callback: Callback<T, R> | undefined,
  wrapper: (fn: Callback<T, R>) => void
): Promise<R> | void {
  let fallbackCallback: Callback<T, R> = callback ?? (() => {
  });
  let result: Promise<R> | void;

  if (typeof callback !== 'function') {
    result = new Promise<any>((resolve, reject) => {
      fallbackCallback = (err: Nullable<Error>, res?: R): void => {
        err ? reject(err) : resolve(res);
      };
    });
  }

  const fn: Callback<T, R> = (err: Nullable<Error>, res?: R): void => {
    if (err !== null) {
      try {
        fallbackCallback(err, res);
      } catch (error) {
        process.nextTick(() => {
          throw error;
        });
      }

      return;
    }

    fallbackCallback(err, res);
  };

  wrapper(fn);
  return result;
}
