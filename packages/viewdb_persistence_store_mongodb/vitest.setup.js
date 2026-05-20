import { LoggerFactory } from 'slf';
import slfDebug from 'slf-debug';

LoggerFactory.setFactory(slfDebug);

globalThis.__MONGO_URI__ = process.env.MONGO_URI;
