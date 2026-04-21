var crud = require('./suites/crud');
var query = require('./suites/query');
var cursor = require('./suites/cursor');
var count = require('./suites/count');
var observe = require('./suites/observe');

var suiteMap = {
  crud: crud,
  query: query,
  cursor: cursor,
  count: count,
  observe: observe
};

function runStoreTests(config) {
  var suites = config.suites || ['crud', 'query', 'cursor', 'count', 'observe'];
  var defaults = { settleDelay: 50 };
  config.observeOptions = Object.assign(defaults, config.observeOptions || {});

  describe(config.name + ' shared store tests', function () {
    suites.forEach(function (name) {
      if (!suiteMap[name]) {
        throw new Error('Unknown suite: ' + name);
      }
      suiteMap[name](config);
    });
  });
}

module.exports = { runStoreTests: runStoreTests };
