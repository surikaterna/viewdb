import type { Document, Filter } from "./mongodb";

export type Query<TSchema> = Filter<TSchema>;

export type QueryOptions = {
  limit?: number;
  project?: Document;
  skip?: number;
  sort?: SortObject;
};

export type QueryObject<T extends Document = Document> = QueryOptions & {
  query?: Filter<T>;
};

export type SortObject = Record<string, 1 | -1>;
