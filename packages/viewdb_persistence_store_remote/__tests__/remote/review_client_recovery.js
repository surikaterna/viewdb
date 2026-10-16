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
});
