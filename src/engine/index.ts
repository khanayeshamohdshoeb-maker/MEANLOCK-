import { computeBaselineSimilarity } from './baseline';
import { compareUnitsAgainstTransformed } from './comparator';
import { DEFAULT_PROTOTYPE_WEIGHTS, UNIT_TYPE_LABELS } from './config';
import { extractCriticalUnits } from './extractor';
import { preprocessText } from './preprocess';
import { calculateScoreAndExplanations } from './scorer';
import {
  AnalysisResult,
  CriticalUnitType,
  ExperimentCase,
  ExperimentCaseResult,
  ExperimentMetrics,
  ImportanceWeightConfig,
  LanguageCode,
  MeaningChainResult,
  MeaningChainStageInput,
  MeaningChainStageResult,
  MeaningChainUnitTrack,
  TransformationType,
} from './types';

export interface AnalyzeOptions {
  transformationType?: TransformationType;
  sourceLanguage?: LanguageCode;
  targetLanguage?: LanguageCode;
  weights?: ImportanceWeightConfig;
}

export function analyzeWithDeterministicEngine(
  originalText: string,
  transformedText: string,
  options: AnalyzeOptions = {}
): AnalysisResult {
  const transformationType = options.transformationType ?? 'Summarization';
  const sourceLanguage = options.sourceLanguage ?? 'en';
  const targetLanguage = options.targetLanguage ?? 'en';
  const weights = options.weights ?? DEFAULT_PROTOTYPE_WEIGHTS;

  const origPre = preprocessText(originalText);
  const transPre = preprocessText(transformedText);

  const units = extractCriticalUnits(originalText, weights);
  const comparisons = compareUnitsAgainstTransformed(units, transformedText);
  const scoreOutcome = calculateScoreAndExplanations(comparisons);
  const baseline = computeBaselineSimilarity(originalText, transformedText, comparisons);

  return {
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
      engineUsed: 'Deterministic Rule & NLP Prototype',
      fallbackTriggered: false,
      originalSentenceCount: origPre.sentences.length,
      transformedSentenceCount: transPre.sentences.length,
      extractedUnitCount: units.length,
      totalConfiguredWeight: scoreOutcome.totalConfiguredWeight,
      earnedWeightedPoints: scoreOutcome.earnedWeightedPoints,
      stages: [
        {
          name: '1. Reading & Preprocessing',
          summary: `Normalized whitespace, expanded contractions, and segmented ${origPre.sentences.length} source / ${transPre.sentences.length} transformed sentence(s).`,
        },
        {
          name: '2. Critical Meaning Extraction',
          summary: `Extracted ${units.length} structured critical meaning unit(s) from the source message.`,
        },
        {
          name: '3. Obligations, Dates, Numbers & Negation',
          summary: `Checked modal strengths, normalized dates/times, numeric counts, monetary amounts, conditions, and negation polarity.`,
        },
        {
          name: '4. Semantic & Structural Comparison',
          summary: `Classified ${scoreOutcome.counts.preserved} preserved, ${scoreOutcome.counts.weakened} weakened, ${scoreOutcome.counts.lost} lost, and ${scoreOutcome.counts.changed} changed.`,
        },
        {
          name: '5. Criticality Assessment & Weighting',
          summary: `Flagged ${scoreOutcome.impactBreakdown.veryHighImpact} very-high, ${scoreOutcome.impactBreakdown.highImpact} high, and ${scoreOutcome.impactBreakdown.mediumImpact} medium impact differences (${scoreOutcome.earnedWeightedPoints}/${scoreOutcome.totalConfiguredWeight} pts = ${scoreOutcome.preservationScore}%).`,
        },
        {
          name: '6. Explanation & Baseline Comparison',
          summary: `Computed ${baseline.cosineSimilarityPct}% surface cosine baseline and generated ${scoreOutcome.explanations.length} decision-impact explanation(s).`,
        },
      ],
    },
  };
}

/**
 * Meaning Chain: tracks every extracted critical unit across sequential stages.
 */
