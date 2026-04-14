import SHA256 = require('crypto-js/sha256');

export function generateQueryHash(query: any, collection: string, skip?: number, limit?: number, sort?: any, project?: any): string {
  return SHA256(`${collection}:${skip || 0}:${limit || 0}:${JSON.stringify(sort || {})}:${JSON.stringify(project || {})}:${JSON.stringify(query)}`).toString();
}
