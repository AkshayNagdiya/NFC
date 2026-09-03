import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Nfc, ScanLine, CalendarCheck, ShieldCheck,
  Wallet, Receipt, BarChart3, Bell, ScrollText, Settings, LogOut, PanelLeft,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useSocketLifecycle } from '../lib/socket';
import { TopBar } from '../components/TopBar';
import { useAuthStore } from '../stores/authStore';
import { useUiStore } from '../stores/uiStore';

const NAV: { section: string; items: { to: string; label: string; icon: typeof Users; perm?: string }[] }[] = [
  { section: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    section: 'Management',
    items: [
      { to: '/users', label: 'Users', icon: Users, perm: 'users.read' },
      { to: '/bands', label: 'NFC Bands', icon: Nfc, perm: 'bands.read' },
      { to: '/devices', label: 'Devices', icon: ScanLine, perm: 'devices.read' },
      { to: '/locations', label: 'Locations', icon: Settings, perm: 'locations.read' },
    ],
  },
  {
    section: 'Operations',
    items: [
      { to: '/scanner', label: 'NFC Scanner', icon: ScanLine, perm: 'nfc.scan' },
      { to: '/attendance', label: 'Attendance', icon: CalendarCheck, perm: 'attendance.read' },
      { to: '/access', label: 'Access Control', icon: ShieldCheck, perm: 'access.read' },
      { to: '/events', label: 'Events', icon: CalendarCheck, perm: 'access.read' },
    ],
  },
  {
    section: 'Finance',
    items: [
      { to: '/wallet', label: 'Wallet', icon: Wallet, perm: 'wallet.read' },
      { to: '/transactions', label: 'Transactions', icon: Receipt, perm: 'transactions.read' },
    ],
  },
  {
    section: 'Analytics',
    items: [{ to: '/reports', label: 'Reports', icon: BarChart3, perm: 'reports.read' }],
  },
  {
    section: 'System',
    items: [
      { to: '/notifications', label: 'Notifications', icon: Bell },
      { to: '/audit', label: 'Audit Logs', icon: ScrollText, perm: 'audit.read' },
      { to: '/settings', label: 'Settings', icon: Settings, perm: 'settings.manage' },
    ],
  },
];

export function AppLayout(): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const hasPerm = useAuthStore((s) => s.hasPerm);
  const logout = useAuthStore((s) => s.logout);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const mobileNav = useUiStore((s) => s.mobileNav);
  const setMobileNav = useUiStore((s) => s.setMobileNav);
  const nav = useNavigate();
  useSocketLifecycle();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground">
        Skip to content
      </a>
      {mobileNav && (
        <button className="fixed inset-0 z-20 bg-black/40 lg:hidden" aria-label="Close navigation" onClick={() => setMobileNav(false)} />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex-col border-r border-border bg-background transition-all',
          'hidden lg:flex',
          collapsed ? 'lg:w-16' : 'lg:w-64',
          mobileNav && 'flex w-64',
        )}
        aria-label="Primary"
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-3">
          {!collapsed && <span className="text-sm font-semibold tracking-tight">NFC Manager</span>}
          <button onClick={toggle} className="rounded-md p-2 hover:bg-muted" aria-label="Toggle sidebar">
            <PanelLeft size={18} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          {NAV.map((g) => (
            <div key={g.section} className="mb-3">
              {!collapsed && <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.section}</p>}
              {g.items.filter((i) => !i.perm || hasPerm(i.perm)).map((i) => (
                <NavLink
                  key={i.to}
                  to={i.to}
                  end={i.to === '/'}
                  onClick={() => setMobileNav(false)}                  className={({ isActive }) =>
                    cn('flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted', isActive && 'bg-muted font-medium')
                  }
                  title={collapsed ? i.label : undefined}
                >
                  <i.icon size={18} aria-hidden />
                  {!collapsed && i.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-border p-2 text-xs">
          {!collapsed && (
            <div className="px-2 py-1">
              <p className="font-medium">{user ? `${user.firstName} ${user.lastName}` : '—'}</p>
              <p className="text-muted-foreground">{user?.role} · {user?.organizationName}</p>
            </div>
          )}
          <button
            onClick={() => { logout(); nav('/login'); }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
          >
            <LogOut size={16} /> {!collapsed && 'Logout'}
          </button>
        </div>
      </aside>
      <div className={cn('transition-all', collapsed ? 'lg:pl-16' : 'lg:pl-64')}>
        <TopBar />
        <main id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
