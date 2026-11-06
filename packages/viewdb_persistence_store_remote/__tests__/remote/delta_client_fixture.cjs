const Observer = require('../../dist/client/observe');
function FakeClient(options) {
  this.options = options || {};
  this.subscriptions = [];
  this.requests = [];
}

FakeClient.prototype.subscribe = function (payload, callback) {
  var subscription = { payload: payload, callback: callback, stopped: false };
  this.subscriptions.push(subscription);
  return {
    stop: function () {
      subscription.stopped = true;
    }
  };
};

FakeClient.prototype.request = function (payload, callback) {
  var request = { payload: payload, callback: callback, completed: false, id: this.requests.length + 101 };
  this.requests.push(request);
  return request.id;
};

FakeClient.prototype.cancelRequest = function (id) {
  var request = this.requests.find(function (entry) {
    return entry.id === id;
  });
  if (request) request.completed = true;
};

FakeClient.prototype.send = function (response) {
  this.subscriptions[this.subscriptions.length - 1].callback(null, response);
};

FakeClient.prototype.findRequest = function (name) {
  return this.requests.find(function (request) {
    return !request.completed && Object.prototype.hasOwnProperty.call(request.payload, name);
  });
};

FakeClient.prototype.reply = function (request, response, error) {
  request.completed = true;
  request.callback(error || null, response);
};

function collection(client) {
  return { _client: client, _name: 'items' };
}

function observeWithState(client, callbacks) {
  var observer = new Observer(collection(client), callbacks, { query: { active: true } });
  return observer;
}

function negotiatedInit(client, documents) {
  client.send({
    handle: 'observer-1',
    deltaVersion: 1,
    sequence: 0,
    changes: [{ s: { r: documents } }]
  });
}

module.exports = { FakeClient, collection, observeWithState, negotiatedInit };
