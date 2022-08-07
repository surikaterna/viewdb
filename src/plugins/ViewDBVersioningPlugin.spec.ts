import { forEach } from 'lodash';
import ViewDB, { Collection, VersioningPlugin } from '..';
import ViewDb from '..';

describe('ViewDB versioning plugin', () => {
  let viewDb: ViewDB;
  let collection: Collection;
  let currentTime: number;
  const doc123Id = '123';
  const doc999Id = '999';
  let doc123: Record<string, any>;
  let doc999: Record<string, any>;

  beforeEach(() => {
    viewDb = new ViewDb();
    new VersioningPlugin(viewDb);

    collection = viewDb.collection('test');
    currentTime = new Date().valueOf();
    doc123 = { id: doc123Id };
    doc999 = { id: doc999Id };
  });

  it('should add version on insert', (done) => {
    const collection = viewDb.collection('test');
    collection.insert(doc123, () => {
      collection.find({id: doc123Id}).toArray((err, docs) => {
        expect(docs?.[0]?.version).toBe(0);
        done();
      });
    });
  });

  it('should add version on bulk insert', (done) => {
    collection.insert([{id: doc123Id}, {id: doc999Id}], () => {
      collection.find({}).toArray((err, docs) => {
        expect(docs?.[0].version).toBe(0);
        expect(docs?.[1].version).toBe(0);
        done();
      });
    });
  });

  it('should increase version on save', (done) => {
    collection.insert(doc123, () => {
      doc123.name = 'Pelle';
      collection.save(doc123, () => {
        collection.find({id: doc123Id}).toArray((err, docs) => {
          const doc = docs?.[0];
          expect(doc?.version).toBe(1);
          expect(doc?.name).toBe('Pelle');
          done();
        });
      });
    });
  });

  it('should increase version on bulk save', (done) => {
    collection.insert([{_id: doc123Id, version: 10}, {_id: doc999Id, version: 101}], () => {
      collection.find({}).toArray((err, docs ) => {
        if (!docs) {
          return done(new Error('Did not receive inserted documents'));
        }

        forEach(docs, (doc, index) => {
          doc.name = index === 0 ? 'Pelle' : 'Kalle';
        });

        collection.save(docs, () => {
          collection.find({}).toArray((err, docs ) => {
            if (!docs) {
              return done(new Error('Did not receive saved documents'));
            }

            const firstDoc = docs[0];
            const secondDoc = docs[1];

            expect(firstDoc.version).toBe(12); // add 1 version for insert and one for save
            expect(firstDoc.name).toBe('Pelle');
            expect(secondDoc.version).toBe(103);
            expect(secondDoc.name).toBe('Kalle');
            done();
          });
        });
      });
    });
  });

  it('should skip changing version with skipVersioning option on save', (done) => {
    collection.insert(doc123, (err, docs) => {
      const doc = docs?.[0];
      expect(doc?.version).toBe(0);

      doc123.name = 'Pelle';
      collection.save(doc123, {skipVersioning: true}, () => {
        collection.find({id: doc123Id}).toArray((err, docs) => {
          const doc = docs?.[0];
          expect(doc?.version).toBe(0);
          expect(doc?.name).toBe('Pelle');
          done();
        });
      });
    });
  });

  it('should add version on save', (done) => {
    collection.insert(doc123, () => {
      doc123.name = 'Pelle';
      doc123.version = undefined;
      collection.save(doc123, () => {
        collection.find({id: doc123Id}).toArray((err, docs) => {
          const doc = docs?.[0];
          expect(doc?.version).toBe(0);
          expect(doc?.name).toBe('Pelle');
          done();
        });
      });
    });
  });
});
