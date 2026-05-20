import count from "./suites/count";
import crud from "./suites/crud";
import cursor from "./suites/cursor";
import observe from "./suites/observe";
import query from "./suites/query";

var suiteMap = {
  crud: crud,
  query: query,
  cursor: cursor,
  count: count,
  observe: observe,
};

function runStoreTests(config) {
  var suites = config.suites || ["crud", "query", "cursor", "count", "observe"];
  var defaults = { settleDelay: 50 };
  config.observeOptions = Object.assign(defaults, config.observeOptions || {});

  describe(config.name + " shared store tests", function () {
    suites.forEach(function (name) {
      if (!suiteMap[name]) {
        throw new Error("Unknown suite: " + name);
      }
      suiteMap[name](config);
    });
  });
}

export { runStoreTests };
