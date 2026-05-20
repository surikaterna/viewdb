class TimeTracker {
  _startTime: number;
  _stopTime: number;

  constructor() {
    this._startTime = -1;
    this._stopTime = -1;
  }

  start(): void {
    this._startTime = Date.now();
  }

  stop(): void {
    this._stopTime = Date.now();
  }

  /**
   * @returns time between start and stop is called in seconds
   */
  getExecutionTime(): number {
    return (this._stopTime - this._startTime) / 1000;
  }
}

export default TimeTracker;