export function runMeaningChain(
  originalText: string,
  stages: MeaningChainStageInput[],
  weights: ImportanceWeightConfig = DEFAULT_PROTOTYPE_WEIGHTS
): MeaningChainResult {
  const sourceUnits = extractCriticalUnits(originalText, weights);
  const results: MeaningChainStageResult[] = [];
  let prevScore = 100;
  let prevLabel = 'Source';
  let prevIssues = new Set<string>();
  let biggestDropStageId: string | null = null;
  let biggestDropFromLabel: string | null = null;
  let biggestDropToLabel: string | null = null;
  let biggestDropAmount = 0;

  for (const stage of stages) {
    const analysis = analyzeWithDeterministicEngine(originalText, stage.text, {
      transformationType: stage.transformationType,
      weights,
    });

    const deltaFromPrevious = analysis.preservationScore - prevScore;
    const drop = Math.max(0, prevScore - analysis.preservationScore);

    const currentIssues = new Set(
      analysis.comparisons
        .filter((c) => c.status !== 'PRESERVED')
        .map((c) => `${UNIT_TYPE_LABELS[c.unit.type]}: ${c.unit.originalText} (${c.status})`)
    );

    const newLossesOrChanges = Array.from(currentIssues).filter((x) => !prevIssues.has(x));

    const lostLabels = analysis.comparisons
      .filter((c) => c.status === 'LOST')
      .map((c) => `${UNIT_TYPE_LABELS[c.unit.type]} ("${c.unit.originalText}")`);
    const weakenedLabels = analysis.comparisons
      .filter((c) => c.status === 'WEAKENED')
      .map((c) => `${UNIT_TYPE_LABELS[c.unit.type]} ("${c.unit.originalText}")`);
    const changedLabels = analysis.comparisons
      .filter((c) => c.status === 'CHANGED')
      .map((c) => `${UNIT_TYPE_LABELS[c.unit.type]} ("${c.unit.originalText}")`);

    if (drop > biggestDropAmount) {
      biggestDropAmount = drop;
      biggestDropStageId = stage.id;
      biggestDropFromLabel = prevLabel;
      biggestDropToLabel = stage.label;
    }

    results.push({
      stageId: stage.id,
      label: stage.label,
      transformationType: stage.transformationType,
      text: stage.text,
      score: analysis.preservationScore,
      deltaFromPrevious,
      riskLevel: analysis.riskLevel,
      counts: analysis.counts,
      newLossesOrChanges,
      lostLabels,
      weakenedLabels,
      changedLabels,
      analysis,
    });

    prevScore = analysis.preservationScore;
    prevLabel = stage.label;
    prevIssues = currentIssues;
  }

  // Build unit-by-unit survival matrix across all stages
  const unitTracks: MeaningChainUnitTrack[] = sourceUnits.map((unit) => ({
    unitId: unit.id,
    type: unit.type,
    originalText: unit.originalText,
    statusesByStage: results.map((st) => {
      const match = st.analysis.comparisons.find(
        (c) => c.unit.type === unit.type && c.unit.originalText === unit.originalText
      );
      return {
        stageId: st.stageId,
        status: match?.status ?? 'LOST',
        matchedText: match?.matchedTransformedText ?? null,
      };
    }),
  }));

  return {
    originalText,
    sourceUnits,
    unitTracks,
    stages: results,
    biggestDropStageId,
    biggestDropFromLabel,
    biggestDropToLabel,
    biggestDropAmount,
  };
}

/**
 * Experiment Mode: Runs real batch evaluation over labeled or unlabeled cases.
 * Generates dynamic failure diagnoses and empirical insights ONLY from actual run data.
 */
