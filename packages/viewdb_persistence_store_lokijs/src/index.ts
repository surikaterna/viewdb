import Store = require('./store');
import Collection = require('./collection');
import LokiPartitioningAdapter = require('./adapter/LokiPartitioningAdapter');
import LokiCordovaFSAdapter = require('./cordova/LokiCordovaFSAdapter');

export = { Store, Collection, LokiPartitioningAdapter, LokiCordovaFSAdapter };
