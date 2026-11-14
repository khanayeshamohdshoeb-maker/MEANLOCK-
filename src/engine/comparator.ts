import { UNIT_WHY_IT_MATTERS } from './config';
import {
  normalizeDateString,
  normalizeTimeString,
  preprocessText,
  simpleStem,
  STOP_WORDS,
  tokenize,
} from './preprocess';
import { CriticalUnit, DecisionImpact, UnitComparison, UnitStatus } from './types';

const SYNONYM_GROUPS: string[][] = [
  ['submit', 'turn in', 'hand in', 'send', 'deliver', 'file', 'return'],
  ['application', 'form', 'submission', 'request', 'paperwork'],
  ['considered', 'accepted', 'reviewed', 'evaluated', 'processed', 'approved', 'permitted', 'allowed'],
  ['rejected', 'denied', 'disqualified', 'refused', 'declined'],
  ['students', 'applicants', 'learners', 'pupils', 'candidates'],
  ['parents', 'guardians', 'families', 'caregivers'],
  ['income certificate', 'proof of income', 'income statement', 'salary slip'],
  ['well-ventilated', 'ventilated', 'open', 'airy'],
  ['late', 'overdue', 'delayed', 'after deadline'],
  ['fee', 'charge', 'payment', 'cost'],
  ['cleaner', 'detergent', 'solution', 'product'],
  ['chemicals', 'bleach', 'ammonia', 'solvents'],
  ['children', 'kids', 'minors', 'youth'],
];

const ANTONYM_PAIRS: [string, string][] = [
  ['incomplete', 'complete'],
  ['unpaid', 'paid'],
  ['invalid', 'valid'],
  ['ineligible', 'eligible'],
  ['unsafe', 'safe'],
  ['illegal', 'legal'],
  ['incorrect', 'correct'],
];

function hasAntonymFlip(origText: string, transText: string): [string, string] | null {
  const origWords = new Set(tokenize(origText, false));
  const transWords = new Set(tokenize(transText, false));
  for (const [negWord, posWord] of ANTONYM_PAIRS) {
    if (origWords.has(negWord) && transWords.has(posWord) && !transWords.has(negWord)) {
      return [negWord, posWord];
    }
    if (origWords.has(posWord) && transWords.has(negWord) && !transWords.has(posWord)) {
      return [posWord, negWord];
    }
  }
  return null;
}

function getSynonyms(term: string): string[] {
  const stem = simpleStem(term);
  const results = new Set<string>([term.toLowerCase(), stem]);
  for (const group of SYNONYM_GROUPS) {
    if (group.some((g) => g === term.toLowerCase() || simpleStem(g) === stem)) {
      for (const item of group) {
        results.add(item);
        results.add(simpleStem(item));
      }
    }
  }
  return Array.from(results);
}

function tokenOverlapScore(unitTerms: string[], targetSentence: string): number {
  if (unitTerms.length === 0) return 0;
  const targetTokens = new Set(tokenize(targetSentence, true).map(simpleStem));
  const targetLower = targetSentence.toLowerCase();

  let matched = 0;
  for (const term of unitTerms) {
    const syns = getSynonyms(term);
    if (
      syns.some((s) =>
        s.includes(' ') ? targetLower.includes(s) : targetTokens.has(s)
      )
    ) {
      matched++;
    }
  }
  return matched / unitTerms.length;
}

function findBestSentence(
  unit: CriticalUnit,
  transformedSentences: string[]
): { sentence: string | null; overlap: number } {
  const unitTerms = (unit.metadata?.coreTerms ?? tokenize(unit.originalText, true)).filter(
    (t) => !STOP_WORDS.has(t)
  );
  let bestSentence: string | null = null;
  let bestScore = 0;

  for (const s of transformedSentences) {
    const score = tokenOverlapScore(unitTerms, s);
    if (score > bestScore) {
      bestScore = score;
      bestSentence = s;
    }
  }

  return { sentence: bestSentence, overlap: bestScore };
}

