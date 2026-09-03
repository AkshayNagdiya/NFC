import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useDebounced } from '../../hooks/hooks';
import { Badge, Button, EmptyState, ErrorState, Field, Input, PageHeader, Pagination, Select, TableSkeleton } from '../../components/ui';
import { useCreateUser, useUpdateUser, useUsers } from './usersApi';

const ROLES = ['ADMIN', 'MANAGER', 'OPERATOR', 'SECURITY', 'FINANCE', 'VIEWER'];

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Minimum 8 characters'),
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  role: z.string().min(1, 'Required'),
});

type CreateForm = z.infer<typeof createSchema>;

function CreateUserDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const create = useCreateUser();
  const { register, handleSubmit, formState } = useForm<CreateForm>({ resolver: zodResolver(createSchema) });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Add user">
      <form
        onSubmit={handleSubmit((v) => create.mutate(v, { onSuccess: onClose }))}
        className="w-full max-w-md space-y-4 rounded-xl border border-border bg-background p-6"
      >
        <h2 className="font-semibold">Add User</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" error={formState.errors.firstName?.message} htmlFor="fu-fn">
            <Input id="fu-fn" {...register('firstName')} />
          </Field>
          <Field label="Last name" error={formState.errors.lastName?.message} htmlFor="fu-ln">
            <Input id="fu-ln" {...register('lastName')} />
          </Field>
        </div>
        <Field label="Email" error={formState.errors.email?.message} htmlFor="fu-email">
          <Input id="fu-email" type="email" {...register('email')} />
        </Field>
        <Field label="Password" error={formState.errors.password?.message} htmlFor="fu-pw">
          <Input id="fu-pw" type="password" {...register('password')} />
        </Field>
        <Field label="Role" error={formState.errors.role?.message} htmlFor="fu-role">
          <Select id="fu-role" {...register('role')} defaultValue="">
            <option value="" disabled>Select role</option>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
        </Field>
        {create.isError && <p className="text-sm text-red-600" role="alert">{(create.error as Error).message}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create user'}</Button>
        </div>
      </form>
    </div>
  );
}

export function UsersPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [creating, setCreating] = useState(false);
  const debounced = useDebounced(search);
  const hasPerm = useAuthStore((s) => s.hasPerm);
  const canCreate = hasPerm('users.create');

  const query = useUsers({ page, search: debounced, role: role || undefined });
  const update = useUpdateUser();

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Users"
        subtitle="People across your organization."
        actions={canCreate ? <Button onClick={() => setCreating(true)}><Plus size={15} /> Add user</Button> : undefined}
      />
      <div className="flex flex-wrap gap-2">
        <div className="min-w-52 flex-1"><Input placeholder="Search name or email…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search users" /></div>
        <Select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label="Filter by role">
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
      </div>

      {query.isPending && <TableSkeleton />}
      {query.isError && <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />}
      {query.data && query.data.items.length === 0 && (
        <EmptyState
          title="No users found"
          body="Try a different search, or invite your first team member."
          action={canCreate ? <Button onClick={() => setCreating(true)}><Plus size={15} /> Add user</Button> : undefined}
        />
      )}
      {query.data && query.data.items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-4 py-2.5">Name</th><th className="px-4 py-2.5">Email</th><th className="px-4 py-2.5">Role</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Last login</th><th className="px-4 py-2.5">Actions</th></tr>
            </thead>
            <tbody>
              {query.data.items.map((u) => (
                <tr key={u._id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-2.5 font-medium">{u.firstName} {u.lastName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-2.5"><Badge value={u.role} /></td>
                  <td className="px-4 py-2.5"><Badge value={u.status} /></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{u.lastLoginAt ? format(new Date(u.lastLoginAt), 'PP p') : '—'}</td>
                  <td className="px-4 py-2.5">
                    {hasPerm('users.update') && (
                      <Button
                        variant="secondary"
                        disabled={update.isPending}
                        onClick={() => update.mutate({ id: u._id, body: { status: u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' } })}
                      >
                        {u.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {query.data && <Pagination page={query.data.page} totalPages={query.data.totalPages} onPage={setPage} />}
      {creating && <CreateUserDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
