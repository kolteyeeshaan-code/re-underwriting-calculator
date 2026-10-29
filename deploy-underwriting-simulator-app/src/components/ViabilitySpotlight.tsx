import { useId, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  PRODUCT_TYPOLOGIES,
  VIABILITY_DEFAULTS,
  vFmtM,
  vFmtNum,
  vFmtPct,
  type ProductTypology,
  type SensitivityRow,
  type ViabilityInputs,
  type ViabilitySimulationController,
} from '../engine/viabilityEngine';
import { Card as EeshaanKolteyCard, PillBtn, Badge } from './eeshaan-koltey/ui';
import { Sparkles, Download } from './eeshaan-koltey/icons';

/* ---------------------------------------------------------- local glass UI */
function Panel({
  title,
  subtitle,
  children,
  className = '',
  right,
  variant = 'plain',
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  right?: React.ReactNode;
  variant?: 'plain' | 'cream' | 'flat';
}) {
  return (
    <EeshaanKolteyCard variant={variant} className={`min-w-0 p-4 sm:p-6 ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(22,24,28,0.08)] pb-4 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 shrink-0 rounded-full bg-[#F4C74B]" />
            <h3 className="text-[15.5px] sm:text-[16px] font-medium tracking-tight text-[#16181C]">{title}</h3>
          </div>
          {subtitle && <p className="mt-0.5 text-[12px] sm:text-[12.5px] font-normal text-[#5F646B]">{subtitle}</p>}
        </div>
        {right}
      </header>
      <div>{children}</div>
    </EeshaanKolteyCard>
  );
}

function NumField({
  label,
  value,
  onChange,
  unit,
  step = 1,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
}) {
  const id = useId();
  return (
    <div className="min-w-0 flex-1 basis-[150px]">
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-medium text-[#16181C]">{label}</label>
      <div className="eeshaan-koltey-field flex items-center px-3 py-2 bg-white">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          className="w-full min-w-0 bg-transparent text-[13.5px] font-medium text-[#16181C] outline-none tabular-nums"
        />
        {unit && (
          <span className="ml-2 text-[11px] font-medium text-[#5F646B] uppercase tracking-wider whitespace-nowrap">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const id = useId();
  return (
    <div className="min-w-0 flex-1 basis-[190px]">
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-medium text-[#16181C]">{label}</label>
      <div className="eeshaan-koltey-field flex items-center px-3 py-2 bg-white">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 cursor-pointer appearance-none bg-transparent text-[13.5px] font-medium text-[#16181C] outline-none"
        >
          {options.map((option) => (
            <option key={option} value={option} className="text-[#16181C]">
              {option}
            </option>
          ))}
        </select>
        <span className="ml-1 text-[10px] text-[#5F646B]">▼</span>
      </div>
    </div>
  );
}

function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  display,
  delta,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
  display: string;
  delta?: string;
}) {
  return (
    <div className="rounded-[20px] border border-[rgba(22,24,28,0.08)] bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-medium text-[#16181C]">{label}</span>
        <span className="text-[14px] font-semibold tabular-nums text-[#16181C]">
          {display}
          {unit ? <span className="ml-0.5 text-[11px] font-normal text-[#5F646B]">{unit}</span> : null}
        </span>
      </div>
      <input
        type="range"
        className="range-amber h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[rgba(22,24,28,0.1)]"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="mt-1.5 flex justify-between text-[11px] text-[#5F646B]">
        <span>{vFmtNum(min, min < 10 ? 1 : 0)}</span>
        {delta && <span className="font-medium text-[#16181C]">{delta}</span>}
        <span>{vFmtNum(max, max < 10 ? 1 : 0)}</span>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  tone = 'light',
  className = '',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'light' | 'amber' | 'dark';
  className?: string;
}) {
  const toneCls =
    tone === 'amber'
      ? 'surface-cream border border-[#F4C74B]/40'
      : tone === 'dark'
        ? 'bg-[#16181C] text-white shadow-md'
        : 'surface';
  const labelCls = tone === 'dark' ? 'text-white/70' : 'text-[#5F646B]';
  const valCls = tone === 'dark' ? 'text-white' : 'text-[#16181C]';
  const subCls = tone === 'dark' ? 'text-white/60' : 'text-[#5F646B]';
  return (
    <div className={`min-w-0 rounded-[20px] sm:rounded-[22px] p-3.5 sm:p-4 ${toneCls} ${className}`}>
      <div className={`min-h-[2.4em] break-words text-[10px] sm:text-[11px] leading-[1.2] font-normal uppercase tracking-wider ${labelCls}`}>{label}</div>
      <div className={`mt-1 break-words text-[19px] sm:text-[22px] xl:text-[24px] font-light tracking-[-0.03em] tabular-nums ${valCls}`}>{value}</div>
      {sub && <div className={`text-[11.5px] sm:text-[12px] font-normal mt-0.5 ${subCls}`}>{sub}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- chart tooltips */
function AllocTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-[16px] bg-[#16181C] px-3.5 py-2.5 text-[12px] text-white shadow-xl">
      <div className="font-normal text-white/70">{p.name}</div>
      <div className="font-semibold text-white tabular-nums mt-0.5">{vFmtM(p.value)}</div>
    </div>
  );
}

function BarTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[16px] bg-[#16181C] px-3.5 py-2.5 text-[12px] text-white shadow-xl">
      <div className="font-normal text-white/70">{label}</div>
      <div className="font-semibold text-white tabular-nums mt-0.5">AED {vFmtNum(payload[0].value, 1)} / GFA sf</div>
    </div>
  );
}

/* ------------------------------------------------- high-contrast status tone */
function rowTone(r: SensitivityRow, targetMarginPercent: number) {
  if (r.grossMarginPercent < 0) {
    return {
      row: 'bg-[#FEECEA] hover:bg-[#FCD6D2]/60',
      metric: 'font-semibold text-[#96291D]',
      labelText: 'text-[#96291D]',
      chip: 'bg-[#FCD6D2] text-[#6B1D14] border border-[#FBB0A8]',
      status: 'Loss Territory',
    };
  }
  if (r.grossMarginPercent <= targetMarginPercent) {
    return {
      row: 'bg-[#FDF6E3] hover:bg-[#FBE6A4]/40',
      metric: 'font-semibold text-[#7A4A0E]',
      labelText: 'text-[#7A4A0E]',
      chip: 'bg-[#FBE6A4] text-[#7A4A0E] border border-[#F9D97E]',
      status: 'Below Target Margin',
    };
  }
  return {
    row: 'bg-[#EFF6F1] hover:bg-[#DFEDE4]/60',
    metric: 'font-semibold text-[#2F5C44]',
    labelText: 'text-[#224332]',
    chip: 'bg-[#DFEDE4] text-[#224332] border border-[#CFE3D6]',
    status: 'Meets Target Hurdle',
  };
}

/* ---------------- Tier-1 benchmarking reference (additive; static market data) */
const BENCHMARK_GFA_PSF = 1000;
const BENCHMARK_EFFICIENCY_PCT = 75;
const BENCHMARK_NSA_PSF = 1333.33;

interface BenchmarkSlice {
  label: string;
  short: string;
  pct: number;
  gfaPsf: number;
  nsaPsf: number;
  color: string;
  note: string;
}

const BASELINE_BENCHMARK_SLICES: BenchmarkSlice[] = [
  { label: 'Land Plot Acquisition', short: 'Land', pct: 25, gfaPsf: 250, nsaPsf: 333.33, color: '#579973', note: 'Plot + DLD & brokerage friction' },
  { label: 'Hard Costs (Construction & Finishes)', short: 'Hard', pct: 55, gfaPsf: 555, nsaPsf: 740.0, color: '#F4C74B', note: 'Structure, envelope & fit-out' },
  { label: 'Soft Costs & Consultant Fees', short: 'Soft', pct: 8, gfaPsf: 80, nsaPsf: 106.67, color: '#AEBEE9', note: 'Design, PMC & approvals' },
  { label: 'Escrow & Contingency Buffer', short: 'Buffer', pct: 7, gfaPsf: 70, nsaPsf: 93.33, color: '#FA6C5D', note: 'Retention & risk cover' },
  { label: 'Working Capital & Marketing', short: 'WC & Mkt', pct: 5, gfaPsf: 45, nsaPsf: 60.0, color: '#7BB694', note: 'Ops, launch & channel' },
];

function BenchmarkStackBar({ slices }: { slices: BenchmarkSlice[] }) {
  return (
    <div>
      <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-[rgba(22,24,28,0.08)]">
        {slices.map((s) => (
          <div
            key={s.short}
            className="flex h-full items-center justify-center text-[9px] font-bold tabular-nums transition-all"
            style={{ width: `${s.pct}%`, background: s.color, color: s.color === '#F4C74B' ? '#16181C' : '#FFFFFF' }}
            title={`${s.label}: ${s.pct}%`}
          >
            {s.pct >= 8 ? `${s.pct}%` : ''}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {slices.map((s) => (
          <span key={s.short} className="flex items-center gap-1.5 text-[11.5px] font-light text-[#5F646B]">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.short} <b className="font-medium tabular-nums text-[#16181C]">{vFmtNum(s.pct, 0)}%</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function BenchmarkSliceCard({ slice }: { slice: BenchmarkSlice }) {
  return (
    <div className="min-w-0 rounded-[18px] border border-[rgba(22,24,28,0.08)] bg-white p-3.5 shadow-sm">
      <div className="flex items-start gap-1.5">
        <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: slice.color }} />
        <span className="min-w-0 break-words text-[12px] font-medium leading-tight text-[#16181C]">{slice.label}</span>
      </div>
      <div className="mt-1.5 text-[22px] font-semibold leading-none tracking-tight tabular-nums text-[#16181C]">
        {vFmtNum(slice.pct, 0)}<span className="ml-0.5 text-[12px] font-normal text-[#5F646B]">%</span>
      </div>
      <div className="mt-2 space-y-1 border-t border-[rgba(22,24,28,0.06)] pt-2 text-[11.5px]">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[#5F646B]">GFA sf</span>
          <span className="font-semibold tabular-nums text-[#16181C]">AED {vFmtNum(slice.gfaPsf, slice.gfaPsf % 1 === 0 ? 0 : 2)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[#5F646B]">NSA sf</span>
          <span className="font-medium tabular-nums text-[#16181C]">AED {vFmtNum(slice.nsaPsf, 2)}</span>
        </div>
      </div>
      <div className="mt-1.5 text-[10.5px] font-light leading-snug text-[#5F646B]">{slice.note}</div>
    </div>
  );
}

function BenchmarkCompareRow({ label, baseline, tier1, delta, favorable }: { label: string; baseline: string; tier1: string; delta: string; favorable: boolean }) {
  return (
    <div className="flex flex-col items-stretch justify-between gap-1 rounded-[12px] bg-[rgba(246,247,249,0.8)] px-2.5 py-1.5 text-[11.5px] min-[420px]:flex-row min-[420px]:items-center">
      <span className="min-w-0 break-words leading-snug text-[#5F646B]">{label}</span>
      <span className="shrink-0 whitespace-nowrap tabular-nums text-[#16181C]">
        {baseline} <span className="text-[#9EA3AA]">→</span> <b>{tier1}</b>{' '}
        <span className={`font-semibold ${favorable ? 'text-[#2F5C44]' : 'text-[#96291D]'}`}>({delta})</span>
      </span>
    </div>
  );
}

function BenchmarkDualBar({ baselinePct, tierPct, color, scale = 60 }: { baselinePct: number; tierPct: number; color: string; scale?: number }) {
  return (
    <div className="space-y-1" aria-hidden="true">
      <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(22,24,28,0.06)]">
        <div className="h-full rounded-full bg-[rgba(22,24,28,0.28)]" style={{ width: `${Math.min(100, (baselinePct / scale) * 100)}%` }} />
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(22,24,28,0.06)]">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (tierPct / scale) * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

/* ======================================================================= */
export default function ViabilitySpotlight({
  simulation,
  onSeedUnderwriting,
  onSeedCfo,
}: {
  simulation: ViabilitySimulationController;
  onSeedUnderwriting: () => void;
  onSeedCfo: () => void;
}) {
  const { inputs, result, underwritingBaseline, update, updateNum, reset } = simulation;
  const seedHelpId = useId();

  const set = (k: keyof ViabilityInputs) => (v: number) => updateNum(k, v);

  const [landAnchor, setLandAnchor] = useState(() => inputs.quotedLandPrice);
  const landRangeBase = landAnchor > 0 ? landAnchor : 1;
  const landMin = landRangeBase * 0.2;
  const landMax = landRangeBase * 3.0;

  const setLandPrice = (v: number) => {
    updateNum('quotedLandPrice', v);
    if (v > 0) setLandAnchor(v);
  };

  const handleReset = () => {
    reset();
    setLandAnchor(VIABILITY_DEFAULTS.quotedLandPrice);
  };

  const targetRow = result.sensitivity.find((r) => r.id === 'target');
  const baselineMargin = targetRow?.grossMarginPercent ?? 0;
  const effDelta = result.totalDevCostPsfNsa;
  const gapPositive = result.gapToMarket >= 0;

  const constructionPhases = result.constructionDrawdowns;
  const constructionMetrics = result.constructionCostMetrics;
  const peakConstructionPhase = constructionPhases.reduce(
    (peak, phase) => (phase.allInCostAed > peak.allInCostAed ? phase : peak),
    constructionPhases[0],
  );
  const openingConstructionPhase = constructionPhases[0];
  const finalConstructionPhase = constructionPhases[constructionPhases.length - 1];
  const totalConstructionFunding = finalConstructionPhase?.cumulativeFundingAed ?? 0;
  const programmeMonths = constructionMetrics.projectDurationMonths;
  const programmeLabel = `${vFmtNum(programmeMonths, programmeMonths % 1 === 0 ? 0 : 1)} months`;

  // Live scheme vs 1,000 AED PSF GFA benchmark (additive derivation; no engine changes).
  const liveGfa = result.maxGfa > 0 ? result.maxGfa : 0;
  const liveCostExFinanceGfa = liveGfa > 0
    ? (result.landTotalAed + result.buildSoftOnlyAed + result.workingCapitalTotalAed) / liveGfa
    : 0;
  const liveLandGfaPsf = result.landCostPsfGfa;
  const liveHardGfaPsf = inputs.constructionPsfGfa;
  const liveSoftWcGfa = result.buildSoftPsfGfa - inputs.constructionPsfGfa + result.workingCapitalPsfGfa;
  const benchmarkDeltaGfa = liveCostExFinanceGfa - BENCHMARK_GFA_PSF;
  const benchmarkDeltaPct = BENCHMARK_GFA_PSF > 0 ? (benchmarkDeltaGfa / BENCHMARK_GFA_PSF) * 100 : 0;
  const benchmarkTone: 'mint' | 'amber' | 'coral' =
    benchmarkDeltaGfa <= 0 ? 'mint' : benchmarkDeltaGfa <= 150 ? 'amber' : 'coral';
  const benchmarkStatus =
    benchmarkDeltaGfa <= 0 ? 'At / below benchmark' : benchmarkDeltaGfa <= 150 ? 'Within tolerance band' : 'Above benchmark envelope';

  return (
    <div className="space-y-6">
      {/* Page Title & Intro */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[21px] sm:text-[26px] font-light leading-tight tracking-[-0.02em] text-[#16181C]">
            Capital Origination &amp; Macro Feasibility
          </h2>
          <p className="mt-0.5 text-[12.5px] sm:text-[13px] font-normal text-[#5F646B] max-w-2xl">
            Plot scanning, cost-approach underwriting and institutional 4-tier strategic sensitivity simulation.
          </p>
        </div>
        <PillBtn tone="soft" onClick={handleReset}>
          Reset Assumptions
        </PillBtn>
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3.5 lg:grid-cols-5">
        <Metric
          tone="dark"
          label="Max GFA Envelope"
          value={`${vFmtNum(result.maxGfa)} sf`}
          sub={`NSA ${vFmtNum(result.nsa)} sf @ ${vFmtPct(inputs.nsaEfficiency, 1)}`}
        />
        <Metric
          label="Effective Land Basis"
          value={vFmtM(result.landEffective)}
          sub={`AED ${vFmtNum(result.landCostPsfGfa, 0)}/GFA sf`}
        />
        <Metric
          label="Total Dev Cost / NSA"
          value={`AED ${vFmtNum(result.totalDevCostPsfNsa, 0)}`}
          sub="cost-approach all-in rate"
        />
        <Metric
          tone="amber"
          label="Baseline Breakeven Floor"
          value={`AED ${vFmtNum(result.breakevenPsf, 0)}`}
          sub={`incl. ${vFmtPct(result.totalSalesLeakage, 0)} sales leakage`}
        />
        <Metric
          className="col-span-2 sm:col-span-1"
          label="Gap to Market Comp"
          value={`${gapPositive ? '+' : ''}AED ${vFmtNum(result.gapToMarket, 0)}`}
          sub={gapPositive ? 'positive underwriting alpha' : 'below market floor'}
        />
      </div>

      {/* Tier-1 Master Developer & Premium Independent Benchmarking Analyzer */}
      <Panel
        title="Tier-1 Master Developer & Premium Independent Benchmarking Analyzer"
        subtitle="Institutional 1,000 AED PSF GFA reference layout at 75% floorplate efficiency — contrasted against Tier-1 structural cost advantages."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="amber">{`${vFmtNum(BENCHMARK_GFA_PSF, 0)} AED / GFA sf`}</Badge>
            <Badge tone="neutral">{`${vFmtNum(BENCHMARK_NSA_PSF, 2)} AED / NSA sf`}</Badge>
          </div>
        }
      >
        {/* 1 · Baseline private developer scheme */}
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-[13px] font-medium text-[#16181C]">Baseline Private Developer Scheme</h4>
          <span className="text-[11.5px] font-light text-[#5F646B]">
            {vFmtNum(BENCHMARK_EFFICIENCY_PCT, 0)}% efficiency · GFA {vFmtNum(BENCHMARK_GFA_PSF, 0)} → NSA {vFmtNum(BENCHMARK_NSA_PSF, 2)}
          </span>
        </div>
        <div className="mt-2.5">
          <BenchmarkStackBar slices={BASELINE_BENCHMARK_SLICES} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-5">
          {BASELINE_BENCHMARK_SLICES.map((s) => (
            <BenchmarkSliceCard key={s.short} slice={s} />
          ))}
        </div>

        {/* Live scheme vs benchmark */}
        <div className="mt-4 rounded-[18px] border border-[rgba(22,24,28,0.08)] bg-[rgba(246,247,249,0.7)] p-3.5 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[12px] font-medium text-[#16181C]">
              Your live scheme vs the {vFmtNum(BENCHMARK_GFA_PSF, 0)} benchmark
              <span className="ml-1.5 text-[11px] font-light text-[#5F646B]">ex-financing, per GFA sf</span>
            </div>
            <Badge tone={benchmarkTone} dot>{benchmarkStatus}</Badge>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="min-w-0 rounded-[14px] border border-[rgba(22,24,28,0.06)] bg-white px-3 py-2">
              <div className="text-[10px] font-normal uppercase tracking-wider text-[#5F646B]">Live all-in</div>
              <div className="mt-0.5 break-words text-[15px] font-semibold tabular-nums text-[#16181C]">
                AED {vFmtNum(liveCostExFinanceGfa, 0)}
              </div>
              <div className="text-[10.5px] font-light text-[#5F646B]">per GFA sf</div>
            </div>
            <div className="min-w-0 rounded-[14px] border border-[rgba(22,24,28,0.06)] bg-white px-3 py-2">
              <div className="text-[10px] font-normal uppercase tracking-wider text-[#5F646B]">Benchmark</div>
              <div className="mt-0.5 break-words text-[15px] font-semibold tabular-nums text-[#16181C]">
                AED {vFmtNum(BENCHMARK_GFA_PSF, 0)}
              </div>
              <div className="text-[10.5px] font-light text-[#5F646B]">per GFA sf</div>
            </div>
            <div className="min-w-0 rounded-[14px] border border-[rgba(22,24,28,0.06)] bg-white px-3 py-2">
              <div className="text-[10px] font-normal uppercase tracking-wider text-[#5F646B]">Variance</div>
              <div className={`mt-0.5 break-words text-[15px] font-semibold tabular-nums ${benchmarkDeltaGfa <= 0 ? 'text-[#2F5C44]' : 'text-[#96291D]'}`}>
                {benchmarkDeltaGfa >= 0 ? '+' : ''}AED {vFmtNum(benchmarkDeltaGfa, 0)}
              </div>
              <div className="text-[10.5px] font-light text-[#5F646B]">
                {benchmarkDeltaPct >= 0 ? '+' : ''}{vFmtNum(benchmarkDeltaPct, 1)}% vs benchmark
              </div>
            </div>
            <div className="min-w-0 rounded-[14px] border border-[rgba(22,24,28,0.06)] bg-white px-3 py-2">
              <div className="text-[10px] font-normal uppercase tracking-wider text-[#5F646B]">Envelope swing</div>
              <div className="mt-0.5 break-words text-[15px] font-semibold tabular-nums text-[#16181C]">
                {vFmtM(benchmarkDeltaGfa * liveGfa)}
              </div>
              <div className="text-[10.5px] font-light text-[#5F646B]">on {vFmtNum(liveGfa, 0)} sf GFA</div>
            </div>
          </div>
          <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <BenchmarkCompareRow
              label="Land basis / GFA sf"
              baseline={`AED ${vFmtNum(liveLandGfaPsf, 0)} live`}
              tier1={`AED ${vFmtNum(250, 0)} ref`}
              delta={`${liveLandGfaPsf - 250 >= 0 ? '+' : ''}AED ${vFmtNum(liveLandGfaPsf - 250, 0)}`}
              favorable={liveLandGfaPsf <= 250}
            />
            <BenchmarkCompareRow
              label="Hard cost / GFA sf"
              baseline={`AED ${vFmtNum(liveHardGfaPsf, 0)} live`}
              tier1={`AED ${vFmtNum(555, 0)} ref`}
              delta={`${liveHardGfaPsf - 555 >= 0 ? '+' : ''}AED ${vFmtNum(liveHardGfaPsf - 555, 0)}`}
              favorable={liveHardGfaPsf <= 555}
            />
            <BenchmarkCompareRow
              label="Soft + WC / GFA sf"
              baseline={`AED ${vFmtNum(liveSoftWcGfa, 0)} live`}
              tier1={`AED ${vFmtNum(125, 0)} ref`}
              delta={`${liveSoftWcGfa - 125 >= 0 ? '+' : ''}AED ${vFmtNum(liveSoftWcGfa - 125, 0)}`}
              favorable={liveSoftWcGfa <= 125}
            />
          </div>
        </div>

        {/* 2 · Tier-1 margin structuring advantage */}
        <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-[13px] font-medium text-[#16181C]">Tier-1 Margin Structuring Advantage</h4>
          <span className="text-[11.5px] font-light text-[#5F646B]">
            Same {vFmtNum(BENCHMARK_GFA_PSF, 0)} cost physics — different capital structure
          </span>
        </div>
        <div className="mt-2.5 grid grid-cols-1 gap-3.5 lg:grid-cols-3">
          {/* Master Developer Model */}
          <article className="flex min-w-0 flex-col rounded-[20px] border border-[rgba(22,24,28,0.08)] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge tone="mint" dot>Land Banking Advantage</Badge>
              <span className="text-[10.5px] font-medium uppercase tracking-wider text-[#5F646B]">Model 01</span>
            </div>
            <h5 className="mt-2.5 text-[14px] font-medium tracking-tight text-[#16181C]">Master Developer Model</h5>
            <p className="text-[11.5px] font-normal text-[#5F646B]">Large-scale master developer · historic land bank</p>
            <div className="mt-2.5 space-y-1.5">
              <BenchmarkCompareRow
                label="Land share of cost"
                baseline={`${vFmtNum(25, 0)}%`}
                tier1={`${vFmtNum(10, 0)}–${vFmtNum(15, 0)}%`}
                delta={`${vFmtNum(-15, 0)} to ${vFmtNum(-10, 0)} pts`}
                favorable
              />
              <BenchmarkCompareRow
                label="Land PSF / GFA"
                baseline={`AED ${vFmtNum(250, 0)}`}
                tier1={`AED ${vFmtNum(100, 0)}–${vFmtNum(150, 0)}`}
                delta={`−AED ${vFmtNum(100, 0)}–${vFmtNum(150, 0)}`}
                favorable
              />
              <BenchmarkCompareRow
                label={`Margin @ ${vFmtNum(3000, 0)} exit`}
                baseline={`AED ${vFmtNum(2000, 0)}`}
                tier1={`AED ${vFmtNum(2100, 0)}–${vFmtNum(2150, 0)}`}
                delta="to profit"
                favorable
              />
            </div>
            <div className="mt-2.5">
              <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-[#5F646B]">
                <span>Baseline land load</span>
                <span>Master land load</span>
              </div>
              <BenchmarkDualBar baselinePct={25} tierPct={12.5} color="#579973" scale={30} />
            </div>
            <p className="mt-2.5 text-[11.5px] font-light leading-relaxed text-[#5F646B]">
              Decades of land banking compress land to {vFmtNum(10, 0)}–{vFmtNum(15, 0)}% of cost. The released{' '}
              AED {vFmtNum(100, 0)}–{vFmtNum(150, 0)} per GFA sf shifts entirely into gross margin when transacting
              at a AED {vFmtNum(3000, 0)}+ premium — on your {vFmtNum(liveGfa, 0)} sf envelope that is ≈{' '}
              {vFmtM(125 * liveGfa)} of structural headroom at midpoint.
            </p>
            <p className="mt-2 rounded-[12px] bg-[#EFF6F1] px-2.5 py-1.5 text-[11px] font-normal leading-relaxed text-[#2F5C44]">
              Pitch line — landowners: a banked-land partner can concede headline price and still clear hurdle margin.
            </p>
          </article>

          {/* Vertically Integrated Model */}
          <article className="flex min-w-0 flex-col rounded-[20px] border border-[rgba(22,24,28,0.08)] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge tone="amber" dot>In-House Contracting</Badge>
              <span className="text-[10.5px] font-medium uppercase tracking-wider text-[#5F646B]">Model 02</span>
            </div>
            <h5 className="mt-2.5 text-[14px] font-medium tracking-tight text-[#16181C]">Vertically Integrated Model</h5>
            <p className="text-[11.5px] font-normal text-[#5F646B]">In-house contracting, MEP &amp; joinery</p>
            <div className="mt-2.5 space-y-1.5">
              <BenchmarkCompareRow
                label="Hard cost / GFA sf"
                baseline={`AED ${vFmtNum(555, 0)}`}
                tier1={`≈ AED ${vFmtNum(480, 0)}`}
                delta={`−AED ${vFmtNum(75, 0)}`}
                favorable
              />
              <BenchmarkCompareRow
                label="Hard share of cost"
                baseline={`${vFmtNum(55, 0)}%`}
                tier1={`≈ ${vFmtNum(48, 0)}%`}
                delta={`${vFmtNum(-7, 0)} pts`}
                favorable
              />
              <BenchmarkCompareRow
                label="All-in envelope"
                baseline={`AED ${vFmtNum(1000, 0)}`}
                tier1={`≈ AED ${vFmtNum(925, 0)}`}
                delta={`−AED ${vFmtNum(75, 0)}`}
                favorable
              />
            </div>
            <div className="mt-2.5">
              <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-[#5F646B]">
                <span>Baseline hard load</span>
                <span>Integrated hard load</span>
              </div>
              <BenchmarkDualBar baselinePct={55} tierPct={48} color="#F4C74B" scale={60} />
            </div>
            <p className="mt-2.5 text-[11.5px] font-light leading-relaxed text-[#5F646B]">
              Captive contracting, MEP and joinery manufacturing strip out main-contractor profit, compressing hard
              costs to ≈ AED {vFmtNum(480, 0)} per GFA sf at identical premium luxury specification — ≈{' '}
              {vFmtM(75 * liveGfa)} of released capital on your {vFmtNum(liveGfa, 0)} sf envelope.
            </p>
            <p className="mt-2 rounded-[12px] bg-[#FDF6E3] px-2.5 py-1.5 text-[11px] font-normal leading-relaxed text-[#7A4A0E]">
              Pitch line — financiers: in-house delivery de-risks cost overrun and protects the debt service cushion.
            </p>
          </article>

          {/* High Brand Equity Independents */}
          <article className="flex min-w-0 flex-col rounded-[20px] border border-[rgba(22,24,28,0.08)] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge tone="coral" dot>Elevated Channel Spend</Badge>
              <span className="text-[10.5px] font-medium uppercase tracking-wider text-[#5F646B]">Model 03</span>
            </div>
            <h5 className="mt-2.5 text-[14px] font-medium tracking-tight text-[#16181C]">High Brand Equity Independents</h5>
            <p className="text-[11.5px] font-normal text-[#5F646B]">Design-led independent · lifestyle premium</p>
            <div className="mt-2.5 space-y-1.5">
              <BenchmarkCompareRow
                label="Soft + marketing share"
                baseline={`${vFmtNum(13, 0)}%`}
                tier1={`${vFmtNum(15, 0)}–${vFmtNum(18, 0)}%`}
                delta={`+${vFmtNum(2, 0)} to +${vFmtNum(5, 0)} pts`}
                favorable={false}
              />
              <BenchmarkCompareRow
                label="Soft + marketing PSF"
                baseline={`AED ${vFmtNum(125, 0)}`}
                tier1={`AED ${vFmtNum(150, 0)}–${vFmtNum(180, 0)}`}
                delta={`+AED ${vFmtNum(25, 0)}–${vFmtNum(55, 0)}`}
                favorable={false}
              />
              <BenchmarkCompareRow
                label="Cost-to-revenue"
                baseline={`≈ ${vFmtNum(40, 1)}% @ ${vFmtNum(2500, 0)}`}
                tier1={`≈ ${vFmtNum(33.3, 1)}% @ ${vFmtNum(3000, 0)}`}
                delta="diluted"
                favorable
              />
            </div>
            <div className="mt-2.5">
              <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-[#5F646B]">
                <span>Baseline soft + channel</span>
                <span>Brand-led spend</span>
              </div>
              <BenchmarkDualBar baselinePct={13} tierPct={16.5} color="#FA6C5D" scale={20} />
            </div>
            <p className="mt-2.5 text-[11.5px] font-light leading-relaxed text-[#5F646B]">
              Soft costs plus aggressive global broker marketing expand to {vFmtNum(15, 0)}–{vFmtNum(18, 0)}% combined —
              up to AED {vFmtNum(180, 0)} per GFA sf. Yet at a AED {vFmtNum(3000, 0)} lifestyle sale the core{' '}
              AED {vFmtNum(1000, 0)} base dilutes to ≈ {vFmtNum(33.3, 1)}% of revenue versus ≈ {vFmtNum(40, 1)}% at{' '}
              AED {vFmtNum(2500, 0)}.
            </p>
            <p className="mt-2 rounded-[12px] bg-[#FEECEA] px-2.5 py-1.5 text-[11px] font-normal leading-relaxed text-[#96291D]">
              Pitch line — off-plan buyers: brand and design equity convert channel spend into resale resilience.
            </p>
          </article>
        </div>

        {/* Development Manager pitch summary */}
        <div className="mt-4 rounded-[18px] border border-[#FBE6A4] bg-[#FDF6E3] p-4">
          <div className="text-[12px] font-semibold text-[#7A4A0E]">Development Manager — how to deploy this benchmark in the room</div>
          <div className="mt-2 grid grid-cols-1 gap-2.5 text-[11.5px] font-normal leading-relaxed text-[#7A4A0E] sm:grid-cols-3">
            <p>
              <b>Landowners:</b> anchor negotiations on the AED {vFmtNum(250, 0)} / GFA ({vFmtNum(25, 0)}%) land slice —
              any plot priced above it must be defended by superior FAR or a {vFmtNum(3000, 0)}+ exit.
            </p>
            <p>
              <b>Financiers:</b> the live {benchmarkStatus.toLowerCase()} ({benchmarkDeltaGfa >= 0 ? '+' : ''}AED{' '}
              {vFmtNum(benchmarkDeltaGfa, 0)} vs benchmark) sizes the contingency the facility must underwrite.
            </p>
            <p>
              <b>Off-plan buyers:</b> a sub-{vFmtNum(1000, 0)} ex-finance build with a {vFmtNum(2500, 0)}+ comp leaves
              visible margin to fund specification, DLP cover and timely handover.
            </p>
          </div>
        </div>
      </Panel>

      {/* Sync Card */}
      <EeshaanKolteyCard variant="cream" className="p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1 basis-full md:basis-[320px]">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber text-ink text-[12px] font-bold">
                ⚡
              </span>
              <h3 className="text-[15.5px] sm:text-[16px] font-medium text-[#16181C]">Cross-Workspace Underwriting Sync</h3>
            </div>
            <p id={seedHelpId} className="mt-1 text-[12px] sm:text-[12.5px] font-normal text-[#5F646B] leading-relaxed">
              Push validated plot envelope, land basis, market rate and duration directly to Workspace 2 (Treasury) or Workspace 3 (SPV CFO).
            </p>
          </div>
          <div className="flex w-full sm:w-auto flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
            <PillBtn
              tone="amber"
              icon={<Sparkles />}
              onClick={onSeedUnderwriting}
              disabled={!underwritingBaseline.valid}
              className="w-full sm:w-auto"
            >
              Seed to Treasury Workspace
            </PillBtn>
            <PillBtn
              tone="dark"
              icon={<Download />}
              onClick={onSeedCfo}
              disabled={!underwritingBaseline.valid}
              className="w-full sm:w-auto"
            >
              Seed to CFO Workspace
            </PillBtn>
          </div>
        </div>
      </EeshaanKolteyCard>

      {/* Inputs + live sliders */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title="Plot &amp; Asset Parameters" subtitle="Core parcel geometry, planning envelopes and land acquisition friction." className="lg:col-span-2">
          <div className="flex flex-wrap gap-4">
            <NumField label="Plot Area" unit="sqft" step={0.01} value={inputs.plotArea} onChange={set('plotArea')} />
            <NumField label="Permissible FAR" unit="x" step={0.01} value={inputs.permissibleFar} onChange={set('permissibleFar')} />
            <NumField label="Quoted Land Price" unit="AED" step={100000} value={inputs.quotedLandPrice} onChange={setLandPrice} />
            <NumField label="Market Comp Price" unit="AED/sf" step={25} value={inputs.marketCompPsf} onChange={set('marketCompPsf')} />
            <NumField label="DLD Transfer Fee" unit="%" step={0.1} value={inputs.landDldFee} onChange={set('landDldFee')} />
            <NumField label="Land Brokerage" unit="%" step={0.1} value={inputs.landBrokerage} onChange={set('landBrokerage')} />
            <SelectField
              label="Product Typology"
              value={inputs.productTypology}
              onChange={(v) => update('productTypology', v as ProductTypology)}
              options={PRODUCT_TYPOLOGIES}
            />
          </div>

          <label className="mt-4 flex w-full sm:w-fit max-w-full cursor-pointer items-start sm:items-center gap-3 rounded-[18px] border border-[rgba(22,24,28,0.08)] bg-white px-3.5 py-2.5 sm:px-4">
            <input
              type="checkbox"
              className="mt-0.5 sm:mt-0 h-4 w-4 shrink-0 accent-amber cursor-pointer rounded"
              checked={inputs.landPriceInclusive}
              onChange={(e) => update('landPriceInclusive', e.target.checked)}
            />
            <span className="min-w-0 text-[12.5px] sm:text-[13px] font-normal text-[#16181C] leading-snug">
              Land price is inclusive of transaction costs
              <span className="block sm:inline sm:ml-1 text-[11.5px] font-light text-[#5F646B]">
                {inputs.landPriceInclusive ? '(no fee uplift applied)' : `(+${(inputs.landDldFee + inputs.landBrokerage).toFixed(1)}% DLD & brokerage)`}
              </span>
            </span>
          </label>

          <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <SliderField
              label="NSA Efficiency Ratio"
              unit="%"
              display={vFmtPct(inputs.nsaEfficiency, 1)}
              value={inputs.nsaEfficiency}
              onChange={set('nsaEfficiency')}
              min={55}
              max={92}
              step={0.5}
              delta={`Impact: AED ${vFmtNum(effDelta, 0)}/NSA sf`}
            />
            <SliderField
              label="Quoted Land Price"
              unit="AED"
              display={vFmtM(inputs.quotedLandPrice)}
              value={Math.min(landMax, Math.max(landMin, inputs.quotedLandPrice))}
              onChange={setLandPrice}
              min={landMin}
              max={landMax}
              step={100000}
              delta={`Effective: ${vFmtM(result.landEffective)}`}
            />
          </div>
        </Panel>

        <Panel title="Build, Soft &amp; Working Capital" subtitle="Physical and consulting expenditure budgeted per GFA sf.">
          <div className="flex flex-wrap gap-3">
            <NumField label="Base Construction" unit="AED/GFA" step={5} value={inputs.constructionPsfGfa} onChange={set('constructionPsfGfa')} />
            <NumField label="Approvals & Soft" unit="AED/GFA" step={1} value={inputs.approvalsPsfGfa} onChange={set('approvalsPsfGfa')} />
            <NumField label="PMC Fee" unit="%" step={0.1} value={inputs.pmcPercent} onChange={set('pmcPercent')} />
            <NumField label="Escalation Buffer" unit="%" step={0.1} value={inputs.escalationPercent} onChange={set('escalationPercent')} />
            <NumField label="Contingency Buffer" unit="%" step={0.1} value={inputs.contingencyPercent} onChange={set('contingencyPercent')} />
            <NumField label="Financing ARR" unit="%" step={0.25} value={inputs.financingArr} onChange={set('financingArr')} />
            <NumField label="Project Duration" unit="years" step={0.5} min={0.5} value={inputs.projectDurationYears} onChange={set('projectDurationYears')} />
          </div>

          <div className="mt-4 rounded-[20px] border border-[rgba(22,24,28,0.08)] bg-white p-4">
            <div className="text-[11px] font-normal uppercase tracking-wider text-[#5F646B]">
              Working capital wallet allocations (flat PSF GFA)
            </div>
            <div className="mt-2.5 grid grid-cols-2 sm:flex sm:flex-wrap gap-2 text-[12px]">
              {([
                ['Office/Team', 'wcOfficeTeam'],
                ['Marketing', 'wcMarketing'],
                ['Hospitality', 'wcHospitality'],
                ['Legal', 'wcLegal'],
                ['RERA', 'wcRera'],
                ['Reserve', 'wcReserve'],
              ] as [string, keyof ViabilityInputs][]).map(([lbl, key]) => (
                <div key={key} className="flex items-center justify-between gap-1.5 rounded-full bg-[rgba(246,247,249,0.9)] px-3 py-1 border border-[rgba(22,24,28,0.06)]">
                  <span className="truncate text-[#5F646B]">{lbl}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    aria-label={`${lbl} working capital PSF`}
                    value={inputs[key] as number}
                    onChange={(e) => updateNum(key, e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-12 sm:w-14 shrink-0 rounded bg-white px-1.5 py-0.5 text-right font-medium tabular-nums text-[#16181C] outline-none border border-[rgba(22,24,28,0.1)]"
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 text-[12.5px] font-normal text-[#16181C]">
              Total Working Capital: <b>AED {vFmtNum(result.workingCapitalPsfGfa, 0)}/GFA sf</b>
            </div>
            <div className="mt-2 rounded-[14px] bg-[#FDF6E3] p-2.5 text-[11.5px] font-normal text-[#7A4A0E] border border-[#FBE6A4]">
              Compounded financing carry ×<b>{result.dynamicFinanceMultiplier.toFixed(3)}</b> ({inputs.financingArr}% over {inputs.projectDurationYears} yrs) = <b>{vFmtM(result.financeCostTotalAed)}</b>
            </div>
          </div>
        </Panel>
      </div>

      {/* Visual Analytics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Panel title="Capital Allocation Profile" subtitle="Relative distribution of all-in project capitalization." className="lg:col-span-2">
          <div className="h-[240px] sm:h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={result.allocation} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={54} outerRadius={88} paddingAngle={2} stroke="none">
                  {result.allocation.map((a) => (
                    <Cell key={a.name} fill={a.color} />
                  ))}
                </Pie>
                <Tooltip content={<AllocTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {result.allocation.map((a) => (
              <div key={a.name} className="flex items-center gap-2 text-[12px]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a.color }} />
                <span className="min-w-0 flex-1 truncate text-[#5F646B]">{a.name}</span>
                <span className="shrink-0 font-medium tabular-nums text-[#16181C]">{vFmtM(a.value)}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Cost-Plus Stack (AED / GFA sf)" subtitle="Cost components per gross building footprint." className="lg:col-span-3">
          <div className="h-[290px] sm:h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={result.costBars} margin={{ top: 8, right: 12, left: -8, bottom: 16 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#5F646B', fontSize: 10.5 }}
                  axisLine={{ stroke: 'rgba(22,24,28,0.1)' }}
                  tickLine={false}
                  interval={0}
                  angle={-22}
                  textAnchor="end"
                  height={48}
                />
                <YAxis tick={{ fill: '#5F646B', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip cursor={{ fill: 'rgba(244,199,75,0.08)' }} content={<BarTooltip />} />
                <Bar dataKey="psf" radius={[6, 6, 0, 0]} maxBarSize={68} isAnimationActive={false}>
                  {result.costBars.map((c) => (
                    <Cell key={c.name} fill={c.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Four-phase S-curve construction capital release */}
      <Panel
        title="Underwritten Construction Capital Release Profile"
        subtitle="Institutional 4-phase S-curve scheduling hard outlays and pro-rata approvals/soft costs across the certified build programme."
        right={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FBE6A4] bg-[#FDF6E3] px-3 py-1 text-[11px] font-semibold text-[#7A4A0E]">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-deep" />
            4-Phase S-Curve
          </span>
        }
      >
        {/* Aggregate schedule metrics */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
          {[
            {
              label: 'All-in Build Funding',
              value: vFmtM(constructionMetrics.allInConstructionAed),
              note: `AED ${vFmtNum(constructionMetrics.allInConstructionPsfNsa, 0)} / NSA sf`,
              accent: false,
            },
            {
              label: 'Hard Outlay',
              value: vFmtM(constructionMetrics.hardCostTotalAed),
              note: `AED ${vFmtNum(constructionMetrics.hardCostTotalPsfNsa, 0)} / NSA sf`,
              accent: false,
            },
            {
              label: 'Approvals',
              value: vFmtM(constructionMetrics.approvalsTotalAed),
              note: `AED ${vFmtNum(constructionMetrics.approvalsTotalPsfNsa, 0)} / NSA sf`,
              accent: false,
            },
            {
              label: 'Programme',
              value: programmeLabel,
              note: `Peak: ${peakConstructionPhase?.shortLabel} · ${vFmtM(constructionMetrics.peakPhaseFundingAed)}`,
              accent: true,
            },
          ].map((metric) => (
            <div
              key={metric.label}
              className={`min-w-0 rounded-[16px] border px-3 py-2.5 sm:px-3.5 ${
                metric.accent ? 'border-[#F4C74B]/35 bg-[#FBF7E9]' : 'border-hair bg-[rgba(246,247,249,0.7)]'
              }`}
            >
              <div className={`text-[9.5px] font-medium uppercase leading-tight tracking-wider sm:text-[10px] ${metric.accent ? 'text-[#7A4A0E]' : 'text-[#5F646B]'}`}>
                {metric.label}
              </div>
              <div className="mt-1 break-words text-[15px] font-semibold tabular-nums text-[#16181C] sm:text-[16px]">{metric.value}</div>
              <div className={`mt-0.5 break-words text-[10px] font-light leading-snug ${metric.accent ? 'text-[#7A4A0E]' : 'text-[#5F646B]'}`}>
                {metric.note}
              </div>
            </div>
          ))}
        </div>

        {/* Phase cards */}
        <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          {constructionPhases.map((phase) => (
            <article
              key={phase.id}
              className="relative flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-[rgba(22,24,28,0.08)] bg-white p-4 shadow-[0_1px_3px_rgba(22,24,28,0.04)] transition-shadow hover:shadow-[0_10px_28px_-18px_rgba(22,24,28,0.28)]"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-amber/30 via-amber-deep to-amber/30" />

              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FBE6A4] bg-[#FDF6E3] px-2.5 py-1 text-[10.5px] font-semibold text-[#7A4A0E]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-deep" />
                  {phase.timelineLabel}
                </span>
                <span className="shrink-0 text-[20px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-amber-deep">
                  {phase.weightPercent}%
                </span>
              </div>

              <div className="mt-3 text-[9.5px] font-medium uppercase tracking-[0.12em] text-[#5F646B]">
                Phase {phase.sequence} · {phase.durationMonths} mo window
              </div>
              <h4 className="mt-0.5 min-h-[2.4em] text-[13px] font-medium leading-snug tracking-[-0.01em] text-[#16181C]">
                {phase.label}
              </h4>

              <div className="mt-3 space-y-2 border-t border-[rgba(22,24,28,0.06)] pt-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11.5px] font-normal text-[#5F646B]">Hard Cost Outlay</span>
                  <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-[#16181C]">
                    {vFmtM(phase.hardCostAed)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11.5px] font-normal text-[#5F646B]">All-in Phased Funding</span>
                  <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-[#16181C]">
                    {vFmtM(phase.allInCostAed)}
                  </span>
                </div>
                <div className="rounded-[10px] bg-[rgba(246,247,249,0.8)] px-2.5 py-1.5 text-[10.5px] font-light leading-relaxed text-[#5F646B]">
                  Approvals {vFmtM(phase.approvalsAed)} · Soft loadings {vFmtM(phase.pmcAed + phase.escalationAed + phase.contingencyAed)}
                </div>
              </div>

              <div className="mt-auto pt-3.5">
                <div className="mb-1 flex items-center justify-between gap-2 text-[9.5px] font-medium uppercase tracking-wider text-[#5F646B]">
                  <span>Loading weight</span>
                  <span className="tabular-nums text-[#16181C]">{phase.weightPercent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[rgba(22,24,28,0.06)]" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber to-amber-deep transition-all duration-500"
                    style={{ width: `${phase.weightPercent}%` }}
                  />
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2 text-[10.5px]">
                  <span className="text-[#5F646B]">Cumulative funding</span>
                  <span className="shrink-0 font-semibold tabular-nums text-[#16181C]">{vFmtM(phase.cumulativeFundingAed)}</span>
                </div>
                <div className="mt-0.5 text-right text-[10px] font-light tabular-nums text-[#5F646B]">
                  AED {vFmtNum(phase.allInCostPsfNsa, 0)} / NSA sf
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Financier carry narrative */}
        <div className="mt-4 flex flex-col gap-3 rounded-[20px] border border-[#FBE6A4] bg-[#FDF6E3] p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber text-[13px] font-semibold text-[#16181C]">
              ↘
            </span>
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold text-[#7A4A0E]">
                Milestone cadence protects accrued interest and financier exposure
              </div>
              <p className="mt-1 text-[11.5px] font-normal leading-relaxed text-[#7A4A0E] sm:text-[12px]">
                Only {openingConstructionPhase?.weightPercent ?? 0}% ({vFmtM(openingConstructionPhase?.allInCostAed ?? 0)}) is released during enabling works, while the {' '}
                {peakConstructionPhase?.weightPercent ?? 0}% structural peak ({vFmtM(peakConstructionPhase?.allInCostAed ?? 0)}) lands in{' '}
                {peakConstructionPhase?.timelineLabel.toLowerCase()}. Staging the {vFmtM(totalConstructionFunding)} all-in requirement against certified WIP,
                rather than funding it as a Day-1 bullet, keeps average drawn principal lower through the {programmeLabel} build and flattens the compounded
                interest carry curve. Facility drawdowns step up to the structural peak, taper to {vFmtM(finalConstructionPhase?.allInCostAed ?? 0)} through
                fit-out, and align capital calls with visible asset value creation for financier and landowner diligence.
              </p>
              <p className="mt-1.5 text-[10.5px] font-light leading-relaxed text-[#7A4A0E]/85">
                All-in values include the approvals envelope plus pro-rata PMC, escalation and contingency. Financing carry is modelled separately in the
                underwriting block above; phase AED allocations reconcile exactly to the aggregate construction budget.
              </p>
            </div>
          </div>
          <div className="shrink-0 rounded-[14px] border border-[#F4C74B]/40 bg-white/75 px-3.5 py-2.5 lg:text-right">
            <div className="text-[9.5px] font-medium uppercase tracking-wider text-[#7A4A0E]/75">Cumulative all-in funding</div>
            <div className="mt-0.5 text-[17px] font-semibold tabular-nums text-[#16181C]">{vFmtM(totalConstructionFunding)}</div>
            <div className="mt-0.5 text-[10px] font-light text-[#7A4A0E]/80">
              {constructionPhases.map((phase) => `${phase.weightPercent}%`).join(' · ')} across four release gates
            </div>
          </div>
        </div>
      </Panel>

      {/* 4-Tier Institutional Sensitivity Matrix */}
      <Panel
        title="4-Tier Institutional Sensitivity Matrix"
        subtitle="Downmarket stress-testing with dynamic leakage scaling and escrow cancellation penalties."
        right={
          <div className="flex w-full sm:w-auto flex-wrap items-end justify-between sm:justify-end gap-3">
            <div className="sm:text-right">
              <span className="text-[11px] font-normal uppercase tracking-wider text-[#5F646B]">Target Margin:</span>
              <span className="ml-1.5 text-[14px] font-semibold tabular-nums text-[#16181C]">
                {vFmtPct(baselineMargin, 1)}
              </span>
            </div>
            <div className="w-[140px] sm:w-[150px]">
              <NumField
                label="Hurdle"
                unit="%"
                step={0.5}
                min={0}
                max={100}
                value={inputs.targetMarginPercent}
                onChange={(v) => updateNum('targetMarginPercent', Math.min(100, Math.max(0, v)))}
              />
            </div>
          </div>
        }
      >
        {/* Mobile native scenario tier cards (< md) */}
        <div className="space-y-3 md:hidden">
          {result.sensitivity.map((r) => {
            const tone = rowTone(r, inputs.targetMarginPercent);
            return (
              <div
                key={r.id}
                className={`rounded-[20px] border border-[rgba(22,24,28,0.08)] p-4 shadow-sm transition-colors ${tone.row}`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0">
                    <div className={`text-[14.5px] font-semibold ${tone.labelText}`}>{r.label}</div>
                    <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${tone.chip}`}>
                      {tone.status}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-[#5F646B]">Gross Margin</div>
                    <span className={`mt-0.5 inline-block rounded-full px-2.5 py-0.5 text-[13px] font-bold tabular-nums ${tone.chip}`}>
                      {vFmtPct(r.grossMarginPercent, 1)}
                    </span>
                  </div>
                </div>

                <div className="mt-3.5 grid grid-cols-2 gap-2.5 rounded-[14px] bg-white/80 p-3 text-[12px] border border-[rgba(22,24,28,0.05)]">
                  <div>
                    <span className="block text-[10.5px] uppercase tracking-wider text-[#5F646B]">Target Price</span>
                    <span className={`font-semibold tabular-nums ${tone.metric}`}>AED {vFmtNum(r.price, 0)}</span>
                    {r.id !== 'target' && (
                      <span className="ml-1 text-[10.5px] text-[#5F646B]">(×{r.priceMultiplier.toFixed(2)})</span>
                    )}
                  </div>
                  <div>
                    <span className="block text-[10.5px] uppercase tracking-wider text-[#5F646B]">Effective GDV</span>
                    <span className="font-semibold tabular-nums text-[#16181C]">{vFmtM(r.gdv)}</span>
                    {r.id === 'stress_case' && (
                      <span className="block text-[10.5px] font-semibold text-[#96291D]">15% cancellation</span>
                    )}
                  </div>
                  <div>
                    <span className="block text-[10.5px] uppercase tracking-wider text-[#5F646B]">Net Proceeds / sf</span>
                    <span className="font-medium tabular-nums text-[#16181C]">
                      AED {vFmtNum(r.netProceedsPsf, 0)} ({vFmtPct(r.dynamicLeakagePercent, 0)} leak)
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10.5px] uppercase tracking-wider text-[#5F646B]">PBT / sf</span>
                    <span className={`font-semibold tabular-nums ${tone.metric}`}>
                      {r.pbtPsf >= 0 ? '+' : ''}AED {vFmtNum(r.pbtPsf, 0)}
                    </span>
                  </div>
                </div>

                <p className="mt-3 text-[12px] font-normal leading-relaxed text-[#5F646B]">
                  {r.rationale}
                </p>
              </div>
            );
          })}
        </div>

        {/* Tablet & Desktop 8-column matrix table (md+) */}
        <div className="hidden md:block overflow-x-auto scroll-thin rounded-[20px] border border-[rgba(22,24,28,0.08)] bg-white shadow-sm">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[rgba(22,24,28,0.08)] bg-[rgba(246,247,249,0.7)] text-[11px] font-medium uppercase tracking-wider text-[#5F646B]">
                <th scope="col" className="px-5 py-3.5">Scenario Tier</th>
                <th scope="col" className="px-3 py-3.5 text-right">Target Price</th>
                <th scope="col" className="px-3 py-3.5 text-right">Effective GDV</th>
                <th scope="col" className="px-3 py-3.5 text-right">Sales Leakage</th>
                <th scope="col" className="px-3 py-3.5 text-right">Net Proceeds / sf</th>
                <th scope="col" className="px-3 py-3.5 text-right">PBT / sf</th>
                <th scope="col" className="px-3 py-3.5 text-right">Gross Margin</th>
                <th scope="col" className="px-5 py-3.5">Institutional Risk Narrative</th>
              </tr>
            </thead>
            <tbody>
              {result.sensitivity.map((r) => {
                const tone = rowTone(r, inputs.targetMarginPercent);
                return (
                  <tr key={r.id} className={`border-b border-[rgba(22,24,28,0.05)] align-top transition-colors ${tone.row}`}>
                    <td className="px-5 py-3.5">
                      <div className={`font-semibold text-[14px] ${tone.labelText}`}>
                        {r.label}
                      </div>
                      <span className={`inline-block mt-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${tone.chip}`}>
                        {tone.status}
                      </span>
                    </td>
                    <td className={`whitespace-nowrap px-3 py-3.5 text-right tabular-nums text-[13.5px] ${tone.metric}`}>
                      AED {vFmtNum(r.price, 0)}
                      {r.id !== 'target' && (
                        <span className="block text-[11px] font-normal text-[#5F646B]">
                          ×{r.priceMultiplier.toFixed(3)}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums text-[13.5px] font-medium text-[#16181C]">
                      {vFmtM(r.gdv)}
                      {r.id === 'stress_case' && (
                        <span className="block text-[11px] font-semibold text-[#96291D]">
                          15% cancellation breach
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 text-right text-[13px] font-medium text-[#16181C] tabular-nums">
                      {vFmtPct(r.dynamicLeakagePercent, 0)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums text-[13.5px] text-[#16181C]">
                      AED {vFmtNum(r.netProceedsPsf, 0)}
                    </td>
                    <td className={`whitespace-nowrap px-3 py-3.5 text-right font-semibold tabular-nums text-[13.5px] ${tone.metric}`}>
                      {r.pbtPsf >= 0 ? '+' : ''}AED {vFmtNum(r.pbtPsf, 0)}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-[12.5px] font-bold tabular-nums ${tone.chip}`}>
                        {vFmtPct(r.grossMarginPercent, 1)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[12.5px] font-light leading-relaxed text-[#5F646B] max-w-[360px]">
                      {r.rationale}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
