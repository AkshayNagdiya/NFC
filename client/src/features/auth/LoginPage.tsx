import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type Form = z.infer<typeof schema>;

export function LoginPage(): JSX.Element {
  const nav = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema) });
  const login = useMutation({
    mutationFn: async (v: Form) => (await api.post('/auth/login', v)).data.data,
    onSuccess: (data) => {
      setSession(data.accessToken, data.refreshToken, data.user);
      nav('/');
    },
  });

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <form
        onSubmit={handleSubmit((v) => login.mutate(v))}
        className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-background p-8"
        aria-label="Login"
      >
        <div>
          <h1 className="text-xl font-semibold">NFC Band Management</h1>
          <p className="text-sm text-muted-foreground">Sign in to your organization workspace.</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            {...register('email')}
          />
          {formState.errors.email && <p className="text-xs text-red-600">{formState.errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            {...register('password')}
          />
          {formState.errors.password && <p className="text-xs text-red-600">{formState.errors.password.message}</p>}
        </div>
        {login.isError && (
          <p className="text-sm text-red-600" role="alert">
            {(login.error as Error).message ?? 'Login failed'}
          </p>
        )}
        <button
          type="submit"
          disabled={login.isPending}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
