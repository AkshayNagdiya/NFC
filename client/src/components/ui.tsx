import { useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/utils';

export function Button({
  children, onClick, type = 'button', variant = 'primary', disabled, className, ariaLabel,
}: {
  children: ReactNode; onClick?: () => void; type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean; className?: string; ariaLabel?: string;
}): JSX.Element {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50',
        variant === 'primary' && 'bg-primary text-primary-foreground hover:opacity-90',
        variant === 'secondary' && 'border border-border bg-background hover:bg-muted',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
        variant === 'ghost' && 'hover:bg-muted',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>): JSX.Element {
  return (
    <input
      {...props}
      className={cn(
        'w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary',
        props.className,
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>): JSX.Element {
  return (
    <select
      {...props}
      className={cn('rounded-md border border-border bg-background px-2 py-2 text-sm', props.className)}
    />
  );
}

const BADGE_TONES: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  SUCCESS: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  ALLOW: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  PRESENT: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  ASSIGNED: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  AVAILABLE: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  BLOCKED: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  DENIED: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  LOST: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  DAMAGED: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  EXPIRED: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  DECOMMISSIONED: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  DISABLED: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  UNKNOWN: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  INVALID: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  ERROR: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
};

export function Badge({ value }: { value: string }): JSX.Element {
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', BADGE_TONES[value] ?? BADGE_TONES.AVAILABLE)}>
      {value}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }): JSX.Element {
  return <div className={cn('rounded-xl border border-border bg-background p-4', className)}>{children}</div>;
}

export function Skeleton({ className }: { className?: string }): JSX.Element {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }): JSX.Element {
  return (
    <div className="space-y-2" aria-label="Loading table">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-2">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-12 text-center">
      <p className="font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-red-200 py-10 text-center" role="alert">
      <p className="font-medium">Something went wrong</p>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      {onRetry && <Button variant="secondary" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }): JSX.Element {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }): JSX.Element {
  if (totalPages <= 1) return <></>;
  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
      <span aria-live="polite" className="text-muted-foreground">Page {page} of {totalPages}</span>
      <Button variant="secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</Button>
    </div>
  );
}

export function ConfirmDialog({
  title, body, confirmLabel = 'Confirm', danger, onConfirm, onCancel, pending,
}: {
  title: string; body: string; confirmLabel?: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void; pending?: boolean;
}): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="alertdialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-background p-6">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{body}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={pending}>
            {pending ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Field({ label, error, children, htmlFor }: { label: string; error?: string; children: ReactNode; htmlFor?: string }): JSX.Element {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}

export function useConfirm(): {
  ask: (opts: { title: string; body: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
  dialog: ReactNode;
} {
  const [opts, setOpts] = useState<{ title: string; body: string; confirmLabel?: string; danger?: boolean } | null>(null);
  const [pending, setPending] = useState(false);
  const resolver = useRef<(v: boolean) => void>(() => undefined);

  function ask(o: { title: string; body: string; confirmLabel?: string; danger?: boolean }): Promise<boolean> {
    setOpts(o);
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }

  const dialog = opts ? (
    <ConfirmDialog
      title={opts.title}
      body={opts.body}
      confirmLabel={opts.confirmLabel}
      danger={opts.danger}
      pending={pending}
      onCancel={() => { setOpts(null); resolver.current(false); }}
      onConfirm={() => { setPending(true); setOpts(null); setPending(false); resolver.current(true); }}
    />
  ) : null;

  return { ask, dialog };
}
