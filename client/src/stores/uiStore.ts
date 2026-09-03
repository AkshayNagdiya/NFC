import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface UiState {
  theme: Theme;
  sidebarCollapsed: boolean;
  mobileNav: boolean;
  setTheme: (t: Theme) => void;
  toggleSidebar: () => void;
  setMobileNav: (v: boolean) => void;
}

function applyTheme(t: Theme): void {
  const dark =
    t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export const useUiStore = create<UiState>()((set) => ({
  theme: 'system',
  sidebarCollapsed: false,
  mobileNav: false,
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setMobileNav: (mobileNav) => set({ mobileNav }),
}));

export { applyTheme };
