import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { analyzeWithDeterministicEngine } from './src/engine/index';
import { computeBaselineSimilarity } from './src/engine/baseline';
import { DEFAULT_PROTOTYPE_WEIGHTS, UNIT_IMPORTANCE_TIER, UNIT_WHY_IT_MATTERS } from './src/engine/config';
import { calculateScoreAndExplanations } from './src/engine/scorer';
import {
  AnalysisResult,
  CriticalUnitType,
  ImportanceWeightConfig,
  LanguageCode,
  TransformationType,
  UnitComparison,
  UnitStatus,
} from './src/engine/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = Number(process.env.PORT ?? 3000);

const VALID_UNIT_TYPES: CriticalUnitType[] = [
  'WHO',
  'OBLIGATION',
  'PERMISSION',
  'NEGATION',
  'DEADLINE',
  'DATE',
  'TIME',
  'QUANTITY',
  'MONEY',
  'DOCUMENT',
  'CONDITION',
  'EXCEPTION',
  'WARNING',
  'CONSEQUENCE',
  'ACTION',
  'LOCATION',
  'CONTACT',
];

const VALID_STATUSES: UnitStatus[] = ['PRESERVED', 'WEAKENED', 'LOST', 'CHANGED'];

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.get('/api/health', (_req, res) => {
  const hasGemini = Boolean(
    process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' &&
      process.env.GEMINI_API_KEY.trim() !== ''
  );
  res.json({
    status: 'ok',
    geminiConfigured: hasGemini,
    supportedLanguages: ['en'],
    plannedLanguages: ['hi', 'ur', 'mr'],
  });
});

