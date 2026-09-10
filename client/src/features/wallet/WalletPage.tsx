import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { inr, parseRupees } from '../../lib/format';
import { Badge, Button, Card, Field, Input, PageHeader, useConfirm } from '../../components/ui';
import { useTransactions, useTopupCancel, useTopupConfirm, useTopupIntent, useTopupOrder, useWallet, useWalletOp } from './walletApi';
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

      {userId && <TopupCard userId={userId} canConfirm={canManage} />}

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

function TopupCard({ userId, canConfirm }: { userId: string; canConfirm: boolean }): JSX.Element {
  const [amount, setAmount] = useState('');
  const [orderId, setOrderId] = useState<string | null>(null);
  const intent = useTopupIntent();
  const live = useTopupOrder(orderId);
  const confirm = useTopupConfirm();
  const cancel = useTopupCancel();
  const paise = parseRupees(amount);

  const order = live.data ?? intent.data?.order;
  const upiIntent = intent.data && intent.data.order._id === order?._id ? intent.data.upiIntent : null;
  const pending = order?.status === 'PENDING';

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold">Online top-up</h2>
        <p className="text-sm text-muted-foreground">Create a UPI order, collect payment, then confirm. Status polls automatically.</p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1">
          <Field label="Amount in ₹" htmlFor="t-amt" error={amount !== '' && paise === null ? 'Enter a valid amount' : undefined}>
            <Input id="t-amt" inputMode="decimal" placeholder="e.g. 500.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} />
          </Field>
        </div>
        <Button
          disabled={paise === null || intent.isPending}
          onClick={() => {
            intent.mutate(
              { userId, body: { amountMinor: paise, provider: 'UPI', idempotencyKey: `topup_${newId()}` } },
              { onSuccess: (d) => setOrderId(d.order._id) },
            );
          }}
        >
          {intent.isPending ? 'Creating…' : 'Create UPI order'}
        </Button>
      </div>
      {intent.isError && <p className="text-sm text-red-600" role="alert">{(intent.error as Error).message}</p>}

      {order && (
        <div className="rounded-lg border border-border p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span>Order <span className="font-mono">{order.reference ?? order._id}</span></span>
            <Badge value={order.status} />
          </div>
          <p className="mt-1 text-2xl font-semibold">{inr(order.amountMinor)}</p>
          {pending && upiIntent && (
            <div className="mt-2 space-y-2">
              <p className="break-all text-xs text-muted-foreground">{upiIntent}</p>
              <div className="flex flex-wrap gap-2">
                <a href={upiIntent} className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">Open UPI app</a>
                <Button variant="secondary" onClick={() => navigator.clipboard?.writeText(upiIntent)}>Copy link</Button>
              </div>
              <p className="text-xs text-muted-foreground">Show this screen at the kiosk — payer completes UPI, staff hits Confirm below (or gateway webhook auto-confirms).</p>
            </div>
          )}
          {pending && (
            <div className="mt-3 flex flex-wrap gap-2">
              {canConfirm && (
                <Button
                  disabled={confirm.isPending}
                  onClick={() => confirm.mutate({ orderId: order._id, providerReference: `COUNTER-${new Date().getTime()}` })}
                >
                  {confirm.isPending ? 'Confirming…' : 'Confirm payment received'}
                </Button>
              )}
              <Button variant="secondary" disabled={cancel.isPending} onClick={() => cancel.mutate(order._id, { onSuccess: () => setOrderId(null) })}>Cancel</Button>
            </div>
          )}
          {(confirm.isError || live.isError) && (
            <p className="mt-2 text-sm text-red-600" role="alert">{((confirm.error ?? live.error) as Error).message}</p>
          )}
          {order.status === 'SUCCESS' && <p className="mt-2 text-sm text-green-700" role="status">Credited. Ledger updated exactly once.</p>}
        </div>
      )}
    </Card>
  );
}
