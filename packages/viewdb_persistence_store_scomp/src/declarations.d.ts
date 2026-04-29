declare module '@scomp/core' {
  export function createContractToken<T>(name: string): T;
  export function createScompService<T>(contract: T): {
    implement(definition: { requests: Record<string, unknown>; feeds: Record<string, unknown>; signals: Record<string, unknown> }): unknown;
  };
  export function createScompFeed<T>(): AsyncIterable<T> & {
    next(value: T): void;
    onUnsubscribe(cb: () => void): void;
  };
}
