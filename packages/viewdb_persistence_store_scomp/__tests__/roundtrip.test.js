const { createScompPeer } = require('@scomp/core');
const { createScompClient } = require('@scomp/client');
const { createInprocessTransport } = require('@scomp/transport-inprocess');
const ViewDB = require('viewdb');
const { Client, createServer, ViewDbContract } = require('..');

function createTestEnvironment(clientOptions) {
  const transport = createInprocessTransport();
  const viewdb = new ViewDB();

  const serverService = createServer(viewdb);

  const peer = createScompPeer({
    transports: [transport],
    clientFactory: (t, token) => {
      const client = createScompClient({
        transport: t,
        routeHints: { [token.name + '.observe']: 'feed' }
      });
      return client[token.name];
    },
    controlPlane: false
  });

  peer.provides(serverService);
  const proxy = peer.consumes(ViewDbContract);
  const store = new Client(proxy, clientOptions);

  return { viewdb, peer, store, transport };
}

describe('viewdb_persistence_store_scomp', () => {
  describe('read operations', () => {
    let env;

    beforeEach(() => {
      env = createTestEnvironment();
    });

    afterEach(async () => {
      await env.peer.close();
    });

    it('find returns empty array for empty collection', (done) => {
      env.store.open(() => {
        env.store
          .collection('items')
          .find({})
          .toArray((err, results) => {
            expect(err).toBeNull();
            expect(results).toEqual([]);
            done();
          });
      });
    });

    it('count returns 0 for empty collection', (done) => {
      env.store.open(() => {
        env.store.collection('items').count({}, {}, (err, count) => {
          expect(err).toBeNull();
          expect(count).toBe(0);
          done();
        });
      });
    });
  });

  describe('write operations (writable mode)', () => {
    let env;

    beforeEach(() => {
      env = createTestEnvironment({ writable: true });
    });

    afterEach(async () => {
      await env.peer.close();
    });

    it('insert documents then find retrieves them', (done) => {
      env.store.open(() => {
        const col = env.store.collection('items');
        col.insert({ _id: 'a', value: 1 }, {}, (err) => {
          expect(err).toBeNull();
          col.find({}).toArray((err, results) => {
            expect(err).toBeNull();
            expect(results.length).toBe(1);
            expect(results[0]._id).toBe('a');
            expect(results[0].value).toBe(1);
            done();
          });
        });
      });
    });

    it('insert multiple documents via array', (done) => {
      env.store.open(() => {
        const col = env.store.collection('items');
        col.insert([{ _id: 'a' }, { _id: 'b' }], {}, (err) => {
          expect(err).toBeNull();
          col.find({}).toArray((err, results) => {
            expect(err).toBeNull();
            expect(results.length).toBe(2);
            done();
          });
        });
      });
    });

    it('save upserts documents', (done) => {
      env.store.open(() => {
        const col = env.store.collection('items');
        col.insert({ _id: 'a', version: 1 }, {}, () => {
          col.save({ _id: 'a', version: 2 }, {}, () => {
            col.find({}).toArray((err, results) => {
              expect(err).toBeNull();
              expect(results.length).toBe(1);
              expect(results[0].version).toBe(2);
              done();
            });
          });
        });
      });
    });

    it('remove deletes documents', (done) => {
      env.store.open(() => {
        const col = env.store.collection('items');
        col.insert([{ _id: 'a' }, { _id: 'b' }], {}, () => {
          col.remove({ _id: 'a' }, {}, (err) => {
            expect(err).toBeNull();
            col.find({}).toArray((err, results) => {
              expect(err).toBeNull();
              expect(results.length).toBe(1);
              expect(results[0]._id).toBe('b');
              done();
            });
          });
        });
      });
    });

    it('count returns correct count after inserts', (done) => {
      env.store.open(() => {
        const col = env.store.collection('items');
        col.insert([{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }], {}, () => {
          col.count({}, {}, (err, count) => {
            expect(err).toBeNull();
            expect(count).toBe(3);
            done();
          });
        });
      });
    });

    it('find with sort, limit, skip', (done) => {
      env.store.open(() => {
        const col = env.store.collection('items');
        col.insert(
          [
            { _id: 'c', order: 3 },
            { _id: 'a', order: 1 },
            { _id: 'b', order: 2 },
            { _id: 'd', order: 4 }
          ],
          {},
          () => {
            col
              .find({})
              .sort({ order: 1 })
              .skip(1)
              .limit(2)
              .toArray((err, results) => {
                expect(err).toBeNull();
                expect(results.length).toBe(2);
                expect(results[0]._id).toBe('b');
                expect(results[1]._id).toBe('c');
                done();
              });
          }
        );
      });
    });
  });

  describe('observe', () => {
    let env;

    beforeEach(() => {
      env = createTestEnvironment({ writable: true });
    });

    afterEach(async () => {
      await env.peer.close();
    });

    it('receives init event with current documents', (done) => {
      env.store.open(() => {
        // Insert directly into viewdb so data exists before observe
        env.viewdb.collection('items').insert({ _id: 'x', name: 'existing' });

        const col = env.store.collection('items');
        const cursor = col.find({});
        const handle = cursor.observe({
          init: (documents) => {
            expect(documents.length).toBe(1);
            expect(documents[0]._id).toBe('x');
            handle.stop();
            done();
          }
        });
      });
    });

    it('receives added event when a document is inserted', (done) => {
      env.store.open(() => {
        const col = env.store.collection('items');
        const cursor = col.find({});
        let initReceived = false;

        const handle = cursor.observe({
          init: () => {
            initReceived = true;
            // Insert after init to trigger added event
            env.viewdb.collection('items').insert({ _id: 'new', name: 'added' });
          },
          added: (document, index) => {
            if (!initReceived) return;
            expect(document._id).toBe('new');
            expect(typeof index).toBe('number');
            handle.stop();
            done();
          }
        });
      });
    });

    it('stop cleans up the observer', (done) => {
      env.store.open(() => {
        const col = env.store.collection('items');
        const cursor = col.find({});
        const handle = cursor.observe({
          init: () => {
            handle.stop();
            // After stopping, inserting should not cause errors
            env.viewdb.collection('items').insert({ _id: 'after-stop' });
            // Give a small delay to confirm no errors
            setTimeout(() => done(), 50);
          }
        });
      });
    });
  });

  describe('read-only mode', () => {
    let env;

    beforeEach(() => {
      env = createTestEnvironment(); // writable defaults to false
    });

    afterEach(async () => {
      await env.peer.close();
    });

    it('insert throws in read-only mode', () => {
      const col = env.store.collection('items');
      expect(() => col.insert({ _id: 'a' })).toThrow('Not implemented');
    });

    it('save throws in read-only mode', () => {
      const col = env.store.collection('items');
      expect(() => col.save({ _id: 'a' })).toThrow('Not implemented');
    });

    it('remove throws in read-only mode', () => {
      const col = env.store.collection('items');
      expect(() => col.remove({ _id: 'a' })).toThrow('Not implemented');
    });
  });
});
