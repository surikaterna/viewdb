import { after } from 'lodash';
import ViewDB, { Collection } from '.';

describe('Observe', () => {
  let store: ViewDB;
  let collection: Collection;

  beforeEach(async () => {
    store = new ViewDB();
    await store.open();
    collection = store.collection('dollhouse');
  });

  it('#observe with insert', (done) => {
    const cursor = collection.find({});
    const handle = cursor.observe({
      added: (doc) => {
        expect(doc._id).toBe('echo');
        handle.stop();
        done();
      }
    });
    collection.insert({_id: 'echo'});
  });

  it('#observe with query and insert', (done) => {
    collection.insert({_id: 'echo'}, () => {
      const cursor = collection.find({_id: 'echo2'});
      const handle = cursor.observe({
        added: (doc) => {
          expect(doc._id).toBe('echo2');
          handle.stop();
          done();
        }
      });
      collection.insert({_id: 'echo2'});
    });
  });

  it('#observe with query and update', (done) => {
    const cursor = collection.find({_id: 'echo'});
    const handle = cursor.observe({
      added: (doc) => {
        expect(doc.age).toBe(10);
        expect(doc._id).toBe('echo');
      },
      changed: (prevDoc, doc) => {
        expect(prevDoc.age).toBe(10);
        expect(doc.age).toBe(100);
        handle.stop();
        done();
      }
    });

    collection.insert({_id: 'echo', age: 10}, () => {
      collection.save({_id: 'echo', age: 100});
    });
  });

  it('#observe with query and skip', (done) => {
    const cursor = collection.find({});
    let skip = 0;
    cursor.limit(1);

    const checkOnThirdCall = after(3, () => {
      cursor.toArray((err, res) => {
        expect(res?.length).toBe(0);
        handle.stop();
        done();
      });
    });

    const handle = cursor.observe({
      added: () => {
        cursor.skip(++skip);
        checkOnThirdCall();
      }
    });

    collection.insert({_id: 'echo'});
    collection.insert({_id: 'echo2'});
    collection.insert({_id: 'echo3'});
  });

  it('#observe with no results', (done) => {
    const cursor = collection.find({});
    const handle = cursor.observe({
      init: (coll) => {
        expect(coll?.length).toBe(0);
        handle.stop();
        done();
      }
    });
  });

  it('#observe with init after one insert', (done) => {
    collection.insert({_id: 'echo'}, () => {
      const cursor = collection.find({});
      const handle = cursor.observe({
        init: (coll) => {
          expect(coll?.length).toBe(1);
          handle.stop();
          done();
        }
      });
    });
  });

  it('#observe with one insert after init', (done) => {
    const cursor = collection.find({});
    const handle = cursor.observe({
      init: (coll) => {
        expect(coll?.length).toBe(0);
      },
      added: (a) => {
        expect(a._id).toBe('echo');
        handle.stop();
        done();
      }
    });

    collection.insert({_id: 'echo'});
  });
});
