import ViewDB from './viewdb';
import Cursor from './cursor';
import Observer from './observe';
import merge from './merger';
import * as plugins from './plugins';

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