export function runExperimentBatch(
  cases: ExperimentCase[],
  weights: ImportanceWeightConfig = DEFAULT_PROTOTYPE_WEIGHTS
): ExperimentMetrics {
  const results: ExperimentCaseResult[] = [];
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  let baselineBlindSpots = 0;

  const byTransMap = new Map<
    TransformationType,
    { count: number; scoreSum: number; baseSum: number; issues: number; totalUnits: number; preservedUnits: number }
  >();
  const byUnitMap = new Map<
    CriticalUnitType,
    { total: number; preserved: number; weakened: number; lost: number; changed: number }
  >();

  for (const tc of cases) {
    const analysis = analyzeWithDeterministicEngine(tc.originalText, tc.transformedText, {
      transformationType: tc.transformationType,
      weights,
    });

    const predictedHasCriticalLoss =
      analysis.counts.weakened + analysis.counts.lost + analysis.counts.changed > 0;

    const baselineMissedLoss =
      predictedHasCriticalLoss && analysis.baseline.cosineSimilarityPct >= 65;
    if (baselineMissedLoss) baselineBlindSpots++;

    let outcome: ExperimentCaseResult['outcome'] = 'UNLABELED';
    let failureExplanation: string | undefined;

    if (tc.expectedHasCriticalLoss !== null) {
      if (predictedHasCriticalLoss && tc.expectedHasCriticalLoss) {
        outcome = 'TP';
        tp++;
      } else if (predictedHasCriticalLoss && !tc.expectedHasCriticalLoss) {
        outcome = 'FP';
        fp++;
        const flagged = analysis.explanations.map((e) => `"${e.originalText}" (${e.status})`).join(', ');
        failureExplanation =
          tc.expectedNotes ||
          `False Positive: MEANLOCK flagged ${flagged}, whereas the human label marks meaning as preserved (e.g., surface wording or double-negative structure resolved equivalently).`;
      } else if (!predictedHasCriticalLoss && !tc.expectedHasCriticalLoss) {
        outcome = 'TN';
        tn++;
      } else {
        outcome = 'FN';
        fn++;
        failureExplanation =
          tc.expectedNotes ||
          `False Negative: MEANLOCK predicted all extracted units survived (${analysis.preservationScore}%), missing subtle implied, contextual, or unparsed meaning changes.`;
      }
    }

    const tEntry = byTransMap.get(tc.transformationType) ?? {
      count: 0,
      scoreSum: 0,
      baseSum: 0,
      issues: 0,
      totalUnits: 0,
      preservedUnits: 0,
    };
    tEntry.count++;
    tEntry.scoreSum += analysis.preservationScore;
    tEntry.baseSum += analysis.baseline.cosineSimilarityPct;
    tEntry.issues += analysis.counts.weakened + analysis.counts.lost + analysis.counts.changed;
    tEntry.totalUnits += analysis.counts.total;
    tEntry.preservedUnits += analysis.counts.preserved;
    byTransMap.set(tc.transformationType, tEntry);

    for (const comp of analysis.comparisons) {
      const uEntry = byUnitMap.get(comp.unit.type) ?? {
        total: 0,
        preserved: 0,
        weakened: 0,
        lost: 0,
        changed: 0,
      };
      uEntry.total++;
      if (comp.status === 'PRESERVED') uEntry.preserved++;
      if (comp.status === 'WEAKENED') uEntry.weakened++;
      if (comp.status === 'LOST') uEntry.lost++;
      if (comp.status === 'CHANGED') uEntry.changed++;
      byUnitMap.set(comp.unit.type, uEntry);
    }

    results.push({
      testCase: tc,
      analysis,
      predictedHasCriticalLoss,
      baselineMissedLoss,
      outcome,
      failureExplanation,
    });
  }

  const evaluatedCount = results.length;
  const labeledCount = tp + fp + tn + fn;

  const meanPreservationScore =
    evaluatedCount > 0
      ? Math.round(results.reduce((s, r) => s + r.analysis.preservationScore, 0) / evaluatedCount)
      : 0;

  const meanBaselineSimilarity =
    evaluatedCount > 0
      ? Math.round(results.reduce((s, r) => s + r.analysis.baseline.cosineSimilarityPct, 0) / evaluatedCount)
      : 0;

  const totalUnits = Array.from(byUnitMap.values()).reduce((s, v) => s + v.total, 0);
  const totalPreservedUnits = Array.from(byUnitMap.values()).reduce((s, v) => s + v.preserved, 0);
  const preservationRatePct = totalUnits > 0 ? Math.round((totalPreservedUnits / totalUnits) * 100) : 0;

  const precision = tp + fp > 0 ? Number((tp / (tp + fp)).toFixed(3)) : null;
  const recall = tp + fn > 0 ? Number((tp / (tp + fn)).toFixed(3)) : null;
  const f1 =
    precision !== null && recall !== null && precision + recall > 0
      ? Number(((2 * precision * recall) / (precision + recall)).toFixed(3))
      : null;

  const byTransformationType = Array.from(byTransMap.entries()).map(([type, data]) => ({
    type,
    count: data.count,
    avgScore: Math.round(data.scoreSum / data.count),
    avgBaseline: Math.round(data.baseSum / data.count),
    preservationRatePct:
      data.totalUnits > 0 ? Math.round((data.preservedUnits / data.totalUnits) * 100) : 0,
    criticalIssuesDetected: data.issues,
  }));

  const byUnitType = Array.from(byUnitMap.entries()).map(([unitType, data]) => ({
    unitType,
    ...data,
  }));

  // Synthesize empirical insights strictly from observed batch numbers
  const insights: string[] = [];
  if (evaluatedCount < 3 || totalUnits === 0) {
    insights.push('More evaluation data is needed to identify reliable patterns.');
  } else {
    const worstUnit = [...byUnitType]
      .filter((u) => u.total >= 2)
      .sort(
        (a, b) =>
          (b.lost + b.changed + b.weakened) / b.total -
          (a.lost + a.changed + a.weakened) / a.total
      )[0];

    if (worstUnit) {
      const affected = worstUnit.lost + worstUnit.changed + worstUnit.weakened;
      const pct = Math.round((affected / worstUnit.total) * 100);
      insights.push(
        `In this ${evaluatedCount}-case evaluation run, ${UNIT_TYPE_LABELS[worstUnit.unitType]} had the highest degradation rate (${affected}/${worstUnit.total} units affected, ${pct}%).`
      );
    }

    const worstTransform = [...byTransformationType]
      .filter((t) => t.count >= 2)
      .sort((a, b) => a.avgScore - b.avgScore)[0];
    const bestTransform = [...byTransformationType]
      .filter((t) => t.count >= 2)
      .sort((a, b) => b.avgScore - a.avgScore)[0];

    if (worstTransform && bestTransform && worstTransform.type !== bestTransform.type) {
      insights.push(
        `${worstTransform.type} averaged ${worstTransform.avgScore}% critical meaning integrity compared to ${bestTransform.avgScore}% for ${bestTransform.type}.`
      );
    }

    if (baselineBlindSpots > 0) {
      insights.push(
        `The bag-of-words cosine baseline scored ≥65% surface similarity on ${baselineBlindSpots} case(s) where MEANLOCK detected critical meaning loss.`
      );
    }

    if (fp + fn > 0) {
      insights.push(
        `MEANLOCK produced ${fp} false positive(s) and ${fn} false negative(s) on labeled cases — inspect the Failure Analysis section below for root causes.`
      );
    }
  }

  return {
    evaluatedCount,
    labeledCount,
    meanPreservationScore,
    meanBaselineSimilarity,
    preservationRatePct,
    precision,
    recall,
    f1,
    falsePositives: fp,
    falseNegatives: fn,
    truePositives: tp,
    trueNegatives: tn,
    baselineBlindSpots,
    insights,
    byTransformationType,
    byUnitType,
    results,
  };
}

export function exportExperimentCsv(metrics: ExperimentMetrics): string {
  const headers = [
    'ID',
    'Title',
    'Domain',
    'TransformationType',
    'MeanlockScorePct',
    'RiskLevel',
    'BaselineCosinePct',
    'UnitsTotal',
    'Preserved',
    'Weakened',
    'Lost',
    'Changed',
    'ExpectedCriticalLoss',
    'PredictedCriticalLoss',
    'ConfusionOutcome',
    'BaselineBlindSpot',
  ];

  const escapeCsv = (val: string | number | boolean | null) => {
    const str = val === null ? '' : String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const rows = metrics.results.map((r) =>
    [
      r.testCase.id,
      r.testCase.title,
      r.testCase.domain,
      r.testCase.transformationType,
      r.analysis.preservationScore,
      r.analysis.riskLevel,
      r.analysis.baseline.cosineSimilarityPct,
      r.analysis.counts.total,
      r.analysis.counts.preserved,
      r.analysis.counts.weakened,
      r.analysis.counts.lost,
      r.analysis.counts.changed,
      r.testCase.expectedHasCriticalLoss,
      r.predictedHasCriticalLoss,
      r.outcome,
      r.baselineMissedLoss,
    ]
      .map(escapeCsv)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}
