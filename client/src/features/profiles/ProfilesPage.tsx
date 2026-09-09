import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useDebounced } from '../../hooks/hooks';
import { Badge, Button, EmptyState, ErrorState, Field, Input, PageHeader, Pagination, ResponsiveTable, TableSkeleton } from '../../components/ui';
import { useProfiles, useUpdateProfile, useUpsertProfile, type ProfileForm, type ProfileItem } from './profilesApi';
import { ProfileFormFields } from './ProfileFormFields';

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
      <div className="m-auto w-full max-w-lg space-y-4 rounded-xl border border-border bg-background p-4 sm:max-w-2xl sm:p-6">
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

        <ProfileFormFields form={form} set={set} />

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
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
          <Button disabled={pending || (!initial && !form.userId) || !form.displayName.trim()} onClick={save} className="w-full sm:w-auto">
            {pending ? 'Saving…' : 'Save profile'}
          </Button>
        </div>
      </div>
    </div>
  );
}
