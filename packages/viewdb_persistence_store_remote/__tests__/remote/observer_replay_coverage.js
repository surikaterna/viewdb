const assert = require('assert').strict;
const { FakeClient, observeWithState, negotiatedInit } = require('./delta_client_fixture.cjs');

describe('Observer recovery replay coverage', function () {
  it('suppresses covered unversioned full changes without losing later corrections', function () {
    var client = new FakeClient();
    var changes = [];
    var observer = observeWithState(client, {
      changed: function (_previous, next) {
        changes.push(next);
      }
    });
    negotiatedInit(client, [{ _id: 'a', version: 1, value: 'base' }]);
    client.send({ sequence: 1, changes: [{ d: { documentId: 'a', baseVersion: 2, version: 3, patch: [], i: 0 } }] });
    var recovery = client.findRequest('observe.document');
    var covered = { _id: 'a', value: 'stale unversioned' };
    var later = { _id: 'a', version: 4, value: 'later sequence' };
    var unknownSequence = { _id: 'a', value: 'unknown sequence' };
    client.send({ sequence: 2, changes: [{ c: { o: null, n: covered, i: 0 } }] });
    client.send({ sequence: 3, changes: [{ c: { o: null, n: { _id: 'a', version: 3, value: 'version three' }, i: 0 } }] });
    client.send({ sequence: 4, changes: [{ c: { o: null, n: later, i: 0 } }] });
    client.send({ changes: [{ c: { o: null, n: unknownSequence, i: 0 } }] });
    var recovered = { _id: 'a', version: 3, value: 'recovered' };
    client.reply(recovery, { visible: true, document: recovered, index: 0, sequence: 3 });
    assert.deepEqual(changes, [recovered, later, unknownSequence]);
    observer.stop();
  });
});
