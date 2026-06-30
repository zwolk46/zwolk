import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const KEY = 'lawHubTheme';

export function getTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function setTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // localStorage may be blocked; theme still applies for this session
  }
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

// Subscribe to theme changes — observes the `dark` class on <html>, so any
// caller of setTheme/toggleTheme (or external manipulation) is picked up.
export function useTheme(): Theme {
  const [theme, setLocal] = useState<Theme>(() => getTheme());
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const sync = () => setLocal(getTheme());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);
  return theme;
}
