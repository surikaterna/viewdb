const LoggerFactory = require('slf').LoggerFactory;
const slfDebug = require('slf-debug').default;

LoggerFactory.setFactory(slfDebug);

globalThis.__MONGO_URI__ = process.env.MONGO_URI;
