import ViewDB = require('./viewdb');
import Cursor = require('./cursor');
import Observer = require('./observe');
import merge = require('./merger');
import plugins = require('./plugins');

// Preserve the exact CommonJS export shape:
// module.exports = ViewDB (callable as constructor)
// module.exports.Cursor = Cursor
// module.exports.Observer = Observer
// module.exports.merge = merge
// module.exports.plugins = { TimestampPlugin, VersioningPlugin }

export = Object.assign(ViewDB, {
  Cursor,
  Observer,
  merge,
  plugins
});
