const assert = require('assert').strict;
const Client = require('../../dist/client/rr_client');

describe('Socket client request registry', function () {
  it('sends notifications without retaining them and preserves callback lifecycles', function () {
    var respond;
    var sent = [];
    var client = new Client({
      on: function (name, callback) {
        respond = callback;
      },
      emit: function (name, request) {
        assert.equal(name, '/vdb/request');
        sent.push(request);
      }
    });
    var results = [];
    var requestId = client.request({}, function (error, result) {
      assert.equal(error, null);
      results.push(result);
    });
    var subscription = client.subscribe({}, function (error, result) {
      assert.equal(error, null);
      results.push(result);
    });
    var subscriptionId = sent[1].i;
    var pending = Object.keys(client._requests);
    for (var index = 0; index < 1000; index++) {
      var payload = { 'observe.stop': { h: String(index) } };
      var id = client.request(payload);
      assert.equal(id, subscriptionId + index + 1);
      assert.deepEqual(sent[index + 2], { i: id, p: payload });
      assert.deepEqual(Object.keys(client._requests), pending);
    }
    var id = client.request({}, undefined, true);
    assert.equal(client._requests[id], undefined);
    respond({ i: requestId, p: 42 });
    assert.deepEqual(Object.keys(client._requests), [String(subscriptionId)]);
    respond({ i: subscriptionId, p: 'first' });
    respond({ i: subscriptionId, p: 'second' });
    assert.deepEqual(results, [42, 'first', 'second']);
    assert.deepEqual(Object.keys(client._requests), [String(subscriptionId)]);
    subscription.stop();
    assert.deepEqual(client._requests, {});
  });
});
