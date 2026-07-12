// Type declaration for clamav.js@0.12 (which ships no types of its own).
// The module's default export is a singleton with callback-based methods.
declare module "clamav.js" {
  interface Scanner {
    scan(
      object: NodeJS.ReadableStream | string,
      callback: (err: Error | undefined, object: unknown, virusName?: string) => void
    ): void;
  }

  interface Clamav {
    createScanner(port: number, host: string): Scanner;
    ping(port: number, host: string, timeout: number, callback: (err?: Error) => void): void;
    version(
      port: number,
      host: string,
      timeout: number,
      callback: (err: Error | undefined, version?: string) => void
    ): void;
  }

  const clamav: Clamav;
  export default clamav;
}
