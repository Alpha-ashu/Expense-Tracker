/**
 * Lightweight circuit-breaker for external API calls (Gemini, Donut, etc.).
 *
 * States:
 *  CLOSED   requests pass through normally
 *  OPEN     requests fail-fast (no network call)
 *  HALF     allow a single probe; if it succeeds  CLOSED, else  OPEN
 */

import { logger } from '../config/logger';

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerOptions {
  /** How many consecutive failures before opening the circuit. */
  failureThreshold?: number;
  /** Milliseconds to wait before trying a single probe. */
  resetTimeoutMs?: number;
  /** Human-readable name for logging. */
  name: string;
}

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureAt: number;
  successesSinceHalf: number;
}

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_RESET_TIMEOUT_MS = 60_000; // 1 minute

const circuits = new Map<string, CircuitBreakerState>();

const getOrCreate = (name: string): CircuitBreakerState => {
  let cb = circuits.get(name);
  if (!cb) {
    cb = { state: 'CLOSED', failures: 0, lastFailureAt: 0, successesSinceHalf: 0 };
    circuits.set(name, cb);
  }
  return cb;
};

/**
 * Execute `fn` through the named circuit breaker.
 * Throws a descriptive error when the circuit is OPEN.
 */
export async function withCircuitBreaker<T>(
  options: CircuitBreakerOptions,
  fn: () => Promise<T>,
): Promise<T> {
  const threshold = options.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
  const resetMs = options.resetTimeoutMs ?? DEFAULT_RESET_TIMEOUT_MS;
  const cb = getOrCreate(options.name);

  // Check whether we should transition OPEN  HALF_OPEN
  if (cb.state === 'OPEN') {
    if (Date.now() - cb.lastFailureAt >= resetMs) {
      cb.state = 'HALF_OPEN';
      cb.successesSinceHalf = 0;
      logger.info('Circuit breaker half-open', { circuit: options.name });
    } else {
      logger.warn('Circuit breaker open  failing fast', { circuit: options.name });
      throw new Error(`Circuit breaker OPEN for ${options.name}. Retry later.`);
    }
  }

  try {
    const result = await fn();

    // Success resets the breaker
    if (cb.state === 'HALF_OPEN' || cb.failures > 0) {
      logger.info('Circuit breaker recovered', {
        circuit: options.name,
        previousFailures: cb.failures,
      });
    }
    cb.state = 'CLOSED';
    cb.failures = 0;
    return result;
  } catch (error) {
    cb.failures += 1;
    cb.lastFailureAt = Date.now();

    if (cb.failures >= threshold) {
      cb.state = 'OPEN';
      logger.error('Circuit breaker tripped to OPEN', {
        circuit: options.name,
        failures: cb.failures,
      });
    }

    throw error;
  }
}

/** Expose internal state for health-check endpoints. */
export const getCircuitBreakerStatus = (): Record<string, { state: CircuitState; failures: number }> => {
  const status: Record<string, { state: CircuitState; failures: number }> = {};
  for (const [name, cb] of circuits) {
    status[name] = { state: cb.state, failures: cb.failures };
  }
  return status;
};

/** Reset a specific circuit (useful in tests). */
export const resetCircuitBreaker = (name: string) => {
  circuits.delete(name);
};
