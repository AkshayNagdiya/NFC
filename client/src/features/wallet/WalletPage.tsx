import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { inr, parseRupees } from '../../lib/format';
import { Badge, Button, Card, Field, Input, PageHeader, useConfirm } from '../../components/ui';
import { useTransactions, useWallet, useWalletOp } from './walletApi';
import { newId } from '../../lib/utils';

interface UserRow { _id: string; firstName: string; lastName: string; email: string; }

export function WalletPage(): JSX.Element {
  const [q, setQ] = useState('');
  const [userId, setUserId] = useState('');
  const [userLabel, setUserLabel] = useState('');
  const [op, setOp] = useState<'credit' | 'debit' | 'adjust' | null>(null);
  const hasPerm = useAuthStore((s) => s.hasPerm);
  const canManage = hasPerm('wallet.manage');
  const { ask, dialog } = useConfirm();

  const users = useQuery({
    queryKey: ['wallet-users', q],
    queryFn: async () => (await api.get('/users', { params: { search: q, pageSize: 6 } })).data.data.items as UserRow[],
    enabled: q.length >= 1,
  });
  const wallet = useWallet(userId || undefined);
  const txns = useTransactions({ page: 1, userId: userId || undefined });
  const freeze = useWalletOp('freeze');
  const unfreeze = useWalletOp('unfreeze');

  async function toggleFreeze(): Promise<void> {
    if (!wallet.data) return;
    const freezing = wallet.data.status === 'ACTIVE';
    if (!(await ask({
      title: freezing ? 'Freeze wallet?' : 'Unfreeze wallet?',
      body: freezing ? 'Debits will be refused until unfrozen.' : 'Normal wallet operation resumes.',
      danger: freezing,
    }))) return;
    (freezing ? freeze : unfreeze).mutate({ userId });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Wallet" subtitle="Balances, top-ups, debits, and adjustments." />
      <Card className="space-y-3">
        <Field label="Find wallet holder" htmlFor="w-user">
          <Input id="w-user" placeholder="Type a name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
        </Field>
        <ul className="divide-y divide-border">
          {(users.data ?? []).map((u) => (
            <li key={u._id}>
              <button
                onClick={() => { setUserId(u._id); setUserLabel(`${u.firstName} ${u.lastName}`); }}
                className={`w-full rounded-md px-2 py-2 text-left text-sm hover:bg-muted ${userId === u._id ? 'bg-muted font-medium' : ''}`}
              >
                {u.firstName} {u.lastName} <span className="text-muted-foreground">{u.email}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {wallet.data && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{userLabel}</p>
              <p className="text-4xl font-semibold tracking-tight">{inr(wallet.data.balanceMinor)}</p>
            </div>
            <Badge value={wallet.data.status} />
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setOp('credit')}>Add money</Button>
              <Button variant="secondary" onClick={() => setOp('debit')}>Debit</Button>
              <Button variant="secondary" onClick={() => setOp('adjust')}>Adjust</Button>
              <Button variant="secondary" onClick={toggleFreeze}>
                {wallet.data.status === 'ACTIVE' ? 'Freeze' : 'Unfreeze'}
              </Button>
            </div>
          )}
        </Card>
      )}

      {txns.data && txns.data.items.length > 0 && (
        <Card>
          <h2 className="mb-2 font-semibold">Recent activity</h2>
          <ul className="divide-y divide-border text-sm">
            {txns.data.items.slice(0, 10).map((t) => (
              <li key={t._id} className="flex items-center justify-between py-2">
                <span>{t.type} · <span className="text-muted-foreground">{format(new Date(t.createdAt), 'PP p')}</span>
                  {t.reason && <span className="block text-xs text-muted-foreground">{t.reason}</span>}
                </span>
                <span className="text-right">
                  <span className={t.type === 'DEBIT' ? 'text-red-600' : 'text-green-700'}>
                    {t.type === 'DEBIT' ? '−' : '+'}{inr(t.amountMinor)}
                  </span>
                  <span className="block text-xs text-muted-foreground">bal {inr(t.balanceAfterMinor)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {op && userId && <MoneyDialog op={op} userId={userId} onClose={() => setOp(null)} />}
      {dialog}
    </div>
  );
}

function MoneyDialog({ op, userId, onClose }: { op: 'credit' | 'debit' | 'adjust'; userId: string; onClose: () => void }): JSX.Element {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const mutation = useWalletOp(op);
  const paise = parseRupees(amount);

  const valid = op === 'adjust' ? paise !== null && reason.trim().length >= 3 : paise !== null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={op}>
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-background p-6">
        <h2 className="font-semibold capitalize">{op === 'credit' ? 'Add money' : op}</h2>
        <Field label={op === 'adjust' ? 'Amount in ₹ (signed)' : 'Amount in ₹'} htmlFor="m-amt" error={amount !== '' && paise === null ? 'Enter a valid amount' : undefined}>
          <Input
            id="m-amt"
            inputMode="decimal"
            placeholder="e.g. 250.00"
            value={amount}
            onChange={(e) => setAmount(op === 'adjust' ? e.target.value.replace(/[^0-9.\-]/g, '') : e.target.value.replace(/[^0-9.]/g, ''))}
          />
        </Field>
        <Field label={op === 'adjust' ? 'Reason (required)' : 'Reason (optional)'} htmlFor="m-reason">
          <Input id="m-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {mutation.isError && <p className="text-sm text-red-600" role="alert">{(mutation.error as Error).message}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!valid || mutation.isPending}
            onClick={() => {
              const body: Record<string, unknown> = {
                idempotencyKey: `${op}_${newId()}`,
                ...(reason.trim() ? { reason: reason.trim() } : {}),
              };
              if (op === 'adjust') body.deltaMinor = Math.round(Number(amount) * 100);
              else body.amountMinor = paise;
              mutation.mutate({ userId, body }, { onSuccess: onClose });
            }}
          >
            {mutation.isPending ? 'Processing…' : 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  );
}
