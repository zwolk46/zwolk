import {
  User,
  Gear,
  BookmarkSimple,
  NotePencil,
  MapTrifold,
  SignOut,
  Sparkle,
} from '@phosphor-icons/react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LockedFeature } from '@/components/common/LockedFeature';

export function AccountMenu() {
  const navigate = useNavigate();

  const go = (path: string) => () => navigate(path);

  const logOut = async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
    } catch {
      // ignore
    }
    // Hard navigate so the middleware re-evaluates auth on the next page load.
    window.location.href = '/login';
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Account">
          <User size={18} weight="regular" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
          Signed in via shared password
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={go('/library')}>
          <BookmarkSimple size={16} weight="regular" />
          Library
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={go('/annotations')}>
          <NotePencil size={16} weight="regular" />
          Annotations
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={go('/map')}>
          <MapTrifold size={16} weight="regular" />
          Map
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={go('/settings')}>
          <Gear size={16} weight="regular" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <LockedFeature hint="Per-user accounts coming">Account</LockedFeature>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <LockedFeature hint="Plan gating coming">
            <span className="inline-flex items-center gap-1">
              <Sparkle size={12} weight="regular" /> Upgrade to Pro
            </span>
          </LockedFeature>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logOut}>
          <SignOut size={16} weight="regular" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
