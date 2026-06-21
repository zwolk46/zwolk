// Shared formatters. All times are rendered in Eastern Time (America/New_York)
// because the tournament is hosted in NA and tickets/broadcast schedules are
// universally quoted in ET.

export const TZ = 'America/New_York';

export const dayLabel = (d) =>
  d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', timeZone:TZ });

export const dayLong = (d) =>
  d.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric', timeZone:TZ });

export const timeLabel = (d) =>
  d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', timeZone:TZ });

export const todayKey = () =>
  new Date().toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric', timeZone:TZ });

export const isToday = (d) =>
  d.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric', timeZone:TZ }) === todayKey();

// EUR market value formatting (matches CLAUDE.md spec):
//   80000000 → "€80m" ;  750000 → "€750k" ;  null → "—"
export function eur(value) {
  if (value == null || isNaN(value)) return '—';
  if (value >= 1_000_000) return `€${(+(value / 1_000_000).toFixed(1)).toString().replace(/\.0$/, '')}m`;
  if (value >= 1_000) return `€${Math.round(value / 1_000)}k`;
  return `€${value}`;
}

export function initials(fullName) {
  if (!fullName) return '??';
  const parts = String(fullName).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return fullName.slice(0, 2).toUpperCase();
}

export function ordinal(n) {
  if (n == null) return '';
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// "in 3d 4h" / "in 2h 15m" / "2m" / "Kickoff!"
export function countdown(targetDate, now = new Date()) {
  const diff = targetDate - now;
  if (diff <= 0) return 'Kickoff!';
  const days = Math.floor(diff / 86_400_000);
  const hrs = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${hrs}h`;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

export const ROUND_LABEL = {
  group: 'Group',
  round_of_32: 'Round of 32',
  round_of_16: 'Round of 16',
  quarter_final: 'Quarterfinal',
  semi_final: 'Semifinal',
  third_place: 'Third place',
  final: 'Final',
};

export const PHASE_LABEL = {
  PRE: 'Pre-match',
  '1H': 'First half',
  HT: 'Halftime',
  '2H': 'Second half',
  ET1: 'Extra time 1',
  ET2: 'Extra time 2',
  PEN: 'Penalty shootout',
  FT: 'Full time',
  FT_PEN: 'Full time (pens)',
};
