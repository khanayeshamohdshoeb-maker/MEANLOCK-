import { STATUS_SCORE_MULTIPLIER, UNIT_TYPE_LABELS } from './config';
import { AnalysisResult, ChangeExplanation, RiskLevel, UnitComparison } from './types';

export interface ScoreOutcome {
  preservationScore: number;
  scoreExplanation: string;
  totalConfiguredWeight: number;
  earnedWeightedPoints: number;
  riskLevel: RiskLevel;
  riskAdvisory: string;
  counts: AnalysisResult['counts'];
  impactBreakdown: AnalysisResult['impactBreakdown'];
  explanations: ChangeExplanation[];
}

export function calculateScoreAndExplanations(comparisons: UnitComparison[]): ScoreOutcome {
  const total = comparisons.length;
  const preserved = comparisons.filter((c) => c.status === 'PRESERVED').length;
  const weakened = comparisons.filter((c) => c.status === 'WEAKENED').length;
  const lost = comparisons.filter((c) => c.status === 'LOST').length;
  const changed = comparisons.filter((c) => c.status === 'CHANGED').length;

  const nonPreserved = comparisons.filter((c) => c.status !== 'PRESERVED');
  const veryHighImpact = nonPreserved.filter((c) => c.decisionImpact === 'VERY HIGH').length;
  const highImpact = nonPreserved.filter((c) => c.decisionImpact === 'HIGH').length;
  const mediumImpact = nonPreserved.filter((c) => c.decisionImpact === 'MEDIUM').length;
  const lowImpact = nonPreserved.filter((c) => c.decisionImpact === 'LOW').length;

  let totalConfiguredWeight = 0;
  let earnedWeightedPoints = 0;

  for (const comp of comparisons) {
    const w = comp.unit.weight;
    const mult = STATUS_SCORE_MULTIPLIER[comp.status];
    totalConfiguredWeight += w;
    earnedWeightedPoints += w * mult;
  }

  const preservationScore =
    totalConfiguredWeight > 0 ? Math.round((earnedWeightedPoints / totalConfiguredWeight) * 100) : 100;

  const criticalNegationOrWarningBroken = comparisons.some(
    (c) =>
      (c.unit.type === 'NEGATION' || c.unit.type === 'WARNING' || c.isNegationReversal) &&
      (c.status === 'LOST' || c.status === 'CHANGED')
  );
  const hasHighWeightLossOrChange = comparisons.some(
    (c) => c.unit.importance === 'HIGH' && (c.status === 'LOST' || c.status === 'CHANGED')
  );

  let riskLevel: RiskLevel;
  let riskAdvisory: string;

  if (criticalNegationOrWarningBroken || preservationScore < 60 || lost + changed >= 3) {
    riskLevel = 'HIGH RISK';
    riskAdvisory =
      'MEANLOCK detected potentially important meaning changes. Review the original message before making a decision.';
  } else if (preservationScore < 85 || weakened > 0 || lost > 0 || changed > 0 || hasHighWeightLossOrChange) {
    riskLevel = 'REVIEW NEEDED';
    riskAdvisory =
      'MEANLOCK detected potentially important meaning changes. Review the original message before making a decision.';
  } else {
    riskLevel = 'LOW RISK';
    riskAdvisory =
      'All detected decision-critical units were preserved in this analysis. Still verify critical notices against the original source when stakes are high.';
  }

  // Dynamic score explanation (never show score without explaining why)
  const severeCount = veryHighImpact + highImpact;
  let scoreExplanation: string;
  if (nonPreserved.length === 0) {
    scoreExplanation = `All ${total} extracted critical meaning unit(s) survived without loss or weakening.`;
  } else if (severeCount > 0) {
    scoreExplanation = `MEANLOCK detected ${severeCount} high-impact ${
      severeCount === 1 ? 'change' : 'changes'
    }${
      mediumImpact > 0 ? ` and ${mediumImpact} medium-impact change${mediumImpact === 1 ? '' : 's'}` : ''
    } that may alter what the reader believes they need to do.`;
  } else {
    scoreExplanation = `MEANLOCK detected ${nonPreserved.length} ${
      nonPreserved.length === 1 ? 'change' : 'changes'
    } of medium or low decision impact.`;
  }

  // Sort changes by Decision Impact then status severity then weight
  const impactRank: Record<string, number> = {
    'VERY HIGH': 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };
  const severityRank: Record<string, number> = {
    CHANGED: 3,
    LOST: 2,
    WEAKENED: 1,
    PRESERVED: 0,
  };

  const issues = [...nonPreserved].sort((a, b) => {
    const impDiff = impactRank[b.decisionImpact] - impactRank[a.decisionImpact];
    if (impDiff !== 0) return impDiff;
    const sevDiff = severityRank[b.status] - severityRank[a.status];
    if (sevDiff !== 0) return sevDiff;
    return b.unit.weight - a.unit.weight;
  });

  const explanations: ChangeExplanation[] = issues.map((item, idx) => {
    const label = UNIT_TYPE_LABELS[item.unit.type];
    const verb =
      item.status === 'LOST'
        ? 'LOST'
        : item.status === 'WEAKENED'
        ? 'WEAKENED'
        : 'CHANGED';

    return {
      index: idx + 1,
      title: `${label.toUpperCase()} ${verb}`,
      status: item.status,
      decisionImpact: item.decisionImpact,
      unitType: item.unit.type,
      originalText: item.unit.originalText,
      transformedText: item.matchedTransformedText,
      impactSummary: item.reason,
      whyThisMatters: item.whyThisMatters,
      detail: item.reason,
    };
  });

  return {
    preservationScore,
    scoreExplanation,
    totalConfiguredWeight: Number(totalConfiguredWeight.toFixed(2)),
    earnedWeightedPoints: Number(earnedWeightedPoints.toFixed(2)),
    riskLevel,
    riskAdvisory,
    counts: {
      total,
      preserved,
      weakened,
      lost,
      changed,
    },
    impactBreakdown: {
      veryHighImpact,
      highImpact,
      mediumImpact,
      lowImpact,
      preserved,
    },
    explanations,
  };
}
