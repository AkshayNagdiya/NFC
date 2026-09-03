import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Menu, Moon, Search, Sun } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useUiStore } from '../stores/uiStore';
import { CommandPalette } from './CommandPalette';
import { useUnreadCount } from '../features/notifications/NotificationsPage';

export function TopBar(): JSX.Element {
  const [palette, setPalette] = useState(false);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const initials = user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : '?';
  const { data: unread } = useUnreadCount();
  const setMobileNav = useUiStore((s) => s.setMobileNav);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/90 px-4 backdrop-blur">
      <button onClick={() => setMobileNav(true)} className="rounded-md p-2 hover:bg-muted lg:hidden" aria-label="Open navigation">
        <Menu size={18} />
      </button>
      <button
        onClick={() => setPalette(true)}
        className="flex flex-1 items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted sm:max-w-sm"
        aria-label="Global search (Ctrl+K)"
      >
        <Search size={15} aria-hidden />
        <span className="hidden sm:inline">Search users, bands, UIDs…</span>
        <kbd className="ml-auto rounded border border-border px-1.5 text-[11px]">Ctrl K</kbd>
      </button>
      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="rounded-md p-2 hover:bg-muted"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <Link to="/notifications" className="relative rounded-md p-2 hover:bg-muted" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
          <Bell size={17} />
          {unread ? (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </Link>
        <span className="ml-1 grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground" title={user ? `${user.firstName} ${user.lastName}` : ''}>
          {initials}
        </span>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </header>
  );
}
