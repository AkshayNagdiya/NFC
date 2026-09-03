import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';
const { model, models } = mongoose;

const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    status: { type: String, enum: ['ACTIVE', 'SUSPENDED'], default: 'ACTIVE', index: true },
    contactEmail: { type: String, trim: true },
    settings: {
      timezone: { type: String, default: 'UTC' },
      attendanceLateAfter: { type: String, default: '09:30' },
      attendanceDayEnd: { type: String, default: '17:00' },
      dupScanWindowMs: { type: Number, default: 3000 },
    },
  },
  { timestamps: true },
);

organizationSchema.index({ name: 1 });

export type OrganizationDoc = InferSchemaType<typeof organizationSchema> & { _id: unknown };
/** Idempotent registration: safe under test re-imports and dev hot-reload. */
export const Organization: Model<OrganizationDoc> =
  (models.Organization as Model<OrganizationDoc> | undefined) ??
  model<OrganizationDoc>('Organization', organizationSchema);
