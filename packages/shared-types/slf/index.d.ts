declare module 'slf' {
  export class Logger {
    static getLogger(name: string): Logger;
    info(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
  }
  export class LoggerFactory {
    static getLogger(name: string): Logger;
  }
}
