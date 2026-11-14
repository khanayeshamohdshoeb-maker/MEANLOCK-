export type CriticalUnitType =
  | 'WHO'
  | 'OBLIGATION'
  | 'PERMISSION'
  | 'NEGATION'
  | 'DEADLINE'
  | 'DATE'
  | 'TIME'
  | 'QUANTITY'
  | 'MONEY'
  | 'DOCUMENT'
  | 'CONDITION'
  | 'EXCEPTION'
  | 'WARNING'
  | 'CONSEQUENCE'
  | 'ACTION'
  | 'LOCATION'
  | 'CONTACT';

export type UnitStatus = 'PRESERVED' | 'WEAKENED' | 'LOST' | 'CHANGED';

export type DecisionImpact = 'VERY HIGH' | 'HIGH' | 'MEDIUM' | 'LOW';

export type RiskLevel = 'LOW RISK' | 'REVIEW NEEDED' | 'HIGH RISK';

export type TransformationType =
  | 'Translation'
  | 'Summarization'
  | 'Simplification'
  | 'Rewriting'
  | 'Forwarded / Edited'
  | 'Other';

export type AnalysisEngineMode = 'deterministic' | 'gemini-hybrid';

export type LanguageCode = 'en' | 'hi' | 'ur' | 'mr';

export interface LanguageSupport {
  code: LanguageCode;
  label: string;
  status: 'supported' | 'planned';
  note: string;
}

export interface ImportanceWeightConfig {
  HIGH: number;
  MEDIUM: number;
  LOW: number;
  byType: Record<CriticalUnitType, number>;
}

export interface PreprocessedText {
  raw: string;
  normalized: string;
  expanded: string;
  sentences: string[];
  tokens: string[];
}

export interface CriticalUnit {
  id: string;
  type: CriticalUnitType;
  importance: 'HIGH' | 'MEDIUM' | 'LOW';
  weight: number;
  originalText: string;
  sentence: string;
  sentenceIndex: number;
  metadata?: {
    modalStrength?: number; // 3 = mandatory, 2 = advisory, 1 = permissive, -3 = prohibited
    polarity?: 'positive' | 'negative' | 'restrictive';
    numericValue?: string;
    normalizedDate?: string;
    normalizedTime?: string;
    coreTerms?: string[];
  };
}

export interface UnitComparison {
  unit: CriticalUnit;
  matchedTransformedText: string | null;
  status: UnitStatus;
  decisionImpact: DecisionImpact;
  isNegationReversal?: boolean;
  reason: string;
  whyThisMatters: string;
  whyItMatters: string;
  confidence: 'rule-exact' | 'rule-heuristic' | 'semantic-assist';
}

export interface BaselineSimilarity {
  cosineSimilarityPct: number;
  jaccardOverlapPct: number;
  methodLabel: string;
  contrastSummary: string;
}

export interface PipelineTrace {
  engineUsed: 'Deterministic Rule & NLP Prototype' | 'Gemini Semantic Assist + Rule Scorer';
  fallbackTriggered: boolean;
  fallbackReason?: string;
  originalSentenceCount: number;
  transformedSentenceCount: number;
  extractedUnitCount: number;
  totalConfiguredWeight: number;
  earnedWeightedPoints: number;
  stages: {
    name: string;
    summary: string;
  }[];
}

export interface ChangeExplanation {
  index: number;
  title: string;
  status: UnitStatus;
  decisionImpact: DecisionImpact;
  unitType: CriticalUnitType;
  originalText: string;
  transformedText: string | null;
  impactSummary: string;
  whyThisMatters: string;
  detail: string;
}

export interface AnalysisResult {
  originalText: string;
  transformedText: string;
  preservationScore: number;
  scoreExplanation: string;
  riskLevel: RiskLevel;
  riskAdvisory: string;
  counts: {
    total: number;
    preserved: number;
    weakened: number;
    lost: number;
    changed: number;
  };
  impactBreakdown: {
    veryHighImpact: number;
    highImpact: number;
    mediumImpact: number;
    lowImpact: number;
    preserved: number;
  };
  comparisons: UnitComparison[];
  explanations: ChangeExplanation[];
  baseline: BaselineSimilarity;
  trace: PipelineTrace;
  transformationType: TransformationType;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
}

export interface MeaningChainStageInput {
  id: string;
  label: string;
  transformationType: TransformationType;
  text: string;
}

export interface MeaningChainStageResult {
  stageId: string;
  label: string;
  transformationType: TransformationType;
  text: string;
  score: number;
  deltaFromPrevious: number;
  riskLevel: RiskLevel;
  counts: AnalysisResult['counts'];
  newLossesOrChanges: string[];
  lostLabels: string[];
  weakenedLabels: string[];
  changedLabels: string[];
  analysis: AnalysisResult;
}

export interface MeaningChainUnitTrack {
  unitId: string;
  type: CriticalUnitType;
  originalText: string;
  statusesByStage: {
    stageId: string;
    status: UnitStatus;
    matchedText: string | null;
  }[];
}

export interface MeaningChainResult {
  originalText: string;
  sourceUnits: CriticalUnit[];
  unitTracks: MeaningChainUnitTrack[];
  stages: MeaningChainStageResult[];
  biggestDropStageId: string | null;
  biggestDropFromLabel: string | null;
  biggestDropToLabel: string | null;
  biggestDropAmount: number;
}

export interface ExperimentCase {
  id: string;
  title: string;
  domain: string;
  transformationType: TransformationType;
  originalText: string;
  transformedText: string;
  expectedCriticalUnits?: string[];
  expectedStatusLabel?: UnitStatus;
  expectedHasCriticalLoss: boolean | null;
  expectedNotes?: string;
}

export interface ExperimentCaseResult {
  testCase: ExperimentCase;
  analysis: AnalysisResult;
  predictedHasCriticalLoss: boolean;
  baselineMissedLoss: boolean;
  outcome: 'TP' | 'FP' | 'TN' | 'FN' | 'UNLABELED';
  failureExplanation?: string;
}

export interface ExperimentMetrics {
  evaluatedCount: number;
  labeledCount: number;
  meanPreservationScore: number;
  meanBaselineSimilarity: number;
  preservationRatePct: number;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  falsePositives: number;
  falseNegatives: number;
  truePositives: number;
  trueNegatives: number;
  baselineBlindSpots: number;
  insights: string[];
  byTransformationType: {
    type: TransformationType;
    count: number;
    avgScore: number;
    avgBaseline: number;
    preservationRatePct: number;
    criticalIssuesDetected: number;
  }[];
  byUnitType: {
    unitType: CriticalUnitType;
    total: number;
    preserved: number;
    weakened: number;
    lost: number;
    changed: number;
  }[];
  results: ExperimentCaseResult[];
}
