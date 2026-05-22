import axios from "axios";
import debug from "debug";
import _ from "lodash";
import { VdbClient } from "../types";

const warn = debug("viewdb:warn");

import { merge } from "viewdb";

class RestClient implements VdbClient {
  _pollInterval: number;
  _baseUri: string;
  _requestOptions: { headers: Record<string, string> };

  constructor(url: string, headers?: any, options?: any) {
    if (!url) {
      throw Error("Cannot use REST viewdb client without URL");
    }
    this._pollInterval = options?.pollInterval || 1000 * 30;

    if (url.slice(-1) === "/") {
      this._baseUri = url.substring(0, url.length - 1);
    } else {
      this._baseUri = url;
    }

    this._requestOptions = {
      headers: headers,
    };
  }

  _callRestService(path: string, payload: any, callback: any): void {
    const params: string[] = [];
    _.forEach(Object.keys(payload), (key: string) => {
      params.push(`${key}=${encodeURIComponent(JSON.stringify(payload[key]))}`);
    });
    let uri = `${this._baseUri}/${path}`;
    if (params.length > 0) {
      uri += `?${params.join("&")}`;
    }
    const options = _.assign({}, this._requestOptions, { url: uri });
    axios(options)
      .then((response: any) => {
        callback(null, response.data);
      })
      .catch((err: Error | null) => {
        if (_.isUndefined(callback)) {
          warn(`API call failed. Error message: ${err}`);
        } else {
          callback(err);
        }
      });
  }

  request(payload: any, callback?: any): void {
    if (!payload["observe.stop"]) {
      const request: any = { q: payload.find || payload.observe };
      if (payload.skip) {
        request.skip = payload.skip;
      }
      if (payload.sort) {
        request.sort = payload.sort;
      }
      if (payload.limit) {
        request.limit = payload.limit;
      }
      if (payload.method) {
        request.method = payload.method;
      }
      this._callRestService(payload.collection, request, callback);
    }
  }

  subscribe(payload: any, callback: any): { stop: () => void } {
    const self = this;
    const cache: any[] = [];
    payload.find = payload.observe;
    function poll() {
      self.request(payload, (err: Error | null, result: any) => {
        if (err) {
          callback(err);
        }
        const delta: any[] = [];
        merge(
          cache,
          result,
          _.defaults(
            {
              comparatorId: (a: { id: string }, b: { id: string }) => a.id === b.id,
            },
            {
              added: (e: any, i: number) => {
                delta.push({ a: { e: e, i: i } });
                cache.splice(i, 0, e);
              },
              removed: (e: any, i: number) => {
                delta.push({ r: { e: e, i: i } });
                cache.splice(i, 1);
              },
              changed: (asis: any, tobe: any, index: number) => {
                delta.push({ c: { o: asis, n: tobe, i: index } });
                cache[index] = tobe;
              },
              moved: (e: any, oldIndex: number, newIndex: number) => {
                delta.push({ m: { e: e, o: oldIndex, n: newIndex } });
                cache.splice(oldIndex, 1);
                cache.splice(newIndex, 0, e);
              },
            }
          )
        );
        callback(null, { changes: delta });
      });
    }

    const pollId = setInterval(poll, this._pollInterval);
    // do first call now
    poll();
    return {
      stop: () => {
        clearInterval(pollId);
      },
    };
  }
}

export default RestClient;
