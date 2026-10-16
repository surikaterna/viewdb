interface SharedObserverStatsHandle {
  getStats?: () => { evalCount: number; matchCount: number; rawChangedCount: number; emittedChangedCount: number };
}

interface SharedObserverStats {
  handle: SharedObserverStatsHandle | null;
  consumers: Map<string, unknown>;
}
interface ObserverStatsViewDb {
  _vdbSharedObservers?: Map<string, SharedObserverStats>;
}
interface ObserverStats {
  sharedObserverCount: number;
  totalConsumerCount: number;
  perCollection: Record<
    string,
    {
      sharedObservers: number;
      consumers: number;
      evalCount: number;
      matchCount: number;
      missCount: number;
      rawChangedCount: number;
      emittedChangedCount: number;
    }
  >;
}

export function getObserverStats(viewdb: ObserverStatsViewDb): ObserverStats {
  var registry = viewdb._vdbSharedObservers || new Map<string, SharedObserverStats>();
  var stats: ObserverStats = { sharedObserverCount: registry.size, totalConsumerCount: 0, perCollection: {} };
  registry.forEach(function (shared, key) {
    var parsed: { collection: string } = JSON.parse(key);
    var collection = parsed.collection;
    var consumerCount = shared.consumers.size;
    stats.totalConsumerCount += consumerCount;
    if (!stats.perCollection[collection])
      stats.perCollection[collection] = {
        sharedObservers: 0,
        consumers: 0,
        evalCount: 0,
        matchCount: 0,
        missCount: 0,
        rawChangedCount: 0,
        emittedChangedCount: 0
      };
    var colStats = stats.perCollection[collection];
    colStats.sharedObservers++;
    colStats.consumers += consumerCount;
    if (shared.handle && shared.handle.getStats) {
      var observerStats = shared.handle.getStats();
      colStats.evalCount += observerStats.evalCount;
      colStats.matchCount += observerStats.matchCount;
      colStats.missCount += observerStats.evalCount - observerStats.matchCount;
      colStats.rawChangedCount += observerStats.rawChangedCount;
      colStats.emittedChangedCount += observerStats.emittedChangedCount;
    }
  });
  return stats;
}
