import debug from "debug";
import _ from "lodash";
import { VdbSocket } from "../types";

const warn = debug("viewdb:warn");

class RequestResponseClient {
  _socket: VdbSocket | undefined;
  _requests: Record<number, { cb: Function; k: boolean }>;
  _requestId: number;

  constructor(socket?: VdbSocket) {
    this._socket = undefined;
    this._requests = {};
    this._requestId = 10;
    if (socket) {
      this.connect(socket);
    }
  }

  connect(socket: VdbSocket): void {
    this._socket = socket;
    this._requests = {};
    this._requestId = 10;
    const self = this;
    this._socket.on("/vdb/response", function (event: any) {
      if (event.e) {
        throw new Error(event.e);
      }
      const request = self._requests[event.i];
      if (_.isUndefined(request)) {
        warn("Response for unregistered request", event);
      } else {
        const callback = request.cb;
        callback(null, event.p);
        if (!request.k) {
          // non persistent request
          delete self._requests[event.i];
        }
      }
    });
  }

  request(payload: any, callback?: any, persistent?: boolean): number {
    const req: any = {
      i: this._requestId++,
      p: payload,
    };
    this._requests[req.i] = { cb: callback, k: persistent || false };
    this._socket!.emit("/vdb/request", req);
    return req.i;
  }

  subscribe(payload: any, callback: any): { stop: () => void } {
    const self = this;
    const i = this.request(payload, callback, true);
    return {
      stop: function () {
        delete self._requests[i];
      },
    };
  }

  // to signal that a socket reconnection have been made, and that observers need to start over.
  // - socket owner is responsible to ensure that proper authentication/setup have been made before calling this function.
  onClientReconnected(): void {
    const self = this;
    _.forEach(this._requests, function (request: any, index: any) {
      if (request.k) {
        // persistent aka observe
        const callback = request.cb;
        callback("reconnected");
      } else {
        delete self._requests[index];
      }
    });
  }
}

export default RequestResponseClient;
