import { DEFAULT_PROTOTYPE_WEIGHTS, UNIT_IMPORTANCE_TIER } from './config';
import {
  normalizeDateString,
  normalizeTimeString,
  preprocessText,
  STOP_WORDS,
  tokenize,
} from './preprocess';
import { CriticalUnit, CriticalUnitType, ImportanceWeightConfig } from './types';

function makeUnit(
  idx: number,
  type: CriticalUnitType,
  originalText: string,
  sentence: string,
  sentenceIndex: number,
  weights: ImportanceWeightConfig,
  metadata?: CriticalUnit['metadata']
): CriticalUnit {
  const importance = UNIT_IMPORTANCE_TIER[type];
  const weight = weights.byType[type] ?? weights[importance];
  const coreTerms = tokenize(originalText, true).filter((t) => !STOP_WORDS.has(t));
  return {
    id: `u_${sentenceIndex}_${idx}_${type.toLowerCase()}`,
    type,
    importance,
    weight,
    originalText: originalText.trim().replace(/[.,;:]+$/, ''),
    sentence,
    sentenceIndex,
    metadata: {
      coreTerms,
      ...metadata,
    },
  };
}

function getModalStrength(phrase: string): number {
  const lower = phrase.toLowerCase();
  if (/\b(must not|cannot|shall not|prohibited|forbidden|do not|never)\b/.test(lower)) return -3;
  if (/\b(must|required|have to|has to|need to|needs to|shall|mandatory|compulsory)\b/.test(lower)) return 3;
  if (/\b(should|ought to|recommended|advised|encouraged)\b/.test(lower)) return 2;
  if (/\b(may|can|might|could|optional)\b/.test(lower)) return 1;
  return 0;
}

