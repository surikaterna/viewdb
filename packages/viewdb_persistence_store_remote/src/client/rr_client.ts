import debug = require('debug');
import type { SocketClientOptions } from '../deltaProtocol';
import type { VdbSocket } from '../types';

var warn = debug('viewdb:warn');

type RequestCallback = (error: Error | null, result?: unknown) => void;

interface RequestEntry {
  cb: RequestCallback;
  k: boolean;
}

interface ResponseEvent {
  i: number;
  e?: unknown;
  p?: unknown;
}

class ResponseError extends Error {
  code?: string;
}

function isResponseEvent(value: unknown): value is ResponseEvent {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && 'i' in value && typeof value.i === 'number';
}

function responseError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === 'string') return new Error(value);
  if (value !== null && typeof value === 'object' && 'message' in value && typeof value.message === 'string') {
    var error = new ResponseError(value.message);
    if ('code' in value && typeof value.code === 'string') error.code = value.code;
    return error;
  }
  return new Error('Remote request failed');
}

class Client {
  _socket: VdbSocket | undefined;
  _requests: Record<number, RequestEntry>;
  _requestId: number;
  readonly options: SocketClientOptions;

  private _connectionGeneration = 0;
  constructor(socket?: VdbSocket, options: SocketClientOptions = {}) {
    this.options = options;
    this._socket = undefined;
    this._requests = {};
    this._requestId = 10;
    if (socket) this.connect(socket);
  }

  connect(socket: VdbSocket): void {
    this._socket = socket;
    this._requests = {};
    var generation = ++this._connectionGeneration;
    var self = this;
    this._socket.on('/vdb/response', function (rawEvent: unknown) {
      if (generation !== self._connectionGeneration) return;
      if (!isResponseEvent(rawEvent)) {
        warn('Malformed response event', rawEvent);
        return;
      }
      var request = self._requests[rawEvent.i];
      if (!request) {
        warn('Response for unregistered request', rawEvent);
        return;
      }
      var callback = request.cb;
      if (!request.k) delete self._requests[rawEvent.i];
      if ('e' in rawEvent) {
        if (callback) callback(responseError(rawEvent.e));
      } else if (callback) {
        callback(null, rawEvent.p);
      }
    });
  }

  request(payload: Record<string, unknown>, callback?: RequestCallback, persistent?: boolean): number {
    var req = {
      i: this._requestId++,
      p: payload
    };
    if (callback) this._requests[req.i] = { cb: callback, k: persistent || false };
    this._socket!.emit('/vdb/request', req);
    return req.i;
  }

  subscribe(payload: Record<string, unknown>, callback: RequestCallback): { stop: () => void } {
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
    Object.keys(this._requests).forEach(function (index) {
      var request = self._requests[Number(index)];
      if (!request) return;
      if (request.k) {
        // persistent aka observe
        if (request.cb) request.cb(new Error('reconnected'));
      } else {
        delete self._requests[Number(index)];
      }
    });
  }
}

export = Client;
