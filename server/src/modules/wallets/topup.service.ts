import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import type { AuthContext } from '../../middleware/auth.js';
import { ApiError } from '../../utils/errors.js';
import { orgFilter } from '../../utils/orgScope.js';
import { writeAudit } from '../audit/audit.service.js';
import { Organization } from '../organizations/organization.model.js';
import { User } from '../users/user.model.js';
import { emitToOrg } from '../../sockets/index.js';
import { Payment } from './wallet.models.js';
import { walletService } from './wallet.service.js';

type Provider = 'MANUAL' | 'UPI' | 'RAZORPAY' | 'STRIPE' | 'MOCK';

function canManage(auth: AuthContext): boolean {
  return auth.role === 'SUPER_ADMIN' || auth.permissions.includes('wallet.manage') || auth.permissions.includes('transactions.manage');
}

function canRead(auth: AuthContext): boolean {
  return canManage(auth) || auth.permissions.includes('wallet.read') || auth.permissions.includes('transactions.read');
}

function assertSelfOrStaff(auth: AuthContext, targetUserId: string, needManage = false): void {
  if (auth.userId === targetUserId) return;
  if (needManage ? canManage(auth) : canRead(auth) || canManage(auth)) return;
  // Self-service top-up: anyone may top up their own wallet even without wallet.read.
  throw new ApiError(403, 'FORBIDDEN', 'Missing permission: wallet.manage');
}

export function buildUpiIntent(amountMinor: number, reference: string, vpa: string, name: string): string | null {
  if (!vpa) return null;
  const rupees = (amountMinor / 100).toFixed(2);
  const params = new URLSearchParams({
    pa: vpa,
    pn: name || 'AirData',
    am: rupees,
    cu: 'INR',
    tn: reference.slice(0, 80),
  });
  return `upi://pay?${params.toString()}`;
}

