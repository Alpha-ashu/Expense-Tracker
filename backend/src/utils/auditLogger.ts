/**
 * Structured audit logging for fintech-grade observability.
 *
 * Captures security-relevant events (auth, data mutation, sync, AI)
 * in a consistent JSON shape that can be shipped to any log aggregator.
 *
 * Uses the existing Winston logger under the hood.
 */

import { logger } from '../config/logger';

export type AuditEventType =
  | 'auth.login'
  | 'auth.login_failed'
  | 'auth.register'
  | 'auth.token_refresh'
  | 'auth.logout'
  | 'data.create'
  | 'data.update'
  | 'data.delete'
  | 'sync.push'
  | 'sync.pull'
  | 'sync.conflict'
  | 'sync.device_register'
  | 'ai.ocr_request'
  | 'ai.ocr_success'
  | 'ai.ocr_failure'
  | 'ai.prompt_injection'
  | 'ai.quota_exceeded'
  | 'ai.voice_request'
  | 'otp.generated'
  | 'otp.verified'
  | 'otp.invalid'
  | 'otp.expired'
  | 'otp.max_attempts'
  | 'otp.rate_limited'
  | 'device.trusted'
  | 'device.revoked'
  | 'security.rate_limit_hit'
  | 'security.idor_attempt'
  | 'security.invalid_file'
  | 'security.circuit_open'
  | 'file.upload'
  | 'file.delete';

interface AuditPayload {
  event: AuditEventType;
  userId?: string;
  ip?: string;
  /** Entity being acted on (e.g. "transaction", "account") */
  resource?: string;
  /** The specific resource ID */
  resourceId?: string;
  /** HTTP method + path (e.g. "POST /api/v1/receipts/scan") */
  action?: string;
  /** Freeform metadata (keep small  logged as JSON). */
  meta?: Record<string, unknown>;
}

/**
 * Emit a structured audit log entry.
 *
 * All audit entries use `info` level so they land in `combined.log`
 * and are available for aggregation.  Security failures additionally
 * log at `warn`.
 */
export function audit(payload: AuditPayload): void {
  const entry = {
    audit: true,
    ...payload,
    timestamp: new Date().toISOString(),
  };

  const isFailure =
    payload.event.includes('failed') ||
    payload.event.includes('injection') ||
    payload.event.includes('exceeded') ||
    payload.event.includes('idor') ||
    payload.event.includes('rate_limit') ||
    payload.event.includes('circuit_open');

  if (isFailure) {
    logger.warn('[AUDIT]', entry);
  } else {
    logger.info('[AUDIT]', entry);
  }
}
