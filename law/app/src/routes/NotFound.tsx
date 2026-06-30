import { Link } from 'react-router';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-6 py-32 text-center">
      <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">404</p>
      <h1 className="font-sans text-2xl font-semibold">Not found</h1>
      <Link to="/" className="text-sm text-foreground underline underline-offset-4">
        Back to home
      </Link>
    </div>
  );
}
