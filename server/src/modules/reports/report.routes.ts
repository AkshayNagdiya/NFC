import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { Router } from 'express';
import { requireAuth, requirePerm } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { AccessEvent } from '../access/access.models.js';
import { Attendance } from '../attendance/attendance.model.js';
import { AuditLog } from '../audit/audit.model.js';
import { NFCBand } from '../bands/band.model.js';
import { NFCDevice } from '../devices/device.model.js';
import { NFCScan } from '../nfc/nfcScan.model.js';
import { User } from '../users/user.model.js';
import { WalletTransaction } from '../wallets/wallet.models.js';
import { exportSchema, summarySchema } from './report.validators.js';

function range(from?: string, to?: string, field = 'createdAt') {
  if (!from && !to) return {};
  return { [field]: { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) } };
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v instanceof Date ? v.toISOString() : v);
  return `"${s.replace(/"/g, '""')}"`;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const cols = Object.keys(rows[0]);
  return [cols.map(csvCell).join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n');
}

export const reportRoutes = Router();

reportRoutes.use(requireAuth);
reportRoutes.use(requirePerm('reports.read'));

reportRoutes.get('/summary', validate(summarySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const org = req.auth!.organizationId;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const orgId = new mongoose.Types.ObjectId(org);

    const [bandsByStatus, scansByResult, attendanceByStatus, devices, users, txns] = await Promise.all([
      NFCBand.aggregate([{ $match: { organizationId: orgId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      NFCScan.aggregate([
        { $match: { organizationId: orgId, ...range(from, to, 'timestamp').timestamp } },
        { $group: { _id: '$result', count: { $sum: 1 } } },
      ]),
      Attendance.aggregate([
        { $match: { organizationId: orgId, ...(from || to ? { createdAt: range(from, to).createdAt } : {}) } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      NFCDevice.aggregate([{ $match: { organizationId: orgId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      User.countDocuments({ organizationId: org, status: 'ACTIVE' }),
      WalletTransaction.aggregate([
        { $match: { organizationId: orgId, status: 'SUCCESS', ...(from || to ? { createdAt: range(from, to).createdAt } : {}) } },
        { $group: { _id: '$type', count: { $sum: 1 }, volumeMinor: { $sum: '$amountMinor' } } },
      ]),
    ]);

    res.json({
      success: true,
      data: { bandsByStatus, scansByResult, attendanceByStatus, devicesByStatus: devices, activeUsers: users, transactions: txns },
      requestId: req.requestId,
    });
  } catch (e) {
    next(e);
  }
});

const EXPORT_LIMIT = 5000;

reportRoutes.get('/export', validate(exportSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const org = req.auth!.organizationId;
    const domain = req.query.domain as string;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    let rows: Record<string, unknown>[] = [];

    if (domain === 'bands') {
      rows = await NFCBand.find({ organizationId: org }).limit(EXPORT_LIMIT).lean();
    } else if (domain === 'scans') {
      rows = await NFCScan.find({ organizationId: org, ...range(from, to, 'timestamp') }).limit(EXPORT_LIMIT).lean();
    } else if (domain === 'attendance') {
      rows = await Attendance.find({ organizationId: org, ...range(from, to) }).populate('userId', 'firstName lastName email').limit(EXPORT_LIMIT).lean();
    } else if (domain === 'access-events') {
      rows = await AccessEvent.find({ organizationId: org, ...range(from, to, 'timestamp') }).limit(EXPORT_LIMIT).lean();
    } else if (domain === 'transactions') {
      rows = await WalletTransaction.find({ organizationId: org, ...range(from, to) }).populate('userId', 'firstName lastName email').limit(EXPORT_LIMIT).lean();
    } else {
      rows = await AuditLog.find({ organizationId: org, ...range(from, to) }).limit(EXPORT_LIMIT).lean();
    }

    // Flatten populated refs + objects for spreadsheet sanity.
    const flat = rows.map((r) => {
      const o: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) {
        if (v !== null && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)) {
          const sub = v as Record<string, unknown>;
          o[k] = sub.email ?? sub.name ?? String(sub._id ?? JSON.stringify(sub));
        } else if (Array.isArray(v)) {
          o[k] = v.join(';');
        } else {
          o[k] = v as unknown;
        }
      }
      return o;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${domain}-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(toCsv(flat));
  } catch (e) {
    next(e);
  }
});
