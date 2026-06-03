declare module 'kuery' {
  class Kuery {
    constructor(query: any);
    /** Test a single document against the query. */
    test(doc: any): boolean;
    /** Find all matching documents with optional sort/skip/limit. */
    find(collection: readonly any[]): readonly any[];
    limit(amount: number): this;
    skip(amount: number): this;
    sort(sortObject: Record<string, 1 | -1>): this;
  }

  export = Kuery;
}
