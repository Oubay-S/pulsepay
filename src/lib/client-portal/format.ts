// ============================================================
// PulsePay — Client Portal Formatting Helpers
// ============================================================

const DAY_MS = 86_400_000;

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatMoney(amount: number, currency = 'USD'): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const hasCents = Math.abs(safeAmount % 1) > 0.001;

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: hasCents ? 2 : 0,
    }).format(safeAmount);
  } catch {
    return `$${safeAmount.toFixed(hasCents ? 2 : 0)}`;
  }
}

export function formatDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  const sameYear = date.getUTCFullYear() === now.getUTCFullYear();
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date);
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(date);
}

export function formatDayLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const start = startOfDay(date);
  const today = startOfDay(now);
  const diff = Math.round((today.getTime() - start.getTime()) / DAY_MS);

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) {
    return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(date);
  }

  return formatDate(iso, now);
}

export function isSameDay(a: string, b: string): boolean {
  const first = new Date(a);
  const second = new Date(b);
  if (Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) return false;

  return (
    first.getUTCFullYear() === second.getUTCFullYear() &&
    first.getUTCMonth() === second.getUTCMonth() &&
    first.getUTCDate() === second.getUTCDate()
  );
}

export function daysPastDue(dueDate: string, now: string | Date = new Date()): number {
  const due = new Date(dueDate);
  const current = typeof now === 'string' ? new Date(now) : now;
  if (Number.isNaN(due.getTime()) || Number.isNaN(current.getTime())) return 0;

  const diff = (startOfDay(current).getTime() - startOfDay(due).getTime()) / DAY_MS;
  return Math.max(0, Math.floor(diff));
}

export function daysUntil(dateIso: string, now: string | Date = new Date()): number {
  const target = new Date(dateIso);
  const current = typeof now === 'string' ? new Date(now) : now;
  if (Number.isNaN(target.getTime()) || Number.isNaN(current.getTime())) return 0;

  return Math.ceil((startOfDay(target).getTime() - startOfDay(current).getTime()) / DAY_MS);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

const COMPANY_SUFFIXES = new Set([
  'co',
  'corp',
  'gmbh',
  'inc',
  'llc',
  'llp',
  'ltd',
  'plc',
  'sa',
  'sarl',
]);

export function initials(name: string | null | undefined): string {
  const safe = (name || '').trim();
  if (!safe) return 'PP';

  const parts = safe.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  const meaningful = parts.filter(
    (part) => !COMPANY_SUFFIXES.has(part.replace(/[.,]/g, '').toLowerCase())
  );
  const words = meaningful.length > 0 ? meaningful : parts;

  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return `${words[0][0] ?? ''}${words[words.length - 1][0] ?? ''}`.toUpperCase();
}

export function firstName(name: string | null | undefined): string {
  const safe = (name || '').trim();
  if (!safe) return 'there';

  return safe.split(/\s+/)[0];
}

export function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
