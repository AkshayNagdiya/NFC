import { AuditLog } from './audit.model.js';

export interface AuditInput {
  organizationId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  previousState?: unknown;
  newState?: unknown;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

/** Fire-and-forget safe: audit failures must not break business operations. */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await AuditLog.create(input);
  } catch {
    // Swallowed intentionally; logger attached by caller if needed.
  }
}
