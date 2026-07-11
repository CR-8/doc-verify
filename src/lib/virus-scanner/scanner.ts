import { logger } from "@/lib/logger/logger";

export interface VirusScanResult {
  clean: boolean;
  threatName?: string;
  scanTimeMs: number;
}

async function scanWithClamAv(buffer: Buffer): Promise<VirusScanResult> {
  const start = Date.now();
  try {
    const clamav = await import("clamav.js").catch(() => null);
    if (!clamav) {
      logger.info("ClamAV not available, skipping virus scan", { action: "virus_scan_skipped" });
      return { clean: true, scanTimeMs: Date.now() - start };
    }
    const scanner = new clamav.ClamScanner();
    const result = await scanner.scanBuffer(buffer);
    return {
      clean: !result.isInfected,
      threatName: result.threatName,
      scanTimeMs: Date.now() - start,
    };
  } catch (error) {
    logger.error("Virus scan error", {
      action: "virus_scan_error",
      metadata: { error: String(error) },
    });
    return { clean: false, threatName: "SCAN_ERROR", scanTimeMs: Date.now() - start };
  }
}

export const virusScanner = {
  async scan(buffer: Buffer): Promise<VirusScanResult> {
    return scanWithClamAv(buffer);
  },
};
