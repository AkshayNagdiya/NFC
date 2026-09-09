import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, EyeOff, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useDebounced } from '../../hooks/hooks';
import { Badge, Button, EmptyState, ErrorState, Field, Input, PageHeader, Pagination, ResponsiveTable, TableSkeleton } from '../../components/ui';
import { useProfiles, useUpdateProfile, useUpsertProfile, type ProfileForm, type ProfileItem } from './profilesApi';

interface UserRow { _id: string; firstName: string; lastName: string; email: string; }

const emptyForm: ProfileForm = {
  userId: '', displayName: '', title: '', phone: '', email: '',
  whatsapp: '', website: '', links: [], photoUrl: '', isPublic: true,
};

function profileUrl(slug: string): string {
  return `${window.location.origin}/p/${slug}`;
}

export function ProfilesPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ProfileItem | 'new' | null>(null);
  const debounced = useDebounced(search);
  const hasPerm = useAuthStore((s) => s.hasPerm);
  const canManage = hasPerm('users.update');

  const query = useProfiles({ page, search: debounced });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tap Profiles"
        subtitle="Digital business cards. Write a profile URL to a card — tap opens call, WhatsApp, contact save, and socials."
        actions={canManage ? <Button onClick={() => setEditing('new')}><Plus size={15} /> New profile</Button> : undefined}
      />
      <div className="flex flex-wrap gap-2">
        <div className="min-w-52 flex-1">
          <Input placeholder="Search name or slug…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search profiles" />
        </div>
      </div>

      {query.isPending && <TableSkeleton cols={4} />}
      {query.isError && <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />}
      {query.data && query.data.items.length === 0 && (
        <EmptyState
          title="No profiles yet"
          body="Publish the first tap profile, then write its URL to an NFC card."
          action={canManage ? <Button onClick={() => setEditing('new')}><Plus size={15} /> New profile</Button> : undefined}
        />
      )}
      {query.data && query.data.items.length > 0 && (
        <ResponsiveTable
          label="Tap profiles"
          rows={query.data.items}
          keyOf={(p) => p._id}
          columns={[
            { header: 'Name', render: (p) => <span className="font-medium">{p.displayName}</span> },
            { header: 'Link', render: (p) => <span className="break-all font-mono text-xs">/p/{p.slug}</span> },
            {
              header: 'Status',
              render: (p) => (
                <span className="inline-flex items-center gap-1.5">
                  <Badge value={p.isPublic ? 'ACTIVE' : 'BLOCKED'} />
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Profile views">
                    <Eye size={13} aria-hidden />{p.views}
                  </span>
                </span>
              ),
            },
            ...(canManage ? [{
              header: 'Actions',
              render: (p: ProfileItem) => (
                <span className="inline-flex gap-2">
                  <Button variant="secondary" onClick={() => setEditing(p)}>Edit</Button>
                </span>
              ),
            }] : []),
          ]}
        />
      )}
      {query.data && <Pagination page={query.data.page} totalPages={query.data.totalPages} onPage={setPage} />}
      {editing && <ProfileDialog initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ProfileDialog({ initial, onClose }: { initial: ProfileItem | null; onClose: () => void }): JSX.Element {
  const upsert = useUpsertProfile();
  const update = useUpdateProfile();
  const [form, setForm] = useState<ProfileForm>(() => initial ? {
    userId: typeof initial.userId === 'object' ? initial.userId._id : initial.userId,
    slug: initial.slug,
    displayName: initial.displayName,
    title: initial.title ?? '',
    phone: initial.phone ?? '',
    email: initial.email ?? '',
    whatsapp: initial.whatsapp ?? '',
    website: initial.website ?? '',
    links: initial.links ?? [],
    photoUrl: initial.photoUrl ?? '',
    isPublic: initial.isPublic,
  } : emptyForm);
  const [userLabel, setUserLabel] = useState(initial && typeof initial.userId === 'object'
    ? `${initial.userId.firstName} ${initial.userId.lastName} (${initial.userId.email})` : '');
  const [userSearch, setUserSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const debouncedUser = useDebounced(userSearch, 250);

  const users = useQuery({
    queryKey: ['profile-users', debouncedUser],
    queryFn: async () => (await api.get('/users', { params: { search: debouncedUser, pageSize: 6 } })).data.data.items as UserRow[],
    enabled: !initial && debouncedUser.length >= 1,
  });

  const set = (k: keyof ProfileForm, v: string | boolean | ProfileForm['links']) =>
    setForm((f) => ({ ...f, [k]: v }));
  const clean = (v: string): string | undefined => (v.trim() ? v.trim() : undefined);
  const pending = upsert.isPending || update.isPending;

  async function save(): Promise<void> {
    setError(null);
    const body: ProfileForm = {
      ...form,
      displayName: form.displayName.trim(),
      slug: form.slug?.trim() ? form.slug.trim().toLowerCase() : undefined,
      title: clean(form.title ?? ''),
      phone: clean(form.phone ?? ''),
      email: clean(form.email ?? ''),
      whatsapp: clean(form.whatsapp ?? ''),
      website: clean(form.website ?? ''),
      photoUrl: clean(form.photoUrl ?? ''),
      links: form.links.filter((l) => l.label.trim() && l.url.trim()).map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
    };
    try {
      if (initial) {
        const { userId: _omit, ...patch } = body;
        await update.mutateAsync({ id: initial._id, body: patch });
      } else {
        await upsert.mutateAsync(body);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Tap profile">
      <div className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-background p-6">
        <h2 className="font-semibold">{initial ? 'Edit profile' : 'New profile'}</h2>

        {!initial && (
          <Field label="Holder (user)" htmlFor="pf-user">
            <Input id="pf-user" placeholder="Type a name or email…" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
            <ul className="divide-y divide-border">
              {(users.data ?? []).map((u) => (
                <li key={u._id}>
                  <button
                    onClick={() => { set('userId', u._id); setUserLabel(`${u.firstName} ${u.lastName} (${u.email})`); if (!form.displayName.trim()) set('displayName', `${u.firstName} ${u.lastName}`); }}
                    className="w-full rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                  >
                    {u.firstName} {u.lastName} <span className="text-muted-foreground">{u.email}</span>
                  </button>
                </li>
              ))}
            </ul>
            {userLabel && <p className="mt-1 text-sm">Selected: <strong>{userLabel}</strong></p>}
          </Field>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Display name" htmlFor="pf-name">
            <Input id="pf-name" value={form.displayName} onChange={(e) => set('displayName', e.target.value)} placeholder="Akshay Nagdiya" />
          </Field>
          <Field label="Title / role" htmlFor="pf-title">
            <Input id="pf-title" value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="Sales Manager" />
          </Field>
          <Field label="Link slug (optional)" htmlFor="pf-slug" hint="Changing it breaks already-written cards.">
            <Input id="pf-slug" value={form.slug ?? ''} onChange={(e) => set('slug', e.target.value.toLowerCase())} placeholder="akshay-nagdiya" className="font-mono" />
          </Field>
          <Field label="Photo URL (optional)" htmlFor="pf-photo">
            <Input id="pf-photo" value={form.photoUrl ?? ''} onChange={(e) => set('photoUrl', e.target.value)} placeholder="https://…" />
          </Field>
          <Field label="Phone (tap-to-call)" htmlFor="pf-phone" hint="E.164, e.g. +919876543210">
            <Input id="pf-phone" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="+91…" inputMode="tel" />
          </Field>
          <Field label="WhatsApp (optional)" htmlFor="pf-wa">
            <Input id="pf-wa" value={form.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value)} placeholder="+91…" inputMode="tel" />
          </Field>
          <Field label="Email" htmlFor="pf-email">
            <Input id="pf-email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} placeholder="name@example.com" inputMode="email" />
          </Field>
          <Field label="Website (optional)" htmlFor="pf-web">
            <Input id="pf-web" value={form.website ?? ''} onChange={(e) => set('website', e.target.value)} placeholder="https://…" inputMode="url" />
          </Field>
        </div>

        <div className="space-y-2">
          <p className="text-[12.5px] font-semibold text-white/85">Social links (max 12)</p>
          {form.links.map((l, i) => (
            <div key={i} className="flex gap-2">
              <Input value={l.label} onChange={(e) => set('links', form.links.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Instagram" aria-label="Link label" />
              <Input value={l.url} onChange={(e) => set('links', form.links.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} placeholder="https://…" aria-label="Link URL" inputMode="url" />
              <Button variant="secondary" onClick={() => set('links', form.links.filter((_, j) => j !== i))} aria-label="Remove link">✕</Button>
            </div>
          ))}
          {form.links.length < 12 && (
            <Button variant="secondary" onClick={() => set('links', [...form.links, { label: '', url: '' }])}><Plus size={15} /> Add link</Button>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isPublic} onChange={(e) => set('isPublic', e.target.checked)} className="h-4 w-4" />
          <span className="inline-flex items-center gap-1.5">{form.isPublic ? <Eye size={14} aria-hidden /> : <EyeOff size={14} aria-hidden />} Public (uncheck to disable the link without deleting)</span>
        </label>

        {initial && (
          <div className="space-y-2 rounded-lg bg-muted p-3 text-sm">
            <p className="break-all font-mono text-xs">{profileUrl(initial.slug)}</p>
            <Button
              variant="secondary"
              onClick={() => { void navigator.clipboard?.writeText(profileUrl(initial.slug)); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }}
            >
              {copied ? 'Copied!' : 'Copy card URL — write this to the NFC card'}
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={pending || (!initial && !form.userId) || !form.displayName.trim()} onClick={save}>
            {pending ? 'Saving…' : 'Save profile'}
          </Button>
        </div>
      </div>
    </div>
  );
}
