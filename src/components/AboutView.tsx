import { ArrowDown, ArrowRight, ArrowUpRight } from 'lucide-react';
import {
  DEFAULT_PROTOTYPE_WEIGHTS,
  LANGUAGE_REGISTRY,
  UNIT_TYPE_LABELS,
} from '../engine/config';
import { HONEST_FAILURE_CASES } from '../engine/demos';
import { CriticalUnitType, TransformationType } from '../engine/types';

interface AboutViewProps {
  onLoadFailureCase: (original: string, transformed: string, type: TransformationType) => void;
}

const DECISION_QUESTIONS = [
  'What do you need to do?',
  'When do you need to do it?',
  'What are you required to provide?',
  "What happens if you don't?",
  'What conditions or warnings changed?',
];

const HOW_IT_WORKS_STEPS = [
  {
    num: '01',
    title: 'Extract',
    detail: 'Identify decision-critical information: obligations, deadlines, numbers, negations, conditions, consequences, and required documents.',
  },
  {
    num: '02',
    title: 'Normalize',
    detail: 'Represent dates (30 Nov ↔ Nov 30), times (5 PM ↔ 17:00), contractions, modal strength tiers, and numeric values in canonical form.',
  },
  {
    num: '03',
    title: 'Compare',
    detail: 'Align extracted source units against the transformed message using lexical, structural, antonym, and optional semantic comparison.',
  },
  {
    num: '04',
    title: 'Classify',
    detail: 'Assign each unit Preserved, Weakened, Lost, or Changed based on modal degradation, omission, or polarity reversal.',
  },
  {
    num: '05',
    title: 'Weight',
    detail: 'Estimate decision impact (Very High / High / Medium / Low) and compute weighted Meaning Integrity.',
  },
  {
    num: '06',
    title: 'Explain',
    detail: 'Generate human-readable explanations showing what changed and why it matters for the reader’s decision.',
  },
];

