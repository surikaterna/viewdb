import ViewDB from '..';
import ViewDb, { Collection, TimestampPlugin, VersioningPlugin } from '..';

describe('ViewDB timestamp plugin', () => {
  let viewDb: ViewDB;
  let collection: Collection;
  let currentTime: number;
  const doc123Id = '123';
  const doc999Id = '999';
  let doc123: Record<string, any>;
  let doc999: Record<string, any>;

  beforeEach(() => {
    viewDb = new ViewDb();
    new TimestampPlugin(viewDb);
    new VersioningPlugin(viewDb);

    collection = viewDb.collection('test');
    currentTime = new Date().valueOf();
    doc123 = { id: doc123Id };
    doc999 = { id: doc999Id };
  });

  it('should add changeDateTime and createDateTime timestamp on insert', (done) => {
    // wait 5ms until update operation to check for lastModified updated
    setTimeout(() => {
      collection.insert(doc123, () => {
        collection.find({ id: doc123Id }).toArray((err, docs) => {
          if (!docs) {
            return done(new Error('Did not receive inserted documents'));
          }

          const { createDateTime, changeDateTime } = docs[0]

          expect(createDateTime).toBeDefined();
          expect(createDateTime).toBe(changeDateTime);

          if (currentTime < createDateTime) {
            done();
          } else {
            done(new Error('Timestamp was not renewed'));
          }
        });
      });
    }, 5);
  });

  it('should add changeDateTime and createDateTime timestamp on bulk insert', (done) => {
    // wait 5ms until update operation to check for lastModified updated
    setTimeout(() => {
      collection.insert([doc123, doc999], () => {
        collection.find({}).toArray((err, docs) => {
          if (!docs) {
            return done(new Error('Did not receive inserted documents'));
          }

          docs.forEach(({ createDateTime, changeDateTime }) => {
            expect(createDateTime).toBeDefined();
            expect(changeDateTime).toBeGreaterThan(currentTime);
          });

          done();
        });
      });
    }, 5);
  });

  it('should update changeDateTime on bulk save', (done) => {
    collection.insert([doc123, doc999], () => {
      collection.find({}).toArray((err, docs) => {
        if (!docs) {
          return done(new Error('Did not receive inserted documents'));
        }

        const { createDateTime: insertCreateDateTime, changeDateTime: insertChangeDateTime } = docs[0]
        expect(insertCreateDateTime).toBeDefined();
        expect(insertCreateDateTime).toBe(insertChangeDateTime);

        setTimeout(() => {
          collection.save([
            { _id: doc123Id, name: 'Pelle', createDateTime: insertCreateDateTime, changeDateTime: insertChangeDateTime },
            { _id: doc999Id, name: 'Kalle', createDateTime: insertCreateDateTime, changeDateTime: insertChangeDateTime }
          ], () => {
            collection.find({}).toArray((err, docs) => {
              if (!docs) {
                return done(new Error('Did not receive saved documents'));
              }

              docs.forEach(({ createDateTime, changeDateTime }) => {
                expect(createDateTime).toBe(insertCreateDateTime);
                expect(changeDateTime).toBeGreaterThan(insertCreateDateTime);
              });

              done();
            });
          });
        }, 5);
      });
    });
  });

  it('should update changeDateTime on save', (done) => {
    collection.insert(doc123);
    collection.find({ id: doc123Id }).toArray((err, docs) => {
      if (!docs) {
        return done(new Error('Did not receive inserted document'));
      }

      const insertTime = docs[0].createDateTime;

      // wait 5ms until update operation to check for changeDateTime updated
      setTimeout(() => {
        doc123.name = 'Pelle';
        collection.save(doc123, () => {
          collection.find({ id: doc123Id }).toArray((err, docs) => {
            if (!docs) {
              return done(new Error('Did not receive saved document'));
            }

            const { createDateTime, changeDateTime } = docs[0];
            expect(createDateTime).toBe(insertTime);
            expect(changeDateTime).toBeGreaterThan(insertTime);
            done();
          });
        });
      }, 5);
    });
  });

  it('should skip changing timestamp with skipTimestamp option on save', (done) => {
    collection.insert(doc123);
    collection.find({id: '123'}).toArray((err, docs) => {
      const insertTime = docs?.[0]?.createDateTime;

      // wait 5ms until update operation to check for changeDateTime updated
      setTimeout(() => {
        doc123.name = 'Pelle';
        collection.save(doc123, {skipTimestamp: true}, () => {
          collection.find({id: doc123Id}).toArray((err, docs) => {
            if (!docs) {
              return done(new Error('Did not receive saved document'));
            }

            const { createDateTime, changeDateTime } = docs[0];
            expect(createDateTime).toBe(insertTime);
            expect(changeDateTime).toBe(insertTime);
            done();
          });
        });
      }, 5);
    });
  });

  it('should work together with version plugin', (done) => {
    collection.insert(doc123, () => {
      doc123.name = 'Pelle';
      doc123.version = undefined;
      collection.save(doc123, () => {
        collection.find({id: '123'}).toArray((err, docs) => {
          if (!docs) {
            return done(new Error('Did not receive saved document'));
          }

          const { name, version, createDateTime, changeDateTime } = docs[0];
          expect(version).toBe(0);
          expect(name).toBe('Pelle');
          expect(createDateTime).toBeDefined();
          expect(changeDateTime).toBeDefined();
          done();
        });
      });
    });
  });
});
