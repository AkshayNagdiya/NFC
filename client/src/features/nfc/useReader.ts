import { useCallback, useEffect, useRef, useState } from 'react';
import { BridgeNfcAdapter, KeyboardNfcAdapter, type NfcTag } from './nfcReader';

export type ReaderMode = 'keyboard' | 'bridge';
export type ReaderStatus = 'connected' | 'disconnected' | 'error';

export interface BridgeHealth {
  ok: boolean;
  mode?: string;
  clients?: number;
  mock?: boolean;
  error?: string;
}

const MODE_KEY = 'nfc-reader-mode';
const BRIDGE_URL = import.meta.env.VITE_BRIDGE_URL ?? 'http://localhost:8787';
const BRIDGE_WS = BRIDGE_URL.replace(/^http/, 'ws');

export function getStoredMode(): ReaderMode {
  return (localStorage.getItem(MODE_KEY) as ReaderMode) === 'bridge' ? 'bridge' : 'keyboard';
}

/**
 * Owns the reader adapter lifecycle for the operator UI.
 * - keyboard: global keystroke capture, no hardware dependency.
 * - bridge: localhost nfc-bridge WebSocket + /status health polling.
 */
export function useReader(opts: { onTag: (tag: NfcTag) => void; paused: boolean }) {
  const [mode, setModeState] = useState<ReaderMode>(getStoredMode);
  const [status, setStatus] = useState<ReaderStatus>('disconnected');
  const [bridge, setBridge] = useState<BridgeHealth>({ ok: false });
  const onTagRef = useRef(opts.onTag);
  onTagRef.current = opts.onTag;
  const pausedRef = useRef(opts.paused);
  pausedRef.current = opts.paused;

  const setMode = useCallback((m: ReaderMode) => {
    localStorage.setItem(MODE_KEY, m);
    setModeState(m);
  }, []);

  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  useEffect(() => {
    const adapter = mode === 'bridge' ? new BridgeNfcAdapter(BRIDGE_WS) : new KeyboardNfcAdapter();
    let off: (() => void) | undefined;
    let cancelled = false;
    setStatus('disconnected');

    adapter.connect()
      .then(() => {
        if (cancelled) return;
        setStatus(adapter.getStatus());
        off = adapter.onTag((tag) => {
          if (!pausedRef.current) onTagRef.current(tag);
        });
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
      off?.();
      adapter.disconnect();
    };
  }, [mode, attempt]);

  // Bridge health polling (bridge mode only).
  useEffect(() => {
    if (mode !== 'bridge') {
      setBridge({ ok: false });
      return;
    }
    let cancelled = false;
    async function poll(): Promise<void> {
      try {
        const res = await fetch(`${BRIDGE_URL}/status`);
        const data = (await res.json()) as { ok: boolean; mode: string; clients: number; mock: boolean };
        if (!cancelled) setBridge({ ok: data.ok, mode: data.mode, clients: data.clients, mock: data.mock });
      } catch {
        if (!cancelled) setBridge({ ok: false, error: 'Bridge unreachable — is nfc-bridge running on this terminal?' });
      }
    }
    poll();
    const t = window.setInterval(poll, 5000);
    return () => { cancelled = true; window.clearInterval(t); };
  }, [mode, attempt]);

  return { mode, setMode, status, bridge, retry, bridgeUrl: BRIDGE_URL };
}
