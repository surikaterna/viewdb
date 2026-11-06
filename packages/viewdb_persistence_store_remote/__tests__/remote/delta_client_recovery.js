const assert = require('assert').strict;
const compare = require('fast-json-patch').compare;
const Observer = require('../../dist/client/observe');
const SocketClient = require('../../dist/client/rr_client');
const { FakeClient, collection, observeWithState, negotiatedInit } = require('./delta_client_fixture.cjs');

describe('Remote delta recovery and lifecycle', function () {
  it('falls back to a merged snapshot for structural changes without a second init', function () {
    var client = new FakeClient();
    var a1 = { _id: 'a', version: 1, rank: 1 };
    var b1 = { _id: 'b', version: 1, rank: 2 };
    var a3 = { _id: 'a', version: 3, rank: 3 };
    var a4 = { _id: 'a', version: 4, rank: 4 };
    var initCount = 0;
    var moves = [];
    var changes = [];
    var observer = new Observer(
      collection(client),
      {
        init: function () {
          initCount++;
        },
        changed: function (_oldDocument, newDocument) {
          changes.push(newDocument);
        },
        moved: function (document, oldIndex, newIndex) {
          moves.push([document._id, oldIndex, newIndex]);
        }
      },
      { query: { active: true } }
    );
    client.send({ handle: 'observer-1', deltaVersion: 1, sequence: 0, changes: [{ i: { r: [a1, b1] } }] });
    client.send({ sequence: 1, changes: [{ d: { documentId: 'a', baseVersion: 2, version: 3, patch: [], i: 0 } }] });
    var documentRequest = client.findRequest('observe.document');
    client.send({ sequence: 2, changes: [{ m: { e: b1, o: 1, n: 0 } }] });
    var snapshotRequest = client.findRequest('observe.snapshot');
    assert.ok(snapshotRequest);
    client.reply(snapshotRequest, { documents: [b1, a3], sequence: 4 });

    assert.equal(initCount, 1);
    assert.deepEqual(moves, [['b', 1, 0]]);
    assert.equal(client.subscriptions[0].stopped, false);
    client.reply(documentRequest, { visible: true, document: a3, index: 1, sequence: 2 });
    client.send({
      sequence: 5,
      changes: [{ d: { documentId: 'a', baseVersion: 3, version: 4, patch: compare(a3, a4), i: 1 } }]
    });
    assert.deepEqual(changes, [a3, a4]);
    observer.stop();
  });

  it('reconciles structural recovery for changed-only observers without public init', function () {
    var client = new FakeClient();
    var a1 = { _id: 'a', version: 1, rank: 1 };
    var b1 = { _id: 'b', version: 1, rank: 2 };
    var a3 = { _id: 'a', version: 3, rank: 3 };
    var a4 = { _id: 'a', version: 4, rank: 4 };
    var changed = [];
    var observer = new Observer(
      collection(client),
      {
        changed: function (_oldDocument, newDocument) {
          changed.push(newDocument);
        }
      },
      { query: { active: true } }
    );
    assert.equal(client.subscriptions[0].payload.events.i, false);
    client.send({ handle: 'observer-1', deltaVersion: 1, sequence: 0, changes: [{ s: { r: [a1, b1] } }] });
    client.send({ sequence: 1, changes: [{ d: { documentId: 'a', baseVersion: 2, version: 3, patch: [], i: 0 } }] });
    client.send({ sequence: 2, changes: [{ m: { e: b1, o: 1, n: 0 } }] });
    var snapshot = client.findRequest('observe.snapshot');
    assert.ok(snapshot);
    client.reply(snapshot, { documents: [b1, a3], sequence: 4 });
    assert.deepEqual(changed, [a3]);
    client.send({
      sequence: 5,
      changes: [{ d: { documentId: 'a', baseVersion: 3, version: 4, patch: compare(a3, a4), i: 1 } }]
    });
    assert.deepEqual(changed, [a3, a4]);
    observer.stop();
  });

  it('updates private baselines for masked full changes without calling changed', function () {
    var client = new FakeClient();
    var a1 = { _id: 'a', version: 1, value: 'initial' };
    var a2 = { _id: 'a', version: 2, value: 'full masked update' };
    var added = 0;
    var observer = new Observer(
      collection(client),
      {
        added: function () {
          added++;
        }
      },
      { query: {} }
    );
    assert.equal(client.subscriptions[0].payload.events.c, false);
    client.send({ handle: 'observer-1', deltaVersion: 1, sequence: 0, changes: [{ s: { r: [a1] } }] });
    client.send({ sequence: 1, changes: [{ c: { o: null, n: a2, i: 0 } }] });
    client.send({
      sequence: 2,
      changes: [{ d: { documentId: 'a', baseVersion: 2, version: 3, patch: [{ op: 'replace', path: '/version', value: 3 }], i: 0 } }]
    });
    assert.equal(added, 0);
    assert.equal(client.findRequest('observe.document'), undefined);
    observer.stop();
  });

  it('preserves projection-excluded identity and version fields in full callbacks', function () {
    var client = new FakeClient();
    var projected = [];
    var observer = new Observer(
      collection(client),
      {
        changed: function (_oldDocument, newDocument) {
          projected.push(newDocument);
        }
      },
      { query: {}, project: { _id: 0, version: 0, name: 1 } }
    );
    var before = { name: 'before' };
    var after = { name: 'after' };
    client.send({ handle: 'observer-1', deltaVersion: 1, sequence: 0, changes: [{ s: { r: [before] } }] });
    client.send({ sequence: 1, changes: [{ c: { o: null, n: after, i: 0 } }] });
    assert.deepEqual(projected, [after]);
    assert.equal(client.findRequest('observe.document'), undefined);
    observer.stop();
  });

  it('rejects prototype-modifying patches and recovers from the full document', function () {
    var client = new FakeClient();
    var base = { _id: 'a', version: 1, safe: true };
    var recovered = { _id: 'a', version: 2, safe: true, value: 'recovered' };
    var calls = [];
    var observer = observeWithState(client, {
      changed: function (_oldDocument, newDocument) {
        calls.push(newDocument);
      }
    });
    negotiatedInit(client, [base]);
    client.send({
      sequence: 1,
      changes: [
        {
          d: {
            documentId: 'a',
            baseVersion: 1,
            version: 2,
            patch: [{ op: 'add', path: '/__proto__/polluted', value: true }],
            i: 0
          }
        }
      ]
    });
    var recovery = client.findRequest('observe.document');
    assert.ok(recovery);
    client.reply(recovery, { visible: true, document: recovered, index: 0, sequence: 1 });
    assert.deepEqual(calls, [recovered]);
    assert.equal({}.polluted, undefined);
    observer.stop();
  });

  it('waits for a handle before dispatch and ignores recovery replies after restart', function () {
    var client = new FakeClient();
    var initCount = 0;
    var observer = new Observer(
      collection(client),
      {
        init: function () {
          initCount++;
        }
      },
      { query: {} }
    );
    var oldSubscription = client.subscriptions[0];
    var document = { _id: 'a', version: 1 };
    oldSubscription.callback(null, { deltaVersion: 1, sequence: 0, changes: [{ i: { r: [document] } }] });
    assert.equal(initCount, 0);
    oldSubscription.callback(null, { handle: 'observer-1', deltaVersion: 1 });
    assert.equal(initCount, 1);
    client.send({ sequence: 1, changes: [{ d: { documentId: 'a', baseVersion: 2, version: 3, patch: [], i: 0 } }] });
    var staleRecovery = client.findRequest('observe.document');
    oldSubscription.callback(new Error('reconnected'));
    assert.equal(client.subscriptions.length, 2);
    client.reply(staleRecovery, { visible: true, document: { _id: 'a', version: 3 }, index: 0, sequence: 2 });
    assert.equal(initCount, 1);
    observer.stop();
  });

  it('routes one-shot errors to callbacks, releases requests and retains adjustable options', function () {
    function FakeSocket() {
      this.listeners = {};
      this.sent = [];
    }
    FakeSocket.prototype.on = function (name, callback) {
      this.listeners[name] = callback;
    };
    FakeSocket.prototype.emit = function (_name, request) {
      this.sent.push(request);
    };
    FakeSocket.prototype.respond = function (response) {
      this.listeners['/vdb/response'](response);
    };

    var socket = new FakeSocket();
    var options = { deltaCache: { maxEntries: 0 } };
    var client = new SocketClient(socket, options);
    assert.strictEqual(client.options, options);
    var collectionClient = collection(client);
    var observed = [];
    var observer = new Observer(
      collectionClient,
      {
        changed: function (_oldDocument, newDocument) {
          observed.push(newDocument);
        }
      },
      { query: { category: 'boat' }, skip: 2, limit: 4, sort: { name: 1 }, project: { name: 1 } }
    );
    var observeRequest = socket.sent[0];
    assert.equal(observeRequest.p.deltaVersion, 1);
    assert.equal(Object.prototype.hasOwnProperty.call(observeRequest.p, 'deltaCache'), false);
    assert.equal(observeRequest.p.skip, 2);
    assert.equal(observeRequest.p.limit, 4);
    assert.deepEqual(observeRequest.p.project, { name: 1 });
    socket.respond({
      i: observeRequest.i,
      p: { handle: observeRequest.p.id, deltaVersion: 1, sequence: 0, changes: [{ s: { r: [{ _id: 'a', version: 1 }] } }] }
    });
    socket.respond({ i: observeRequest.i, p: { sequence: 1, changes: [{ d: { documentId: 'a', baseVersion: 0, version: 2, patch: [], i: 0 } }] } });
    var recoveryRequest = socket.sent[1];
    assert.ok(recoveryRequest.p['observe.document']);
    var routedError;
    var oneShotId = client.request({ ping: true }, function (error) {
      routedError = error;
    });
    socket.respond({ i: oneShotId, e: { code: 'RECOVERY_FAILED', message: 'unavailable' } });
    assert.equal(routedError.message, 'unavailable');
    assert.equal(routedError.code, 'RECOVERY_FAILED');
    assert.equal(client._requests[oneShotId], undefined);
    socket.respond({ i: recoveryRequest.i, e: { code: 'RECOVERY_FAILED', message: 'recovery unavailable' } });
    socket.respond({ i: observeRequest.i, p: { sequence: 2, changes: [{ c: { o: null, n: { _id: 'a', version: 2, value: 'full' }, i: 0 } }] } });
    var snapshotRequest = socket.sent[socket.sent.length - 1];
    assert.ok(snapshotRequest.p['observe.snapshot']);
    socket.respond({ i: snapshotRequest.i, p: { documents: [{ _id: 'a', version: 2, value: 'full' }], sequence: 2 } });
    assert.deepEqual(observed, [{ _id: 'a', version: 2, value: 'full' }]);
    observer.stop();
    var oldSocket = new FakeSocket();
    var reconnectingClient = new SocketClient(oldSocket);
    var oldResult;
    var oldRequestId = reconnectingClient.request({ ping: 'old' }, function (_error, result) {
      oldResult = result;
    });
    var newSocket = new FakeSocket();
    reconnectingClient.connect(newSocket);
    var newResult;
    var newRequestId = reconnectingClient.request({ ping: 'new' }, function (_error, result) {
      newResult = result;
    });
    assert.ok(newRequestId > oldRequestId);
    oldSocket.respond({ i: oldRequestId, p: 'stale' });
    assert.equal(oldResult, undefined);
    assert.equal(newResult, undefined);
    newSocket.respond({ i: newRequestId, p: 'current' });
    assert.equal(newResult, 'current');
    var stopId = reconnectingClient.request({ 'observe.stop': { h: 'done' } });
    assert.equal(reconnectingClient._requests[stopId], undefined);
  });

  it('rejects a partially applicable malformed patch atomically before recovering', function () {
    var client = new FakeClient();
    var base = { _id: 'a', version: 1, nested: { value: 'unchanged' } };
    var recovered = { _id: 'a', version: 2, nested: { value: 'authoritative' } };
    var calls = [];
    var observer = observeWithState(client, {
      changed: function (previous, next) {
        calls.push({ previous: previous, next: next });
      }
    });
    negotiatedInit(client, [base]);
    client.send({
      sequence: 1,
      changes: [
        {
          d: {
            documentId: 'a',
            baseVersion: 1,
            version: 2,
            i: 0,
            patch: [
              { op: 'replace', path: '/nested/value', value: 'partial' },
              { op: 'remove', path: '/missing' }
            ]
          }
        }
      ]
    });
    assert.deepEqual(calls, []);
    assert.deepEqual(base, { _id: 'a', version: 1, nested: { value: 'unchanged' } });
    var recovery = client.findRequest('observe.document');
    assert.ok(recovery);
    client.reply(recovery, { visible: true, document: recovered, index: 0, sequence: 1 });
    assert.deepEqual(calls, [{ previous: base, next: recovered }]);
    observer.stop();
  });

  it('retains the highest pending target when an older full recovery completes', function () {
    var client = new FakeClient();
    var base = { _id: 'a', version: 1, value: 'old' };
    var latest = { _id: 'a', version: 4, value: 'latest' };
    var calls = [];
    var observer = observeWithState(client, {
      changed: function (_previous, next) {
        calls.push(next);
      }
    });
    negotiatedInit(client, [base]);
    client.send({ sequence: 1, changes: [{ d: { documentId: 'a', baseVersion: 2, version: 3, patch: [], i: 0 } }] });
    var recovery = client.findRequest('observe.document');
    client.send({ sequence: 2, changes: [{ d: { documentId: 'a', baseVersion: 3, version: 4, patch: [], i: 0 } }] });
    client.reply(recovery, { visible: true, document: { _id: 'a', version: 3, value: 'behind' }, index: 0, sequence: 1 });
    assert.deepEqual(calls, []);
    var snapshot = client.findRequest('observe.snapshot');
    assert.ok(snapshot);
    client.reply(snapshot, { documents: [latest], sequence: 2 });
    assert.deepEqual(calls, [latest]);
    observer.stop();
  });

  it('reconciles removal and re-entry during recovery and ignores replies after stop', function () {
    var client = new FakeClient();
    var a = { _id: 'a', version: 1 };
    var b = { _id: 'b', version: 1 };
    var reentered = { _id: 'a', version: 4 };
    var result = [a, b];
    var changes = [];
    var observer = observeWithState(client, {
      changed: function (_previous, next, index) {
        result[index] = next;
        changes.push(next);
      },
      removed: function (_document, index) {
        result.splice(index, 1);
      },
      added: function (document, index) {
        result.splice(index, 0, document);
      },
      moved: function (document, oldIndex, newIndex) {
        result.splice(oldIndex, 1);
        result.splice(newIndex, 0, document);
      }
    });
    negotiatedInit(client, [a, b]);
    client.send({ sequence: 1, changes: [{ d: { documentId: 'a', baseVersion: 2, version: 3, patch: [], i: 0 } }] });
    var recovery = client.findRequest('observe.document');
    client.send({ sequence: 2, changes: [{ r: { e: a, i: 0 } }] });
    client.send({ sequence: 3, changes: [{ a: { e: reentered, i: 1 } }] });
    assert.deepEqual(result, [a, b]);
    client.reply(client.findRequest('observe.snapshot'), { documents: [b, reentered], sequence: 3 });
    client.reply(recovery, { visible: false, sequence: 2 });
    assert.deepEqual(result, [b, reentered]);
    assert.deepEqual(changes, [reentered]);
    client.send({ sequence: 4, changes: [{ d: { documentId: 'a', baseVersion: 5, version: 6, patch: [], i: 1 } }] });
    var stoppedRecovery = client.findRequest('observe.document');
    observer.stop();
    client.reply(stoppedRecovery, { visible: true, document: { _id: 'a', version: 6 }, index: 1, sequence: 4 });
    assert.deepEqual(result, [b, reentered]);
  });
});
