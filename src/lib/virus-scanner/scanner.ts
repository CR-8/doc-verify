import { Readable } from "node:stream";
import { logger } from "@/lib/logger/logger";

export interface VirusScanResult {
  clean: boolean;
  threatName?: string;
  scanTimeMs: number;
  skipped?: boolean;
}

// ClamAV is an optional dependency: scanning is only performed when explicitly
// enabled and a clamd daemon is reachable. Config is read from the environment.
const ENABLED = process.env.CLAMAV_ENABLED === "true";
const HOST = process.env.CLAMAV_HOST || "127.0.0.1";
const PORT = Number(process.env.CLAMAV_PORT) || 3310;
const TIMEOUT_MS = Number(process.env.CLAMAV_TIMEOUT_MS) || 30000;
// When the daemon is unreachable while scanning is enabled, fail closed
// (reject the upload) only if configured; otherwise skip so that an outage of
// the scanning infrastructure does not halt all uploads.
const FAIL_CLOSED = process.env.CLAMAV_FAIL_CLOSED === "true";

// Shape of the parts of clamav.js (v0.12) that we use. The package's default
// export is a singleton instance whose methods are callback-based.
interface ClamavScanner {
  scan(
    object: NodeJS.ReadableStream,
    callback: (err: Error | undefined, object: unknown, virusName?: string) => void
  ): void;
}
interface ClamavModule {
  createScanner(port: number, host: string): ClamavScanner;
  ping(port: number, host: string, timeout: number, callback: (err?: Error) => void): void;
}

let modulePromise: Promise<ClamavModule | null> | null = null;

async function loadClamav(): Promise<ClamavModule | null> {
  if (!modulePromise) {
    // Externalized in next.config.ts, so this resolves via Node at runtime.
    modulePromise = import("clamav.js")
      .then((mod) => (mod.default ?? mod) as unknown as ClamavModule)
      .catch((error) => {
        logger.warn("clamav.js module unavailable", {
          action: "virus_scan_module_missing",
          metadata: { error: String(error) },
        });
        return null;
      });
  }
  return modulePromise;
}

function pingDaemon(clamav: ClamavModule): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (reachable: boolean) => {
      if (!settled) {
        settled = true;
        resolve(reachable);
      }
    };
    try {
      clamav.ping(PORT, HOST, TIMEOUT_MS, (err) => finish(!err));
    } catch {
      finish(false);
    }
  });
}

function scanBuffer(clamav: ClamavModule, buffer: Buffer): Promise<VirusScanResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: VirusScanResult) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    try {
      const scanner = clamav.createScanner(PORT, HOST);
      scanner.scan(Readable.from(buffer), (err, _object, virusName) => {
        if (err) {
          logger.error("Virus scan error", {
            action: "virus_scan_error",
            metadata: { error: String(err) },
          });
          finish({
            clean: !FAIL_CLOSED,
            threatName: FAIL_CLOSED ? "SCAN_ERROR" : undefined,
            skipped: !FAIL_CLOSED,
            scanTimeMs: Date.now() - start,
          });
          return;
        }
        finish({
          clean: !virusName,
          threatName: virusName,
          scanTimeMs: Date.now() - start,
        });
      });
    } catch (error) {
      logger.error("Virus scan failed to start", {
        action: "virus_scan_error",
        metadata: { error: String(error) },
      });
      finish({
        clean: !FAIL_CLOSED,
        threatName: FAIL_CLOSED ? "SCAN_ERROR" : undefined,
        skipped: !FAIL_CLOSED,
        scanTimeMs: Date.now() - start,
      });
    }
  });
}

export const virusScanner = {
  async scan(buffer: Buffer): Promise<VirusScanResult> {
    const start = Date.now();

    if (!ENABLED) {
      return { clean: true, skipped: true, scanTimeMs: Date.now() - start };
    }

    const clamav = await loadClamav();
    if (!clamav) {
      return {
        clean: !FAIL_CLOSED,
        threatName: FAIL_CLOSED ? "SCANNER_UNAVAILABLE" : undefined,
        skipped: !FAIL_CLOSED,
        scanTimeMs: Date.now() - start,
      };
    }

    const reachable = await pingDaemon(clamav);
    if (!reachable) {
      logger.warn("ClamAV daemon unreachable", {
        action: "virus_scan_daemon_unreachable",
        metadata: { host: HOST, port: PORT, failClosed: FAIL_CLOSED },
      });
      return {
        clean: !FAIL_CLOSED,
        threatName: FAIL_CLOSED ? "SCANNER_UNAVAILABLE" : undefined,
        skipped: !FAIL_CLOSED,
        scanTimeMs: Date.now() - start,
      };
    }

    return scanBuffer(clamav, buffer);
  },
};
