import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Bell, X as XIcon, ArrowRight, Lightning } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { law } from '@/lib/lawClient';
import type { Subscription } from '@/lib/law-data';

export default function Alerts() {
  const [subs, setSubs] = useState<Subscription[]>(() => law.listSubscriptions());

  // The data layer's user store fires no events; refresh on focus so changes
  // made elsewhere (e.g., the future "subscribe" button in the reader) show up.
  useEffect(() => {
    const refresh = () => setSubs(law.listSubscriptions());
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const unsubscribe = (id: string) => {
    law.unsubscribe(id);
    setSubs(law.listSubscriptions());
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 space-y-10">
      <header className="space-y-1">
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
          Alerts
        </p>
        <h1 className="font-sans text-3xl font-semibold tracking-tight">
          Changes &amp; new bills
        </h1>
        <p className="text-sm text-muted-foreground">
          Follow sections, corpora, or queries; we'll surface amendments and new bills here once
          the alerts pipeline lands.
        </p>
      </header>

      {/* Stubbed feed area */}
      <section
        className="border border-border rounded-md p-6 space-y-2 bg-card text-center"
        aria-labelledby="feed-heading"
      >
        <h2 id="feed-heading" className="sr-only">
          Recent changes
        </h2>
        <Lightning size={28} weight="regular" className="mx-auto text-muted-foreground" />
        <p className="text-sm">No change feed yet.</p>
        <p className="text-xs text-muted-foreground">
          When the ingestion pipeline pulls amendments from the Federal Register and new bills
          from Congress.gov / state legislatures, the most recent items relevant to your
          subscriptions will appear here. Wired into the data layer's{' '}
          <span className="font-mono">getAlertsFeed()</span> already.
        </p>
      </section>

      {/* Subscriptions list */}
      <section className="space-y-3" aria-labelledby="subs-heading">
        <h2 id="subs-heading" className="text-xs uppercase tracking-widest text-muted-foreground inline-flex items-center gap-2">
          <Bell size={12} weight="regular" />
          Your subscriptions
        </h2>
        {subs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 italic">
            Nothing subscribed yet. The reader will gain a "follow this section" button alongside
            Save in a follow-up; for now, subscriptions are populated by the data layer's{' '}
            <span className="font-mono">subscribe()</span> API directly.
          </p>
        ) : (
          <ul className="divide-y divide-border border-t border-b border-border">
            {subs.map((sub) => (
              <li key={sub.id} className="flex items-start gap-3 py-3">
                <Bell size={16} weight="regular" className="text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-sm">
                    {sub.label || sub.target}
                  </p>
                  <p className="font-mono text-[0.7rem] text-muted-foreground">
                    {sub.type} · since {new Date(sub.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {sub.type === 'node' && (
                  <Button asChild variant="ghost" size="xs">
                    <Link to={`/j/${sub.target.split(':')[0]}/n/${sub.target.split(':')[1] ?? ''}`}>
                      Open <ArrowRight size={12} weight="regular" />
                    </Link>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => unsubscribe(sub.id)}
                  aria-label="Unsubscribe"
                >
                  <XIcon size={12} weight="regular" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
