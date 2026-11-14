import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import {
  LANGUAGE_REGISTRY,
  STATUS_SCORE_MULTIPLIER,
  UNIT_IMPORTANCE_TIER,
  UNIT_TYPE_LABELS,
} from '../engine/config';
import { DEMO_SCENARIOS } from '../engine/demos';
import { extractCriticalUnits } from '../engine/extractor';
import {
  AnalysisEngineMode,
  AnalysisResult,
  CriticalUnit,
  CriticalUnitType,
  ImportanceWeightConfig,
  LanguageCode,
  TransformationType,
} from '../engine/types';
import { ImpactLabel, RiskIndicator, SegmentedScoreBar, StatusIndicator } from './StatusVisuals';

interface AnalyzeViewProps {
  viewMode: 'workspace' | 'results';
  originalText: string;
  transformedText: string;
  transformationType: TransformationType;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  engineMode: AnalysisEngineMode;
  geminiAvailable: boolean;
  weights: ImportanceWeightConfig;
  result: AnalysisResult | null;
  isAnalyzing: boolean;
  analysisStepIndex: number;
  analysisStepDetail: string | null;
  errorMsg: string | null;
  onBackToWorkspace: () => void;
  onChangeOriginal: (val: string) => void;
  onChangeTransformed: (val: string) => void;
  onChangeTransformationType: (val: TransformationType) => void;
  onChangeTargetLanguage: (val: LanguageCode) => void;
  onChangeEngineMode: (val: AnalysisEngineMode) => void;
  onPopulateDemo: (demoId: string) => void;
  onClear: () => void;
  onAnalyze: () => void;
  onUpdateWeight: (type: CriticalUnitType, value: number) => void;
  onResetWeights: () => void;
}

const TRANSFORMATION_TYPES: TransformationType[] = [
  'Translation',
  'Summarization',
  'Simplification',
  'Rewriting',
  'Forwarded / Edited',
  'Other',
];

export const ANALYSIS_STEPS = [
  'Reading source message',
  'Extracting critical meaning units',
  'Checking obligations, dates, numbers & conditions',
  'Comparing transformed meaning',
  'Assessing criticality',
  'Generating explanation',
];

interface FocusCategory {
  id: string;
  label: string;
  types: CriticalUnitType[];
}

const FOCUS_CATEGORIES: FocusCategory[] = [
  { id: 'obligations', label: 'Obligations', types: ['OBLIGATION', 'PERMISSION'] },
  { id: 'deadlines', label: 'Deadlines', types: ['DEADLINE', 'DATE', 'TIME'] },
  { id: 'numbers', label: 'Numbers', types: ['QUANTITY', 'MONEY'] },
  { id: 'negation', label: 'Negation', types: ['NEGATION', 'EXCEPTION'] },
  { id: 'conditions', label: 'Conditions', types: ['CONDITION'] },
  { id: 'consequences', label: 'Consequences', types: ['CONSEQUENCE', 'WARNING'] },
  { id: 'actions', label: 'Required actions', types: ['DOCUMENT', 'ACTION', 'LOCATION', 'CONTACT'] },
];

