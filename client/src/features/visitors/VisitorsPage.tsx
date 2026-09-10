import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Badge, Button, Card, Field, Input, PageHeader } from '../../components/ui';

interface PassRow {
  _id: string;
  kind: string;
  name: string;
  purpose?: string;
  maxUses: number;
  usedCount: number;
  status: string;
  createdAt: string;
}

interface PassDetail extends PassRow {
  token: string;
  checkinUrl: string;
}

export function VisitorsPage(): JSX.Element {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [kind, setKind] = useState('VISITOR');
  const [token, setToken] = useState('');
  const [issued, setIssued] = useState<PassDetail | null>(null);

  const list = useQuery({
    queryKey: ['visitors'],
    queryFn: async () => (await api.get('/visitors', { params: { pageSize: 20 } })).data.data as { items: PassRow[] },
  });

  const create = useMutation({
    mutationFn: async () => (await api.post('/visitors', { kind, name: name.trim(), purpose: purpose.trim() || undefined })).data.data as PassDetail,
    onSuccess: (d) => {
      setIssued(d);
      setName('');
      setPurpose('');
      qc.invalidateQueries({ queryKey: ['visitors'] });
    },
  });

  const checkin = useMutation({
    mutationFn: async () => (await api.post('/visitors/check-in', { token: token.trim() })).data.data,
    onSuccess: () => {
      setToken('');
      qc.invalidateQueries({ queryKey: ['visitors'] });
    },
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => (await api.post(`/visitors/${id}/revoke`)).data.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['visitors'] }),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Visitors & Day QR" subtitle="Gate passes for visitors — and day QR codes for holders who forgot their band." />
      <Card className="space-y-3">
        <h2 className="font-semibold">Issue pass (valid today)</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name" htmlFor="v-name"><Input id="v-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest name" /></Field>
          <Field label="Kind" htmlFor="v-kind">
            <select id="v-kind" value={kind} onChange={(e) => setKind(e.target.value)} className="h-10 rounded-md border border-border bg-background px-3 text-sm">
              <option value="VISITOR">Visitor</option>
              <option value="DAY_QR">Day QR (forgot band)</option>
            </select>
          </Field>
        </div>
        <Field label="Purpose (optional)" htmlFor="v-purpose"><Input id="v-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Parent meeting, delivery…" /></Field>
        {create.isError && <p className="text-sm text-red-600" role="alert">{(create.error as Error).message}</p>}
        <Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>{create.isPending ? 'Issuing…' : 'Issue pass'}</Button>
        {issued && (
          <div className="rounded-lg border border-border p-3 text-sm" role="status">
            <p className="font-semibold">{issued.name} · {issued.kind}</p>
            <p className="mt-1 break-all font-mono text-xs">{issued.token}</p>
            <p className="mt-1 text-muted-foreground">Gate link: <span className="font-mono">{issued.checkinUrl}</span> — share or scan at entry.</p>
            <div className="mt-2 flex gap-2">
              <Button variant="secondary" onClick={() => navigator.clipboard?.writeText(issued.token)}>Copy code</Button>
              <Button variant="secondary" onClick={() => navigator.clipboard?.writeText(`${window.location.origin}${issued.checkinUrl}`)}>Copy link</Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Gate check-in (QR / code)</h2>
        <Field label="Pass code" htmlFor="v-token"><Input id="v-token" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste 64-char code" className="font-mono" /></Field>
        {checkin.isError && <p className="text-sm text-red-600" role="alert">{(checkin.error as Error).message}</p>}
        {checkin.isSuccess && <p className="text-sm text-green-700" role="status">Checked in.</p>}
        <Button disabled={token.trim().length < 64 || checkin.isPending} onClick={() => checkin.mutate()}>{checkin.isPending ? 'Checking…' : 'Check in'}</Button>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-semibold">Recent passes</h2>
        <ul className="divide-y divide-border text-sm">
          {(list.data?.items ?? []).map((p) => (
            <li key={p._id} className="flex items-center justify-between gap-2 py-2">
              <span>{p.name} <span className="text-muted-foreground">· {p.kind} · used {p.usedCount}/{p.maxUses}</span></span>
              <span className="flex items-center gap-2"><Badge value={p.status} />
                {p.status === 'ACTIVE' && <button onClick={() => revoke.mutate(p._id)} className="text-xs text-red-600 hover:underline">Revoke</button>}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