app.post('/api/analyze', async (req, res) => {
  const {
    originalText,
    transformedText,
    transformationType = 'Summarization',
    sourceLanguage = 'en',
    targetLanguage = 'en',
    mode = 'deterministic',
    weights = DEFAULT_PROTOTYPE_WEIGHTS,
  } = req.body as {
    originalText?: string;
    transformedText?: string;
    transformationType?: TransformationType;
    sourceLanguage?: LanguageCode;
    targetLanguage?: LanguageCode;
    mode?: 'deterministic' | 'gemini-hybrid';
    weights?: ImportanceWeightConfig;
  };

  if (!originalText || !transformedText || !originalText.trim() || !transformedText.trim()) {
    res.status(400).json({ error: 'Both originalText and transformedText are required.' });
    return;
  }

  // Always available deterministic baseline
  const runFallback = (reason?: string): AnalysisResult => {
    const result = analyzeWithDeterministicEngine(originalText, transformedText, {
      transformationType,
      sourceLanguage,
      targetLanguage,
      weights,
    });
    if (reason) {
      result.trace.fallbackTriggered = true;
      result.trace.fallbackReason = reason;
    }
    return result;
  };

  if (mode !== 'gemini-hybrid') {
    res.json(runFallback());
    return;
  }

  const ai = getGeminiClient();
  if (!ai) {
    res.json(
      runFallback(
        'Gemini API key not configured in server environment; executed deterministic rule & NLP prototype instead.'
      )
    );
    return;
  }

  try {
    const prompt = `You are MEANLOCK's structured semantic extraction module.
Extract ONLY decision-critical meaning units from the Original Message that could change what a student, parent, patient, or citizen needs to DO. Do NOT extract trivial nouns or filler words.
Compare each extracted unit against the Transformed Message and classify its status as:
- PRESERVED: exact meaning, obligation strength, numbers, dates, times, and negation survived.
- WEAKENED: obligation became softer (e.g., "must" -> "should"), restriction ("only") dropped, or specific modifier/certainty softened.
- LOST: the critical fact, time, document, quantity, exception, or consequence disappeared completely.
- CHANGED: a number, date, time, location, consequence, or polarity/negation was materially altered or reversed.

Transformation type: ${transformationType}
Source language: ${sourceLanguage}, Target language: ${targetLanguage}

Original Message:
"""${originalText}"""

Transformed Message:
"""${transformedText}"""`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            units: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  originalSpan: { type: Type.STRING },
                  transformedSpan: { type: Type.STRING },
                  status: { type: Type.STRING },
                  reason: { type: Type.STRING },
                },
                required: ['type', 'originalSpan', 'transformedSpan', 'status', 'reason'],
              },
            },
          },
          required: ['units'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{"units":[]}').trim()) as {
      units?: Array<{
        type: string;
        originalSpan: string;
        transformedSpan: string;
        status: string;
        reason: string;
      }>;
    };

    if (!parsed.units || parsed.units.length === 0) {
      res.json(
        runFallback('Semantic extractor returned empty unit list; fell back to deterministic rule engine.')
      );
      return;
    }

    const comparisons: UnitComparison[] = parsed.units.map((u, idx) => {
      const unitType: CriticalUnitType = VALID_UNIT_TYPES.includes(u.type as CriticalUnitType)
        ? (u.type as CriticalUnitType)
        : 'ACTION';
      const unitStatus: UnitStatus = VALID_STATUSES.includes(u.status as UnitStatus)
        ? (u.status as UnitStatus)
        : 'WEAKENED';
      const importance = UNIT_IMPORTANCE_TIER[unitType];
      const weight = weights.byType?.[unitType] ?? weights[importance];
      const matched =
        u.transformedSpan && u.transformedSpan.trim() !== '' && u.transformedSpan !== '—' && u.transformedSpan !== 'null'
          ? u.transformedSpan.trim()
          : null;

      const decisionImpact =
        unitStatus === 'PRESERVED'
          ? 'LOW'
          : unitType === 'NEGATION' || unitType === 'WARNING' || unitType === 'MONEY'
          ? 'VERY HIGH'
          : importance === 'HIGH'
          ? 'HIGH'
          : 'MEDIUM';

      return {
        unit: {
          id: `gem_${idx}_${unitType.toLowerCase()}`,
          type: unitType,
          importance,
          weight,
          originalText: u.originalSpan.trim(),
          sentence: u.originalSpan.trim(),
          sentenceIndex: idx,
        },
        matchedTransformedText: matched,
        status: unitStatus,
        decisionImpact,
        reason: u.reason.trim(),
        whyThisMatters: u.reason.trim(),
        whyItMatters: UNIT_WHY_IT_MATTERS[unitType],
        confidence: 'semantic-assist',
      };
    });

    // Compute weighted score & baseline mathematically (NEVER let LLM invent scores!)
    const scoreOutcome = calculateScoreAndExplanations(comparisons);
    const baseline = computeBaselineSimilarity(originalText, transformedText, comparisons);

    const result: AnalysisResult = {
      originalText,
      transformedText,
      preservationScore: scoreOutcome.preservationScore,
      scoreExplanation: scoreOutcome.scoreExplanation,
      riskLevel: scoreOutcome.riskLevel,
      riskAdvisory: scoreOutcome.riskAdvisory,
      counts: scoreOutcome.counts,
      impactBreakdown: scoreOutcome.impactBreakdown,
      comparisons,
      explanations: scoreOutcome.explanations,
      baseline,
      transformationType,
      sourceLanguage,
      targetLanguage,
      trace: {
        engineUsed: 'Gemini Semantic Assist + Rule Scorer',
        fallbackTriggered: false,
        originalSentenceCount: originalText.split(/[.!?]+/).filter((s) => s.trim()).length,
        transformedSentenceCount: transformedText.split(/[.!?]+/).filter((s) => s.trim()).length,
        extractedUnitCount: comparisons.length,
        totalConfiguredWeight: scoreOutcome.totalConfiguredWeight,
        earnedWeightedPoints: scoreOutcome.earnedWeightedPoints,
        stages: [
          {
            name: '1–4. Gemini Semantic Unit Extraction & Alignment',
            summary: `Extracted and aligned ${comparisons.length} critical unit(s) via server-side Gemini model with structured schema.`,
          },
          {
            name: '5–6. Deterministic Weighted Scorer',
            summary: `Calculated ${scoreOutcome.earnedWeightedPoints} / ${scoreOutcome.totalConfiguredWeight} weighted points = ${scoreOutcome.preservationScore}% (never LLM-invented).`,
          },
          {
            name: '7. Mathematical Baseline Comparison',
            summary: `TF-IDF/n-gram cosine similarity = ${baseline.cosineSimilarityPct}%.`,
          },
        ],
      },
    };

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown semantic API error';
    res.json(runFallback(`Gemini semantic assist failed (${message}); used deterministic rule & NLP engine.`));
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MEANLOCK server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
