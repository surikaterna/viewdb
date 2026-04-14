declare module 'crypto-js/sha256' {
  function SHA256(message: string): { toString(): string };
  export = SHA256;
}
