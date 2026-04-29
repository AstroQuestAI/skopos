/**
 * sunNames.ts — Sanskrit names of the Sun mapped to the time-of-day.
 *
 * Reference: classical Vedic 12-Adityas plus phase descriptors in the
 * Rig Veda + Surya Sahasranama. Each "phase" maps to a window of hours
 * relative to local civil time (sunrise/sunset are handled separately
 * if available; we fall back to clock hours when not).
 *
 * The result is the *currently appropriate* name to surface in the
 * SUN orb on the home dashboard ("SUN · Aditya" instead of the wrong
 * "SUN PHASE · Waxing Moon").
 */
export interface SunName {
  name: string;        // Sanskrit name e.g. "Aditya"
  meaning: string;     // short gloss e.g. "Son of Aditi — sovereign noon Sun"
  stage: string;       // e.g. "Midday"
}
const TABLE: Array<{ start: number; end: number; sun: SunName }> = [
  { start:  4, end:  6, sun: { name: 'Aruna',     meaning: 'The reddish dawn',                   stage: 'Pre-dawn' } },
  { start:  6, end:  7, sun: { name: 'Mitra',     meaning: 'Friend of all — gentle morning',     stage: 'Sunrise' } },
  { start:  7, end:  8, sun: { name: 'Savitr',    meaning: 'Vivifier — purifies and inspires',   stage: 'Early morning' } },
  { start:  8, end:  9, sun: { name: 'Bhanu',     meaning: 'The radiant one',                    stage: 'Morning' } },
  { start:  9, end: 10, sun: { name: 'Martanda',  meaning: 'Source of cosmic life',              stage: 'Late morning' } },
  { start: 10, end: 11, sun: { name: 'Pushan',    meaning: 'Nourisher — fuel for growth',        stage: 'Mid-morning' } },
  { start: 11, end: 12, sun: { name: 'Tapan',     meaning: 'The one who heats',                  stage: 'Pre-noon' } },
  { start: 12, end: 13, sun: { name: 'Aditya',    meaning: 'Sovereign — the majestic noon Sun',  stage: 'Midday' } },
  { start: 13, end: 15, sun: { name: 'Bhaskara',  meaning: 'Giver of light',                     stage: 'Afternoon' } },
  { start: 15, end: 16, sun: { name: 'Saptarashmi', meaning: 'Of the seven rays',                stage: 'Late afternoon' } },
  { start: 16, end: 17, sun: { name: 'Mihira',    meaning: 'The wise watcher of the sky',        stage: 'Pre-sunset' } },
  { start: 17, end: 18, sun: { name: 'Aushinara', meaning: 'Of the slanting western light',      stage: 'Sunset hour' } },
  { start: 18, end: 20, sun: { name: 'Ravi',      meaning: 'The lord setting in golden hush',    stage: 'Sunset' } },
  { start: 20, end: 22, sun: { name: 'Vivasvan',  meaning: 'Light withdrawing into the night',   stage: 'Evening' } },
  { start: 22, end: 24, sun: { name: 'Surya',     meaning: 'Hidden Sun behind the night veil',   stage: 'Night' } },
  { start:  0, end:  4, sun: { name: 'Brahma-Surya', meaning: 'The unmanifest Sun before dawn',  stage: 'Deep night' } },
];

export function sunNameForHour(hour: number): SunName {
  const h = ((hour % 24) + 24) % 24;
  for (const row of TABLE) {
    if (h >= row.start && h < row.end) return row.sun;
  }
  return TABLE[7].sun; // Aditya fallback
}

export function sunNameForDate(d?: Date): SunName {
  return sunNameForHour((d || new Date()).getHours());
}
