import { useState } from 'react';
import { ArrowUpRight, Download, Play, Plus, Trash2 } from 'lucide-react';
import { UNIT_TYPE_LABELS } from '../engine/config';
import { EXPERIMENT_STARTER_CORPUS } from '../engine/demos';
import { exportExperimentCsv, runExperimentBatch } from '../engine/index';
import {
  ExperimentCase,
  ExperimentMetrics,
  ImportanceWeightConfig,
  TransformationType,
  UnitStatus,
} from '../engine/types';
import { RiskIndicator } from './StatusVisuals';

interface ExperimentsViewProps {
  weights: ImportanceWeightConfig;
  onInspectInAnalyzer: (original: string, transformed: string, type: TransformationType) => void;
}

const TRANSFORM_TYPES: TransformationType[] = [
  'Translation',
  'Summarization',
  'Simplification',
  'Rewriting',
  'Forwarded / Edited',
  'Other',
];

export function ExperimentsView({ weights, onInspectInAnalyzer }: ExperimentsViewProps) {
  const [cases, setCases] = useState<ExperimentCase[]>(EXPERIMENT_STARTER_CORPUS);
  const [metrics, setMetrics] = useState<ExperimentMetrics | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newDomain, setNewDomain] = useState('Education');
  const [newType, setNewType] = useState<TransformationType>('Summarization');
  const [newOriginal, setNewOriginal] = useState('');
  const [newTransformed, setNewTransformed] = useState('');
  const [newExpectedUnits, setNewExpectedUnits] = useState('');
  const [newExpectedStatus, setNewExpectedStatus] = useState<UnitStatus>('LOST');
  const [newExpected, setNewExpected] = useState<'true' | 'false' | 'null'>('true');

  const handleRunBatch = () => {
    const computed = runExperimentBatch(cases, weights);
    setMetrics(computed);
  };

  const handleAddCase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOriginal.trim() || !newTransformed.trim()) return;
    const expectedUnits = newExpectedUnits
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const nextCase: ExperimentCase = {
      id: `EXP-${String(cases.length + 1).padStart(2, '0')}`,
      title: newTitle.trim() || `Custom Case ${cases.length + 1}`,
      domain: newDomain.trim() || 'General',
      transformationType: newType,
      originalText: newOriginal.trim(),
      transformedText: newTransformed.trim(),
      expectedCriticalUnits: expectedUnits.length > 0 ? expectedUnits : undefined,
      expectedStatusLabel: newExpected === 'false' ? 'PRESERVED' : newExpectedStatus,
      expectedHasCriticalLoss:
        newExpected === 'true' ? true : newExpected === 'false' ? false : null,
    };
    setCases((prev) => [...prev, nextCase]);
    setNewTitle('');
    setNewOriginal('');
    setNewTransformed('');
    setNewExpectedUnits('');
    setShowAddForm(false);
    setMetrics(null);
  };

  const handleDeleteCase = (id: string) => {
    setCases((prev) => prev.filter((c) => c.id !== id));
    setMetrics(null);
  };

  const handleExportCsv = () => {
    if (!metrics) return;
    const csv = exportExperimentCsv(metrics);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meanlock_evaluation_lab_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalUnitsEvaluated = metrics
    ? metrics.byUnitType.reduce((sum, u) => sum + u.total, 0)
    : 0;

  const actualFailures = metrics
    ? metrics.results.filter((r) => r.outcome === 'FP' || r.outcome === 'FN')
    : [];

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="max-w-2xl space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Evaluation Lab
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Measure whether critical meaning survives across transformations. Metrics, failure cases, and research insights are generated strictly after executing a real batch.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="inline-flex items-center gap-1.5 min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Add Test Case</span>
          </button>

          {metrics && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export CSV</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleRunBatch}
            disabled={cases.length === 0}
            className="inline-flex items-center gap-2 min-h-[44px] rounded-xl bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:bg-slate-300 cursor-pointer whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Run Evaluation ({cases.length} cases)</span>
          </button>
        </div>
      </section>

      {/* Add Custom Case Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddCase}
          className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4"
        >
          <h2 className="text-base font-bold text-slate-900">Add Evaluation Case</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <input
              type="text"
              placeholder="Case title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="min-h-[44px] rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
            <input
              type="text"
              placeholder="Domain (School, Safety)"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              className="min-h-[44px] rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as TransformationType)}
              className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {TRANSFORM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              value={newExpected}
              onChange={(e) => setNewExpected(e.target.value as 'true' | 'false' | 'null')}
              className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="true">Expected: Critical Loss Present</option>
              <option value="false">Expected: Meaning Preserved</option>
              <option value="null">Unlabeled</option>
            </select>
            <select
              value={newExpectedStatus}
              onChange={(e) => setNewExpectedStatus(e.target.value as UnitStatus)}
              disabled={newExpected === 'false'}
              className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
            >
              <option value="LOST">Primary Label: LOST</option>
              <option value="WEAKENED">Primary Label: WEAKENED</option>
              <option value="CHANGED">Primary Label: CHANGED</option>
              <option value="PRESERVED">Primary Label: PRESERVED</option>
            </select>
          </div>
          <input
            type="text"
            placeholder="Expected critical units (comma-separated, e.g.: must submit, 5:00 PM, income certificate)"
            value={newExpectedUnits}
            onChange={(e) => setNewExpectedUnits(e.target.value)}
            className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <textarea
              rows={3}
              required
              placeholder="Original message..."
              value={newOriginal}
              onChange={(e) => setNewOriginal(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
            <textarea
              rows={3}
              required
              placeholder="Transformed message..."
              value={newTransformed}
              onChange={(e) => setNewTransformed(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="min-h-[40px] rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[40px] rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
            >
              Add Case
            </button>
          </div>
        </form>
      )}

      {/* Metrics & Findings */}
      {!metrics ? (
        <section className="bg-white border border-slate-200 rounded-2xl p-8 space-y-6">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <div className="text-lg font-bold text-slate-900">Not yet evaluated</div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Click <strong>Run Evaluation</strong> above to process the {cases.length} queued cases and compute preservation rate, precision, recall, F1, false positives/negatives, breakdown charts, failure cases, and empirical insights.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200 text-xs">
            <div>
              <span className="text-slate-500">Dataset size</span>
              <div className="font-mono font-semibold text-slate-900 mt-0.5">
                {cases.length} queued (not run)
              </div>
            </div>
            <div>
              <span className="text-slate-500">Preservation rate</span>
              <div className="font-mono text-slate-500 mt-0.5">Not yet evaluated</div>
            </div>
            <div>
              <span className="text-slate-500">Precision / Recall / F1</span>
              <div className="font-mono text-slate-500 mt-0.5">Not yet evaluated</div>
            </div>
            <div>
              <span className="text-slate-500">What did we learn?</span>
              <div className="font-mono text-slate-500 mt-0.5">Not yet evaluated</div>
            </div>
          </div>
        </section>
      ) : (
        <div className="space-y-6">
          {/* Top KPI Grid */}
          <section className="bg-white border border-slate-200 rounded-2xl grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 overflow-hidden">
            <div className="p-4">
              <div className="text-xs text-slate-500">Dataset Size</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {metrics.evaluatedCount}
              </div>
              <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                {metrics.labeledCount} labeled
              </div>
            </div>
            <div className="p-4">
              <div className="text-xs text-slate-500">Critical Units</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {totalUnitsEvaluated}
              </div>
              <div className="text-[11px] text-slate-500">Extracted</div>
            </div>
            <div className="p-4">
              <div className="text-xs text-slate-500">Preservation Rate</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {metrics.preservationRatePct}%
              </div>
              <div className="text-[11px] text-slate-500">Units intact</div>
            </div>
            <div className="p-4">
              <div className="text-xs text-slate-500">Mean Score</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {metrics.meanPreservationScore}%
              </div>
              <div className="text-[11px] text-slate-500">
                vs {metrics.meanBaselineSimilarity}% sim
              </div>
            </div>
            <div className="p-4">
              <div className="text-xs text-slate-500">Precision</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {metrics.precision !== null ? metrics.precision.toFixed(2) : 'N/A'}
              </div>
              <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                TP: {metrics.truePositives}
              </div>
            </div>
            <div className="p-4">
              <div className="text-xs text-slate-500">Recall</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {metrics.recall !== null ? metrics.recall.toFixed(2) : 'N/A'}
              </div>
              <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                TN: {metrics.trueNegatives}
              </div>
            </div>
            <div className="p-4">
              <div className="text-xs text-slate-500">F1 Score</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {metrics.f1 !== null ? metrics.f1.toFixed(2) : 'N/A'}
              </div>
              <div className="text-[11px] text-slate-500">Detection F1</div>
            </div>
            <div className="p-4 bg-slate-50">
              <div className="text-xs text-slate-500">Failure Cases</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-red-700 mt-1">
                {metrics.falsePositives + metrics.falseNegatives}
              </div>
              <div className="text-[11px] text-slate-600 font-mono tabular-nums">
                FP {metrics.falsePositives} · FN {metrics.falseNegatives}
              </div>
            </div>
          </section>

          {/* WHAT DID WE LEARN? INSIGHT BOX */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900">What did we learn?</h2>
              <span className="text-xs text-slate-500">
                Computed strictly from this {metrics.evaluatedCount}-case evaluation run
              </span>
            </div>
            <ul className="divide-y divide-slate-200 border-t border-slate-200 text-sm">
              {metrics.insights.map((insight) => (
                <li key={insight} className="py-2.5 text-slate-800 leading-relaxed">
                  {insight}
                </li>
              ))}
            </ul>
          </section>

          {/* Breakdown Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Transformation Breakdown</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Actual MEANLOCK critical preservation vs. surface cosine similarity by transformation type.
                </p>
              </div>

              <div className="space-y-4">
                {metrics.byTransformationType.map((row) => (
                  <div key={row.type} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900">
                        {row.type}{' '}
                        <span className="font-normal text-slate-500">
                          ({row.count} {row.count === 1 ? 'case' : 'cases'})
                        </span>
                      </span>
                      <span className="font-mono tabular-nums text-slate-700">
                        Preservation <strong>{row.preservationRatePct}%</strong> · Integrity{' '}
                        <strong>{row.avgScore}%</strong> · Sim {row.avgBaseline}%
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          row.avgScore >= 85
                            ? 'bg-emerald-600'
                            : row.avgScore >= 60
                            ? 'bg-amber-500'
                            : 'bg-red-600'
                        }`}
                        style={{ width: `${row.avgScore}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Critical Element Breakdown</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Which types of critical information were most frequently lost, changed, or weakened in this run.
                </p>
              </div>

              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {[...metrics.byUnitType]
                  .sort(
                    (a, b) =>
                      b.lost + b.changed + b.weakened - (a.lost + a.changed + a.weakened)
                  )
                  .map((row) => {
                    const issues = row.lost + row.changed + row.weakened;
                    const issuePct = row.total > 0 ? Math.round((issues / row.total) * 100) : 0;
                    return (
                      <div key={row.unitType} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-900">
                            {UNIT_TYPE_LABELS[row.unitType]}
                          </span>
                          <span className="font-mono tabular-nums text-slate-600">
                            {issues}/{row.total} affected ({issuePct}%)
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden flex">
                          <div
                            className="h-full bg-emerald-500"
                            style={{ width: `${(row.preserved / row.total) * 100}%` }}
                          />
                          <div
                            className="h-full bg-amber-500"
                            style={{ width: `${(row.weakened / row.total) * 100}%` }}
                          />
                          <div
                            className="h-full bg-orange-500"
                            style={{ width: `${(row.changed / row.total) * 100}%` }}
                          />
                          <div
                            className="h-full bg-red-600"
                            style={{ width: `${(row.lost / row.total) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </section>
          </div>

          {/* AUTOMATIC FAILURE ANALYSIS FROM ACTUAL RUN */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Failure Analysis (Detected Misclassifications)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cases from this batch where MEANLOCK&apos;s prediction disagreed with the human ground-truth label.
              </p>
            </div>

            {actualFailures.length === 0 ? (
              <p className="text-sm text-slate-600">
                No false positives or false negatives were recorded on the labeled cases in this batch. Add harder edge cases above to stress-test the analyzer.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 border-t border-slate-200">
                {actualFailures.map((fail) => (
                  <div key={fail.testCase.id} className="py-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-bold text-slate-900">
                        <span className="font-mono text-red-700 mr-2">{fail.outcome}</span>
                        {fail.testCase.id}: {fail.testCase.title}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onInspectInAnalyzer(
                            fail.testCase.originalText,
                            fail.testCase.transformedText,
                            fail.testCase.transformationType
                          )
                        }
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-900 hover:underline underline-offset-2 cursor-pointer"
                      >
                        <span>Inspect in Analyzer</span>
                        <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                        <div className="font-semibold text-slate-700 mb-0.5">
                          MEANLOCK Prediction
                        </div>
                        <div className="text-slate-900">
                          {fail.predictedHasCriticalLoss
                            ? `Flagged critical loss (${fail.analysis.preservationScore}% integrity)`
                            : `Marked preserved (${fail.analysis.preservationScore}% integrity)`}
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                        <div className="font-semibold text-slate-700 mb-0.5">Human Ground Truth</div>
                        <div className="text-slate-900">
                          {fail.testCase.expectedHasCriticalLoss
                            ? `Critical loss present (${fail.testCase.expectedStatusLabel ?? 'LOST'})`
                            : `Preserved (${fail.testCase.expectedStatusLabel ?? 'PRESERVED'})`}
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed">
                      <strong>Root cause:</strong> {fail.failureExplanation}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Dataset Table */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">Evaluation Corpus & Predictions</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Each case includes source, transformed message, transformation type, expected critical units, and expected status.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 pl-6 pr-3">Case & Expected Units</th>
                <th className="py-3 px-3">Transformation</th>
                <th className="py-3 px-3">Expected</th>
                <th className="py-3 px-3 text-right">MEANLOCK</th>
                <th className="py-3 px-3 text-right">Text Sim</th>
                <th className="py-3 px-3">Integrity</th>
                <th className="py-3 px-3">Outcome</th>
                <th className="py-3 pl-3 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {cases.map((tc) => {
                const res = metrics?.results.find((r) => r.testCase.id === tc.id);
                return (
                  <tr key={tc.id} className="hover:bg-slate-50/60">
                    <td className="py-3.5 pl-6 pr-3 max-w-[290px]">
                      <div className="font-semibold text-slate-900 text-xs">
                        <span className="font-mono text-slate-500 mr-1.5">{tc.id}</span>
                        {tc.title}
                      </div>
                      {tc.expectedCriticalUnits && tc.expectedCriticalUnits.length > 0 && (
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          Expected units: {tc.expectedCriticalUnits.join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-xs text-slate-700 whitespace-nowrap">
                      {tc.transformationType}
                    </td>
                    <td className="py-3.5 px-3 text-xs text-slate-700 whitespace-nowrap">
                      {tc.expectedHasCriticalLoss === null
                        ? 'Unlabeled'
                        : tc.expectedHasCriticalLoss
                        ? `Loss (${tc.expectedStatusLabel ?? 'Flagged'})`
                        : 'Preserved'}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums text-xs font-bold text-slate-900">
                      {res ? `${res.analysis.preservationScore}%` : '—'}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums text-xs text-slate-600">
                      {res ? `${res.analysis.baseline.cosineSimilarityPct}%` : '—'}
                    </td>
                    <td className="py-3.5 px-3">
                      {res ? (
                        <RiskIndicator risk={res.analysis.riskLevel} />
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-xs">
                      {res ? (
                        <span
                          className={
                            res.outcome === 'FP' || res.outcome === 'FN'
                              ? 'font-bold text-red-700'
                              : res.outcome === 'UNLABELED'
                              ? 'text-slate-500'
                              : 'font-bold text-emerald-700'
                          }
                        >
                          {res.outcome}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 pl-3 pr-6 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            onInspectInAnalyzer(
                              tc.originalText,
                              tc.transformedText,
                              tc.transformationType
                            )
                          }
                          className="text-xs font-semibold text-slate-800 hover:text-slate-900 underline underline-offset-2 cursor-pointer"
                        >
                          Inspect
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCase(tc.id)}
                          title="Remove case"
                          className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
