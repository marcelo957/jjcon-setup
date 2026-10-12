/** "02 Aug 2027" — the date format used across JJCON SetUp. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** First name for friendly copy: "Marcelo invited you". */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
