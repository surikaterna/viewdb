const assert = require('assert').strict;
const SocketClient = require('../../dist/client/rr_client');
const { FakeClient, collection, observeWithState, negotiatedInit } = require('./delta_client_fixture.cjs');

describe('Review client recovery regressions', function () {
  it('replays later equal, lower, and unknown-sequence full corrections', function () {
    var client = new FakeClient();
    var base = { _id: 'a', version: 1, value: 'base' };
    var recovered = { _id: 'a', version: 3, value: 'recovered' };
    var correction = { _id: 'a', version: 3, value: 'corrected' };
    var lower = { _id: 'a', version: 2, value: 'lower correction' };
    var unknownSequence = { _id: 'a', version: 2, value: 'unknown sequence correction' };
    var latest = { _id: 'a', version: 4, value: 'latest' };
    var changes = [];
    var observer = observeWithState(client, {
      changed: function (_previous, next) {
        changes.push(next);
      }
    });
    negotiatedInit(client, [base]);
    client.send({ sequence: 1, changes: [{ d: { documentId: 'a', baseVersion: 2, version: 3, patch: [], i: 0 } }] });
    var recovery = client.findRequest('observe.document');
    client.send({ sequence: 2, changes: [{ c: { o: null, n: correction, i: 0 } }] });
    client.send({ sequence: 3, changes: [{ c: { o: null, n: lower, i: 0 } }] });
    client.send({ changes: [{ c: { o: null, n: unknownSequence, i: 0 } }] });
    client.reply(recovery, { visible: true, document: recovered, index: 0, sequence: 1 });
    assert.deepEqual(changes, [recovered, correction, lower, unknownSequence]);
    client.send({
      sequence: 4,
      changes: [
        {
          d: {
            documentId: 'a',
            baseVersion: 3,
            version: 4,
            patch: [
              { op: 'replace', path: '/version', value: 4 },
              { op: 'replace', path: '/value', value: 'latest' }
            ],
            i: 0
          }
        }
      ]
    });
    assert.deepEqual(changes, [recovered, correction, lower, unknownSequence, latest]);
    observer.stop();
  });

  it('cancels pending one-shot recovery registrations on stop and snapshot supersession', function () {
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
    var client = new SocketClient(socket);
    var observer = new (require('../../dist/client/observe'))(collection(client), {}, { query: {} });
    var observeRequest = socket.sent[0];
    socket.respond({
      i: observeRequest.i,
      p: { handle: observeRequest.p.id, deltaVersion: 1, sequence: 0, changes: [{ s: { r: [{ _id: 'a', version: 1 }] } }] }
    });
    socket.respond({ i: observeRequest.i, p: { sequence: 1, changes: [{ d: { documentId: 'a', baseVersion: 0, version: 2, patch: [], i: 0 } }] } });
    var documentRequest = socket.sent[1];
    assert.ok(client._requests[documentRequest.i]);
    socket.respond({ i: observeRequest.i, p: { sequence: 2, changes: [{ m: { e: { _id: 'a', version: 1 }, o: 0, n: 0 } }] } });
    var snapshotRequest = socket.sent[2];
    assert.equal(client._requests[documentRequest.i], undefined);
    assert.ok(client._requests[snapshotRequest.i]);
    socket.respond({ i: observeRequest.i, e: { code: 'RECONNECTED', message: 'reconnected' } });
    assert.equal(client._requests[snapshotRequest.i], undefined);
    observer.stop();
    assert.equal(client._requests[snapshotRequest.i], undefined);
  });

  it('does not retain a one-shot request when its response arrives synchronously', function () {
    function FakeSocket() {
      this.listeners = {};
      this.sent = [];
    }
    FakeSocket.prototype.on = function (name, callback) {
      this.listeners[name] = callback;
    };
    FakeSocket.prototype.emit = function (_name, request) {
      this.sent.push(request);
      if (request.p['observe.document']) {
        this.listeners['/vdb/response']({
          i: request.i,
          p: { visible: true, document: { _id: 'a', version: 3 }, index: 0, sequence: 1 }
        });
      }
    };
    var socket = new FakeSocket();
    var client = new SocketClient(socket);
    var observer = new (require('../../dist/client/observe'))(collection(client), {}, { query: {} });
    var observeRequest = socket.sent[0];
    socket.listeners['/vdb/response']({
      i: observeRequest.i,
      p: { handle: observeRequest.p.id, deltaVersion: 1, sequence: 0, changes: [{ s: { r: [{ _id: 'a', version: 1 }] } }] }
    });
    socket.listeners['/vdb/response']({
      i: observeRequest.i,
      p: { sequence: 1, changes: [{ d: { documentId: 'a', baseVersion: 2, version: 3, patch: [], i: 0 } }] }
    });
    assert.equal(client._requests[socket.sent[1].i], undefined);
    observer.stop();
  });

  it('automatically retries with a snapshot after a document recovery error', function () {
    var client = new FakeClient();
    var base = { _id: 'a', version: 1 };
    var recovered = { _id: 'a', version: 3, value: 'snapshot' };
    var changes = [];
    var observer = observeWithState(client, {
      changed: function (_previous, next) {
        changes.push(next);
      }
    });
    negotiatedInit(client, [base]);
    client.send({ sequence: 1, changes: [{ d: { documentId: 'a', baseVersion: 2, version: 3, patch: [], i: 0 } }] });
    client.reply(client.findRequest('observe.document'), undefined, new Error('transient recovery failure'));
    var snapshot = client.findRequest('observe.snapshot');
    assert.ok(snapshot);
    client.reply(snapshot, { documents: [recovered], sequence: 1 });
    assert.deepEqual(changes, [recovered]);
    observer.stop();
  });
  it('uses full observer events when removed callbacks need retained payloads', function () {
    var client = new FakeClient();
    var observer = observeWithState(client, { removed: function () {} });
    assert.equal(client.subscriptions[0].payload.deltaVersion, undefined);
    observer.stop();
  });

  it('stops snapshot merge callbacks immediately when a callback stops the observer', function () {
    var client = new FakeClient();
    var changed = [];
    var observer = observeWithState(client, {
      changed: function (_oldDocument, document) {
        changed.push(document._id);
        observer.stop();
      }
    });
    negotiatedInit(client, [
      { _id: 'a', version: 1 },
      { _id: 'b', version: 1 }
    ]);
    client.send({ sequence: 1, changes: [{ m: { e: { _id: 'missing', version: 1 }, o: 0, n: 0 } }] });
    var snapshot = client.findRequest('observe.snapshot');
    client.reply(snapshot, {
      documents: [
        { _id: 'a', version: 2 },
        { _id: 'b', version: 2 }
      ],
      sequence: 1
    });
    assert.deepEqual(changed, ['a']);
  });
  it('keeps large query membership while bounding full-document baselines and recovers evicted rows', function () {
    [
      { maxBytes: 0, maxEntries: 0 },
      { maxBytes: 128, maxEntries: 2 }
    ].forEach(function (limits) {
      var client = new FakeClient({ deltaCache: limits });
      var changes = [];
      var observer = observeWithState(client, {
        changed: function (oldDocument, newDocument) {
          changes.push([oldDocument, newDocument]);
        }
      });
      var initial = [];
      for (var index = 0; index < 400; index++) initial.push({ _id: 'doc-' + index, version: 1, value: 'initial-' + index });
      negotiatedInit(client, initial);
      for (var added = 0; added < 400; added++) {
        client.send({
          sequence: added + 1,
          changes: [{ a: { e: { _id: 'extra-' + added, version: 1, value: 'payload-' + added }, i: initial.length + added } }]
        });
      }
      assert.equal(observer.cache.size <= limits.maxEntries, true);
      client.send({ sequence: 1000, changes: [{ d: { documentId: 'doc-0', baseVersion: 1, version: 2, patch: [], i: 0 } }] });
      var recovery = client.findRequest('observe.document');
      assert.ok(recovery);
      assert.equal(observer.cache.size <= limits.maxEntries, true);
      assert.equal(observer.currentRows.length, 800);
      assert.equal(
        observer.currentRows.every(function (row) {
          return !Object.prototype.hasOwnProperty.call(row, 'document');
        }),
        true
      );
      client.reply(recovery, {
        visible: true,
        document: { _id: 'doc-0', version: 2, value: 'recovered' },
        index: 0,
        sequence: 999
      });
      assert.equal(changes.length, 1);
      assert.equal(changes[0][0], null);
      assert.equal(changes[0][1].value, 'recovered');
      observer.stop();
    });
  });

  it('uses stable row keys to reconcile changed-only projected snapshot rows', function () {
    var client = new FakeClient({ deltaCache: { maxBytes: 0 } });
    var changed = [];
    var observer = observeWithState(client, {
      changed: function (oldDocument, newDocument, index) {
        changed.push([oldDocument, newDocument, index]);
      }
    });
    client.send({
      handle: 'observer-1',
      deltaVersion: 1,
      sequence: 0,
      changes: [{ s: { r: [{ name: 'before' }], rowKeys: ['opaque-row'] } }]
    });
    client.send({ sequence: 1, changes: [{ m: { e: { name: 'unknown' }, o: 0, n: 0, rowKey: 'other-row' } }] });
    var snapshot = client.findRequest('observe.snapshot');
    assert.ok(snapshot);
    client.reply(snapshot, { documents: [{ name: 'after' }], rowKeys: ['opaque-row'], sequence: 1 });
    assert.deepEqual(changed, [[null, { name: 'after' }, 0]]);
    observer.stop();
  });
  it('reconciles additions and permutations with evolving merge indices', function () {
    var client = new FakeClient();
    var state = ['a', 'b', 'c'];
    var changed = [];
    var observer = observeWithState(client, {
      added: function (document, index) {
        state.splice(index, 0, document._id);
      },
      changed: function (_oldDocument, document, index) {
        state[index] = document._id;
        changed.push(document._id);
      },
      moved: function (document, oldIndex, newIndex) {
        state.splice(oldIndex, 1);
        state.splice(newIndex, 0, document._id);
      }
    });
    client.send({
      handle: 'observer-1',
      deltaVersion: 1,
      sequence: 0,
      changes: [
        {
          s: {
            r: [
              { _id: 'a', version: 1 },
              { _id: 'b', version: 1 },
              { _id: 'c', version: 1 }
            ],
            rowKeys: ['row-a', 'row-b', 'row-c']
          }
        }
      ]
    });
    client.send({ sequence: 1, changes: [{ m: { e: { _id: 'unknown' }, o: 0, n: 0, rowKey: 'unknown' } }] });
    var snapshot = client.findRequest('observe.snapshot');
    client.reply(snapshot, {
      documents: [
        { _id: 'c', version: 2 },
        { _id: 'a', version: 1 },
        { _id: 'b', version: 1 },
        { _id: 'd', version: 1 }
      ],
      rowKeys: ['row-c', 'row-a', 'row-b', 'row-d'],
      sequence: 1
    });
    assert.deepEqual(state, ['c', 'a', 'b', 'd']);
    assert.deepEqual(changed, ['c']);
    observer.stop();
  });
  it('uses a later authoritative s with rowKeys to supersede projected recovery', function () {
    var client = new FakeClient({ deltaCache: { maxBytes: 0 } });
    var changed = [];
    var observer = observeWithState(client, {
      changed: function (oldDocument, newDocument, index) {
        changed.push([oldDocument, newDocument, index]);
      }
    });
    client.send({
      handle: 'observer-1',
      deltaVersion: 1,
      sequence: 0,
      changes: [{ s: { r: [{ name: 'before', version: 1 }], rowKeys: ['stable-row'] } }]
    });
    client.send({
      sequence: 1,
      changes: [{ d: { documentId: 'internal-id', baseVersion: 1, version: 2, patch: [], i: 0 }, rowKey: 'stable-row' }]
    });
    var recovery = client.findRequest('observe.document');
    assert.ok(recovery);
    client.send({
      sequence: 2,
      changes: [{ s: { r: [{ name: 'after', version: 2 }], rowKeys: ['stable-row'] } }]
    });
    assert.equal(recovery.completed, true);
    assert.deepEqual(changed, [[null, { name: 'after', version: 2 }, 0]]);
    observer.stop();
  });
  it('recovers projected rows by opaque row key without retaining a public id', function () {
    var client = new FakeClient({ deltaCache: { maxBytes: 0 } });
    var changes = [];
    var observer = observeWithState(client, {
      changed: function (oldDocument, newDocument, index) {
        changes.push([oldDocument, newDocument, index]);
      }
    });
    client.send({
      handle: 'observer-1',
      deltaVersion: 1,
      sequence: 0,
      changes: [{ s: { r: [{ name: 'before', version: 1 }], rowKeys: ['opaque-row'] } }]
    });
    client.send({
      sequence: 1,
      changes: [{ d: { documentId: 'internal-id', baseVersion: 1, version: 2, patch: [], i: 0 }, rowKey: 'opaque-row' }]
    });
    var recovery = client.findRequest('observe.document');
    assert.ok(recovery);
    client.reply(recovery, {
      visible: true,
      document: { name: 'after', version: 2 },
      index: 0,
      sequence: 1,
      rowKey: 'opaque-row'
    });
    assert.deepEqual(changes, [[null, { name: 'after', version: 2 }, 0]]);
    observer.stop();
  });
  it('bounds pending full-event recovery and reconciles a fresh snapshot on the same registration', function () {
    var client = new FakeClient({ deltaCache: { maxBytes: 0 } });
    var changed = [];
    var observer = observeWithState(client, {
      changed: function (oldDocument, newDocument) {
        changed.push([oldDocument, newDocument]);
      }
    });
    client.send({
      handle: 'observer-1',
      deltaVersion: 1,
      sequence: 0,
      changes: [{ s: { r: [{ name: 'initial', version: 1 }], rowKeys: ['opaque-row'] } }]
    });
    client.send({
      sequence: 1,
      changes: [{ d: { documentId: 'internal-id', baseVersion: 1, version: 2, patch: [], i: 0 }, rowKey: 'opaque-row' }]
    });
    for (var sequence = 2; sequence < 260; sequence++) {
      client.send({
        sequence: sequence,
        changes: [{ d: { documentId: 'internal-id', baseVersion: sequence - 1, version: sequence, patch: [], i: 0 }, rowKey: 'opaque-row' }]
      });
    }
    assert.equal(client.subscriptions.length, 1);
    var snapshot = client.findRequest('observe.snapshot');
    assert.ok(snapshot);
    client.reply(snapshot, {
      documents: [{ name: 'stale', version: 258 }],
      rowKeys: ['opaque-row'],
      sequence: 258
    });
    assert.deepEqual(changed, []);
    var freshSnapshot = client.findRequest('observe.snapshot');
    assert.ok(freshSnapshot);
    client.reply(freshSnapshot, {
      documents: [{ name: 'current', version: 260 }],
      rowKeys: ['opaque-row'],
      sequence: 260
    });
    assert.deepEqual(changed, [[null, { name: 'current', version: 260 }]]);
    observer.stop();
  });
});
