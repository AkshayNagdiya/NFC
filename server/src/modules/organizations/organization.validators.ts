import { z } from 'zod';

export const updateSettingsSchema = z.object({
  body: z.object({
    timezone: z.string().max(64).optional(),
    attendanceLateAfter: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm').optional(),
    attendanceDayEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm').optional(),
    dupScanWindowMs: z.number().int().min(0).max(60000).optional(),
  }).refine((b) => Object.keys(b).length > 0, { message: 'No settings to update' }),
});
