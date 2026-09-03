import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const { model, models } = mongoose;
/**
 * Money is stored as integer minor units (`balanceMinor`, `amountMinor`) — never floats.
 * Wallet updates use optimistic locking on `version` to prevent double-spend races.
 */
const walletSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    balanceMinor: { type: Number, required: true, default: 0, min: 0 },
    currency: { type: String, default: 'INR', maxlength: 8 },
    status: { type: String, enum: ['ACTIVE', 'FROZEN', 'CLOSED'], default: 'ACTIVE', index: true },
    version: { type: Number, default: 0 },
  },
  { timestamps: true, optimisticConcurrency: true },
);

walletSchema.index({ organizationId: 1, userId: 1 }, { unique: true });

export type WalletDoc = InferSchemaType<typeof walletSchema> & { _id: unknown };
export const Wallet: Model<WalletDoc> =
  (models.Wallet as Model<WalletDoc> | undefined) ?? model<WalletDoc>('Wallet', walletSchema);

export const WALLET_TX_TYPES = ['CREDIT', 'DEBIT', 'REFUND', 'ADJUSTMENT'] as const;
export const WALLET_TX_STATUSES = ['SUCCESS', 'PENDING', 'FAILED'] as const;

/** Immutable financial ledger. Never updated or deleted — reversals are new REFUND rows. */
const walletTxSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    walletId: { type: Schema.Types.ObjectId, ref: 'Wallet', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: WALLET_TX_TYPES, required: true, index: true },
    amountMinor: { type: Number, required: true, min: 1 },
    balanceAfterMinor: { type: Number, required: true },
    status: { type: String, enum: WALLET_TX_STATUSES, default: 'SUCCESS', index: true },
    /** Client idempotency key. Unique per org — retries replay the original row. */
    idempotencyKey: { type: String, required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, maxlength: 500 },
    scanId: { type: Schema.Types.ObjectId, ref: 'NFCScan' },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

walletTxSchema.index({ organizationId: 1, idempotencyKey: 1 }, { unique: true });
walletTxSchema.index({ organizationId: 1, walletId: 1, createdAt: -1 });

export type WalletTransactionDoc = InferSchemaType<typeof walletTxSchema>;
export const WalletTransaction: Model<WalletTransactionDoc> =
  (models.WalletTransaction as Model<WalletTransactionDoc> | undefined) ??
  model<WalletTransactionDoc>('WalletTransaction', walletTxSchema);

export const PAYMENT_STATUSES = ['SUCCESS', 'PENDING', 'FAILED', 'REFUNDED', 'CANCELLED'] as const;

const paymentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    walletTransactionId: { type: Schema.Types.ObjectId, ref: 'WalletTransaction' },
    amountMinor: { type: Number, required: true, min: 1 },
    method: { type: String, enum: ['CASH', 'UPI', 'CARD', 'NETBANKING', 'WALLET'], required: true },
    status: { type: String, enum: PAYMENT_STATUSES, default: 'PENDING', index: true },
    reference: { type: String, maxlength: 160, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

paymentSchema.index({ organizationId: 1, createdAt: -1 });

export type PaymentDoc = InferSchemaType<typeof paymentSchema> & { _id: unknown };
export const Payment: Model<PaymentDoc> =
  (models.Payment as Model<PaymentDoc> | undefined) ?? model<PaymentDoc>('Payment', paymentSchema);
