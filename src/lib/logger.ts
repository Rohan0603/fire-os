/**
 * Logger utility for FIRE OS
 * Provides development and production logging with automatic environment detection
 */

export interface Logger {
  log(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  error(message: string, error?: any): void;
  debug(message: string, data?: any): void;
}

/**
 * Detect if running in development environment
 * Dev: localhost or 127.0.0.1
 * Prod: any other hostname
 * @returns true if in development environment
 */
function isDevelopment(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

/**
 * Get current timestamp in HH:MM:SS format
 * @returns Formatted timestamp string
 */
function getTimestamp(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Create and initialize a logger instance
 * In development: logs to console with timestamps
 * In production: silently discards logs (no console output)
 * @returns Logger instance
 */
export function initLogger(): Logger {
  const dev = isDevelopment();

  return {
    log(message: string, data?: any): void {
      if (!dev) return;
      const timestamp = getTimestamp();
      console.log(`[${timestamp}] [FIRE OS] ${message}`, data);
    },

    warn(message: string, data?: any): void {
      if (!dev) return;
      const timestamp = getTimestamp();
      console.warn(`[${timestamp}] [FIRE OS] ⚠️ ${message}`, data);
    },

    error(message: string, error?: any): void {
      if (!dev) return;
      const timestamp = getTimestamp();
      console.error(`[${timestamp}] [FIRE OS] ❌ ${message}`, error);
    },

    debug(message: string, data?: any): void {
      if (!dev) return;
      const timestamp = getTimestamp();
      console.debug(`[${timestamp}] [FIRE OS] 🔧 ${message}`, data);
    },
  };
}

/**
 * Global logger instance
 * Initialized once and reused throughout the application
 */
let globalLogger: Logger | null = null;

/**
 * Get or create the global logger instance
 * @returns Global logger instance
 */
export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = initLogger();
  }
  return globalLogger;
}

/**
 * Set up global uncaught error handler
 * Logs all unhandled errors to the logger
 * @param logger - Logger instance to use
 */
export function setupGlobalErrorHandler(logger: Logger): void {
  if (typeof window === 'undefined') return;

  window.onerror = (message: string | Event, source?: string, lineno?: number, colno?: number, error?: Error) => {
    logger.error(`Uncaught error at ${source}:${lineno}:${colno}`, {
      message: typeof message === 'string' ? message : message.toString(),
      error: error?.stack || error?.toString() || 'Unknown',
    });
    return false; // Allow default error handling
  };

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    logger.error('Uncaught promise rejection', {
      reason: event.reason,
      promise: event.promise,
    });
  });
}
