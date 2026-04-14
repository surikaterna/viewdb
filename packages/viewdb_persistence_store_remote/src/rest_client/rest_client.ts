import debug = require('debug');
import _ = require('lodash');

var warn = debug('viewdb:warn');
var merge = require('viewdb').merge;
var axios: any = require('axios');

class Client {
  _pollInterval: number;
  _baseUri: string;
  _requestOptions: any;

  constructor(url: string, headers?: any, options?: any) {
    if (!url) {
      throw Error('Cannot use REST viewdb client without URL');
    }
    this._pollInterval = (options && options.pollInterval) || 1000 * 30;

    if (url.slice(-1) === '/') {
      this._baseUri = url.substring(0, url.length - 1);
    } else {
      this._baseUri = url;
    }

    this._requestOptions = {
      headers: headers
    };
  }

  _callRestService(path: string, payload: any, callback: any): void {
    var params: string[] = [];
    _.forEach(Object.keys(payload), function (key: string) {
      params.push(key + '=' + encodeURIComponent(JSON.stringify(payload[key])));
    });
    var uri = this._baseUri + '/' + path;
    if (params.length > 0) {
      uri += '?' + params.join('&');
    }
    const options = _.assign({}, this._requestOptions, { url: uri });
    axios(options)
      .then(function (response: any) {
        callback(null, response.data);
      })
      .catch(function (err: any) {
        if (_.isUndefined(callback)) {
          warn('API call failed. Error message: ' + err);
        } else {
          callback(err);
        }
      });
  }

  request(payload: any, callback?: any): void {
    if (!payload['observe.stop']) {
      var request: any = { q: payload.find || payload.observe };
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
    var self = this;
    var cache: any[] = [];
    payload.find = payload.observe;
    function poll() {
      self.request(payload, function (err: any, result: any) {
        if (err) {
          callback(err);
        }
        var delta: any[] = [];
        merge(
          cache,
          result,
          _.defaults(
            {
              comparatorId: function (a: any, b: any) {
                return a.id === b.id;
              }
            },
            {
              added: function (e: any, i: number) {
                delta.push({ a: { e: e, i: i } });
                cache.splice(i, 0, e);
              },
              removed: function (e: any, i: number) {
                delta.push({ r: { e: e, i: i } });
                cache.splice(i, 1);
              },
              changed: function (asis: any, tobe: any, index: number) {
                delta.push({ c: { o: asis, n: tobe, i: index } });
                cache[index] = tobe;
              },
              moved: function (e: any, oldIndex: number, newIndex: number) {
                delta.push({ m: { e: e, o: oldIndex, n: newIndex } });
                cache.splice(oldIndex, 1);
                cache.splice(newIndex, 0, e);
              }
            }
          )
        );
        callback(null, { changes: delta });
      });
    }

    var pollId = setInterval(poll, this._pollInterval);
    // do first call now
    poll();
    return {
      stop: function () {
        clearInterval(pollId);
      }
    };
  }
}

export = Client;
