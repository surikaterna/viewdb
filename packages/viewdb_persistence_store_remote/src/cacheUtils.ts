import SHA256 from "crypto-js/sha256";

export function generateQueryHash(
  query: Record<string, any>,
  collection: string,
  skip?: number,
  limit?: number,
  sort?: Record<string, 1 | -1>,
  project?: Record<string, 0 | 1>
): string {
  return SHA256(
    `${collection}:${skip || 0}:${limit || 0}:${JSON.stringify(sort || {})}:${JSON.stringify(project || {})}:${JSON.stringify(query)}`
  ).toString();
}
