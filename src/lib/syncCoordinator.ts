import type { PortfolioEnvelope, SyncStatus } from '../types/firebase';

export interface SyncCoordinatorOptions {
  uid: string;
  save: (uid: string, envelope: PortfolioEnvelope) => Promise<void>;
  debounceMs?: number;
  maxRetries?: number;
  retryBaseMs?: number;
  initialOnline?: boolean;
  onStatusChange?: (status: SyncStatus) => void;
}

export interface FlushOptions {
  timeoutMs?: number;
}

export class SyncCoordinator {
  private readonly uid: string;
  private readonly save: SyncCoordinatorOptions['save'];
  private readonly debounceMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  private readonly onStatusChange?: SyncCoordinatorOptions['onStatusChange'];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: PortfolioEnvelope | null = null;
  private activeWrite: Promise<void> | null = null;
  private paused = false;
  private generation = 0;
  private status: SyncStatus = 'idle';
  private online = typeof navigator === 'undefined' || navigator.onLine;
  private readonly handleOnline = (): void => {
    this.online = true;
    if (this.pending) void this.flushWithRetry();
  };
  private readonly handleOffline = (): void => {
    this.online = false;
    if (this.pending) this.setStatus('offline');
  };

  constructor(options: SyncCoordinatorOptions) {
    this.uid = options.uid;
    this.save = options.save;
    this.debounceMs = options.debounceMs ?? 1000;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryBaseMs = options.retryBaseMs ?? 500;
    if (options.initialOnline !== undefined) this.online = options.initialOnline;
    this.onStatusChange = options.onStatusChange;
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  markDirty(envelope: PortfolioEnvelope): void {
    if (this.paused) return;
    this.pending = envelope;
    if (!this.online) {
      this.setStatus('offline');
      return;
    }
    this.setStatus('pending');
    if (this.timer) clearTimeout(this.timer);
    const generation = this.generation;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (generation !== this.generation || this.paused) return;
      void this.flushWithRetry();
    }, this.debounceMs);
  }

  pause(): void {
    this.paused = true;
    this.generation += 1;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  resume(): void {
    this.paused = false;
    if (this.pending) {
      this.setStatus(this.online ? 'pending' : 'offline');
      if (this.online) void this.flushWithRetry();
    }
  }

  async flush(options: FlushOptions = {}): Promise<void> {
    if (!this.online) {
      if (this.pending) this.setStatus('offline');
      return;
    }
    if (this.activeWrite) return this.activeWrite;
    if (!this.pending) {
      this.setStatus('idle');
      return;
    }

    const envelope = this.pending;
    this.pending = null;
    const generation = this.generation;
    this.setStatus('syncing');
    const write = this.save(this.uid, envelope)
      .then(() => {
        if (generation === this.generation) this.setStatus(this.pending ? 'pending' : 'idle');
      })
      .catch((error: unknown) => {
        if (generation === this.generation) {
          this.pending = envelope;
          this.setStatus('error');
        }
        throw error;
      })
      .finally(() => {
        this.activeWrite = null;
      });

    this.activeWrite = options.timeoutMs
      ? withTimeout(write, options.timeoutMs)
      : write;
    return this.activeWrite;
  }

  dispose(): void {
    this.pause();
    this.pending = null;
    this.setStatus('idle');
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
  }

  private async flushWithRetry(): Promise<void> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      if (!this.online || !this.pending) return;
      try {
        await this.flush();
        return;
      } catch (error) {
        if (!isRetryableSyncError(error) || attempt === this.maxRetries || !this.online) return;
        this.setStatus('pending');
        await delay(this.retryBaseMs * (2 ** attempt));
      }
    }
  }

  private setStatus(status: SyncStatus): void {
    this.status = status;
    this.onStatusChange?.(status);
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Sync flush timed out after ${timeoutMs}ms`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isRetryableSyncError(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  if (error.name === 'AbortError') return false;
  const code = (error as Error & { code?: string }).code ?? '';
  return [
    'unavailable',
    'deadline-exceeded',
    'resource-exhausted',
    'aborted',
    'failed-precondition',
    'network-request-failed',
  ].includes(code)
    || /network|timeout|temporarily unavailable/i.test(error.message);
}