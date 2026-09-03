import { z } from 'zod';
import { PAYMENT_STATUSES, WALLET_TX_STATUSES, WALLET_TX_TYPES } from './wallet.models.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const money = z.number().int().min(1).max(100_000_000);
const idemKey = z.string().min(8).max(128).optional();

export const walletParamsSchema = z.object({
  params: z.object({ userId: objectId }),
});

export const creditSchema = z.object({
  params: z.object({ userId: objectId }),
  body: z.object({
    amountMinor: money,
    idempotencyKey: idemKey,
    reason: z.string().max(500).optional(),
    method: z.enum(['CASH', 'UPI', 'CARD', 'NETBANKING', 'WALLET']).optional(),
  }),
});

export const debitSchema = z.object({
  params: z.object({ userId: objectId }),
  body: z.object({
    amountMinor: money,
    idempotencyKey: idemKey,
    reason: z.string().max(500).optional(),
  }),
});

export const adjustSchema = z.object({
  params: z.object({ userId: objectId }),
  body: z.object({
    deltaMinor: z.number().int().min(-100_000_000).max(100_000_000).refine((n) => n !== 0, 'Delta cannot be zero'),
    idempotencyKey: idemKey,
    reason: z.string().min(3).max(500),
  }),
});

export const refundSchema = z.object({
  body: z.object({
    transactionId: objectId,
    idempotencyKey: idemKey,
    reason: z.string().min(3).max(500),
  }),
});

export const listTransactionsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    userId: objectId.optional(),
    type: z.enum(WALLET_TX_TYPES).optional(),
    status: z.enum(WALLET_TX_STATUSES).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }),
});

export const listPaymentsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    userId: objectId.optional(),
    status: z.enum(PAYMENT_STATUSES).optional(),
  }),
});
