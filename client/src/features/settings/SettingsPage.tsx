import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { Button, Card, Field, Input, PageHeader, Skeleton } from '../../components/ui';

interface OrgSettings {
  name: string;
  slug: string;
  status: string;
  contactEmail?: string;
  settings: { timezone: string; attendanceLateAfter: string; attendanceDayEnd: string; dupScanWindowMs: number };
}

export function SettingsPage(): JSX.Element {
  const hasPerm = useAuthStore((s) => s.hasPerm);
  const canManage = hasPerm('settings.manage');
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);

  const query = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get('/settings')).data.data as OrgSettings,
  });
  const save = useMutation({
    mutationFn: async (body: Record<string, unknown>) => (await api.put('/settings', body)).data.data as OrgSettings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    },
  });

  const [form, setForm] = useState<Record<string, string> | null>(null);
  const s = form ?? (query.data ? {
    timezone: query.data.settings.timezone,
    attendanceLateAfter: query.data.settings.attendanceLateAfter,
    attendanceDayEnd: query.data.settings.attendanceDayEnd,
    dupScanWindowMs: String(query.data.settings.dupScanWindowMs),
  } : null);

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-6">
      <PageHeader title="Settings" subtitle={query.data ? `${query.data.name} · ${query.data.slug}` : 'Organization settings.'} />
      {query.isPending && <Skeleton className="h-64 w-full" />}
      {query.data && s && (
        <Card className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Timezone" htmlFor="s-tz">
              <Input id="s-tz" value={s.timezone} disabled={!canManage} onChange={(e) => setForm({ ...s, timezone: e.target.value })} placeholder="Asia/Kolkata" />
            </Field>
            <Field label="Duplicate scan window (ms)" htmlFor="s-dup">
              <Input id="s-dup" inputMode="numeric" value={s.dupScanWindowMs} disabled={!canManage} onChange={(e) => setForm({ ...s, dupScanWindowMs: e.target.value.replace(/[^0-9]/g, '') })} />
            </Field>
            <Field label="Late after (HH:mm)" htmlFor="s-late">
              <Input id="s-late" value={s.attendanceLateAfter} disabled={!canManage} onChange={(e) => setForm({ ...s, attendanceLateAfter: e.target.value })} />
            </Field>
            <Field label="School day ends (HH:mm)" htmlFor="s-end">
              <Input id="s-end" value={s.attendanceDayEnd} disabled={!canManage} onChange={(e) => setForm({ ...s, attendanceDayEnd: e.target.value })} />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">Late detection, early-exit, scan dedupe, and access windows all derive from these values. Changes are audited.</p>
          {save.isError && <p className="text-sm text-red-600" role="alert">{(save.error as Error).message}</p>}
          {saved && <p className="text-sm text-green-700" role="status">Settings saved.</p>}
          {canManage && (
            <div className="flex justify-end">
              <Button
                disabled={save.isPending}
                onClick={() => save.mutate({
                  timezone: s.timezone,
                  attendanceLateAfter: s.attendanceLateAfter,
                  attendanceDayEnd: s.attendanceDayEnd,
                  dupScanWindowMs: Number(s.dupScanWindowMs),
                })}
              >
                {save.isPending ? 'Saving…' : 'Save settings'}
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
