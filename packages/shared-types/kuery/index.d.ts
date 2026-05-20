declare module "kuery" {
  class Kuery {
    constructor(query: any);
    find(collection: any[]): any[];
    limit(amount: number): void;
    skip(amount: number): void;
    sort(sortObject: Record<string, 1 | -1>): void;
  }

  export = Kuery;
}
