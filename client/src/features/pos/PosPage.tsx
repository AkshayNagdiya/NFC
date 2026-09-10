import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import { inr } from '../../lib/format';
import { newId } from '../../lib/utils';
import { Badge, Button, Card, Field, Input, PageHeader, useConfirm } from '../../components/ui';
import { useReader } from '../nfc/useReader';
import type { NfcTag } from '../nfc/nfcReader';

interface ChargeResult {
  result: string;
  message?: string;
  walletTransaction?: { _id: string; balanceAfterMinor: number };
}

interface RecentSale {
  _id: string;
  amountMinor: number;
  reason?: string;
  createdAt: string;
  holder: string;
}

interface Settlement {
  date: string;
  timezone: string;
  bounds: { from: string; to: string };
  salesCount: number;
  salesVolumeMinor: number;
  refundCount: number;
  refundVolumeMinor: number;
  netVolumeMinor: number;
  avgTicketMinor: number;
  topupCount: number;
  topupVolumeMinor: number;
  deniedPayments: number;
  hourly: { hour: number; count: number; volumeMinor: number }[];
  recent: RecentSale[];
}

interface MenuItem {
  name: string;
  priceMinor: number;
}

interface CartLine extends MenuItem {
  qty: number;
}

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function PosPage(): JSX.Element {
  const qc = useQueryClient();
  const { ask, dialog } = useConfirm();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [custom, setCustom] = useState('');
  const [receipt, setReceipt] = useState<{ uid: string; at: Date; totalMinor: number; res: ChargeResult } | null>(null);
  const [date, setDate] = useState<string>(() => todayLocal());
  const [downloading, setDownloading] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const on = (): void => setIsOnline(true);
    const off = (): void => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const menuQuery = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get('/settings')).data.data as { settings: { posMenu?: MenuItem[] } },
  });
  const menu = menuQuery.data?.settings.posMenu ?? [];

  const totalMinor = useMemo(() => cart.reduce((s, l) => s + l.priceMinor * l.qty, 0), [cart]);

  const charge = useMutation({
    mutationFn: async ({ tag, mode, amountMinor }: { tag: NfcTag; mode: string; amountMinor: number }) =>
      (await api.post('/nfc/scan', { nfcUid: tag.uid, action: 'PAYMENT', amountMinor, requestId: `pos_${newId()}` }, { headers: { 'X-NFC-Adapter': mode } }))
        .data.data as ChargeResult,
    onSuccess: (res, { tag, amountMinor }) => {
      setReceipt({ uid: tag.uid, at: new Date(), totalMinor: amountMinor, res });
      if (res.result === 'SUCCESS') setCart([]);
    },
    onError: (e: unknown, vars) => {
      setReceipt({ uid: vars.tag.uid, at: new Date(), totalMinor: vars.amountMinor, res: { result: 'ERROR', message: (e as Error).message } });
    },
  });

  const { mode, setMode, status, beginPhoneScan, phoneActive, phoneError } = useReader({
    paused: charge.isPending || !isOnline || totalMinor <= 0,
    onTag: (tag) => {
      if (totalMinor <= 0 || !isOnline) return;
      charge.mutate({ tag, mode, amountMinor: totalMinor });
    },
  });

  const settlement = useQuery({
    queryKey: ['settlement', date],
    queryFn: async () => (await api.get('/reports/settlement', { params: date ? { date } : {} })).data.data as Settlement,
    refetchInterval: 30000,
  });

  const voidTxn = useMutation({
    mutationFn: async (transactionId: string) => (await api.post('/pos/void', { transactionId })).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settlement'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
    },
  });

  async function downloadCsv(): Promise<void> {
    const b = settlement.data?.bounds;
    if (!b || downloading) return;
    setDownloading(true);
    try {
      const res = await api.get('/reports/export', { params: { domain: 'transactions', from: b.from, to: b.to }, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `pos-${settlement.data?.date ?? 'today'}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  async function askVoid(sale: RecentSale): Promise<void> {
    if (!(await ask({ title: `Void ${inr(sale.amountMinor)}?`, body: `${sale.holder} · ${format(new Date(sale.createdAt), 'HH:mm:ss')} — balance is restored immediately.`, danger: true, confirmLabel: 'Void charge' }))) return;
    voidTxn.mutate(sale._id);
  }

  function addItem(item: MenuItem): void {
    setReceipt(null);
    setCart((c) => {
      const found = c.find((l) => l.name === item.name && l.priceMinor === item.priceMinor);
      if (found) return c.map((l) => (l === found ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { ...item, qty: 1 }];
    });
  }

  function addCustom(): void {
    const paise = Math.round(Number(custom) * 100);
    if (!Number.isFinite(paise) || paise <= 0) return;
    addItem({ name: 'Custom', priceMinor: paise });
    setCustom('');
  }

  const ok = receipt?.res.result === 'SUCCESS';

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Canteen POS" subtitle={`Tap band to charge ${totalMinor > 0 ? inr(totalMinor) : ''} · reader ${status} (${mode})`} />
      {!isOnline && <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200" role="alert">Offline — payments are disabled until reconnect. Balances cannot be verified offline.</p>}

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            Reader
            <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="h-9 rounded-md border border-border bg-background px-2" aria-label="Reader adapter">
              <option value="keyboard">Keyboard / USB reader</option>
              <option value="phone">Phone NFC (tap to this phone)</option>
              <option value="bridge">Local bridge (PC/SC · serial)</option>
            </select>
          </label>
          {mode === 'phone' && !phoneActive && (
            <Button onClick={beginPhoneScan}>Enable phone NFC</Button>
          )}
          {mode === 'phone' && phoneActive && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-300" role="status">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden /> Phone tap ready — hold band to this phone
            </span>
          )}
        </div>
        {mode === 'phone' && !phoneActive && (
          <p className="text-xs text-muted-foreground">Phone-as-reader uses Web NFC (Android Chrome/Edge + HTTPS only — iPhone Safari cannot tap-scan). Tap the button, then hold the band to this phone.</p>
        )}
        {phoneError && <p className="text-sm text-red-600" role="alert">{phoneError}</p>}
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Menu {menu.length === 0 && <span className="font-normal text-muted-foreground">(empty — add items in Settings)</span>}</h2>
        <div className="flex flex-wrap gap-2">
          {menu.map((m) => (
            <button
              key={`${m.name}-${m.priceMinor}`}
              onClick={() => addItem(m)}
              className="rounded-xl border border-border px-4 py-2.5 text-left hover:bg-muted"
            >
              <span className="block text-sm font-semibold">{m.name}</span>
              <span className="font-mono text-sm text-muted-foreground">{inr(m.priceMinor)}</span>
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <div className="w-40">
            <Field label="Custom ₹" htmlFor="pos-custom">
              <Input id="pos-custom" inputMode="decimal" placeholder="0.00" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, ''))} />
            </Field>
          </div>
          <Button variant="secondary" onClick={addCustom}>Add</Button>
        </div>

        <div className="rounded-lg border border-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold">Bill {cart.length > 0 && `(${cart.reduce((s, l) => s + l.qty, 0)} items)`}</p>
            {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs text-muted-foreground hover:underline">Clear</button>}
          </div>
          {cart.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tap menu items, then tap the band to charge.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {cart.map((l) => (
                <li key={`${l.name}-${l.priceMinor}`} className="flex items-center justify-between py-1.5">
                  <span>{l.name} × {l.qty}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono">{inr(l.priceMinor * l.qty)}</span>
                    <button onClick={() => setCart((c) => c.map((x) => (x === l ? { ...x, qty: x.qty - 1 } : x)).filter((x) => x.qty > 0))} className="rounded px-1.5 hover:bg-muted" aria-label={`Remove one ${l.name}`}>−</button>
                    <button onClick={() => setCart((c) => c.map((x) => (x === l ? { ...x, qty: x.qty + 1 } : x)))} className="rounded px-1.5 hover:bg-muted" aria-label={`Add one ${l.name}`}>+</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-right text-xl font-bold">Total {inr(totalMinor)}</p>
        </div>

        {charge.isPending && <p role="status">Charging {inr(totalMinor)}… tap the band now.</p>}
        {receipt && (
          <div role={ok ? 'status' : 'alert'} className={`rounded-xl border p-4 ${ok ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-red-500 bg-red-50 dark:bg-red-950'}`}>
            <p className={`text-xl font-bold ${ok ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
              {ok ? `Charged ${inr(receipt.totalMinor)}` : 'Payment declined'}
            </p>
            <p className="mt-1 font-mono text-sm">{receipt.uid} · {format(receipt.at, 'HH:mm:ss')}</p>
            <p className="text-sm text-muted-foreground">{receipt.res.message ?? receipt.res.result}</p>
            {ok && receipt.res.walletTransaction && (
              <p className="text-xs text-muted-foreground">Txn {receipt.res.walletTransaction._id.slice(-8)} · Balance after: {inr(receipt.res.walletTransaction.balanceAfterMinor)}</p>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Each tap uses a unique idempotency key — double-taps inside the scan window dedupe server-side.</p>
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Settlement {settlement.data && <span className="font-normal text-muted-foreground">· {settlement.data.date} ({settlement.data.timezone})</span>}</h2>
          <div className="flex items-center gap-2">
            <Input aria-label="Settlement date" type="date" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} className="h-9 w-40" />
            <Button variant="secondary" onClick={() => settlement.refetch()}>Refresh</Button>
          </div>
        </div>
        {settlement.data ? (
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><p className="text-muted-foreground">Sales</p><p className="text-xl font-semibold">{inr(settlement.data.salesVolumeMinor)}</p><p className="text-xs">{settlement.data.salesCount} txns</p></div>
            <div><p className="text-muted-foreground">Net</p><p className="text-xl font-semibold">{inr(settlement.data.netVolumeMinor)}</p><p className="text-xs">avg {inr(settlement.data.avgTicketMinor)}</p></div>
            <div><p className="text-muted-foreground">Refunds</p><p className="text-xl font-semibold">{inr(settlement.data.refundVolumeMinor)}</p><p className="text-xs">{settlement.data.refundCount} txns</p></div>
            <div><p className="text-muted-foreground">Denied</p><p className="text-xl font-semibold">{settlement.data.deniedPayments}</p><p className="text-xs">insufficient/frozen</p></div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}

        {settlement.data && settlement.data.recent.length > 0 && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Recent sales</h3>
              <button
                onClick={() => settlement.refetch()}
                disabled={settlement.isFetching}
                className="rounded border border-border p-1.5 hover:bg-muted disabled:opacity-50"
                aria-label="Refresh recent sales"
                title="Refresh recent sales"
              >
                <RefreshCw size={14} className={settlement.isFetching ? 'animate-spin' : ''} aria-hidden />
              </button>
            </div>
            <ul className="divide-y divide-border text-sm">
              {settlement.data.recent.map((s) => (
                <li key={s._id} className="flex items-center justify-between gap-2 py-1.5">
                  <span>{s.holder} <span className="text-muted-foreground">· {format(new Date(s.createdAt), 'HH:mm:ss')}</span></span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono">{inr(s.amountMinor)}</span>
                    <button onClick={() => askVoid(s)} disabled={voidTxn.isPending} className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted disabled:opacity-50">Void</button>
                  </span>
                </li>
              ))}
            </ul>
            {voidTxn.isError && <p className="mt-1 text-sm text-red-600" role="alert">{(voidTxn.error as Error).message}</p>}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" disabled={!settlement.data || downloading} onClick={downloadCsv}>{downloading ? 'Preparing…' : 'Download day CSV'}</Button>
          <span className="flex items-center gap-2 text-xs text-muted-foreground"><Badge value={settlement.isFetching ? 'SYNCING' : 'LIVE'} /> auto-refreshes every 30s</span>
        </div>
      </Card>
      {dialog}
    </div>
  );
}