export const topupService = {
  async intent(
    auth: AuthContext,
    userId: string,
    input: { amountMinor: number; provider?: Provider; method?: 'CASH' | 'UPI' | 'CARD' | 'NETBANKING' | 'WALLET'; idempotencyKey?: string },
  ) {
    const scope = orgFilter(auth);
    // Self top-up allowed for any authenticated holder; topping up others needs wallet.manage.
    if (auth.userId !== userId && !canManage(auth)) {
      throw new ApiError(403, 'FORBIDDEN', 'Missing permission: wallet.manage');
    }
    const holder = await User.findOne({ _id: userId, organizationId: scope.organizationId }).select('_id status').lean();
    if (!holder) throw new ApiError(404, 'NOT_FOUND', 'User not found');

    const org = await Organization.findById(scope.organizationId).select('settings').lean();
    const settings = (org?.settings ?? {}) as { minTopupMinor?: number; maxTopupMinor?: number; upiPayeeVpa?: string; upiPayeeName?: string };
    const min = settings.minTopupMinor ?? 1000;
    const max = settings.maxTopupMinor ?? 1000000;
    if (input.amountMinor < min || input.amountMinor > max) {
      throw new ApiError(400, 'VALIDATION_ERROR', `Amount must be between ₹${(min / 100).toFixed(2)} and ₹${(max / 100).toFixed(2)}`);
    }

    const provider: Provider = input.provider ?? 'UPI';
    const method = input.method ?? (provider === 'MANUAL' ? 'CASH' : 'UPI');
    const idemKey = input.idempotencyKey ?? `topup_${randomUUID()}`;

    const existing = await Payment.findOne({ organizationId: scope.organizationId, idempotencyKey: idemKey }).lean();
    if (existing) {
      return { order: existing, replay: true, upiIntent: upiForOrder(existing, settings), qrPayload: upiForOrder(existing, settings) ?? String(existing._id) };
    }

    const providerOrderId = `ord_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const reference = `AD-${String(providerOrderId).slice(-8).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + env.TOPUP_ORDER_TTL_MIN * 60 * 1000);

    let order;
    try {
      order = await Payment.create({
        organizationId: scope.organizationId,
        userId,
        amountMinor: input.amountMinor,
        method,
        status: 'PENDING',
        reference,
        actorId: auth.userId,
        provider,
        providerOrderId,
        idempotencyKey: idemKey,
        expiresAt,
        metadata: { provider },
      });
    } catch (e: unknown) {
      if ((e as { code?: number }).code === 11000) {
        const winner = await Payment.findOne({ organizationId: scope.organizationId, idempotencyKey: idemKey }).lean();
        if (!winner) throw new ApiError(500, 'INTERNAL_ERROR', 'Top-up order vanished');
        return { order: winner, replay: true, upiIntent: upiForOrder(winner, settings), qrPayload: upiForOrder(winner, settings) ?? String(winner._id) };
      }
      throw e;
    }

    const vpa = settings.upiPayeeVpa || env.UPI_PAYEE_VPA;
    const name = settings.upiPayeeName || env.UPI_PAYEE_NAME;
    const upiIntent = provider === 'UPI' || provider === 'MOCK' ? buildUpiIntent(input.amountMinor, reference, vpa, name) : null;

    await writeAudit({
      organizationId: scope.organizationId,
      actorId: auth.userId,
      action: 'WALLET_TOPUP_INTENT',
      entityType: 'Payment',
      entityId: String(order._id),
      newState: { userId, amountMinor: input.amountMinor, provider, reference },
      requestId: undefined,
    });
    emitToOrg(scope.organizationId, 'wallet.topup', { orderId: String(order._id), userId, status: 'PENDING', amountMinor: input.amountMinor });

    const plain = order.toObject();
    return { order: plain, replay: false, upiIntent, qrPayload: upiIntent ?? String(order._id) };
  },

  async get(auth: AuthContext, orderId: string) {
    const scope = orgFilter(auth);
    const order = await Payment.findOne({ _id: orderId, organizationId: scope.organizationId }).lean();
    if (!order) throw new ApiError(404, 'NOT_FOUND', 'Top-up order not found');
    assertSelfOrStaff(auth, String(order.userId));
    return order;
  },

  async list(auth: AuthContext, q: { page: number; pageSize: number; userId?: string; status?: string }) {
    const scope = orgFilter(auth);
    if (q.userId) {
      assertSelfOrStaff(auth, q.userId);
    } else if (auth.role !== 'SUPER_ADMIN' && !canRead(auth) && !canManage(auth)) {
      // Non-privileged users may only list their own orders.
      q = { ...q, userId: auth.userId };
    }
    const filter: Record<string, unknown> = { ...scope };
    if (q.userId) filter.userId = q.userId;
    if (q.status) filter.status = q.status;
    const total = await Payment.countDocuments(filter);
    const items = await Payment.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.pageSize).limit(q.pageSize).lean();
    return { items, page: q.page, pageSize: q.pageSize, total, totalPages: Math.ceil(total / q.pageSize) };
  },

  /** Staff confirm (cash counter) or MOCK auto-confirm. Exactly-once via ledger idempotency. */
  async confirm(auth: AuthContext, orderId: string, providerReference?: string) {
    if (!canManage(auth)) throw new ApiError(403, 'FORBIDDEN', 'Missing permission: wallet.manage');
    const scope = orgFilter(auth);
    const order = await Payment.findOne({ _id: orderId, organizationId: scope.organizationId });
    if (!order) throw new ApiError(404, 'NOT_FOUND', 'Top-up order not found');
    return finalizeOrder(scope.organizationId, order.toObject(), { actorId: auth.userId, providerReference });
  },

  async cancel(auth: AuthContext, orderId: string) {
    const scope = orgFilter(auth);
    const order = await Payment.findOne({ _id: orderId, organizationId: scope.organizationId });
    if (!order) throw new ApiError(404, 'NOT_FOUND', 'Top-up order not found');
    if (auth.userId !== String(order.userId) && !canManage(auth)) {
      throw new ApiError(403, 'FORBIDDEN', 'Missing permission: wallet.manage');
    }
    if (order.status !== 'PENDING') throw new ApiError(409, 'INVALID_STATE', `Order is already ${String(order.status).toLowerCase()}`);
    order.status = 'CANCELLED';
    await order.save();
    await writeAudit({
      organizationId: scope.organizationId,
      actorId: auth.userId,
      action: 'WALLET_TOPUP_CANCELLED',
      entityType: 'Payment',
      entityId: String(order._id),
    });
    emitToOrg(scope.organizationId, 'wallet.topup', { orderId: String(order._id), userId: String(order.userId), status: 'CANCELLED' });
    return order.toObject();
  },

  /** Gateway webhook. No auth — verified by secret + order lookup. Safe to retry. */
  async webhook(input: { orderId?: string; providerOrderId?: string; reference?: string; status: string; providerReference?: string; secret?: string }) {
    if (env.TOPUP_WEBHOOK_SECRET && input.secret !== env.TOPUP_WEBHOOK_SECRET) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Invalid webhook secret');
    }
    const or: Record<string, unknown>[] = [];
    if (input.orderId) or.push({ _id: input.orderId });
    if (input.providerOrderId) or.push({ providerOrderId: input.providerOrderId });
    if (input.reference) or.push({ reference: input.reference });
    if (or.length === 0) throw new ApiError(400, 'VALIDATION_ERROR', 'Provide orderId, providerOrderId or reference');
    const order = await Payment.findOne({ $or: or }).lean();
    if (!order) throw new ApiError(404, 'NOT_FOUND', 'Top-up order not found');
    const orgId = String(order.organizationId);

    if (input.status === 'FAILED' || input.status === 'CANCELLED') {
      const failed = await Payment.findOneAndUpdate(
        { _id: order._id, status: 'PENDING' },
        { $set: { status: 'FAILED', providerReference: input.providerReference } },
        { new: true },
      ).lean();
      if (failed) {
        emitToOrg(orgId, 'wallet.topup', { orderId: String(order._id), userId: String(order.userId), status: 'FAILED' });
        return { order: failed, replay: false };
      }
      const current = await Payment.findById(order._id).lean();
      return { order: current, replay: true };
    }

    if (input.status !== 'SUCCESS') throw new ApiError(400, 'VALIDATION_ERROR', 'Unknown webhook status');
    return finalizeOrder(orgId, order, { actorId: String(order.actorId), providerReference: input.providerReference, via: 'webhook' });
  },
};

