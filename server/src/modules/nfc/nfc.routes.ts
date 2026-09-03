import { Router } from 'express';
import { requireAuth, requirePerm } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { nfcController } from './nfc.controller.js';
import { listScansSchema, scanSchema } from './nfc.validators.js';

export const nfcRoutes = Router();

nfcRoutes.use(requireAuth);
nfcRoutes.post('/scan', requirePerm('nfc.scan'), validate(scanSchema), nfcController.scan);
nfcRoutes.get('/scans', requirePerm('nfc.scan'), validate(listScansSchema), nfcController.list);
