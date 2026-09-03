import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Nfc, Plus, ScanLine, Search, UserPlus, FileBarChart } from 'lucide-react';
import { api } from '../lib/api';
import { useDebounced } from '../hooks/hooks';

interface UserHit { _id: string; firstName: string; lastName: string; email: string; }
interface BandHit { _id: string; bandId: string; nfcUid: string; status: string; }

const COMMANDS = [
  { label: 'Issue Band', hint: 'bands.create', to: '/bands/issue', icon: Plus },
  { label: 'Scan NFC', hint: 'nfc.scan', to: '/scanner', icon: ScanLine },
  { label: 'Add User', hint: 'users.create', to: '/users', icon: UserPlus },
  { label: 'Generate Report', hint: 'reports.read', to: '/reports', icon: FileBarChart },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element | null {
  const [q, setQ] = useState('');
  const debounced = useDebounced(q, 250);
  const nav = useNavigate();

  const users = useQuery({
    queryKey: ['palette-users', debounced],
    queryFn: async () => (await api.get('/users', { params: { search: debounced, pageSize: 5 } })).data.data.items as UserHit[],
    enabled: open && debounced.length >= 2,
  });
  const bands = useQuery({
    queryKey: ['palette-bands', debounced],
    queryFn: async () => (await api.get('/bands', { params: { search: debounced, pageSize: 5 } })).data.data.items as BandHit[],
    enabled: open && debounced.length >= 2,
  });

  if (!open) return null;

  function go(to: string): void {
    onClose();
    setQ('');
    nav(to);
  }

  const cmds = COMMANDS.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-4 pt-24" onClick={onClose} role="dialog" aria-modal="true" aria-label="Global search">
      <div
        className="mx-auto w-full max-w-lg overflow-hidden rounded-xl border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search size={16} className="text-muted-foreground" aria-hidden />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
            placeholder="Search users, bands, UIDs… or type a command"
            className="w-full bg-transparent py-3 text-sm outline-none"
            aria-label="Global search"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {cmds.length > 0 && (
            <div className="mb-2">
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Commands</p>
              {cmds.map((c) => (
                <button key={c.label} onClick={() => go(c.to)} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted">
                  <c.icon size={16} aria-hidden /> {c.label}
                </button>
              ))}
            </div>
          )}
          {debounced.length >= 2 && (
            <>
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Users</p>
              {(users.data ?? []).map((u) => (
                <button key={u._id} onClick={() => go('/users')} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted">
                  <UserPlus size={16} aria-hidden /> {u.firstName} {u.lastName} <span className="text-muted-foreground">{u.email}</span>
                </button>
              ))}
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Bands</p>
              {(bands.data ?? []).map((b) => (
                <button key={b._id} onClick={() => go(`/bands/${b._id}`)} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted">
                  <Nfc size={16} aria-hidden /> {b.bandId} <span className="text-muted-foreground">{b.nfcUid} · {b.status}</span>
                </button>
              ))}
              {users.isPending || bands.isPending ? <p className="px-2 py-2 text-xs text-muted-foreground">Searching…</p> : null}
            </>
          )}
          {q === '' && <p className="px-2 py-3 text-xs text-muted-foreground">Try “Issue Band”, a name, a band ID, or an NFC UID.</p>}
        </div>
      </div>
    </div>
  );
}
