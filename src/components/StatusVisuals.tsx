import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { DecisionImpact, RiskLevel, UnitStatus } from '../engine/types';

export function StatusIndicator({ status }: { status: UnitStatus }) {
  switch (status) {
    case 'PRESERVED':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
          <span>PRESERVED</span>
        </span>
      );
    case 'WEAKENED':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
          <span>WEAKENED</span>
        </span>
      );
    case 'LOST':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 whitespace-nowrap">
          <XCircle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
          <span>LOST</span>
        </span>
      );
    case 'CHANGED':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700 whitespace-nowrap">
          <RefreshCw className="w-4 h-4 text-orange-600 shrink-0" aria-hidden="true" />
          <span>CHANGED</span>
        </span>
      );
  }
}

export function ImpactLabel({ impact }: { impact: DecisionImpact }) {
  if (impact === 'VERY HIGH') {
    return (
      <span className="text-[11px] font-bold tracking-wide text-red-800 whitespace-nowrap">
        VERY HIGH IMPACT
      </span>
    );
  }
  if (impact === 'HIGH') {
    return (
      <span className="text-[11px] font-bold tracking-wide text-orange-800 whitespace-nowrap">
        HIGH IMPACT
      </span>
    );
  }
  if (impact === 'MEDIUM') {
    return (
      <span className="text-[11px] font-semibold tracking-wide text-amber-800 whitespace-nowrap">
        MEDIUM IMPACT
      </span>
    );
  }
  return (
    <span className="text-[11px] font-medium tracking-wide text-slate-500 whitespace-nowrap">
      LOW IMPACT
    </span>
  );
}

export function RiskIndicator({ risk }: { risk: RiskLevel }) {
  if (risk === 'LOW RISK') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 whitespace-nowrap">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
        <span>LOW RISK</span>
      </span>
    );
  }
  if (risk === 'REVIEW NEEDED') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 whitespace-nowrap">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
        <span>REVIEW NEEDED</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 whitespace-nowrap">
      <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
      <span>HIGH RISK</span>
    </span>
  );
}

export function SegmentedScoreBar({
  score,
  segments = 20,
}: {
  score: number;
  segments?: number;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const filled = Math.round((clamped / 100) * segments);
  const barColor =
    clamped >= 85 ? 'bg-emerald-600' : clamped >= 60 ? 'bg-amber-500' : 'bg-red-600';

  return (
    <div
      className="flex items-center gap-1 w-full"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Critical meaning integrity score: ${clamped}%`}
    >
      {Array.from({ length: segments }).map((_, i) => (
        <span
          key={i}
          className={`h-2.5 flex-1 rounded-[2px] transition-colors duration-150 ${
            i < filled ? barColor : 'bg-slate-200'
          }`}
        />
      ))}
    </div>
  );
}
