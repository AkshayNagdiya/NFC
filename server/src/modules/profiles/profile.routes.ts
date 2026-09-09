import { Router } from 'express';
import { requireAuth, requirePerm } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { profileController } from './profile.controller.js';
import {
  getProfileSchema,
  listProfilesSchema,
  publicProfileSchema,
  updateProfileSchema,
  upsertProfileSchema,
} from './profile.validators.js';

export const profileRoutes = Router();

// Public tap-profile page + contact file (no login — profiles are public by design).
profileRoutes.get('/p/:slug', validate(publicProfileSchema), profileController.public);
profileRoutes.get('/p/:slug/vcard', validate(publicProfileSchema), profileController.vcard);

profileRoutes.use(requireAuth);
profileRoutes.get('/', requirePerm('users.read'), validate(listProfilesSchema), profileController.list);
profileRoutes.get('/:id', requirePerm('users.read'), validate(getProfileSchema), profileController.get);
profileRoutes.post('/', requirePerm('users.update'), validate(upsertProfileSchema), profileController.upsert);
profileRoutes.patch('/:id', requirePerm('users.update'), validate(updateProfileSchema), profileController.update);
