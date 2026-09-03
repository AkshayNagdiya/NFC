import { Router } from 'express';
import { requireAuth, requirePerm } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { walletController } from './wallet.controller.js';
import {
  adjustSchema,
  creditSchema,
  debitSchema,
  listTransactionsSchema,
  refundSchema,
  walletParamsSchema,
} from './wallet.validators.js';

export const walletRoutes = Router();

walletRoutes.use(requireAuth);
walletRoutes.get('/:userId', requirePerm('wallet.read'), validate(walletParamsSchema), walletController.get);
walletRoutes.post('/:userId/credit', requirePerm('wallet.manage'), validate(creditSchema), walletController.credit);
walletRoutes.post('/:userId/debit', requirePerm('wallet.manage'), validate(debitSchema), walletController.debit);
walletRoutes.post('/:userId/adjust', requirePerm('wallet.manage'), validate(adjustSchema), walletController.adjust);
walletRoutes.post('/:userId/freeze', requirePerm('wallet.manage'), validate(walletParamsSchema), walletController.freeze);
walletRoutes.post('/:userId/unfreeze', requirePerm('wallet.manage'), validate(walletParamsSchema), walletController.unfreeze);
walletRoutes.post('/refund', requirePerm('transactions.manage'), validate(refundSchema), walletController.refund);

export const transactionRoutes = Router();

transactionRoutes.use(requireAuth);
transactionRoutes.get('/', requirePerm('transactions.read'), validate(listTransactionsSchema), walletController.transactions);