function detectModalStrengthInSentence(sentence: string): number {
  const lower = sentence.toLowerCase();
  if (/\b(must not|cannot|shall not|prohibited|forbidden|do not|never)\b/.test(lower)) return -3;
  if (/\b(avoid|refrain from|try not to|discouraged)\b/.test(lower)) return -2;
  if (/\b(must|are required to|is required to|have to|has to|need to|needs to|shall|mandatory|compulsory|required)\b/.test(lower))
    return 3;
  if (/\b(should|ought to|advised|recommended|encouraged|preferred)\b/.test(lower)) return 2;
  if (/\b(may|can|might|could|optional)\b/.test(lower)) return 1;
  return 0;
}

function extractAllTimes(text: string): { raw: string; norm: string }[] {
  const regex =
    /\b(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)|(?:[01]?\d|2[0-3]):[0-5]\d\s*(?:hrs?|hours)?|\bnoon\b|\bmidnight\b)\b/gi;
  const out: { raw: string; norm: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const norm = normalizeTimeString(m[0]);
    if (norm) out.push({ raw: m[0].trim(), norm });
  }
  return out;
}

function extractAllDates(text: string): { raw: string; norm: string }[] {
  const monthNames =
    '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
  const regex = new RegExp(
    `\\b(?:\\d{1,2}(?:st|nd|rd|th)?\\s+${monthNames}(?:,?\\s+\\d{4})?|${monthNames}\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}/\\d{1,2}/\\d{2,4})\\b`,
    'gi'
  );
  const out: { raw: string; norm: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const norm = normalizeDateString(m[0]);
    if (norm) out.push({ raw: m[0].trim(), norm });
  }
  return out;
}

function inferDecisionImpact(
  unit: CriticalUnit,
  status: UnitStatus,
  isNegationReversal = false
): DecisionImpact {
  if (status === 'PRESERVED') return 'LOW';

  if (isNegationReversal) return 'VERY HIGH';
  if (unit.type === 'NEGATION' && (status === 'LOST' || status === 'CHANGED')) return 'VERY HIGH';
  if (unit.type === 'NEGATION' && status === 'WEAKENED') return 'HIGH';
  if (unit.type === 'WARNING' && (status === 'LOST' || status === 'CHANGED')) return 'VERY HIGH';
  if (unit.type === 'WARNING' && status === 'WEAKENED') return 'HIGH';
  if (unit.type === 'MONEY' && (status === 'LOST' || status === 'CHANGED')) return 'VERY HIGH';

  if (
    unit.type === 'TIME' ||
    unit.type === 'DATE' ||
    unit.type === 'DEADLINE' ||
    unit.type === 'OBLIGATION' ||
    unit.type === 'CONSEQUENCE' ||
    unit.type === 'QUANTITY' ||
    unit.type === 'EXCEPTION' ||
    unit.type === 'CONDITION'
  ) {
    return 'HIGH';
  }

  if (unit.type === 'DOCUMENT') {
    return status === 'LOST' || status === 'CHANGED' ? 'HIGH' : 'MEDIUM';
  }

  if (unit.type === 'LOCATION' || unit.type === 'CONTACT' || unit.type === 'ACTION') {
    return 'MEDIUM';
  }

  return 'LOW';
}

function makeComparison(
  unit: CriticalUnit,
  matchedTransformedText: string | null,
  status: UnitStatus,
  reason: string,
  whyThisMatters: string,
  confidence: UnitComparison['confidence'] = 'rule-exact',
  isNegationReversal = false
): UnitComparison {
  return {
    unit,
    matchedTransformedText,
    status,
    decisionImpact: inferDecisionImpact(unit, status, isNegationReversal),
    isNegationReversal,
    reason,
    whyThisMatters,
    whyItMatters: UNIT_WHY_IT_MATTERS[unit.type],
    confidence,
  };
}

