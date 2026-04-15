/** Minimal socket interface — compatible with socket.io Socket */
export interface VdbSocket {
  emit(event: string, ...args: any[]): any;
  on(event: string, callback: (...args: any[]) => void): any;
}

/** Client interface for request/response and subscriptions (rr_client, rest_client) */
export interface VdbClient {
  request(payload: Record<string, any>, callback?: (err: Error | null, result?: any) => void): void;
  subscribe(payload: Record<string, any>, callback: (err: Error | null, result?: any) => void): void;
}