function upiForOrder(order: Record<string, unknown>, settings: { upiPayeeVpa?: string; upiPayeeName?: string }): string | null {
  const vpa = settings.upiPayeeVpa || env.UPI_PAYEE_VPA;
  const name = settings.upiPayeeName || env.UPI_PAYEE_NAME;
  return buildUpiIntent(order.amountMinor as number, String(order.reference ?? order._id), vpa, name);
}

async function finalizeOrder(
  organizationId: string,
  order: Record<string, unknown> & { _id: unknown },
  opts: { actorId: string; providerReference?: string; via?: string },
): Promise<{ order: Record<string, unknown>; txn: unknown; replay: boolean }> {
  const orderId = String(order._id);
  if (order.expiresAt && new Date(order.expiresAt as string) < new Date() && order.status === 'PENDING') {
    await Payment.updateOne({ _id: order._id }, { $set: { status: 'CANCELLED' } });
    throw new ApiError(410, 'INVALID_STATE', 'Top-up order has expired — create a new one');
  }
  if (order.status === 'SUCCESS') {
    const existingTxn = order.walletTransactionId
      ? await walletService.listTransactions(
          { userId: opts.actorId, organizationId, role: 'SUPER_ADMIN', permissions: [] },
          { page: 1, pageSize: 1 },
        ).catch(() => null)
      : null;
    void existingTxn;
    const current = await Payment.findById(order._id).lean();
    return { order: current as Record<string, unknown>, txn: null, replay: true };
  }
  if (order.status !== 'PENDING') throw new ApiError(409, 'INVALID_STATE', `Order is already ${String(order.status).toLowerCase()}`);

  // Exactly-once credit: ledger idempotency key is derived from the order id.
  const { txn } = await walletService.apply({
    organizationId,
    userId: String(order.userId),
    amountMinor: order.amountMinor as number,
    actorId: opts.actorId,
    idempotencyKey: `topup_${orderId}`,
    reason: `Online top-up ${String(order.reference ?? orderId)}`,
    metadata: { provider: order.provider, topupOrderId: orderId },
    type: 'CREDIT',
    signedDelta: order.amountMinor as number,
  });

  const updated = await Payment.findOneAndUpdate(
    { _id: order._id, status: 'PENDING' },
    {
      $set: {
        status: 'SUCCESS',
        walletTransactionId: (txn as { _id: unknown })._id,
        providerReference: opts.providerReference,
      },
    },
    { new: true },
  ).lean();
  // Lost a confirm race (duplicate webhook + staff click): ledger stayed single via idempotency.
  const finalOrder = updated ?? ((await Payment.findById(order._id).lean()) as Record<string, unknown>);

  await writeAudit({
    organizationId,
    actorId: opts.actorId,
    action: opts.via === 'webhook' ? 'WALLET_TOPUP_WEBHOOK' : 'WALLET_TOPUP_CONFIRMED',
    entityType: 'Payment',
    entityId: orderId,
    newState: { amountMinor: order.amountMinor, providerReference: opts.providerReference },
  });
  emitToOrg(organizationId, 'wallet.topup', { orderId, userId: String(order.userId), status: 'SUCCESS', amountMinor: order.amountMinor });
  return { order: finalOrder, txn, replay: false };
}
