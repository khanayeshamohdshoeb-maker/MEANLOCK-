import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { UNIT_TYPE_LABELS } from '../engine/config';
import { DEFAULT_MEANING_CHAIN } from '../engine/demos';
import { runMeaningChain } from '../engine/index';
import {
  ImportanceWeightConfig,
  MeaningChainStageInput,
  TransformationType,
  UnitStatus,
} from '../engine/types';
import { RiskIndicator, SegmentedScoreBar } from './StatusVisuals';

interface MeaningChainViewProps {
  weights: ImportanceWeightConfig;
}

const TRANSFORM_OPTIONS: TransformationType[] = [
  'Translation',
  'Simplification',
  'Summarization',
  'Rewriting',
  'Forwarded / Edited',
  'Other',
];

function ChainSymbol({ status }: { status: UnitStatus }) {
  if (status === 'PRESERVED') {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-emerald-700">
        <span>✓</span>
        <span>Preserved</span>
      </span>
    );
  }
  if (status === 'WEAKENED') {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-amber-700">
        <span>△</span>
        <span>Weakened</span>
      </span>
    );
  }
  if (status === 'CHANGED') {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-orange-700">
        <span>⇄</span>
        <span>Changed</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-red-700">
      <span>✕</span>
      <span>Lost</span>
    </span>
  );
}

