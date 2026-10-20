export function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '--:--';
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function getStopStatus(index: number, currentIndex: number): 'completed' | 'current' | 'next' | 'upcoming' {
  if (index < currentIndex) return 'completed';
  if (index === currentIndex) return 'current';
  if (index === currentIndex + 1) return 'next';
  return 'upcoming';
}

export function getDelayBadge(delayMinutes: number): { label: string; className: string } {
  if (delayMinutes <= 0) return { label: 'ON TIME', className: 'badge-green' };
  if (delayMinutes <= 5) return { label: `+${delayMinutes} MIN`, className: 'badge-yellow' };
  if (delayMinutes > 10) return { label: 'EARLY!', className: 'badge-red' };
  return { label: `+${delayMinutes} MIN`, className: 'badge-yellow' };
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
