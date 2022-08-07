import { after } from 'lodash';
import ViewDb from '.';

describe('Observe', () => {
  it('#observe with insert', (done) => {
    const store = new ViewDb();
    store.open().then(() => {
      const cursor = store.collection('dollhouse').find({});
      const handle = cursor.observe({
        added: (x) => {
          expect(x._id).toBe('echo');
          handle.stop();
          done();
        }
      });
      store.collection('dollhouse').insert({_id: 'echo'});
    });
  });
  it('#observe with query and insert', (done) => {
    const store = new ViewDb();
    store.open().then(() => {
      store.collection('dollhouse').insert({_id: 'echo'});
      const cursor = store.collection('dollhouse').find({_id: 'echo2'});
      const handle = cursor.observe({
        added: (x) => {
          expect(x._id).toBe('echo2');
          handle.stop();
          done();
        }
      });
      store.collection('dollhouse').insert({_id: 'echo2'});
    });
  });
  it('#observe with query and update', (done) => {
    const store = new ViewDb();
    store.open().then(() => {
      const cursor = store.collection('dollhouse').find({_id: 'echo'});
      const handle = cursor.observe({
        added: (x) => {
          expect(x.age).toBe(10);
          expect(x._id).toBe('echo');
        }, changed: (o, n) => {
          expect(o.age).toBe(10);
          expect(n.age).toBe(100);
          handle.stop();
          done();
        }
      });

      store.collection('dollhouse').insert({_id: 'echo', age: 10}, () => {
        store.collection('dollhouse').save({_id: 'echo', age: 100});
      });
    });
  });
  it('#observe with query and skip', (done) => {
    const store = new ViewDb();
    store.open().then(() => {
      store.collection('dollhouse').insert({_id: 'echo'});
      store.collection('dollhouse').insert({_id: 'echo2'});
      store.collection('dollhouse').insert({_id: 'echo3'});
      const cursor = store.collection('dollhouse').find({});
      let skip = 0;
      cursor.limit(1);
      const realDone = after(3, () => {
        cursor.toArray((err, res) => {
          expect(res?.length).toBe(0);
          handle.stop();
          done();
        });
      });
      const handle = cursor.observe({
        added: () => {
          cursor.skip(++skip);
          realDone();
        }
      });
    });
  });
  it('#observe with no results', (done) => {
    const store = new ViewDb();
    store.open().then(() => {
      const cursor = store.collection('dollhouse').find({});
      const handle = cursor.observe({
        init: (coll) => {
          expect(coll?.length).toBe(0);
          handle.stop();
          done();
        }
      });
    });
  });
  it('#observe with init after one insert', (done) => {
    const store = new ViewDb();
    store.collection('dollhouse').insert({_id: 'echo'}, () => {
      store.open().then(() => {
        const cursor = store.collection('dollhouse').find({});
        const handle = cursor.observe({
          init: (coll) => {
            expect(coll?.length).toBe(1);
            handle.stop();
            done();
          }
        });
      });
    });
  });
  it('#observe with one insert after init', (done) => {
    const store = new ViewDb();
    store.open().then(() => {
      const cursor = store.collection('dollhouse').find({});
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
    });
    setTimeout(() => {
      store.collection('dollhouse').insert({_id: 'echo'});
    }, 5);
  });
});
