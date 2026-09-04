import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Maximize, Minimize, RotateCcw, Settings2 } from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import type { NfcTag } from './nfcReader';
import { useReader, type ReaderMode } from './useReader';

type ScanState =
  | { kind: 'idle' }
  | { kind: 'reading'; uid: string }
  | { kind: 'success'; uid: string; message: string; user?: string; at: Date }
  | { kind: 'denied'; uid: string; message: string; result: string; at: Date }
  | { kind: 'error'; message: string };

const ACTIONS = ['ENTRY', 'EXIT', 'CHECK_IN', 'CHECK_OUT', 'IDENTIFY', 'PAYMENT'];
const RESET_OPTIONS = [2000, 4000, 8000];

export function ScannerPage(): JSX.Element {
  const [action, setAction] = useState('ENTRY');
  const [state, setState] = useState<ScanState>({ kind: 'idle' });
  const [kiosk, setKiosk] = useState(false);
  const [resetMs, setResetMs] = useState(4000);
  const [amount, setAmount] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const timer = useRef<number | null>(null);
  const countdown = useRef<number | null>(null);
  const [countdownPct, setCountdownPct] = useState(100);

  const scan = useMutation({
    mutationFn: async ({ tag, mode }: { tag: NfcTag; mode: ReaderMode }) => {
      const body: Record<string, unknown> = { nfcUid: tag.uid, action };
      if (action === 'PAYMENT') {
        const paise = Math.round(Number(amount) * 100);
        if (!Number.isFinite(paise) || paise <= 0) throw new Error('Enter a valid amount for payment.');
        body.amountMinor = paise;
      }
      return (await api.post('/nfc/scan', body, { headers: { 'X-NFC-Adapter': mode } })).data.data as {
        result: string; message?: string; scan?: { nfcUid?: string };
      };
    },
    onSuccess: (res, { tag }) => {
      const at = new Date();
      if (res.result === 'SUCCESS') {
        setState({ kind: 'success', uid: tag.uid, message: res.message ?? 'Access granted', at });
      } else {
        setState({ kind: 'denied', uid: tag.uid, message: res.message ?? `Result: ${res.result}`, result: res.result, at });
      }
      scheduleReset();
    },
    onError: (e: unknown) => {
      const status = (e as { response?: { status?: number; data?: { message?: string } } }).response;
      const message =
        status?.data?.message ??
        (status?.status === 0 || !status ? 'Backend unavailable. Check network connection.' : 'Scan failed.');
      setState({ kind: 'error', message });
      scheduleReset();
    },
  });

  function scheduleReset(): void {
    if (timer.current) window.clearTimeout(timer.current);
    if (countdown.current) window.clearInterval(countdown.current);
    const started = Date.now();
    setCountdownPct(100);
    countdown.current = window.setInterval(() => {
      const left = Math.max(0, 1 - (Date.now() - started) / resetMs);
      setCountdownPct(left * 100);
      if (left <= 0 && countdown.current) window.clearInterval(countdown.current);
    }, 100);
    timer.current = window.setTimeout(() => setState({ kind: 'idle' }), resetMs);
  }

  function resetNow(): void {
    if (timer.current) window.clearTimeout(timer.current);
    if (countdown.current) window.clearInterval(countdown.current);
    setState({ kind: 'idle' });
  }

  const busy = state.kind === 'reading';
  const { mode, setMode, status, bridge, retry } = useReader({
    paused: busy || scan.isPending,
    onTag: (tag) => {
      setState({ kind: 'reading', uid: tag.uid });
      scan.mutate({ tag, mode: getMode() });
    },
  });
  const modeRef = useRef(mode);
  modeRef.current = mode;
  function getMode(): ReaderMode {
    return modeRef.current;
  }

  // Kiosk fullscreen handling.
  useEffect(() => {
    if (!kiosk) {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
      return;
    }
    document.documentElement.requestFullscreen().catch(() => undefined);
  }, [kiosk]);

  // Cleanup timers on unmount.
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
    if (countdown.current) window.clearInterval(countdown.current);
  }, []);

  const readerOk = status === 'connected' && (mode === 'keyboard' || bridge.ok);

  return (
    <div className={cn('mx-auto max-w-3xl space-y-6', kiosk && 'max-w-5xl bg-black text-white min-h-screen')}>
      {/* Status strip */}
      <div className={cn('flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5 text-xs', kiosk ? 'text-gray-300' : 'text-white/50')}>
        <span className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-medium" role="status" aria-label={`Reader ${status}`}>
          <span className={cn('h-1.5 w-1.5 rounded-full', status === 'connected' ? 'animate-pulse-dot bg-emerald-400' : 'bg-red-400')} aria-hidden />
          Reader: {status} · {mode}
        </span>
        {mode === 'bridge' && (
          <span title={bridge.error ?? `Bridge mode: ${bridge.mode}, ${bridge.clients ?? 0} clients`}>
            · Bridge: {bridge.ok ? `ok${bridge.mock ? ' (mock)' : ''}` : 'unreachable'}
          </span>
        )}
        <span aria-hidden>·</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" aria-hidden /> Live</span>
        <span className="ml-auto flex gap-1">
          {!kiosk && (
            <button onClick={() => setShowSettings((v) => !v)} className="rounded-md p-2 hover:bg-muted" aria-label="Scanner settings">
              <Settings2 size={16} />
            </button>
          )}
          <button
            onClick={() => setKiosk((v) => !v)}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-muted"
            aria-label={kiosk ? 'Exit kiosk mode' : 'Enter kiosk mode'}
          >
            {kiosk ? <Minimize size={14} /> : <Maximize size={14} />} {kiosk ? 'Exit kiosk' : 'Kiosk'}
          </button>
        </span>
      </div>

      {!kiosk && showSettings && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border p-4 text-sm">
          <label className="flex items-center gap-2">
            Reader
            <select value={mode} onChange={(e) => setMode(e.target.value as ReaderMode)} className="rounded-md border border-border bg-background px-2 py-1.5" aria-label="Reader adapter">
              <option value="keyboard">Keyboard (direct)</option>
              <option value="bridge">Local bridge (PC/SC · serial · vendor)</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            Auto-reset
            <select value={resetMs} onChange={(e) => setResetMs(Number(e.target.value))} className="rounded-md border border-border bg-background px-2 py-1.5" aria-label="Auto-reset timeout">
              {RESET_OPTIONS.map((ms) => <option key={ms} value={ms}>{ms / 1000}s</option>)}
            </select>
          </label>
          {mode === 'bridge' && bridge.error && <span className="text-xs text-red-600">{bridge.error}</span>}
        </div>
      )}

      <div className="text-center">
        <p className="eyebrow mb-2 justify-center text-[#D4A853]">Live terminal</p>
        <h1 className={cn('font-semibold tracking-[-0.025em] text-white', kiosk ? 'text-5xl' : 'text-[30px]')}>NFC Scanner</h1>
        <p className="mt-1.5 text-[13.5px] text-white/45">Tap a band — result in milliseconds.</p>
      </div>

      {/* Action selector (compact in kiosk) */}
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Scan action">
        {ACTIONS.map((a) => (
          <button
            key={a}
            onClick={() => setAction(a)}
            aria-pressed={action === a}
            className={cn(
              'h-9 rounded-[10px] border px-3.5 text-[13px] font-semibold transition-all',
              kiosk && 'h-auto px-6 py-4 text-xl rounded-2xl',
              action === a
                ? 'gold-button border-transparent'
                : kiosk ? 'border-gray-600 text-white hover:bg-gray-800' : 'border-white/[0.09] bg-white/[0.03] text-white/60 hover:border-white/[0.16] hover:text-white',
            )}
          >
            {a.replace('_', ' ')}
          </button>
        ))}
      </div>

      {action === 'PAYMENT' && (
        <div className="mx-auto flex max-w-xs items-center gap-2">
          <label htmlFor="scan-amount" className={cn('text-sm', kiosk ? 'text-gray-200' : 'text-muted-foreground')}>Amount ₹</label>
          <input
            id="scan-amount"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            className={cn('w-full rounded-lg border px-4 font-mono', kiosk ? 'border-gray-600 bg-gray-900 py-4 text-2xl text-white' : 'border-border bg-background py-2 text-sm')}
          />
        </div>
      )}

      {/* Main panel */}
      {state.kind === 'idle' && (
        <div className={cn('premium-card rounded-3xl p-10 text-center', kiosk && 'border-gray-700 bg-gray-900')}>
          {readerOk ? (
            <>
              <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-b from-[#F0D48A] to-[#8F6A2E] shadow-glow text-black font-mono text-xl">◉</span>
              <p className={cn('font-semibold text-white', kiosk ? 'text-3xl' : 'text-[19px]')}>Ready to scan</p>
              <p className={cn('mt-2', kiosk ? 'text-xl text-gray-300' : 'text-[13.5px] text-white/45')}>
                Place the NFC band near the reader.
              </p>
            </>
          ) : (
            <div role="alert">
              <p className={cn('font-semibold', kiosk ? 'text-3xl' : 'text-xl')}>NFC READER OFFLINE</p>
              <p className={cn('mt-2', kiosk ? 'text-lg text-gray-300' : 'text-sm text-muted-foreground')}>
                {mode === 'bridge'
                  ? (bridge.error ?? 'The bridge is not responding.')
                  : 'The NFC reader is not responding.'}
              </p>
              <div className="mt-5 flex justify-center gap-2">
                <button onClick={retry} className="rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground">Retry Connection</button>
                {mode === 'bridge' && (
                  <button onClick={() => setMode('keyboard')} className="rounded-lg border border-border px-6 py-3">Use keyboard mode</button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {state.kind === 'reading' && (
        <div className="rounded-2xl border border-border p-10 text-center" role="status" aria-label="Reading tag">
          <p className={cn(kiosk ? 'text-3xl' : 'text-xl')}>Reading <span className="font-mono">{state.uid}</span>…</p>
        </div>
      )}

      {(state.kind === 'success' || state.kind === 'denied') && (
        <div
          role={state.kind === 'success' ? 'status' : 'alert'}
          className={cn(
            'rounded-2xl border p-10 text-center',
            state.kind === 'success'
              ? 'border-green-500 bg-green-50 dark:bg-green-950'
              : 'border-red-500 bg-red-50 dark:bg-red-950',
            kiosk && state.kind === 'success' && 'bg-green-900',
            kiosk && state.kind === 'denied' && 'bg-red-900',
          )}
        >
          <p className={cn('font-bold', kiosk ? 'text-5xl' : 'text-3xl', state.kind === 'success' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300')}>
            {state.kind === 'success' ? '✓ ACCESS GRANTED' : state.result === 'UNKNOWN' ? 'UNKNOWN BAND' : 'ACCESS DENIED'}
          </p>
          <p className={cn('mt-3 font-mono', kiosk ? 'text-2xl' : 'text-lg')}>{state.uid}</p>
          <p className={cn('mt-1', kiosk ? 'text-xl' : 'text-sm', kiosk ? 'text-gray-200' : 'text-muted-foreground')}>
            {state.message} · {format(state.at, 'HH:mm:ss')}
          </p>
          {/* auto-reset progress */}
          <div className="mx-auto mt-6 h-1.5 max-w-xs overflow-hidden rounded-full bg-black/10" aria-hidden>
            <div className="h-full bg-current opacity-40" style={{ width: `${countdownPct}%` }} />
          </div>
          <button onClick={resetNow} className={cn('mt-4 rounded-lg border px-8 font-medium', kiosk ? 'border-gray-500 py-4 text-xl' : 'border-border px-6 py-2.5 text-sm')}>
            <span className="inline-flex items-center gap-2"><RotateCcw size={16} /> Scan Again</span>
          </button>
        </div>
      )}

      {state.kind === 'error' && (
        <div className="rounded-2xl border border-border p-10 text-center" role="alert">
          <p className={cn('font-semibold', kiosk ? 'text-3xl' : 'text-xl')}>BACKEND UNAVAILABLE</p>
          <p className={cn('mt-2', kiosk ? 'text-lg text-gray-300' : 'text-sm text-muted-foreground')}>{state.message}</p>
          <button onClick={resetNow} className="mt-5 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground">Scan Again</button>
        </div>
      )}
    </div>
  );
}
