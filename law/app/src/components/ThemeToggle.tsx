import { useEffect, useState } from 'react';
import { Sun, Moon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { getTheme, toggleTheme, type Theme } from '@/lib/theme';

export function ThemeToggle() {
  const [theme, setLocalTheme] = useState<Theme>('dark');

  useEffect(() => {
    setLocalTheme(getTheme());
  }, []);

  const onClick = () => {
    setLocalTheme(toggleTheme());
  };

  const Icon = theme === 'dark' ? Sun : Moon;
  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <Button variant="ghost" size="icon" onClick={onClick} aria-label={label} title={label}>
      <Icon size={18} weight="regular" />
    </Button>
  );
}