export function compareUnitsAgainstTransformed(
  units: CriticalUnit[],
  transformedRaw: string
): UnitComparison[] {
  const transPre = preprocessText(transformedRaw);
  const transExpanded = transPre.expanded;
  const transLower = transExpanded.toLowerCase();
  const transTimes = extractAllTimes(transExpanded);
  const transDates = extractAllDates(transExpanded);

  return units.map((unit) => {
    // 1. EXACT TIME
    if (unit.type === 'TIME') {
      const targetNorm = unit.metadata?.normalizedTime;
      const exact = transTimes.find((t) => t.norm === targetNorm);
      if (exact) {
        return makeComparison(
          unit,
          exact.raw,
          'PRESERVED',
          'Same exact deadline time preserved.',
          'The reader receives the exact same time-of-day cutoff.'
        );
      }
      if (transTimes.length > 0) {
        return makeComparison(
          unit,
          transTimes[0].raw,
          'CHANGED',
          `Exact time changed from "${unit.originalText}" to "${transTimes[0].raw}".`,
          `The original requires action by ${unit.originalText}, whereas the transformed text states ${transTimes[0].raw}. Acting on the transformed time could miss the real cutoff.`
        );
      }
      const dateNote =
        transDates.length > 0
          ? ` The transformed message preserves the date (${transDates[0].raw}) but removes the time, so a reader could mistakenly believe submitting later that day is acceptable.`
          : ' Without an exact time, a reader does not know when the cutoff actually closes.';
      return makeComparison(
        unit,
        null,
        'LOST',
        `Exact submission time "${unit.originalText}" disappeared.`,
        `The original message specifies a strict ${unit.originalText} cutoff.${dateNote}`
      );
    }

    // 2. DATE
    if (unit.type === 'DATE') {
      const targetNorm = unit.metadata?.normalizedDate;
      const exact = transDates.find((d) => d.norm === targetNorm);
      if (exact) {
        return makeComparison(
          unit,
          exact.raw,
          'PRESERVED',
          'Same calendar date preserved (different wording).',
          'Both messages refer to the exact same calendar date.'
        );
      }
      if (transDates.length > 0) {
        return makeComparison(
          unit,
          transDates[0].raw,
          'CHANGED',
          `Date changed from "${unit.originalText}" to "${transDates[0].raw}".`,
          `A different date (${transDates[0].raw}) appears in the transformed text, directly changing when the user acts.`
        );
      }
      return makeComparison(
        unit,
        null,
        'LOST',
        `Specific date "${unit.originalText}" disappeared.`,
        `The reader no longer knows the calendar deadline (${unit.originalText}) from the transformed message alone.`
      );
    }

    // 3. RELATIVE DEADLINE
    if (unit.type === 'DEADLINE') {
      if (transLower.includes(unit.originalText.toLowerCase())) {
        return makeComparison(
          unit,
          unit.originalText,
          'PRESERVED',
          'Relative deadline preserved.',
          'The exact timeframe remains intact.'
        );
      }
      const origNum = unit.metadata?.numericValue;
      const { sentence, overlap } = findBestSentence(unit, transPre.sentences);
      if (origNum && sentence) {
        const transNum = sentence.match(/\b(\d+)\s+(?:business\s+)?(?:days?|hours?|weeks?|months?)\b/i)?.[1];
        if (transNum && transNum === origNum) {
          return makeComparison(
            unit,
            sentence,
            'PRESERVED',
            'Same deadline duration preserved.',
            'The timeframe window matches the original.',
            'rule-heuristic'
          );
        }
        if (transNum && transNum !== origNum) {
          return makeComparison(
            unit,
            sentence,
            'CHANGED',
            `Deadline window changed from ${origNum} to ${transNum}.`,
            `The allowed window shifted from ${origNum} to ${transNum}, changing how long the reader believes they have.`,
            'rule-heuristic'
          );
        }
      }
      if (/\b(soon|shortly|eventually|asap|before the end|sometime)\b/i.test(transLower)) {
        const vague = transExpanded.match(/\b(soon|shortly|eventually|asap|before the end|sometime)\b/i)?.[0] ?? null;
        return makeComparison(
          unit,
          vague,
          'WEAKENED',
          `Concrete deadline "${unit.originalText}" was softened into vague timing ("${vague}").`,
          `Replacing "${unit.originalText}" with "${vague}" hides the enforceable cutoff.`,
          'rule-heuristic'
        );
      }
      if (overlap >= 0.65 && sentence) {
        return makeComparison(
          unit,
          sentence,
          'PRESERVED',
          'Deadline wording matched closely.',
          'The deadline requirement remains clear.',
          'rule-heuristic'
        );
      }
      return makeComparison(
        unit,
        null,
        'LOST',
        `Deadline "${unit.originalText}" disappeared.`,
        `The transformed text drops "${unit.originalText}", leaving the reader without a clear deadline.`
      );
    }

    // 4. MONETARY AMOUNTS
    if (unit.type === 'MONEY') {
      const moneyMatches = transExpanded.match(
        /(?:[$₹€£]\s*\d+(?:,\d{3})*(?:\.\d{1,2})?|\b(?:Rs\.?|INR|USD|EUR|GBP)\s*\d+(?:,\d{3})*(?:\.\d{1,2})?|\b\d+(?:,\d{3})*(?:\.\d{1,2})?\s*(?:dollars|rupees|euros|pounds|cents)\b)/gi
      );
      const origNum = unit.metadata?.numericValue;
      if (moneyMatches && moneyMatches.length > 0) {
        const matchingNum = moneyMatches.find(
          (m) => m.replace(/,/g, '').match(/\d+(?:\.\d+)?/)?.[0] === origNum
        );
        if (matchingNum) {
          return makeComparison(
            unit,
            matchingNum,
            'PRESERVED',
            'Exact monetary amount preserved.',
            'The financial amount matches the original notice.'
          );
        }
        return makeComparison(
          unit,
          moneyMatches[0],
          'CHANGED',
          `Monetary amount changed from "${unit.originalText}" to "${moneyMatches[0]}".`,
          `The fee or payment amount changed from ${unit.originalText} to ${moneyMatches[0]}, directly altering financial expectations.`
        );
      }
      return makeComparison(
        unit,
        null,
        'LOST',
        `Exact monetary amount "${unit.originalText}" disappeared.`,
        `The specific amount (${unit.originalText}) is missing, so the reader does not know what fee, fine, or threshold applies.`
      );
    }

    // 5. QUANTITIES & LIMITS
    if (unit.type === 'QUANTITY') {
      const origNum = unit.metadata?.numericValue;
      const nonNumTerms = tokenize(unit.originalText, true).filter(
        (t) => !/^\d/.test(t) && !STOP_WORDS.has(t)
      );
      const { sentence } = findBestSentence(unit, transPre.sentences);

      if (origNum) {
        const numRegex = new RegExp(`\\b${origNum}\\b`);
        if (sentence && numRegex.test(sentence)) {
          const origQual = unit.originalText
            .toLowerCase()
            .match(/\b(at least|minimum|maximum|max|min|up to|under|over|below|above)\b/)?.[1];
          if (origQual && !sentence.toLowerCase().includes(origQual)) {
            return makeComparison(
              unit,
              sentence,
              'WEAKENED',
              `Number "${origNum}" remained, but qualifier "${origQual}" changed or disappeared.`,
              `Dropping "${origQual}" changes whether ${origNum} is a floor, ceiling, or exact requirement.`,
              'rule-heuristic'
            );
          }
          return makeComparison(
            unit,
            unit.originalText,
            'PRESERVED',
            `Exact quantity/limit "${origNum}" preserved.`,
            'The numeric count or threshold survived intact.'
          );
        }

        if (sentence && nonNumTerms.length > 0) {
          const monthPattern =
            '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
          const sentenceWithoutDatesTimes = sentence
            .replace(new RegExp(`\\b${monthPattern}\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`, 'gi'), ' ')
            .replace(new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${monthPattern}\\b`, 'gi'), ' ')
            .replace(/\b\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\b/gi, ' ');
          const otherNum = sentenceWithoutDatesTimes.match(/\b\d+(?:\.\d+)?%?\b/)?.[0];
          if (otherNum && otherNum !== origNum) {
            return makeComparison(
              unit,
              otherNum,
              'CHANGED',
              `Quantity/limit changed from "${origNum}" to "${otherNum}".`,
              `The required quantity or limit changed from ${origNum} to ${otherNum}, altering compliance.`,
              'rule-heuristic'
            );
          }
          return makeComparison(
            unit,
            sentence,
            'LOST',
            `Exact quantity/limit "${unit.originalText}" disappeared.`,
            `The transformed text mentions the topic generically without the exact count or limit ("${unit.originalText}"), so a reader may bring too few items or overlook an age/threshold rule.`,
            'rule-heuristic'
          );
        }
      }
      return makeComparison(
        unit,
        null,
        'LOST',
        `Quantity/limit "${unit.originalText}" disappeared.`,
        `The numeric limit "${unit.originalText}" is no longer present in the transformed text.`
      );
    }

    // 6. NEGATION & RESTRICTIONS
    if (unit.type === 'NEGATION') {
      const strippedTerms = tokenize(
        unit.originalText.replace(
          /\b(do not|never|must not|shall not|cannot|not|prohibited|forbidden|only|without)\b/gi,
          ' '
        ),
        true
      ).filter((t) => !STOP_WORDS.has(t));

      let bestSent: string | null = null;
      let bestOverlap = 0;
      for (const s of transPre.sentences) {
        const sc = tokenOverlapScore(strippedTerms, s);
        if (sc > bestOverlap) {
          bestOverlap = sc;
          bestSent = s;
        }
      }

      if (unit.metadata?.polarity === 'restrictive') {
        const hasOnly = /\b(only|exclusively|strictly|solely)\b/i.test(bestSent ?? transExpanded);
        if (bestSent && bestOverlap >= 0.25) {
          if (hasOnly) {
            return makeComparison(
              unit,
              bestSent,
              'PRESERVED',
              'Restriction ("only") preserved.',
              'The strict boundary remains enforced.',
              'rule-heuristic'
            );
          }
          return makeComparison(
            unit,
            bestSent,
            'WEAKENED',
            `Restriction "${unit.originalText}" lost its "only" qualifier.`,
            `Removing "only" turns a strict safety or eligibility restriction into general advice, which can lead someone to apply it in unsafe or ineligible situations.`,
            'rule-heuristic'
          );
        }
        return makeComparison(
          unit,
          null,
          'LOST',
          `Restriction "${unit.originalText}" disappeared.`,
          `The exclusivity rule "${unit.originalText}" is absent from the transformed message.`
        );
      }

      if (bestSent && bestOverlap >= 0.25) {
        const hasSoftAvoid =
          /\b(avoid|try not|when possible|discouraged|careful|not recommended|not advised|advised against)\b/i.test(
            bestSent
          );
        const hasStrongNeg =
          !hasSoftAvoid &&
          /\b(do not|never|must not|shall not|cannot|prohibited|forbidden|not allowed|not permitted|without|no)\b/i.test(
            bestSent
          );

        if (hasStrongNeg) {
          if (bestOverlap < 0.6) {
            return makeComparison(
              unit,
              bestSent,
              'WEAKENED',
              'Prohibition survived, but specific restricted items or details were omitted.',
              `The prohibition stays negative, but omitting specific named items from "${unit.originalText}" reduces clarity about what is forbidden.`,
              'rule-heuristic'
            );
          }
          return makeComparison(
            unit,
            bestSent,
            'PRESERVED',
            'Prohibition and negation preserved.',
            'The negative rule survived with its polarity intact.',
            'rule-heuristic'
          );
        }
        if (hasSoftAvoid) {
          return makeComparison(
            unit,
            bestSent,
            'WEAKENED',
            `Strong prohibition ("${unit.originalText}") softened to advisory caution.`,
            `Softening an absolute "do not" into "avoid when possible" makes a strict prohibition sound optional.`,
            'rule-heuristic'
          );
        }
        // Core action appears WITHOUT negation -> Negation Reversed!
        return makeComparison(
          unit,
          bestSent,
          'CHANGED',
          `Negation reversed: "${unit.originalText}" became affirmative ("${bestSent}").`,
          `The original explicitly forbids or restricts this ("${unit.originalText}"), while the transformed text removes the negation ("${bestSent}"). Following the transformed version flips the instruction to its opposite.`,
          'rule-exact',
          true
        );
      }

      return makeComparison(
        unit,
        null,
        'LOST',
        `Prohibition "${unit.originalText}" disappeared.`,
        `A critical negative rule ("${unit.originalText}") is missing from the transformed message.`
      );
    }

    // 7. OBLIGATIONS
    if (unit.type === 'OBLIGATION') {
      const actionTerms = tokenize(
        unit.originalText.replace(
          /\b(must|are required to|is required to|have to|has to|need to|needs to|shall|should|ought to|are advised to|are encouraged to|recommended to|required|mandatory|compulsory|optional|recommended|is|are)\b/gi,
          ' '
        ),
        true
      ).filter((t) => !STOP_WORDS.has(t));

      let bestSent: string | null = null;
      let bestOverlap = 0;
      for (const s of transPre.sentences) {
        const sc = tokenOverlapScore(actionTerms, s);
        if (sc > bestOverlap) {
          bestOverlap = sc;
          bestSent = s;
        }
      }

      if (!bestSent || bestOverlap < 0.35) {
        return makeComparison(
          unit,
          null,
          'LOST',
          `Obligation "${unit.originalText}" disappeared.`,
          `The required action "${unit.originalText}" is no longer stated in the transformed message.`
        );
      }

      const origStrength = unit.metadata?.modalStrength ?? 3;
      const transStrength = detectModalStrengthInSentence(bestSent);

      const snippetMatch = bestSent.match(
        /\b(must not|cannot|do not|must|are required to|is required to|have to|has to|need to|should|ought to|recommended|advised|encouraged|may|can|optional|required|mandatory)\b(?:\s+[a-z]+)?/i
      );
      const displayMatch = snippetMatch ? snippetMatch[0] : bestSent;

      if (origStrength > 0 && transStrength < 0) {
        return makeComparison(
          unit,
          displayMatch,
          'CHANGED',
          `Obligation reversed into a prohibition ("${displayMatch}").`,
          `The original required this step, whereas the transformed version prohibits or discourages it.`,
          'rule-exact',
          true
        );
      }
      if (origStrength >= 3 && transStrength === 2) {
        return makeComparison(
          unit,
          displayMatch,
          'WEAKENED',
          'A mandatory action became advisory.',
          `The original makes this mandatory ("${unit.originalText}"). Changing it to "${displayMatch}" signals a recommendation rather than a strict requirement, so a reader may treat it as optional.`
        );
      }
      if (origStrength >= 2 && transStrength === 1) {
        return makeComparison(
          unit,
          displayMatch,
          'WEAKENED',
          `Obligation weakened to optional/permissive ("${displayMatch}").`,
          `Replacing a requirement with "${displayMatch}" makes the action appear completely optional.`
        );
      }
      if (origStrength >= 3 && transStrength === 0) {
        return makeComparison(
          unit,
          displayMatch,
          'WEAKENED',
          'Mandatory modal ("must"/"required") disappeared; phrasing became ambiguous.',
          `Without explicit mandatory wording, the reader may not realize this step is required.`,
          'rule-heuristic'
        );
      }
      if (transStrength >= origStrength) {
        return makeComparison(
          unit,
          displayMatch,
          'PRESERVED',
          'Mandatory obligation strength preserved.',
          'The requirement keeps its mandatory force.'
        );
      }
      return makeComparison(
        unit,
        displayMatch,
        'PRESERVED',
        'Obligation level preserved.',
        'The obligation strength matches the original.',
        'rule-heuristic'
      );
    }

    // 8. CONSEQUENCES
    if (unit.type === 'CONSEQUENCE') {
      const { sentence, overlap } = findBestSentence(unit, transPre.sentences);
      if (!sentence || overlap < 0.45) {
        return makeComparison(
          unit,
          null,
          'LOST',
          `Consequence "${unit.originalText}" disappeared.`,
          `The penalty or outcome ("${unit.originalText}") is missing, so the reader will not understand the risk of non-compliance.`
        );
      }

      const antonymFlip = hasAntonymFlip(unit.originalText, sentence);
      if (antonymFlip) {
        return makeComparison(
          unit,
          sentence,
          'CHANGED',
          `Consequence wording shifted from "${antonymFlip[0]}" to "${antonymFlip[1]}" and weakened binding outcome.`,
          `The original warns of a concrete penalty ("${unit.originalText}"), while the transformed sentence ("${sentence}") replaces it with a soft preference.`
        );
      }

      const origLower = unit.originalText.toLowerCase();
      const transSentLower = sentence.toLowerCase();

      const origDefiniteNeg =
        /\b(will not|cannot|never|will be rejected|will be denied|will be disqualified|will not be considered|will not be permitted)\b/.test(
          origLower
        );
      const transUncertain = /\b(may not|might not|could not|may still|might still|may be|might be|possibly)\b/.test(
        transSentLower
      );
      const transPositive =
        !/\b(not|never|no|cannot|rejected|denied|disqualified|forfeit)\b/.test(transSentLower) &&
        /\b(accepted|considered|reviewed|permitted|allowed|eligible|preferred)\b/.test(transSentLower);

      if (origDefiniteNeg && transPositive) {
        return makeComparison(
          unit,
          sentence,
          'CHANGED',
          'Negative consequence was altered into an affirmative/permissive statement.',
          `The original states a definite negative outcome ("${unit.originalText}"), whereas the transformed phrasing ("${sentence}") implies acceptance or preference.`,
          'rule-exact',
          true
        );
      }
      if (origDefiniteNeg && transUncertain) {
        return makeComparison(
          unit,
          sentence,
          'CHANGED',
          'The consequence became less certain ("will not" → "may not").',
          `The original states definitively that late or non-compliant submissions will not be accepted. Changing this to "${sentence}" makes the penalty sound uncertain or negotiable.`
        );
      }
      if (/\bwill\b/.test(origLower) && /\b(may|might|could|preferred)\b/.test(transSentLower)) {
        return makeComparison(
          unit,
          sentence,
          'WEAKENED',
          'Certain consequence ("will") weakened to uncertain ("may/might").',
          `A guaranteed outcome became uncertain in the transformed version.`
        );
      }

      return makeComparison(
        unit,
        sentence,
        'PRESERVED',
        'Consequence and certainty level preserved.',
        'The stated outcome matches the original.',
        'rule-heuristic'
      );
    }

    // 9. DOCUMENTS
    if (unit.type === 'DOCUMENT') {
      const docTerms = tokenize(unit.originalText, true).filter((t) => !STOP_WORDS.has(t));
      const headNoun = docTerms[docTerms.length - 1];
      const { sentence, overlap } = findBestSentence(unit, transPre.sentences);
      if (transLower.includes(unit.originalText.toLowerCase())) {
        return makeComparison(
          unit,
          unit.originalText,
          'PRESERVED',
          `Required document "${unit.originalText}" preserved.`,
          'The reader is still told to provide this exact document.'
        );
      }
      const docSyns = getSynonyms(unit.originalText.toLowerCase());
      const synHit = docSyns.find((s) => s.includes(' ') && transLower.includes(s));
      if (synHit) {
        return makeComparison(
          unit,
          synHit,
          'PRESERVED',
          `Required document preserved via equivalent phrasing ("${synHit}").`,
          'The required document remains clear.'
        );
      }
      const headNounPresent = headNoun
        ? getSynonyms(headNoun).some((s) => transLower.includes(s))
        : false;
      if (sentence && headNounPresent && overlap >= 0.45 && docTerms.length > 1) {
        const missingModifiers = docTerms.filter((t) => !transLower.includes(simpleStem(t)));
        if (missingModifiers.length > 0) {
          return makeComparison(
            unit,
            sentence,
            'WEAKENED',
            `Document mentioned, but specification ("${missingModifiers.join(', ')}") was dropped.`,
            `Omitting "${missingModifiers.join(', ')}" from "${unit.originalText}" can cause the reader to submit an unsigned or wrong version.`,
            'rule-heuristic'
          );
        }
        return makeComparison(
          unit,
          sentence,
          'PRESERVED',
          'Required document preserved.',
          'The required document remains clear.',
          'rule-heuristic'
        );
      }
      return makeComparison(
        unit,
        null,
        'LOST',
        `A required document ("${unit.originalText}") is no longer mentioned.`,
        `The transformed message omits "${unit.originalText}". A reader relying on the transformed message will not know to prepare or attach it, risking rejection.`
      );
    }

    // 10. EXCEPTIONS & CONDITIONS
    if (unit.type === 'EXCEPTION' || unit.type === 'CONDITION') {
      const { sentence, overlap } = findBestSentence(unit, transPre.sentences);
      if (sentence) {
        const antonymFlip = hasAntonymFlip(unit.originalText, sentence);
        if (antonymFlip) {
          return makeComparison(
            unit,
            sentence,
            'CHANGED',
            `Condition altered from "${antonymFlip[0]}" to "${antonymFlip[1]}".`,
            `The condition ("${unit.originalText}") was inverted or softened into "${sentence}", hiding the rule trigger.`
          );
        }
      }

      const hasMarker =
        unit.type === 'EXCEPTION'
          ? /\b(unless|except|other than|waiver|exempt)\b/i.test(sentence ?? '')
          : /\b(if|only if|provided|subject to|when|in case)\b/i.test(sentence ?? '');

      if (sentence && overlap >= 0.5 && hasMarker) {
        return makeComparison(
          unit,
          sentence,
          'PRESERVED',
          `${unit.type === 'EXCEPTION' ? 'Exception' : 'Condition'} preserved.`,
          'The conditional rule or exception survived intact.',
          'rule-heuristic'
        );
      }
      if (sentence && overlap >= 0.45 && !hasMarker) {
        return makeComparison(
          unit,
          sentence,
          'WEAKENED',
          `${unit.type === 'EXCEPTION' ? 'Exception' : 'Condition'} marker disappeared.`,
          `Dropping the conditional marker ("if"/"unless") turns an explicit eligibility trigger into a loose statement.`,
          'rule-heuristic'
        );
      }
      return makeComparison(
        unit,
        null,
        'LOST',
        `${unit.type === 'EXCEPTION' ? 'Exception' : 'Condition'} "${unit.originalText}" disappeared.`,
        `The reader loses a key ${unit.type.toLowerCase()} ("${unit.originalText}") that determines whether the rule or penalty applies to them.`
      );
    }

    // 11. LOCATION & CONTACT
    if (unit.type === 'LOCATION' || unit.type === 'CONTACT') {
      if (transLower.includes(unit.originalText.toLowerCase())) {
        return makeComparison(
          unit,
          unit.originalText,
          'PRESERVED',
          `Exact ${unit.type.toLowerCase()} preserved.`,
          'The submission location or contact detail matches the original.'
        );
      }
      if (unit.type === 'LOCATION') {
        const altLoc = transExpanded.match(
          /\b((?:Room|Rm\.?|Office|Building|Bldg\.?|Hall|Desk|Window|Counter|Suite|Floor|Gate)\s+[A-Z0-9-]+|the\s+(?:main office|registrar(?:'s)? office|counseling office|front desk|admin office|student portal|online portal|website)|https?:\/\/[^\s]+)\b/i
        );
        if (altLoc) {
          return makeComparison(
            unit,
            altLoc[0],
            'CHANGED',
            `Location changed from "${unit.originalText}" to "${altLoc[0]}".`,
            `Sending the user to "${altLoc[0]}" instead of "${unit.originalText}" can cause missed submissions or delays.`
          );
        }
      }
      if (unit.type === 'CONTACT') {
        const altContact = transExpanded.match(
          /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4})/
        );
        if (altContact) {
          return makeComparison(
            unit,
            altContact[0],
            'CHANGED',
            `Contact info changed from "${unit.originalText}" to "${altContact[0]}".`,
            `Contact details changed, which could route inquiries or forms to the wrong place.`
          );
        }
      }
      return makeComparison(
        unit,
        null,
        'LOST',
        `${unit.type === 'LOCATION' ? 'Location' : 'Contact'} "${unit.originalText}" disappeared.`,
        `Without "${unit.originalText}", the reader does not know where or how to submit.`
      );
    }

    // 12. ACTION / PERMISSION / WARNING / WHO
    const { sentence, overlap } = findBestSentence(unit, transPre.sentences);
    if (sentence && overlap >= 0.6) {
      return makeComparison(
        unit,
        unit.type === 'ACTION' ? unit.originalText : sentence,
        'PRESERVED',
        'Actionable unit preserved.',
        'The core instruction survived in the transformed message.',
        'rule-heuristic'
      );
    }
    if (sentence && overlap >= 0.35) {
      return makeComparison(
        unit,
        sentence,
        'WEAKENED',
        `Partially preserved in "${sentence}", though specific detail was reduced.`,
        'Part of the instruction survived, but precision was lost.',
        'rule-heuristic'
      );
    }
    return makeComparison(
      unit,
      null,
      'LOST',
      `"${unit.originalText}" did not appear in the transformed message.`,
      `This instruction or detail is missing from the transformed text.`
    );
  });
}