export function extractCriticalUnits(
  rawText: string,
  weights: ImportanceWeightConfig = DEFAULT_PROTOTYPE_WEIGHTS
): CriticalUnit[] {
  const pre = preprocessText(rawText);
  const units: CriticalUnit[] = [];
  let counter = 0;

  const seenKeys = new Set<string>();
  const addUnique = (unit: CriticalUnit) => {
    const norm = `${unit.type}:${unit.originalText.toLowerCase().replace(/\s+/g, ' ')}`;
    if (!unit.originalText || unit.originalText.length < 2) return;
    if (seenKeys.has(norm)) return;
    seenKeys.add(norm);
    units.push(unit);
  };

  pre.sentences.forEach((sentence, sIdx) => {
    const lower = sentence.toLowerCase();

    // 1. WARNINGS (Explicit safety markers or toxic/hazard statements)
    if (/\b(warning|caution|danger|hazard|toxic|flammable|poison|fatal|emergency)\b/i.test(sentence)) {
      if (/^(warning|caution|danger)\s*:/i.test(sentence)) {
        const cleaned = sentence.replace(/^(warning|caution|danger)\s*:\s*/i, '');
        if (/\b(do not|never|cannot|must not|prohibited|avoid)\b/i.test(cleaned)) {
          addUnique(
            makeUnit(counter++, 'NEGATION', cleaned, sentence, sIdx, weights, {
              polarity: 'negative',
              modalStrength: -3,
            })
          );
        } else {
          addUnique(
            makeUnit(counter++, 'WARNING', cleaned, sentence, sIdx, weights, {
              polarity: 'negative',
            })
          );
        }
      } else if (/\b(toxic|poison|fatal|injury|burn|shock|explode|chlorine|gas)\b/i.test(sentence)) {
        addUnique(
          makeUnit(counter++, 'CONSEQUENCE', sentence, sentence, sIdx, weights, {
            polarity: 'negative',
          })
        );
      }
    }

    // 2. NEGATION & PROHIBITION ("Do not ...", "must not ...", "cannot ...", "never ...", "without ...")
    const negImperativeRegex =
      /\b(do not|never|must not|shall not|cannot|are not allowed to|is not permitted to|prohibited from|forbidden to)\s+[^.;!?]+/gi;
    let m: RegExpExecArray | null;
    while ((m = negImperativeRegex.exec(sentence)) !== null) {
      const span = m[0].trim();
      const alreadyWarning = units.some(
        (u) =>
          u.sentenceIndex === sIdx &&
          u.type === 'NEGATION' &&
          u.originalText.toLowerCase().includes(span.toLowerCase())
      );
      if (!alreadyWarning) {
        addUnique(
          makeUnit(counter++, 'NEGATION', span, sentence, sIdx, weights, {
            polarity: 'negative',
            modalStrength: -3,
          })
        );
      }
    }

    // Restriction with "only" ("Use only in...", "Only students with...")
    const onlyRegex =
      /\b(?:use\s+)?only\s+(?:in|if|when|for|by|on|at|with|students|applicants|residents|patients|parents)\b[^.;!?,]*?(?=\s+and\s+keep|\s+and\s+do|[.;!?,]|$)/gi;
    while ((m = onlyRegex.exec(sentence)) !== null) {
      if (/\bonly\s+if\b/i.test(m[0])) continue; // handled cleanly by CONDITION
      addUnique(
        makeUnit(counter++, 'NEGATION', m[0].trim(), sentence, sIdx, weights, {
          polarity: 'restrictive',
        })
      );
    }

    // "without ..." restriction (skip if sentence is a full rejection consequence clause)
    const isRejectionSentence = /\b(will not be|will be rejected|will be denied|will be disqualified)\b/i.test(sentence);
    if (!isRejectionSentence) {
      const withoutRegex = /\bwithout\s+(?:a|an|the|their|your|prior|written)?\s*[a-z]+(?:\s+[a-z]+){0,3}/gi;
      while ((m = withoutRegex.exec(sentence)) !== null) {
        addUnique(
          makeUnit(counter++, 'NEGATION', m[0].trim(), sentence, sIdx, weights, {
            polarity: 'negative',
          })
        );
      }
    }

    // 3. EXCEPTIONS ("unless ...", "except ...", "other than ...")
    const exceptionRegex = /\b(unless|except(?:\s+for|\s+when|\s+if)?|other than)\s+[^.;!?]+/gi;
    while ((m = exceptionRegex.exec(sentence)) !== null) {
      addUnique(
        makeUnit(counter++, 'EXCEPTION', m[0].trim(), sentence, sIdx, weights, {
          polarity: 'restrictive',
        })
      );
    }

    // 4. CONDITIONS ("if ...", "only if ...", "provided that ...", "in case ...", "otherwise ...")
    const conditionRegex =
      /\b(only if\s+[^.;!?]+|provided that\s+[^.;!?]+|in case(?:\s+of)?\s+[^,.;!?]+|subject to\s+[^,.;!?]+|if\s+[^,.;!?]+)/gi;
    while ((m = conditionRegex.exec(sentence)) !== null) {
      const span = m[0].trim();
      const overlapsException = units.some(
        (u) => u.sentenceIndex === sIdx && u.type === 'EXCEPTION' && u.originalText.toLowerCase().includes(span.toLowerCase())
      );
      if (!overlapsException) {
        addUnique(makeUnit(counter++, 'CONDITION', span, sentence, sIdx, weights));
      }
    }

    // 5. CONSEQUENCE clauses (penalties, rejections, outcomes)
    const consequenceTrigger =
      /\b(will not be considered|may not be considered|will not be accepted|will be rejected|will be denied|will be disqualified|may be disqualified|will not be permitted|will result in|will be charged|failure to|disqualified|penalt|forfeit|suspended|void|canceled|cancelled|fined|gas will be released|late submissions?|late applications?|otherwise\b)\b/i;
    if (consequenceTrigger.test(sentence)) {
      // If the sentence starts with an "If ..., <consequence>" clause, extract the consequence part cleanly!
      let consequenceSpan = sentence;
      const ifSplit = sentence.match(/^if\s+[^,]+,\s*(.+)$/i);
      if (ifSplit && ifSplit[1]) {
        consequenceSpan = ifSplit[1].trim();
      }
      const hasNeg = /\b(not|never|no|without|cannot|denied|rejected|disqualified)\b/i.test(
        consequenceSpan.toLowerCase()
      );
      addUnique(
        makeUnit(counter++, 'CONSEQUENCE', consequenceSpan, sentence, sIdx, weights, {
          polarity: hasNeg ? 'negative' : 'positive',
        })
      );
    }

    // 6. OBLIGATIONS (Concise modal + action verb for crisp alignment, e.g., "must submit", "must upload")
    const obligationRegex =
      /\b(must|are required to|is required to|have to|has to|need to|needs to|shall|should|ought to|are advised to|are encouraged to|recommended to)\s+([a-z]+)/gi;
    while ((m = obligationRegex.exec(sentence)) !== null) {
      const span = m[0].trim();
      // Skip if preceded/part of "must not"
      if (/\bnot\b/i.test(sentence.slice(m.index, m.index + m[0].length + 6))) continue;
      // Skip if already part of a CONSEQUENCE ("will be rejected")
      const strength = getModalStrength(m[1]);
      addUnique(
        makeUnit(counter++, 'OBLIGATION', span, sentence, sIdx, weights, {
          modalStrength: strength,
          polarity: 'positive',
        })
      );
    }

    // Adjective obligations ("A $25 lab fee is required")
    const adjObligationRegex =
      /\b(?:a|an|the)?\s*(?:[\w$₹€£]+\s+){0,3}\b(?:is|are)\s+(required|mandatory|compulsory|optional|recommended)\b/gi;
    while ((m = adjObligationRegex.exec(sentence)) !== null) {
      const span = m[0].trim();
      const strength = getModalStrength(m[1]);
      addUnique(
        makeUnit(counter++, 'OBLIGATION', span, sentence, sIdx, weights, {
          modalStrength: strength,
          polarity: 'positive',
        })
      );
    }

    // 7. ACTION (Concise core verb + object phrase when meaningful, e.g., "submit the scholarship application")
    const actionRegex =
      /\b(?:must|should|are required to|need to|have to|please)\s+((?:submit|upload|return|bring|complete|pay|send|provide|report|file)\s+(?:the|a|an|their|your)?\s*[a-z]+(?:\s+[a-z]+){0,2})/gi;
    while ((m = actionRegex.exec(sentence)) !== null) {
      const actionSpan = m[1]
        .replace(/\s+(before|by|on|at|to|in|from|and|or)$/i, '')
        .trim();
      // Avoid adding ACTION if it duplicates a DOCUMENT that will be extracted (like "upload their income certificate")
      const isDocUpload =
        /\b(certificate|permission slip|consent form|photo id|id card|transcript|fee waiver|passport photos?)\b/i.test(
          actionSpan
        );
      if (!isDocUpload && actionSpan.split(/\s+/).length >= 2) {
        addUnique(makeUnit(counter++, 'ACTION', actionSpan, sentence, sIdx, weights));
      }
    }

    // 8. PERMISSIONS ("may apply", "are permitted to")
    const permRegex =
      /\b(may|are permitted to|is permitted to|are allowed to|is allowed to)\s+[a-z]+(?:\s+[a-z]+){0,2}/gi;
    while ((m = permRegex.exec(sentence)) !== null) {
      if (/\bmay not\b/i.test(sentence.slice(m.index, m.index + 12))) continue;
      if (units.some((u) => u.sentenceIndex === sIdx && u.type === 'CONSEQUENCE')) continue;
      addUnique(
        makeUnit(counter++, 'PERMISSION', m[0].trim(), sentence, sIdx, weights, {
          modalStrength: 1,
        })
      );
    }

    // 9. EXACT TIMES
    const timeRegex =
      /\b(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)|(?:[01]?\d|2[0-3]):[0-5]\d\s*(?:hrs?|hours)?|\bnoon\b|\bmidnight\b)\b/gi;
    while ((m = timeRegex.exec(sentence)) !== null) {
      const rawTime = m[0].trim();
      const normTime = normalizeTimeString(rawTime);
      if (normTime) {
        addUnique(
          makeUnit(counter++, 'TIME', rawTime, sentence, sIdx, weights, {
            normalizedTime: normTime,
          })
        );
      }
    }

    // 10. DATES
    const monthNames =
      '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
    const dateRegex = new RegExp(
      `\\b(?:\\d{1,2}(?:st|nd|rd|th)?\\s+${monthNames}(?:,?\\s+\\d{4})?|${monthNames}\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}/\\d{1,2}/\\d{2,4})\\b`,
      'gi'
    );
    while ((m = dateRegex.exec(sentence)) !== null) {
      const rawDate = m[0].trim();
      const normDate = normalizeDateString(rawDate);
      if (normDate) {
        addUnique(
          makeUnit(counter++, 'DATE', rawDate, sentence, sIdx, weights, {
            normalizedDate: normDate,
          })
        );
      }
    }

    // 11. RELATIVE DEADLINES
    const relDeadlineRegex =
      /\b(within\s+\d+\s+(?:business\s+)?(?:days?|hours?|weeks?|months?)|no later than\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow)|before\s+(?:the\s+)?(?:end of|midnight|noon)|by\s+(?:today|tomorrow|friday|monday|tuesday|wednesday|thursday|saturday|sunday))\b/gi;
    while ((m = relDeadlineRegex.exec(sentence)) !== null) {
      addUnique(
        makeUnit(counter++, 'DEADLINE', m[0].trim(), sentence, sIdx, weights, {
          numericValue: m[0].match(/\d+/)?.[0],
        })
      );
    }

    // 12. MONETARY AMOUNTS
    const moneyRegex =
      /(?:[$₹€£]\s*\d+(?:,\d{3})*(?:\.\d{1,2})?|\b(?:Rs\.?|INR|USD|EUR|GBP)\s*\d+(?:,\d{3})*(?:\.\d{1,2})?|\b\d+(?:,\d{3})*(?:\.\d{1,2})?\s*(?:dollars|rupees|euros|pounds|cents)\b)/gi;
    while ((m = moneyRegex.exec(sentence)) !== null) {
      const num = m[0].replace(/,/g, '').match(/\d+(?:\.\d+)?/)?.[0];
      addUnique(
        makeUnit(counter++, 'MONEY', m[0].trim(), sentence, sIdx, weights, {
          numericValue: num,
        })
      );
    }

    // 13. QUANTITIES, PERCENTAGES, AGE LIMITS
    const qtyRegex =
      /\b((?:at least|minimum|maximum|max|min|up to|under|over|below|above|older than|younger than)\s+\d+(?:\.\d+)?%?|\d+(?:\.\d+)?%|\d+\s+(?:passport\s+photos?|photos?|documents?|copies|forms?|proofs?(?:\s+of\s+[a-z]+)?|references?|letters?|pages?|attempts?|minutes?|hours?|days?|weeks?|months?|years?|mg|ml|tablets?|capsules?|doses?))\b/gi;
    while ((m = qtyRegex.exec(sentence)) !== null) {
      const span = m[0].trim();
      const isOverlap = units.some(
        (u) =>
          u.sentenceIndex === sIdx &&
          (u.type === 'DEADLINE' || u.type === 'DATE' || u.type === 'TIME' || u.type === 'MONEY') &&
          u.originalText.toLowerCase().includes(span.toLowerCase())
      );
      if (!isOverlap) {
        const num = span.match(/\d+(?:\.\d+)?/)?.[0];
        addUnique(
          makeUnit(counter++, 'QUANTITY', span, sentence, sIdx, weights, {
            numericValue: num,
          })
        );
      }
    }

    // 14. REQUIRED DOCUMENTS / ARTIFACTS
    const docRegex =
      /\b((?:signed|original|notarized|official|valid|certified|current|updated|completed)?\s*(?:income|birth|medical|vaccination|residency|tax|marriage|death)?\s*(?:certificate|permission slip|consent form|application form|registration form|passport photos?|photo id|id card|identification|transcript|proof of income|proof of residency|proof of residence|bank statement|tax return|fee waiver|receipt|passport|visa|report card|immunization record|voucher)s?)\b/gi;
    while ((m = docRegex.exec(sentence)) !== null) {
      const span = m[0].trim();
      addUnique(makeUnit(counter++, 'DOCUMENT', span, sentence, sIdx, weights));
    }

    // 15. LOCATIONS & PORTALS
    const locationRegex =
      /\b((?:Room|Rm\.?|Office|Building|Bldg\.?|Hall|Desk|Window|Counter|Suite|Floor|Gate)\s+[A-Z0-9-]+|the\s+(?:main office|registrar(?:'s)? office|counseling office|front desk|admin office|student portal|online portal|website)|https?:\/\/[^\s]+)\b/gi;
    while ((m = locationRegex.exec(sentence)) !== null) {
      addUnique(makeUnit(counter++, 'LOCATION', m[0].trim(), sentence, sIdx, weights));
    }

    // 16. CONTACT INFO
    const contactRegex =
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4})/g;
    while ((m = contactRegex.exec(sentence)) !== null) {
      addUnique(makeUnit(counter++, 'CONTACT', m[0].trim(), sentence, sIdx, weights));
    }
  });

  // Fallback for short/general sentences with no structural trigger
  if (units.length === 0 && pre.sentences.length > 0) {
    pre.sentences.forEach((sentence, sIdx) => {
      addUnique(makeUnit(counter++, 'ACTION', sentence, sentence, sIdx, weights));
    });
  }

  return units;
}