export function AnalyzeView({
  viewMode,
  originalText,
  transformedText,
  transformationType,
  sourceLanguage,
  targetLanguage,
  engineMode,
  geminiAvailable,
  weights,
  result,
  isAnalyzing,
  analysisStepIndex,
  analysisStepDetail,
  errorMsg,
  onBackToWorkspace,
  onChangeOriginal,
  onChangeTransformed,
  onChangeTransformationType,
  onChangeTargetLanguage,
  onChangeEngineMode,
  onPopulateDemo,
  onClear,
  onAnalyze,
  onUpdateWeight,
  onResetWeights,
}: AnalyzeViewProps) {
  const [selectedFocusId, setSelectedFocusId] = useState<string | null>('obligations');
  const [diffFilter, setDiffFilter] = useState<'all' | 'changes' | 'high'>('all');
  const [showTechTable, setShowTechTable] = useState(false);
  const [showWeightEditor, setShowWeightEditor] = useState(false);

  const liveUnits = useMemo<CriticalUnit[]>(() => {
    if (!originalText.trim()) return [];
    return extractCriticalUnits(originalText, weights);
  }, [originalText, weights]);

  const focusedCategory = FOCUS_CATEGORIES.find((c) => c.id === selectedFocusId) ?? null;
  const focusedLiveUnits = focusedCategory
    ? liveUnits.filter((u) => focusedCategory.types.includes(u.type))
    : [];

  const handleExportJson = () => {
    if (!result) return;
    const payload = {
      generatedAt: new Date().toISOString(),
      transformationType: result.transformationType,
      engineUsed: result.trace.engineUsed,
      originalText: result.originalText,
      transformedText: result.transformedText,
      meaningIntegrityPct: result.preservationScore,
      riskLevel: result.riskLevel,
      scoreExplanation: result.scoreExplanation,
      baselineCosineSimilarityPct: result.baseline.cosineSimilarityPct,
      criticalityBreakdown: result.impactBreakdown,
      criticalUnits: result.comparisons.map((c) => ({
        type: c.unit.type,
        original: c.unit.originalText,
        transformed: c.matchedTransformedText,
        status: c.status,
        decisionImpact: c.decisionImpact,
        weight: c.unit.weight,
        impactSummary: c.reason,
        whyThisMatters: c.whyThisMatters,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meanlock_analysis_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportReport = () => {
    if (!result) return;
    const lines = [
      'MEANLOCK — CRITICAL MEANING ANALYSIS REPORT',
      `Generated: ${new Date().toISOString()}`,
      `Transformation: ${result.transformationType}`,
      `Engine: ${result.trace.engineUsed}`,
      '',
      `MEANING INTEGRITY: ${result.preservationScore}% (${result.riskLevel})`,
      `TEXT SIMILARITY BASELINE (${result.baseline.methodLabel}): ${result.baseline.cosineSimilarityPct}%`,
      `Summary: ${result.scoreExplanation}`,
      '',
      '--- SOURCE MESSAGE ---',
      result.originalText,
      '',
      '--- TRANSFORMED MESSAGE ---',
      result.transformedText,
      '',
      '--- CRITICAL UNITS & CHANGES ---',
      ...result.comparisons.map(
        (c, i) =>
          `${i + 1}. [${c.status} | ${c.decisionImpact} IMPACT] ${UNIT_TYPE_LABELS[c.unit.type]}\n   Original: "${c.unit.originalText}"\n   Transformed: "${c.matchedTransformedText ?? 'missing'}"\n   Impact: ${c.reason}\n   Why this matters: ${c.whyThisMatters}`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meanlock_report_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ============================================================================
  // STATE 2: DEDICATED INVESTIGATION RESULTS VIEW
  // ============================================================================
  if (viewMode === 'results' && result) {
    const filteredComparisons = result.comparisons.filter((c) => {
      if (diffFilter === 'changes') return c.status !== 'PRESERVED';
      if (diffFilter === 'high')
        return c.decisionImpact === 'VERY HIGH' || c.decisionImpact === 'HIGH';
      return true;
    });

    const highTypes = (Object.keys(weights.byType) as CriticalUnitType[]).filter(
      (t) => UNIT_IMPORTANCE_TIER[t] === 'HIGH'
    );
    const mediumTypes = (Object.keys(weights.byType) as CriticalUnitType[]).filter(
      (t) => UNIT_IMPORTANCE_TIER[t] === 'MEDIUM'
    );

    const highPlusVeryHigh =
      result.impactBreakdown.veryHighImpact + result.impactBreakdown.highImpact;

    return (
      <div className="space-y-7 pb-8">
        {/* Top Action & Export Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <button
            type="button"
            onClick={onBackToWorkspace}
            className="inline-flex items-center gap-2 min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-800 hover:bg-slate-50 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Edit Messages</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportReport}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export Report (.txt)</span>
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export JSON</span>
            </button>
          </div>
        </div>

        {result.trace.fallbackTriggered && result.trace.fallbackReason && (
          <div className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-700">
            <strong>Engine Fallback Note:</strong> {result.trace.fallbackReason}
          </div>
        )}

        {/* 1. MEANING INTEGRITY + CRITICALITY BREAKDOWN + TWO WAYS TO COMPARE */}
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            {/* Meaning Integrity & Criticality Breakdown */}
            <div className="lg:col-span-7 p-6 sm:p-7 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-bold tracking-wider uppercase text-slate-500">
                  Meaning Integrity Result
                </span>
                <RiskIndicator risk={result.riskLevel} />
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl font-bold font-mono tabular-nums tracking-tight text-slate-900">
                    {result.preservationScore}%
                  </span>
                  <span className="text-base font-semibold text-slate-700">
                    Meaning Integrity
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-900 leading-relaxed">
                  {result.scoreExplanation}
                </p>
              </div>

              <SegmentedScoreBar score={result.preservationScore} segments={24} />

              {/* Criticality Breakdown */}
              <div className="pt-2 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold tracking-wide uppercase text-slate-500">
                    Critical Information
                  </span>
                  <span className="font-mono tabular-nums text-slate-600">
                    {result.counts.total} unit{result.counts.total === 1 ? '' : 's'} detected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 flex items-center justify-between">
                    <span className="text-xs font-bold text-red-800">HIGH / VERY HIGH IMPACT</span>
                    <span className="text-lg font-bold font-mono tabular-nums text-red-700">
                      {highPlusVeryHigh}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-800">MEDIUM IMPACT</span>
                    <span className="text-lg font-bold font-mono tabular-nums text-amber-700">
                      {result.impactBreakdown.mediumImpact}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800">PRESERVED</span>
                    <span className="text-lg font-bold font-mono tabular-nums text-emerald-700">
                      {result.impactBreakdown.preserved}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-600 pt-1">
                {result.riskAdvisory}{' '}
                <span className="text-slate-500">
                  (Informational verification only — not legal, medical, or financial advice.)
                </span>
              </p>
            </div>

            {/* Two Ways to Compare Messages */}
            <div className="lg:col-span-5 p-6 sm:p-7 bg-slate-50/60 flex flex-col justify-between space-y-5">
              <div className="space-y-1">
                <div className="text-xs font-bold tracking-wider uppercase text-slate-500">
                  Two ways to compare messages
                </div>
                <div className="text-xs text-slate-600">
                  Does ordinary similarity miss critical meaning changes?
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl bg-white border border-slate-200 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">
                      Surface Similarity ({result.baseline.methodLabel})
                    </span>
                    <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
                      {result.baseline.cosineSimilarityPct}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-slate-600 rounded-full"
                      style={{ width: `${result.baseline.cosineSimilarityPct}%` }}
                    />
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-slate-500">
                    Jaccard token overlap: {result.baseline.jaccardOverlapPct}%
                  </div>
                </div>

                <div className="rounded-xl bg-white border border-slate-200 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900">
                      Critical Meaning Integrity (MEANLOCK)
                    </span>
                    <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
                      {result.preservationScore}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        result.preservationScore >= 85
                          ? 'bg-emerald-600'
                          : result.preservationScore >= 60
                          ? 'bg-amber-500'
                          : 'bg-red-600'
                      }`}
                      style={{ width: `${result.preservationScore}%` }}
                    />
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-slate-500">
                    {result.counts.preserved} preserved · {result.counts.weakened} weakened ·{' '}
                    {result.counts.lost} lost · {result.counts.changed} changed
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed">
                {result.baseline.contrastSummary}
              </p>
            </div>
          </div>
        </section>

        {/* 2. EXTRACTED CRITICAL MEANING UNITS (STRUCTURED SOURCE MODEL) */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Extracted Critical Meaning Units (Source Blueprint)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Structured decision-critical facts MEANLOCK extracted from the source message before comparing.
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {result.comparisons.length} units · {result.transformationType}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {result.comparisons.map((c) => (
              <div
                key={c.unit.id}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold tracking-wide uppercase text-slate-500">
                    {UNIT_TYPE_LABELS[c.unit.type]}
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-slate-400">
                    w={c.unit.weight.toFixed(1)}
                  </span>
                </div>
                <div className="text-sm font-semibold text-slate-900 leading-snug">
                  {c.unit.originalText}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. SIDE-BY-SIDE SOURCE VS TRANSFORMED + CONNECTED UNIT ALIGNMENT */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Side-by-Side Comparison & Unit Alignment
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Source vs. Transformed message with direct visual mapping of every critical unit.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1.5">
              <div className="text-xs font-bold tracking-wider uppercase text-slate-500">
                SOURCE
              </div>
              <p className="text-sm text-slate-900 leading-relaxed">{result.originalText}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1.5">
              <div className="text-xs font-bold tracking-wider uppercase text-slate-500">
                TRANSFORMED ({result.transformationType})
              </div>
              <p className="text-sm text-slate-900 leading-relaxed">{result.transformedText}</p>
            </div>
          </div>

          {/* Connected Critical Unit Lines */}
          <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
            {result.comparisons.map((item) => (
              <div
                key={item.unit.id}
                className="p-3.5 sm:px-4 grid grid-cols-1 md:grid-cols-12 gap-2.5 md:items-center bg-white"
              >
                <div className="md:col-span-2 text-[11px] font-bold tracking-wide uppercase text-slate-500">
                  {UNIT_TYPE_LABELS[item.unit.type]}
                </div>
                <div className="md:col-span-3 text-sm font-medium text-slate-900">
                  {item.unit.originalText}
                </div>
                <div className="hidden md:flex md:col-span-1 items-center justify-center text-slate-400">
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="md:col-span-3 text-sm">
                  {item.matchedTransformedText ? (
                    <span className="text-slate-800">{item.matchedTransformedText}</span>
                  ) : (
                    <span className="font-mono text-xs font-semibold text-red-700">missing</span>
                  )}
                </div>
                <div className="md:col-span-3 flex flex-wrap items-center md:justify-end gap-3">
                  <StatusIndicator status={item.status} />
                  {item.status !== 'PRESERVED' && <ImpactLabel impact={item.decisionImpact} />}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 4. MEANING DIFFERENCE VISUALIZATION: WHAT CHANGED? + WHY THIS MATTERS */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">What changed?</h2>
              <p className="text-sm text-slate-600">
                Compact decision-impact cards explaining each difference and why it matters to a reader.
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setDiffFilter('all')}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  diffFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({result.comparisons.length})
              </button>
              <button
                type="button"
                onClick={() => setDiffFilter('changes')}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  diffFilter === 'changes'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Changed/Lost ({result.counts.weakened + result.counts.lost + result.counts.changed})
              </button>
              <button
                type="button"
                onClick={() => setDiffFilter('high')}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  diffFilter === 'high'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                High Impact
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredComparisons.map((item) => {
              const cardBorder =
                item.status === 'LOST'
                  ? 'border-red-200'
                  : item.status === 'CHANGED'
                  ? 'border-orange-200'
                  : item.status === 'WEAKENED'
                  ? 'border-amber-200'
                  : 'border-slate-200';
              const actionWord =
                item.status === 'PRESERVED'
                  ? 'PRESERVED'
                  : item.status === 'WEAKENED'
                  ? 'WEAKENED'
                  : item.status === 'LOST'
                  ? 'LOST'
                  : 'CHANGED';

              return (
                <article
                  key={item.unit.id}
                  className={`bg-white border ${cardBorder} rounded-2xl p-5 flex flex-col justify-between space-y-4`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold tracking-wide uppercase text-slate-900">
                        {UNIT_TYPE_LABELS[item.unit.type].toUpperCase()} {actionWord}
                      </div>
                      <ImpactLabel impact={item.decisionImpact} />
                    </div>
                    <StatusIndicator status={item.status} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                      <div className="text-[11px] font-semibold text-slate-500 mb-1">Original</div>
                      <div className="text-sm font-medium text-slate-900 leading-snug">
                        {item.unit.originalText}
                      </div>
                    </div>
                    <div
                      className={`rounded-xl border p-3 ${
                        item.status === 'LOST'
                          ? 'bg-red-50/50 border-red-200'
                          : item.status === 'CHANGED'
                          ? 'bg-orange-50/50 border-orange-200'
                          : item.status === 'WEAKENED'
                          ? 'bg-amber-50/50 border-amber-200'
                          : 'bg-emerald-50/40 border-emerald-200'
                      }`}
                    >
                      <div className="text-[11px] font-semibold text-slate-500 mb-1">Transformed</div>
                      <div className="text-sm font-medium text-slate-900 leading-snug">
                        {item.matchedTransformedText ?? (
                          <span className="font-mono text-red-700">—</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="font-bold text-slate-900">Impact: </span>
                      <span className="text-slate-700">{item.reason}</span>
                    </div>
                    {item.status !== 'PRESERVED' && (
                      <div className="rounded-lg bg-slate-50 p-3 text-slate-700 leading-relaxed">
                        <span className="font-bold text-slate-900 block mb-0.5">
                          Why this matters
                        </span>
                        {item.whyThisMatters}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* 5. HOW WE CALCULATED THIS + CONFIGURABLE WEIGHTS + TECHNICAL TABLE */}
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">How we calculated this</h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Configurable prototype weights emphasize obligations, negations, deadlines, monetary amounts, and consequences over ordinary filler words.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowWeightEditor((v) => !v)}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer shrink-0"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{showWeightEditor ? 'Hide Weight Controls' : 'Configure Prototype Weights'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-1.5">
                <div className="text-xs font-semibold text-slate-900">High Criticality</div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {highTypes.map((t) => UNIT_TYPE_LABELS[t]).join(' · ')}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-1.5">
                <div className="text-xs font-semibold text-slate-900">Medium Criticality</div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {mediumTypes.map((t) => UNIT_TYPE_LABELS[t]).join(' · ')}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-1.5">
                <div className="text-xs font-semibold text-slate-900">Transparent Formula</div>
                <p className="text-xs font-mono tabular-nums text-slate-800">
                  {result.trace.earnedWeightedPoints} earned / {result.trace.totalConfiguredWeight} max ={' '}
                  <strong>{result.preservationScore}%</strong>
                </p>
                <p className="text-[11px] text-slate-500">
                  Multipliers: Preserved {STATUS_SCORE_MULTIPLIER.PRESERVED}, Weakened{' '}
                  {STATUS_SCORE_MULTIPLIER.WEAKENED}, Changed {STATUS_SCORE_MULTIPLIER.CHANGED}, Lost{' '}
                  {STATUS_SCORE_MULTIPLIER.LOST}. Prototype weights — not scientifically validated.
                </p>
              </div>
            </div>

            {showWeightEditor && (
              <div className="pt-4 border-t border-slate-200 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800">
                    Adjust Prototype Weights & Re-Analyze
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={onResetWeights}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Reset Defaults</span>
                    </button>
                    <button
                      type="button"
                      onClick={onAnalyze}
                      className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
                    >
                      Recalculate Score
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  {(Object.keys(weights.byType) as CriticalUnitType[]).map((unitType) => (
                    <label
                      key={unitType}
                      className="flex flex-col justify-between gap-1 rounded-lg border border-slate-200 p-2.5 text-xs"
                    >
                      <span className="font-medium text-slate-700 truncate">
                        {UNIT_TYPE_LABELS[unitType]}
                      </span>
                      <input
                        type="number"
                        min={0.5}
                        max={5}
                        step={0.5}
                        value={weights.byType[unitType]}
                        onChange={(e) => {
                          const parsed = parseFloat(e.target.value);
                          if (!Number.isNaN(parsed)) {
                            onUpdateWeight(unitType, Math.max(0.5, Math.min(5, parsed)));
                          }
                        }}
                        className="w-full rounded border border-slate-300 px-2 py-1 font-mono tabular-nums text-xs text-slate-900"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-slate-50/70 px-6 py-3 flex items-center justify-between">
            <span className="text-xs text-slate-600">
              Technical Inspection Table & 6-Step Pipeline Trace
            </span>
            <button
              type="button"
              onClick={() => setShowTechTable((v) => !v)}
              className="inline-flex items-center gap-1.5 min-h-[36px] text-xs font-semibold text-slate-800 hover:text-slate-900 cursor-pointer"
            >
              <span>{showTechTable ? 'Hide Technical Details' : 'Show Technical Details'}</span>
              {showTechTable ? (
                <ChevronUp className="w-4 h-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>

          {showTechTable && (
            <div className="border-t border-slate-200 divide-y divide-slate-200">
              <div className="p-6 space-y-2 bg-slate-50/40">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Executed Pipeline Trace
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  {result.trace.stages.map((st) => (
                    <div key={st.name} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="font-bold text-slate-900">{st.name}</div>
                      <div className="text-slate-600 mt-1 leading-relaxed">{st.summary}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <th className="py-3 pl-6 pr-3">Critical Element</th>
                      <th className="py-3 px-3">Original</th>
                      <th className="py-3 px-3">Transformed</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Criticality</th>
                      <th className="py-3 px-3 text-right">Weight</th>
                      <th className="py-3 pl-3 pr-6">Impact Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {result.comparisons.map((item) => (
                      <tr key={item.unit.id}>
                        <td className="py-3 pl-6 pr-3 font-medium text-slate-900 whitespace-nowrap">
                          {UNIT_TYPE_LABELS[item.unit.type]}
                        </td>
                        <td className="py-3 px-3 text-slate-800">{item.unit.originalText}</td>
                        <td className="py-3 px-3 text-slate-700">
                          {item.matchedTransformedText ?? (
                            <span className="font-mono text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <StatusIndicator status={item.status} />
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <ImpactLabel impact={item.decisionImpact} />
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums">
                          {item.unit.weight.toFixed(1)}
                        </td>
                        <td className="py-3 pl-3 pr-6 text-slate-600">{item.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    );
  }

  // ============================================================================
  // STATE 1: ANALYSIS WORKSPACE & 6-STEP INVESTIGATION FLOW
  // ============================================================================
  return (
    <div className="space-y-8 pb-8">
      {/* Hero Message */}
      <section className="max-w-3xl space-y-2.5">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 text-balance">
          Did the important meaning survive?
        </h1>
        <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
          MEANLOCK identifies decision-critical information that can disappear or change when a message is translated, summarized, simplified, or rewritten.
        </p>
        <p className="text-sm font-semibold text-slate-900">
          Not text similarity. Meaning that matters.
        </p>
      </section>

      {/* Quick Load Example Strip */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold tracking-wider uppercase text-slate-500 mr-1">
            Load example:
          </span>
          {DEMO_SCENARIOS.map((demo) => {
            const isSelected =
              originalText.trim() === demo.originalText.trim() &&
              transformedText.trim() === demo.transformedText.trim();
            return (
              <button
                key={demo.id}
                type="button"
                onClick={() => onPopulateDemo(demo.id)}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-slate-500'
                }`}
              >
                {demo.shortLabel}
              </button>
            );
          })}
        </div>
      </section>

      {/* Side-by-Side Comparison Workspace */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-5">
        {/* Top Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
            <div className="space-y-1">
              <label htmlFor="transform-type" className="block text-xs font-semibold text-slate-600">
                Transformation
              </label>
              <select
                id="transform-type"
                value={transformationType}
                onChange={(e) => onChangeTransformationType(e.target.value as TransformationType)}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              >
                {TRANSFORMATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="lang-pair" className="block text-xs font-semibold text-slate-600">
                Language Architecture
              </label>
              <select
                id="lang-pair"
                value={targetLanguage}
                onChange={(e) => onChangeTargetLanguage(e.target.value as LanguageCode)}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              >
                {LANGUAGE_REGISTRY.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {sourceLanguage.toUpperCase()} → {lang.label}{' '}
                    {lang.status === 'supported' ? '(Active)' : '(Planned)'}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="engine-mode" className="block text-xs font-semibold text-slate-600">
                Analysis Engine
              </label>
              <select
                id="engine-mode"
                value={engineMode}
                onChange={(e) => onChangeEngineMode(e.target.value as AnalysisEngineMode)}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              >
                <option value="deterministic">Deterministic Rule & NLP Engine</option>
                <option value="gemini-hybrid">
                  {geminiAvailable
                    ? 'Gemini Semantic Assist + Rule Scorer'
                    : 'Gemini Semantic Assist (Fallback to Rules)'}
                </option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={onClear}
            className="min-h-[44px] px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer self-start sm:self-end whitespace-nowrap"
          >
            Clear Inputs
          </button>
        </div>

        {/* Two Large Text Areas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <label
                  htmlFor="original-message"
                  className="text-xs font-bold tracking-wider uppercase text-slate-900"
                >
                  SOURCE MESSAGE
                </label>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {originalText.trim() ? `${originalText.trim().split(/\s+/).length} words` : '0 words'}
              </span>
            </div>
            <textarea
              id="original-message"
              rows={7}
              value={originalText}
              onChange={(e) => onChangeOriginal(e.target.value)}
              placeholder="Paste the original notice, instruction, or policy..."
              className="w-full rounded-xl border border-slate-300 bg-slate-50/60 px-4 py-3 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 leading-relaxed"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <label
                  htmlFor="transformed-message"
                  className="text-xs font-bold tracking-wider uppercase text-slate-900"
                >
                  TRANSFORMED MESSAGE
                </label>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {transformedText.trim()
                  ? `${transformedText.trim().split(/\s+/).length} words`
                  : '0 words'}
              </span>
            </div>
            <textarea
              id="transformed-message"
              rows={7}
              value={transformedText}
              onChange={(e) => onChangeTransformed(e.target.value)}
              placeholder="Paste the translated, summarized, simplified, or rewritten message..."
              className="w-full rounded-xl border border-slate-300 bg-slate-50/60 px-4 py-3 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 leading-relaxed"
            />
          </div>
        </div>

        {/* Live "What MEANLOCK Looks For" Inspector */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
              <Eye className="w-4 h-4 text-slate-600 shrink-0" aria-hidden="true" />
              <span>Live critical meaning units detected in Source Message</span>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {liveUnits.length} critical unit{liveUnits.length === 1 ? '' : 's'} extracted
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {FOCUS_CATEGORIES.map((cat) => {
              const matches = liveUnits.filter((u) => cat.types.includes(u.type));
              const isSelected = selectedFocusId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedFocusId(isSelected ? null : cat.id)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900'
                      : matches.length > 0
                      ? 'bg-white text-slate-900 border-slate-300 hover:border-slate-400'
                      : 'bg-slate-100/70 text-slate-500 border-slate-200 hover:text-slate-700'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span
                    className={`font-mono tabular-nums text-[11px] ${
                      isSelected ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {matches.length}
                  </span>
                </button>
              );
            })}
          </div>

          {focusedCategory && (
            <div className="pt-2 border-t border-slate-200 text-xs text-slate-700">
              {focusedLiveUnits.length > 0 ? (
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  <span className="font-semibold text-slate-900">
                    {focusedCategory.label}:
                  </span>
                  {focusedLiveUnits.map((u) => (
                    <span
                      key={u.id}
                      className="font-mono bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-800"
                    >
                      {u.originalText}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-slate-500">
                  No {focusedCategory.label.toLowerCase()} detected in the current Source Message.
                </span>
              )}
            </div>
          )}
        </div>

        {/* 6-Step Real Analysis Process Panel (Shown while analyzing) */}
        {isAnalyzing && (
          <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-900">
              <span>Running MEANLOCK Investigation Pipeline...</span>
              <span className="font-mono tabular-nums text-slate-600">
                Step {Math.min(analysisStepIndex + 1, ANALYSIS_STEPS.length)} / {ANALYSIS_STEPS.length}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {ANALYSIS_STEPS.map((label, idx) => {
                const done = idx < analysisStepIndex;
                const active = idx === analysisStepIndex;
                return (
                  <div
                    key={label}
                    className={`rounded-lg border px-3 py-2 text-xs flex items-center gap-2 ${
                      active
                        ? 'border-slate-900 bg-white font-semibold text-slate-900'
                        : done
                        ? 'border-emerald-200 bg-emerald-50/50 text-emerald-800'
                        : 'border-slate-200 bg-white/60 text-slate-400'
                    }`}
                  >
                    {done ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                    ) : (
                      <span className="font-mono text-[11px] shrink-0">0{idx + 1}</span>
                    )}
                    <span className="truncate">{label}</span>
                  </div>
                );
              })}
            </div>
            {analysisStepDetail && (
              <div className="text-xs font-mono text-slate-600">{analysisStepDetail}</div>
            )}
          </div>
        )}

        {targetLanguage !== 'en' && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
            Multilingual notice: Only English rules are validated in this prototype.{' '}
            {sourceLanguage.toUpperCase()} → {targetLanguage.toUpperCase()} is an architectural slot
            and is not evaluated for native-script accuracy.
          </p>
        )}

        {errorMsg && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
            {errorMsg}
          </p>
        )}

        {/* Primary Analyze CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="text-xs text-slate-500">
            Executes 6-stage extraction, alignment, criticality weighting, and baseline comparison.
          </div>

          <button
            type="button"
            onClick={onAnalyze}
            disabled={isAnalyzing || !originalText.trim() || !transformedText.trim()}
            className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2.5 rounded-xl bg-slate-900 px-7 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
          >
            <span>
              {isAnalyzing
                ? ANALYSIS_STEPS[analysisStepIndex] ?? 'Analyzing...'
                : 'ANALYZE MEANING'}
            </span>
            <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* 5 Curated Example Cards */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
          <h2 className="text-sm font-bold tracking-wider uppercase text-slate-900">
            Try a real example
          </h2>
          <p className="text-xs text-slate-500">
            Select any scenario to populate the workspace, then tap ANALYZE MEANING.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {DEMO_SCENARIOS.map((demo) => {
            const isSelected =
              originalText.trim() === demo.originalText.trim() &&
              transformedText.trim() === demo.transformedText.trim();
            return (
              <button
                key={demo.id}
                type="button"
                onClick={() => onPopulateDemo(demo.id)}
                className={`text-left rounded-2xl border p-4 flex flex-col justify-between space-y-3 transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-slate-900 bg-white ring-1 ring-slate-900'
                    : 'border-slate-200 bg-white hover:border-slate-400'
                }`}
              >
                <div className="space-y-1">
                  <div className="text-[11px] font-medium text-slate-500">
                    {demo.transformationType}
                  </div>
                  <div className="text-sm font-bold text-slate-900">{demo.title}</div>
                  <div className="text-xs font-semibold text-slate-700">{demo.domain}</div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{demo.summaryNote}</p>
                <div className="text-xs font-semibold text-slate-900 pt-1">
                  {isSelected ? 'Loaded in workspace ↑' : 'Load example →'}
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