export function MeaningChainView({ weights }: MeaningChainViewProps) {
  const [originalText, setOriginalText] = useState(DEFAULT_MEANING_CHAIN.originalText);
  const [stages, setStages] = useState<MeaningChainStageInput[]>(DEFAULT_MEANING_CHAIN.stages);
  const [selectedStageId, setSelectedStageId] = useState<string>(
    DEFAULT_MEANING_CHAIN.stages[DEFAULT_MEANING_CHAIN.stages.length - 1].id
  );

  const chainResult = useMemo(() => {
    if (!originalText.trim() || stages.length === 0) return null;
    return runMeaningChain(originalText, stages, weights);
  }, [originalText, stages, weights]);

  const handleUpdateStage = (id: string, patch: Partial<MeaningChainStageInput>) => {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const handleAddStage = () => {
    const idx = stages.length + 1;
    const prevText = stages[stages.length - 1]?.text ?? originalText;
    const newStage: MeaningChainStageInput = {
      id: `stage-${Date.now()}`,
      label: `Stage ${idx}`,
      transformationType: 'Summarization',
      text: prevText,
    };
    setStages((prev) => [...prev, newStage]);
    setSelectedStageId(newStage.id);
  };

  const handleRemoveStage = (id: string) => {
    if (stages.length <= 2) return;
    setStages((prev) => prev.filter((s) => s.id !== id));
  };

  const handleResetPreset = () => {
    setOriginalText(DEFAULT_MEANING_CHAIN.originalText);
    setStages(DEFAULT_MEANING_CHAIN.stages);
    setSelectedStageId(DEFAULT_MEANING_CHAIN.stages[DEFAULT_MEANING_CHAIN.stages.length - 1].id);
  };

  const activeStageResult =
    chainResult?.stages.find((s) => s.stageId === selectedStageId) ??
    chainResult?.stages[chainResult.stages.length - 1] ??
    null;

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="max-w-2xl space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Where did the meaning break?
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Track critical units across Source → Translation → Simplification → Summary to observe exactly when deadlines, obligations, documents, and consequences disappear.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleResetPreset}
            className="inline-flex items-center gap-1.5 min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset Preset</span>
          </button>
          <button
            type="button"
            onClick={handleAddStage}
            className="inline-flex items-center gap-1.5 min-h-[44px] rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Add Stage</span>
          </button>
        </div>
      </section>

      {/* CRITICAL UNITS MOVING THROUGH THE CHAIN (SURVIVAL MATRIX) */}
      {chainResult && chainResult.unitTracks.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Information Survival Through the Chain
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Live trace of every critical unit from Source through each transformation stage (✓ Preserved · △ Weakened · ⇄ Changed · ✕ Lost).
              </p>
            </div>
            {chainResult.biggestDropStageId && chainResult.biggestDropAmount > 0 && (
              <div className="text-xs font-bold text-red-700">
                Largest drop: {chainResult.biggestDropFromLabel} → {chainResult.biggestDropToLabel} (
                -{chainResult.biggestDropAmount}%)
              </div>
            )}
          </div>

          {/* Responsive Unit Survival Rows (works cleanly on mobile and desktop without horizontal breakage) */}
          <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
            {chainResult.unitTracks.map((track) => (
              <div key={track.unitId} className="p-4 space-y-3 bg-white">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs font-bold tracking-wide uppercase text-slate-500">
                    {UNIT_TYPE_LABELS[track.type]}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    “{track.originalText}”
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                    <div className="text-[11px] font-semibold text-slate-500">SOURCE</div>
                    <div className="mt-1 font-mono text-xs font-bold text-emerald-700">
                      ✓ Preserved
                    </div>
                  </div>
                  {track.statusesByStage.map((st) => {
                    const stageObj = chainResult.stages.find((s) => s.stageId === st.stageId);
                    const bgClass =
                      st.status === 'LOST'
                        ? 'bg-red-50/50 border-red-200'
                        : st.status === 'CHANGED'
                        ? 'bg-orange-50/50 border-orange-200'
                        : st.status === 'WEAKENED'
                        ? 'bg-amber-50/50 border-amber-200'
                        : 'bg-emerald-50/40 border-emerald-200';
                    return (
                      <div key={st.stageId} className={`rounded-lg border px-3 py-2 ${bgClass}`}>
                        <div className="text-[11px] font-semibold text-slate-600 truncate">
                          {stageObj?.label ?? 'Stage'}
                        </div>
                        <div className="mt-1">
                          <ChainSymbol status={st.status} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Stage Pipeline + Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-2">
          {/* SOURCE */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold tracking-wider uppercase text-slate-500">
                  SOURCE
                </div>
                <div className="text-xs text-slate-500">Original reference message</div>
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700">100%</div>
            </div>
            <SegmentedScoreBar score={100} segments={16} />
            <textarea
              rows={3}
              value={originalText}
              onChange={(e) => setOriginalText(e.target.value)}
              aria-label="Original source message for chain"
              className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none"
            />
          </div>

          {stages.map((stage, idx) => {
            const stageRes = chainResult?.stages.find((s) => s.stageId === stage.id);
            const prevLabel = idx === 0 ? 'Source' : stages[idx - 1].label;
            const isBiggestDrop =
              chainResult?.biggestDropStageId === stage.id && chainResult.biggestDropAmount > 0;
            const isSelected = activeStageResult?.stageId === stage.id;

            return (
              <div key={stage.id} className="space-y-2">
                <div className="flex flex-col items-center py-1">
                  <ArrowDown
                    className={`w-5 h-5 ${isBiggestDrop ? 'text-red-600' : 'text-slate-400'}`}
                    aria-hidden="true"
                  />
                  {isBiggestDrop && stageRes && (
                    <div className="mt-1.5 w-full rounded-xl border border-red-300 bg-red-50 px-4 py-3.5 space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs font-bold text-red-800">
                        <span className="inline-flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
                          <span>Largest meaning loss</span>
                        </span>
                        <span className="font-mono tabular-nums">
                          {prevLabel} → {stage.label} ({stageRes.deltaFromPrevious}%)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-red-900">
                        {stageRes.lostLabels.length > 0 && (
                          <div>
                            <strong className="block">Lost:</strong>
                            <ul className="list-disc list-inside space-y-0.5 mt-0.5">
                              {stageRes.lostLabels.map((l) => (
                                <li key={l}>{l}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {(stageRes.weakenedLabels.length > 0 || stageRes.changedLabels.length > 0) && (
                          <div>
                            <strong className="block">Weakened / Changed:</strong>
                            <ul className="list-disc list-inside space-y-0.5 mt-0.5">
                              {[...stageRes.weakenedLabels, ...stageRes.changedLabels].map((l) => (
                                <li key={l}>{l}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Stage Card */}
                <div
                  onClick={() => setSelectedStageId(stage.id)}
                  className={`bg-white border rounded-2xl p-5 space-y-3 transition-colors cursor-pointer ${
                    isBiggestDrop
                      ? 'border-red-300'
                      : isSelected
                      ? 'border-slate-900 ring-1 ring-slate-900'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-[180px] space-y-1">
                      <input
                        type="text"
                        value={stage.label}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleUpdateStage(stage.id, { label: e.target.value })}
                        aria-label="Stage title"
                        className="w-full font-bold text-sm text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-slate-900 focus:outline-none bg-transparent"
                      />
                      <div className="flex items-center gap-2">
                        <select
                          value={stage.transformationType}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            handleUpdateStage(stage.id, {
                              transformationType: e.target.value as TransformationType,
                            })
                          }
                          aria-label="Stage transformation type"
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700"
                        >
                          {TRANSFORM_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        {stages.length > 2 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveStage(stage.id);
                            }}
                            title="Remove stage"
                            className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>

                    {stageRes && (
                      <div className="text-right shrink-0">
                        <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                          {stageRes.score}%
                        </div>
                        <div
                          className={`text-xs font-mono tabular-nums font-semibold ${
                            stageRes.deltaFromPrevious < 0
                              ? 'text-red-700'
                              : stageRes.deltaFromPrevious > 0
                              ? 'text-emerald-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {stageRes.deltaFromPrevious > 0
                            ? `+${stageRes.deltaFromPrevious}% vs prev`
                            : `${stageRes.deltaFromPrevious}% vs prev`}
                        </div>
                      </div>
                    )}
                  </div>

                  {stageRes && <SegmentedScoreBar score={stageRes.score} segments={16} />}

                  <textarea
                    rows={3}
                    value={stage.text}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleUpdateStage(stage.id, { text: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none"
                  />

                  {stageRes && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pt-1">
                      <span className="font-mono tabular-nums">
                        {stageRes.counts.preserved} preserved · {stageRes.counts.weakened} weakened ·{' '}
                        {stageRes.counts.lost} lost · {stageRes.counts.changed} changed
                      </span>
                      <span className="font-semibold text-slate-800">
                        {isSelected ? 'Inspecting →' : 'Tap to inspect'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sticky Stage Inspector */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-5 lg:sticky lg:top-20">
          {activeStageResult ? (
            <>
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200">
                <div>
                  <div className="text-xs font-semibold text-slate-500">Stage Inspection</div>
                  <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                    {activeStageResult.label}
                  </h2>
                </div>
                <RiskIndicator risk={activeStageResult.riskLevel} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                  <div className="text-xs text-slate-500">Meaning Integrity</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                    {activeStageResult.score}%
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                  <div className="text-xs text-slate-500">Text Similarity</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-700 mt-1">
                    {activeStageResult.analysis.baseline.cosineSimilarityPct}%
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <h3 className="text-xs font-bold tracking-wider uppercase text-slate-500">
                  Critical Differences vs Source
                </h3>

                {activeStageResult.analysis.explanations.length === 0 ? (
                  <p className="text-sm text-slate-600">
                    All critical units from the source message survived at this stage.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-200 border-t border-slate-200">
                    {activeStageResult.analysis.explanations.map((exp) => (
                      <li key={exp.index} className="py-3 space-y-1">
                        <div className="text-xs font-bold text-slate-900">
                          {exp.index}. {exp.title}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{exp.detail}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Select any stage to inspect its meaning diffs.</p>
          )}
        </div>
      </div>
    </div>
  );
}
