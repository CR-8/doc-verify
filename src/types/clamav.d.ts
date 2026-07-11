declare module "clamav.js" {
  interface ClamScanner {
    scanBuffer(buffer: Buffer): Promise<{ isInfected: boolean; threatName?: string }>;
  }
  export class ClamScanner {
    constructor();
    scanBuffer(buffer: Buffer): Promise<{ isInfected: boolean; threatName?: string }>;
  }
}
