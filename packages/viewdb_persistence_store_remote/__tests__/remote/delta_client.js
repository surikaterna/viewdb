var assert = require('assert').strict;
var compare = require('fast-json-patch').compare;
var Observer = require('../../dist/client/observe');
const { FakeClient, collection, observeWithState, negotiatedInit } = require('./delta_client_fixture.cjs');

describe('remote delta client reconstruction', function () {
  it('reconstructs nested edits and removals privately across caller mutation', function () {
    var client = new FakeClient({
      deltaCache: { maxEntries: 16, maxBytes: 65536 }
    });
    var original = { _id: 'a', version: 1, nested: { count: 1 }, values: [1, 2], removeMe: true };
    var originalCopy = JSON.parse(JSON.stringify(original));
    var next = { _id: 'a', version: 2, nested: { count: 2 }, values: [1, 2, 3] };
    var latest = { _id: 'a', version: 3, nested: { count: 3 }, values: [0, 1, 2, 3] };
    var changes = [];
    var observer = observeWithState(client, {
      changed: function (oldDocument, newDocument, index) {
        changes.push({ old: oldDocument, next: newDocument, index: index });
        if (changes.length === 1) {
          newDocument.nested.count = 900;
          newDocument.values.push(900);
        }
      }
    });

    assert.equal(client.subscriptions[0].payload.deltaVersion, 1);
    assert.equal(Object.prototype.hasOwnProperty.call(client.subscriptions[0].payload, 'deltaCache'), false);
    assert.deepEqual(client.subscriptions[0].payload.events, { i: false, a: false, r: false, c: true, m: false });
    negotiatedInit(client, [original]);
    client.send({
      sequence: 1,
      changes: [{ d: { documentId: 'a', baseVersion: 1, version: 2, patch: compare(original, next), i: 0 } }]
    });
    client.send({
      sequence: 2,
      changes: [{ d: { documentId: 'a', baseVersion: 2, version: 3, patch: compare(next, latest), i: 0 } }]
    });

    assert.equal(changes.length, 2);
    assert.deepEqual(changes[0].old, original);
    assert.deepEqual(changes[1].old, next);
    assert.deepEqual(changes[1].next, latest);
    assert.equal(changes[1].index, 0);
    assert.notStrictEqual(changes[0].old, original);
    assert.deepEqual(original, originalCopy);
    assert.equal(client.findRequest('observe.document'), undefined);
    observer.stop();
  });

  it('ignores duplicate and stale delta targets without changing callback state', function () {
    var client = new FakeClient();
    var base = { _id: 'a', version: 1, value: 'one' };
    var target = { _id: 'a', version: 2, value: 'two' };
    var changed = [];
    var observer = observeWithState(client, {
      changed: function (_oldDocument, newDocument) {
        changed.push(newDocument);
      }
    });
    negotiatedInit(client, [base]);
    var delta = { d: { documentId: 'a', baseVersion: 1, version: 2, patch: compare(base, target), i: 0 } };
    client.send({ sequence: 1, changes: [delta] });
    client.send({ sequence: 2, changes: [delta] });
    client.send({
      sequence: 3,
      changes: [{ d: { documentId: 'a', baseVersion: 0, version: 1, patch: [], i: 0 } }]
    });
    assert.equal(changed.length, 1);
    assert.deepEqual(changed[0], target);
    assert.equal(client.findRequest('observe.document'), undefined);
    observer.stop();
  });

  it('recovers entries evicted from the bounded private baseline cache', function () {
    var client = new FakeClient({ deltaCache: { maxEntries: 1, maxBytes: 4096 } });
    var a1 = { _id: 'a', version: 1, value: 'a1' };
    var a2 = { _id: 'a', version: 2, value: 'a2' };
    var a3 = { _id: 'a', version: 3, value: 'a3' };
    var b1 = { _id: 'b', version: 1, value: 'b1' };
    var b2 = { _id: 'b', version: 2, value: 'b2' };
    var calls = [];
    var observer = observeWithState(client, {
      changed: function (oldDocument, newDocument) {
        calls.push({ old: oldDocument, next: newDocument });
      }
    });
    negotiatedInit(client, [a1, b1]);
    client.send({ sequence: 1, changes: [{ d: { documentId: 'a', baseVersion: 1, version: 2, patch: compare(a1, a2), i: 0 } }] });
    var recovery = client.findRequest('observe.document');
    assert.ok(recovery);
    client.reply(recovery, { visible: true, document: a2, index: 0, sequence: 1 });
    client.send({ sequence: 2, changes: [{ c: { o: null, n: b2, i: 1 } }] });
    client.send({ sequence: 3, changes: [{ d: { documentId: 'a', baseVersion: 1, version: 2, patch: compare(a1, a2), i: 0 } }] });
    assert.equal(client.findRequest('observe.document'), undefined);
    client.send({ sequence: 4, changes: [{ d: { documentId: 'a', baseVersion: 2, version: 3, patch: compare(a2, a3), i: 0 } }] });
    var secondRecovery = client.findRequest('observe.document');
    assert.ok(secondRecovery);
    client.reply(secondRecovery, { visible: true, document: a3, index: 0, sequence: 4 });

    assert.deepEqual(
      calls.map(function (call) {
        return call.next;
      }),
      [a2, b2, a3]
    );
    assert.equal(calls[0].old, null);
    assert.equal(client.findRequest('observe.document'), undefined);
    observer.stop();
  });

  it('keeps equal-version full updates authoritative and never regresses a baseline', function () {
    var client = new FakeClient();
    var initial = { _id: 'a', version: 1, value: 'initial' };
    var equal = { _id: 'a', version: 1, value: 'equal-version update' };
    var v2 = { _id: 'a', version: 2, value: 'version two' };
    var decreasing = { _id: 'a', version: 1, value: 'decreasing full event' };
    var v3 = { _id: 'a', version: 3, value: 'version three' };
    var invalid = { _id: 'a', version: 'invalid', value: 'full only' };
    var v4 = { _id: 'a', version: 4, value: 'recovered version four' };
    var calls = [];
    var observer = observeWithState(client, {
      changed: function (oldDocument, newDocument) {
        calls.push({ old: oldDocument, next: newDocument });
      }
    });
    negotiatedInit(client, [initial]);
    client.send({ sequence: 1, changes: [{ c: { o: null, n: equal, i: 0 } }] });
    client.send({ sequence: 2, changes: [{ d: { documentId: 'a', baseVersion: 1, version: 2, patch: compare(equal, v2), i: 0 } }] });
    client.send({ sequence: 3, changes: [{ c: { o: null, n: decreasing, i: 0 } }] });
    client.send({ sequence: 4, changes: [{ d: { documentId: 'a', baseVersion: 2, version: 3, patch: compare(v2, v3), i: 0 } }] });
    client.send({ sequence: 5, changes: [{ c: { o: null, n: invalid, i: 0 } }] });
    client.send({ sequence: 6, changes: [{ d: { documentId: 'a', baseVersion: 3, version: 4, patch: [], i: 0 } }] });
    var recovery = client.findRequest('observe.document');
    assert.ok(recovery);
    client.reply(recovery, { visible: true, document: v4, index: 0, sequence: 6 });

    assert.deepEqual(
      calls.map(function (call) {
        return call.next;
      }),
      [equal, v2, decreasing, v3, invalid, v4]
    );
    assert.deepEqual(calls[1].old, equal);
    assert.deepEqual(calls[3].old, v2);
    assert.equal(calls[5].old, null);
    observer.stop();
  });

  it('uses full callbacks with a legacy server that never acknowledges delta support', function () {
    var client = new FakeClient();
    var initial = { _id: 'a', version: 1, value: 'initial' };
    var updated = { _id: 'a', version: 2, value: 'legacy full update' };
    var initialized = [];
    var changes = [];
    var observer = new Observer(
      collection(client),
      {
        init: function (documents) {
          initialized.push(documents);
        },
        changed: function (oldDocument, newDocument) {
          changes.push({ old: oldDocument, next: newDocument });
        }
      },
      { query: { active: true } }
    );
    client.send({ handle: 'legacy-handle', changes: [{ i: { r: [initial] } }] });
    client.send({ changes: [{ c: { n: updated, i: 0 } }] });
    assert.equal(client.subscriptions[0].payload.deltaVersion, 1);
    assert.deepEqual(initialized, [[initial]]);
    assert.deepEqual(changes, [{ old: undefined, next: updated }]);
    assert.equal(client.findRequest('observe.document'), undefined);
    assert.equal(client.findRequest('observe.snapshot'), undefined);
    observer.stop();
  });

  it('preserves legacy document callbacks without a public init callback', function () {
    var client = new FakeClient();
    var added = [];
    var changed = [];
    var moved = [];
    var removed = [];
    var a1 = { _id: 'a', version: 1 };
    var a2 = { _id: 'a', version: 2 };
    var observer = new Observer(
      collection(client),
      {
        added: function (document, index) {
          added.push([document, index]);
        },
        changed: function (oldDocument, newDocument, index) {
          changed.push([oldDocument, newDocument, index]);
        },
        moved: function (document, oldIndex, newIndex) {
          moved.push([document, oldIndex, newIndex]);
        },
        removed: function (document, index) {
          removed.push([document, index]);
        }
      },
      { query: { active: true } }
    );
    client.send({ handle: 'legacy-handle', changes: [{ a: { e: a1, i: 0 } }] });
    client.send({ changes: [{ c: { n: a2, i: 0 } }] });
    client.send({ changes: [{ m: { e: a2, o: 0, n: 1 } }] });
    client.send({ changes: [{ r: { e: a2, i: 0 } }] });
    assert.deepEqual(added, [[a1, 0]]);
    assert.deepEqual(changed, [[undefined, a2, 0]]);
    assert.deepEqual(moved, [[a2, 0, 1]]);
    assert.deepEqual(removed, [[a2, 0]]);
    assert.equal(client.findRequest('observe.snapshot'), undefined);
    observer.stop();
  });

  it('coalesces recovery targets and still applies buffered updates for other documents', function () {
    var client = new FakeClient();
    var a1 = { _id: 'a', version: 1, value: 'a1' };
    var b1 = { _id: 'b', version: 1, value: 'b1' };
    var a3 = { _id: 'a', version: 3, value: 'a3' };
    var a4 = { _id: 'a', version: 4, value: 'a4' };
    var b2 = { _id: 'b', version: 2, value: 'b2' };
    var calls = [];
    var observer = observeWithState(client, {
      changed: function (oldDocument, newDocument, index) {
        calls.push({ old: oldDocument, next: newDocument, index: index });
      }
    });
    negotiatedInit(client, [a1, b1]);
    client.send({ sequence: 1, changes: [{ d: { documentId: 'a', baseVersion: 2, version: 3, patch: [], i: 0 } }] });
    var request = client.findRequest('observe.document');
    assert.deepEqual(request.payload['observe.document'], { h: 'observer-1', documentId: 'a' });
    client.send({ sequence: 2, changes: [{ d: { documentId: 'a', baseVersion: 3, version: 4, patch: [], i: 0 } }] });
    client.send({ sequence: 3, changes: [{ d: { documentId: 'b', baseVersion: 1, version: 2, patch: compare(b1, b2), i: 1 } }] });
    client.reply(request, { visible: true, document: a4, index: 0, sequence: 10 });

    assert.deepEqual(
      calls.map(function (call) {
        return call.next;
      }),
      [a4, b2]
    );
    assert.deepEqual(calls[0].old, a1);
    assert.equal(calls[1].index, 1);
    observer.stop();
  });
});
