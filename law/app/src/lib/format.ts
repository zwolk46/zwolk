// Central formatting helpers. Pass 'en-US' explicitly so the site renders as
// US English regardless of the runtime locale (the Vercel build container /
// user browser may default to a non-US locale, which produces "29 de jun."
// dates and "116.906" numbers).
const LOCALE = 'en-US';

const dateShort = new Intl.DateTimeFormat(LOCALE, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});
const dateTime = new Intl.DateTimeFormat(LOCALE, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const numberFmt = new Intl.NumberFormat(LOCALE);

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return dateShort.format(new Date(iso));
  } catch {
    return iso || '';
  }
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return dateTime.format(new Date(iso));
  } catch {
    return iso || '';
  }
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '';
  return numberFmt.format(n);
}
