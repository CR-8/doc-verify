export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  userId?: string;
  action?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

function formatLogEntry(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function log(level: LogLevel, message: string, meta?: Partial<LogEntry>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  const formatted = formatLogEntry(entry);

  switch (level) {
    case LogLevel.ERROR:
      console.error(formatted);
      break;
    case LogLevel.WARN:
      console.warn(formatted);
      break;
    default:
      console.log(formatted);
  }
}

export const logger = {
  debug: (message: string, meta?: Partial<LogEntry>) => log(LogLevel.DEBUG, message, meta),
  info: (message: string, meta?: Partial<LogEntry>) => log(LogLevel.INFO, message, meta),
  warn: (message: string, meta?: Partial<LogEntry>) => log(LogLevel.WARN, message, meta),
  error: (message: string, meta?: Partial<LogEntry>) => log(LogLevel.ERROR, message, meta),
};
