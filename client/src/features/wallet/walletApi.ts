import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { newId } from '../../lib/utils';

export interface WalletInfo {
  _id: string;
  userId: string;
  balanceMinor: number;
  currency: string;
  status: string;
}

export interface TxnItem {
  _id: string;
  userId: { _id: string; firstName: string; lastName: string; email: string } | string;
  type: string;
  amountMinor: number;
  balanceAfterMinor: number;
  status: string;
  reason?: string;
  createdAt: string;
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function txnUserName(t: TxnItem): string {
  const u = t.userId;
  return u && typeof u === 'object' ? `${u.firstName} ${u.lastName}` : '—';
}

export function useWallet(userId: string | undefined) {
  return useQuery({
    queryKey: ['wallet', userId],
    queryFn: async () => (await api.get(`/wallets/${userId}`)).data.data as WalletInfo,
    enabled: !!userId,
  });
}

export function useWalletOp(op: 'credit' | 'debit' | 'adjust' | 'freeze' | 'unfreeze') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, body }: { userId: string; body?: Record<string, unknown> }) =>
      (await api.post(`/wallets/${userId}/${op}`, body ?? {})).data.data as { txn: TxnItem; replay: boolean },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useRefund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { transactionId: string; reason: string }) =>
      (await api.post('/wallets/refund', { ...body, idempotencyKey: `refund_${newId()}` })).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useTransactions(params: { page: number; userId?: string; type?: string; status?: string }) {
  return useQuery({
    queryKey: ['transactions', params],
    queryFn: async () => (await api.get('/transactions', { params: { ...params, pageSize: 12 } })).data.data as Paged<TxnItem>,
  });
}
