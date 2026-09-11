import { MongoMemoryReplSet } from 'mongodb-memory-server';

let replSet;

export async function setup() {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    binary: { version: '7.0.37' }
  });
  const uri = replSet.getUri();
  process.env.MONGO_URI = uri;
}

export async function teardown() {
  if (replSet) {
    await replSet.stop();
  }
}
