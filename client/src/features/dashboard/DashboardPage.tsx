import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useSocketEvent } from '../../lib/socket';
import { useNow } from '../../hooks/hooks';
import { Badge, Card, Skeleton } from '../../components/ui';
import { bucketByHour, useKpiCounts, useTodayScans, type LiveScanEvent, type ScanItem } from './dashboardApi';

function Kpi({ label, value, sub, loading }: { label: string; value: string; sub: string; loading: boolean }): JSX.Element {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      {loading ? <Skeleton className="mt-2 h-8 w-20" /> : <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>}
      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden /> {sub}
      </p>
    </Card>
  );
}

function LiveFeed({ seed }: { seed: ScanItem[] }): JSX.Element {
  const [live, setLive] = useState<LiveScanEvent[]>([]);
  useSocketEvent<LiveScanEvent>('nfc.scan', (ev) => setLive((prev) => [ev, ...prev].slice(0, 20)));
  const now = useNow(5000);
  void now; // re-renders the feed so relative times stay fresh

  const seeded: LiveScanEvent[] = seed.slice(0, 10).map((s) => ({
    scanId: s._id, nfcUid: s.nfcUid, bandId: null, user: null, action: s.action, result: s.result, timestamp: s.timestamp,
  }));
  const items = [...live, ...seeded].slice(0, 12);

  return (
    <Card className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Live Activity</h2>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" aria-hidden /> Live
        </span>
      </div>
      {items.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No scans yet today. Activity appears here in real time.</p>}
      <ul className="space-y-2 overflow-y-auto">
        {items.map((s) => (
          <li key={s.scanId + s.timestamp} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
            <span className={s.result === 'SUCCESS' ? 'text-green-600' : 'text-red-600'} aria-hidden>●</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{s.user ?? s.bandId ?? s.nfcUid}</p>
              <p className="truncate text-xs text-muted-foreground">{s.nfcUid} · {s.action}</p>
            </div>
            <div className="text-right">
              <Badge value={s.result} />
              <p className="mt-0.5 text-[11px] text-muted-foreground" title={new Date(s.timestamp).toLocaleString()}>
                {formatDistanceToNow(new Date(s.timestamp), { addSuffix: true })}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const PIE_COLORS = ['#16a34a', '#dc2626', '#d97706', '#6b7280'];

export function DashboardPage(): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const { bands, activeBands, users, scansToday } = useKpiCounts();
  const todayScans = useTodayScans(200);
  const scans = todayScans.data ?? [];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.firstName ?? 'Admin';

  const hourly = bucketByHour(scans);
  const entry = scans.filter((s) => s.action === 'ENTRY').length;
  const exit = scans.filter((s) => s.action === 'EXIT').length;
  const denied = scans.filter((s) => s.result !== 'SUCCESS').length;
  const resultSplit = [
    { name: 'Success', value: scans.length - denied },
    { name: 'Denied', value: scans.filter((s) => s.result === 'DENIED' || s.result === 'BLOCKED').length },
    { name: 'Unknown/Invalid', value: scans.filter((s) => ['UNKNOWN', 'INVALID', 'ERROR', 'LOST', 'EXPIRED'].includes(s.result)).length },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{greeting}, {firstName}</h1>
          <p className="text-sm text-muted-foreground">Here&apos;s what&apos;s happening across your NFC ecosystem.</p>
        </div>
        <button
          onClick={() => { bands.refetch(); activeBands.refetch(); users.refetch(); scansToday.refetch(); todayScans.refetch(); }}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total Bands" value={String(bands.data ?? '—')} sub="Registered in your organization" loading={bands.isPending} />
        <Kpi label="Active Bands" value={String(activeBands.data ?? '—')} sub="Ready to scan" loading={activeBands.isPending} />
        <Kpi label="Today's Scans" value={String(scansToday.data ?? '—')} sub={`${denied} denied`} loading={scansToday.isPending} />
        <Kpi label="Active Users" value={String(users.data ?? '—')} sub="Across all roles" loading={users.isPending} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <h2 className="mb-1 font-semibold">NFC Activity</h2>
          <p className="mb-3 text-xs text-muted-foreground">Successful vs failed scans by hour (today).</p>
          {todayScans.isPending ? <Skeleton className="h-56 w-full" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={hourly}>
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={3} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="success" name="Successful" stroke="#16a34a" fill="#16a34a" fillOpacity={0.15} />
                <Area type="monotone" dataKey="denied" name="Failed" stroke="#dc2626" fill="#dc2626" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>
        <LiveFeed seed={scans} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-1 font-semibold">Access</h2>
          <p className="mb-3 text-xs text-muted-foreground">Entry vs exit scans today.</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={[{ name: 'Entry', value: entry }, { name: 'Exit', value: exit }]}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h2 className="mb-1 font-semibold">Scan Results</h2>
          <p className="mb-3 text-xs text-muted-foreground">Outcome split for today&apos;s scans.</p>
          {resultSplit.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No scans yet today.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={resultSplit} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                  {resultSplit.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}
