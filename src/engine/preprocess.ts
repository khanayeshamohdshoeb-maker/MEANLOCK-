import { PreprocessedText } from './types';

const CONTRACTIONS: [RegExp, string][] = [
  [/\bcan't\b/gi, 'cannot'],
  [/\bwon't\b/gi, 'will not'],
  [/\bdon't\b/gi, 'do not'],
  [/\bdoesn't\b/gi, 'does not'],
  [/\bdidn't\b/gi, 'did not'],
  [/\bshouldn't\b/gi, 'should not'],
  [/\bmustn't\b/gi, 'must not'],
  [/\bneedn't\b/gi, 'need not'],
  [/\bisn't\b/gi, 'is not'],
  [/\baren't\b/gi, 'are not'],
  [/\bwasn't\b/gi, 'was not'],
  [/\bweren't\b/gi, 'were not'],
  [/\bhaven't\b/gi, 'have not'],
  [/\bhasn't\b/gi, 'has not'],
  [/\bhadn't\b/gi, 'had not'],
  [/\bwouldn't\b/gi, 'would not'],
  [/\bcouldn't\b/gi, 'could not'],
  [/\bmayn't\b/gi, 'may not'],
  [/\bain't\b/gi, 'is not'],
];

export const MONTH_MAP: Record<string, string> = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', sept: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12',
};

export const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'with',
  'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'this', 'that', 'these', 'those', 'their', 'your', 'our', 'his', 'her', 'its',
  'it', 'they', 'we', 'you', 'he', 'she', 'who', 'which', 'whom', 'into',
]);

export function expandContractions(text: string): string {
  let result = text;
  for (const [pattern, replacement] of CONTRACTIONS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export function splitSentences(text: string): string[] {
  // Protect common abbreviations like Rs., Dr., Mr., Ms., No., e.g., i.e., a.m., p.m.
  const protectedText = text
    .replace(/\b(Rs|Dr|Mr|Mrs|Ms|Prof|No|St|vs|etc)\./gi, '$1__DOT__')
    .replace(/\b(a|p)\.m\./gi, '$1m')
    .replace(/(\d+)\.(\d+)/g, '$1__DEC__$2');

  const rawChunks = protectedText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/__DOT__/g, '.').replace(/__DEC__/g, '.').trim())
    .filter((s) => s.length > 0);

  return rawChunks;
}

export function tokenize(text: string, removeStopWords = false): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s$₹€£%/:.-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[.,;:!?]+|[.,;:!?]+$/g, ''))
    .filter(Boolean);

  if (!removeStopWords) return words;
  return words.filter((w) => !STOP_WORDS.has(w));
}

export function simpleStem(word: string): string {
  const w = word.toLowerCase();
  if (w.length <= 3) return w;
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('ing') && w.length > 5) return w.slice(0, -3);
  if (w.endsWith('ed') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('es') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
  return w;
}

export function normalizeTimeString(raw: string): string | null {
  const lower = raw.toLowerCase().trim();
  if (lower === 'noon' || lower === 'midday') return '12:00';
  if (lower === 'midnight') return '00:00';

  const ampmMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/i);
  if (ampmMatch) {
    let hour = parseInt(ampmMatch[1], 10);
    const min = ampmMatch[2] ?? '00';
    const meridiem = ampmMatch[3].replace(/\./g, '').toLowerCase();
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${min}`;
  }

  const h24Match = lower.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (h24Match) {
    return `${String(parseInt(h24Match[1], 10)).padStart(2, '0')}:${h24Match[2]}`;
  }

  return null;
}

export function normalizeDateString(raw: string): string | null {
  const cleaned = raw
    .toLowerCase()
    .replace(/(\d+)(st|nd|rd|th)\b/g, '$1')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Pattern 1: "30 november [2026]" or "30 nov"
  const dayFirst = cleaned.match(
    /\b(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(\d{4}))?\b/
  );
  if (dayFirst) {
    const day = String(parseInt(dayFirst[1], 10)).padStart(2, '0');
    const month = MONTH_MAP[dayFirst[2]];
    const year = dayFirst[3] ? `${dayFirst[3]}-` : '';
    return `${year}${month}-${day}`;
  }

  // Pattern 2: "november 30 [2026]" or "nov 30"
  const monthFirst = cleaned.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:\s+(\d{4}))?\b/
  );
  if (monthFirst) {
    const month = MONTH_MAP[monthFirst[1]];
    const day = String(parseInt(monthFirst[2], 10)).padStart(2, '0');
    const year = monthFirst[3] ? `${monthFirst[3]}-` : '';
    return `${year}${month}-${day}`;
  }

  // Pattern 3: ISO 2026-11-30
  const iso = cleaned.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // Pattern 4: Numeric DD/MM/YYYY or MM/DD/YYYY
  const slash = cleaned.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (slash) {
    const a = String(parseInt(slash[1], 10)).padStart(2, '0');
    const b = String(parseInt(slash[2], 10)).padStart(2, '0');
    const y = slash[3] ? `${slash[3]}-` : '';
    return `${y}${a}/${b}`;
  }

  return null;
}

export function preprocessText(raw: string): PreprocessedText {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
  const expanded = expandContractions(raw.replace(/\r\n/g, '\n').trim());
  const sentences = splitSentences(expanded);
  const tokens = tokenize(expanded, false);

  return {
    raw,
    normalized,
    expanded,
    sentences,
    tokens,
  };
}
