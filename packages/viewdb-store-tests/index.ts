import count from "./suites/count";
import crud from "./suites/crud";
import cursor from "./suites/cursor";
import observe from "./suites/observe";
import query from "./suites/query";

const suiteMap = {
  crud: crud,
  query: query,
  cursor: cursor,
  count: count,
  observe: observe,
};

function runStoreTests(config) {
  const suites = config.suites || ["crud", "query", "cursor", "count", "observe"];
  const defaults = { settleDelay: 50 };
  config.observeOptions = Object.assign(defaults, config.observeOptions || {});

  describe(`${config.name} shared store tests`, () => {
    suites.forEach((name) => {
      if (!suiteMap[name]) {
        throw new Error(`Unknown suite: ${name}`);
      }
      suiteMap[name](config);
    });
  });
}

export { runStoreTests };
