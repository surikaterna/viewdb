import _ = require('lodash');
import debug = require('debug');

var warn = debug('viewdb:warn');

class Client {
  _socket: any;
  _requests: Record<number, any>;
  _requestId: number;

  constructor(socket?: any) {
    this._socket = null;
    this._requests = {};
    this._requestId = 10;
    if (socket) {
      this.connect(socket);
    }
  }

  connect(socket: any): void {
    this._socket = socket;
    this._requests = {};
    this._requestId = 10;
    var self = this;
    this._socket.on('/vdb/response', function (event: any) {
      if (event.e) {
        throw new Error(event.e);
      }
      var request = self._requests[event.i];
      if (_.isUndefined(request)) {
        warn('Response for unregistered request', event);
      } else {
        var callback = request.cb;
        callback(null, event.p);
        if (!request.k) {
          // non persistent request
          delete self._requests[event.i];
        }
      }
    });
  }

  request(payload: any, callback?: any, persistent?: boolean): number {
    var req: any = {
      i: this._requestId++,
      p: payload
    };
    this._requests[req.i] = { cb: callback, k: persistent };
    this._socket.emit('/vdb/request', req);
    return req.i;
  }

  subscribe(payload: any, callback: any): { stop: () => void } {
    var self = this;
    var i = this.request(payload, callback, true);
    return {
      stop: function () {
        delete self._requests[i];
      }
    };
  }

  // to signal that a socket reconnection have been made, and that observers need to start over.
  // - socket owner is responsible to ensure that proper authentication/setup have been made before calling this function.
  onClientReconnected(): void {
    var self = this;
    _.forEach(this._requests, function (request: any, index: any) {
      if (request.k) {
        // persistent aka observe
        var callback = request.cb;
        callback('reconnected');
      } else {
        delete self._requests[index];
      }
    });
  }
}

export = Client;