export function AboutView({ onLoadFailureCase }: AboutViewProps) {
  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <section className="pb-6 border-b border-slate-200 space-y-3 max-w-3xl">
        <div className="text-xs font-bold tracking-wider uppercase text-slate-500">
          Critical Meaning Intelligence
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          MEANLOCK investigates whether information that matters for a person&apos;s decision survives transformation.
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          Ordinary similarity metrics treat every token roughly the same. MEANLOCK isolates the exact statements that govern action, eligibility, safety, and deadlines.
        </p>
      </section>

      {/* How MEANLOCK Works (6-Step Architecture) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <div>
          <h2 className="text-base font-bold text-slate-900">How MEANLOCK Works</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Transparent 6-stage modular pipeline implemented under <span className="font-mono">src/engine/</span>.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-stretch">
          {HOW_IT_WORKS_STEPS.map((item, idx) => (
            <div key={item.num} className="flex flex-col lg:flex-row items-stretch gap-2">
              <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1.5">
                <div className="text-xs font-mono font-bold text-slate-500">{item.num}</div>
                <div className="text-sm font-bold text-slate-900">{item.title}</div>
                <p className="text-xs text-slate-600 leading-relaxed">{item.detail}</p>
              </div>
              {idx < HOW_IT_WORKS_STEPS.length - 1 && (
                <div className="flex items-center justify-center text-slate-400">
                  <ArrowDown className="w-4 h-4 lg:hidden" aria-hidden="true" />
                  <ArrowRight className="w-4 h-4 hidden lg:block" aria-hidden="true" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* METHOD PANEL (Unit Types, Comparison Methods, Outputs) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <div>
          <h2 className="text-base font-bold text-slate-900">Method Specification</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Inspectable taxonomy of critical units, comparison mechanisms, and structured outputs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2.5">
            <div className="text-xs font-bold tracking-wider uppercase text-slate-500">
              Critical Unit Types
            </div>
            <ul className="space-y-1 text-xs text-slate-800 font-medium">
              <li>Obligation (must, required, should, may)</li>
              <li>Deadline (dates, exact times, relative windows)</li>
              <li>Negation (not, never, cannot, must not, only, without)</li>
              <li>Number (quantities, percentages, monetary amounts)</li>
              <li>Condition &amp; Exception (if, unless, only if, except)</li>
              <li>Consequence &amp; Warning (rejection, fees, hazards)</li>
              <li>Requirement &amp; Action (documents, locations, verbs)</li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2.5">
            <div className="text-xs font-bold tracking-wider uppercase text-slate-500">
              Comparison Methods
            </div>
            <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
              <li>
                <strong className="text-slate-900 block">Lexical</strong>
                Token normalization, stemming, synonym groups, and explicit antonym-flip guards (e.g., incomplete ↔ complete).
              </li>
              <li>
                <strong className="text-slate-900 block">Structural</strong>
                Modal strength hierarchy (mandatory → advisory → permissive), polarity reversal checks, and normalized date/time/numeric matching.
              </li>
              <li>
                <strong className="text-slate-900 block">Semantic</strong>
                Optional server-side Gemini structured unit alignment paired with the deterministic weighted scorer and rule fallback.
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2.5">
            <div className="text-xs font-bold tracking-wider uppercase text-slate-500">
              Output Schema
            </div>
            <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
              <li>
                <strong className="text-slate-900 block">Status</strong>
                Preserved · Weakened · Lost · Changed
              </li>
              <li>
                <strong className="text-slate-900 block">Criticality</strong>
                Very High · High · Medium · Low Decision Impact
              </li>
              <li>
                <strong className="text-slate-900 block">Explanation</strong>
                Direct side-by-side diff, human-readable &ldquo;Why this matters&rdquo; reasoning, and TF-IDF/cosine baseline contrast.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 5 Human Questions + Prototype Weights & Multilingual Roadmap */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            Five questions MEANLOCK protects
          </h2>
          <ul className="divide-y divide-slate-200 border-t border-slate-200">
            {DECISION_QUESTIONS.map((q, idx) => (
              <li key={q} className="py-3 flex items-baseline gap-3 text-sm text-slate-800">
                <span className="font-mono text-xs text-slate-400">0{idx + 1}</span>
                <span className="font-medium">{q}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Prototype Criticality Weights
            </h2>
            <span className="text-xs text-slate-500">Configurable · Not scientifically validated</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {(Object.keys(DEFAULT_PROTOTYPE_WEIGHTS.byType) as CriticalUnitType[]).map((t) => (
              <div
                key={t}
                className="flex items-center justify-between border border-slate-200 rounded-xl px-3 py-2 text-xs"
              >
                <span className="text-slate-700 truncate pr-2">{UNIT_TYPE_LABELS[t]}</span>
                <span className="font-mono tabular-nums font-bold text-slate-900">
                  {DEFAULT_PROTOTYPE_WEIGHTS.byType[t].toFixed(1)}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-200">
            <div className="text-xs font-bold text-slate-900 mb-2">Multilingual Roadmap</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {LANGUAGE_REGISTRY.map((lang) => (
                <div
                  key={lang.code}
                  className="border border-slate-200 rounded-xl p-3 flex items-start justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900">{lang.label}</div>
                    <div className="text-slate-600 mt-0.5">{lang.note}</div>
                  </div>
                  <span
                    className={`font-semibold shrink-0 ${
                      lang.status === 'supported' ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    {lang.status === 'supported' ? 'Active' : 'Planned'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Honest Failure Analysis */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900">
            Failure Analysis — MEANLOCK is not perfect
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            For research credibility, we document real scenarios where deterministic and shallow semantic checks misclassify meaning. Tap any case to test it directly in the Analyzer.
          </p>
        </div>

        <div className="divide-y divide-slate-200 border-t border-slate-200">
          {HONEST_FAILURE_CASES.map((fc) => (
            <div key={fc.id} className="py-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-medium text-slate-500">{fc.category}</div>
                  <h3 className="text-sm font-bold text-slate-900">{fc.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onLoadFailureCase(fc.originalText, fc.transformedText, fc.transformationType)
                  }
                  className="inline-flex items-center gap-1 min-h-[36px] text-xs font-semibold text-slate-900 hover:underline underline-offset-2 shrink-0 cursor-pointer"
                >
                  <span>Test in Analyzer</span>
                  <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <div className="font-bold text-slate-700 mb-1">Original</div>
                  <p className="text-slate-800 leading-relaxed">{fc.originalText}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <div className="font-bold text-slate-700 mb-1">Transformed</div>
                  <p className="text-slate-800 leading-relaxed">{fc.transformedText}</p>
                </div>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed">
                <strong>Why MEANLOCK can fail here:</strong> {fc.whyPrototypeCanFail}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
