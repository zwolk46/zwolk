import { Scales } from '@phosphor-icons/react';
import { Link } from 'react-router';

export function Wordmark() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-2 rounded-md px-1 py-1 text-foreground transition-colors duration-(--dur-1) hover:text-foreground/80"
      aria-label="Law Hub — home"
    >
      <Scales size={20} weight="regular" />
      <span className="font-sans text-sm font-semibold tracking-tight">Law Hub</span>
    </Link>
  );
}
