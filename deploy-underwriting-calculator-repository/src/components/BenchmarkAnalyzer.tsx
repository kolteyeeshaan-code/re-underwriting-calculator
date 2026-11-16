import { useEffect, useId, useMemo, useState } from 'react';
import { Badge, Card as EeshaanKolteyCard } from './eeshaan-koltey/ui';
import { vFmtM, vFmtNum, type ViabilityInputs, type ViabilityResult } from '../engine/viabilityEngine';
import {
  BENCHMARK_SLICES,
  BENCHMARK_STORAGE_KEYS,
  baselineDefaults,
  clamp,
  deriveBaseline,
  loadStored,
  sanitizeBaseline,
  sanitizeTier1,
  saveStored,
  tier1Defaults,
  withEfficiency,
  withSlicePercent,
  withSlicePsf,
  type BaselinePsfBySlice,
  type BenchmarkBaseline,
  type BenchmarkSliceId,
  type Tier1Scenario,
} from '../lib/benchmarkBaseline';
import { EkSlider } from './EkSlider';

/* ========================================================================
 * Benchmarking Analyzer
 *
 * No reference rate is hard-coded anywhere in this component. The comparison
 * baseline is an editable private-developer cost stack owned by the user, and
 * every variance, swing and colour is recomputed live from that baseline plus
 * the viability engine's own output.
 * ======================================================================== */

type CompareMode = 'median' | 'tier1';

const TOLERANCE_BAND_PCT = 5; // % variance still considered "within tolerance"

/* ------------------------------------------------------------ local fields */
function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="min-w-0 flex-1 basis-[220px]">
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-medium text-[#16181C]">{label}</label>
      <div className="eeshaan-koltey-field flex items-center px-3 py-2 bg-white">
        <input
          id={id}
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 bg-transparent text-[13.5px] font-medium text-[#16181C] outline-none"
        />
      </div>
    </div>
  );
}

function MiniField({
  label,
  value,
  onChange,
  suffix,
  step = 1,
  min = 0,
  max,
  hint,
  precision = 2,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
  hint?: string;
  /** Display-only rounding; the stored value keeps full precision. */
  precision?: number;
}) {
  const id = useId();
  // While the user is typing we echo their exact text, so mid-edit reformatting
  // never fights the caret; on blur the tidy rounded value takes over.
  const [draft, setDraft] = useState<string | null>(null);
  const canonical = Number.isFinite(value) ? String(Number(value.toFixed(precision))) : '';
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-[10.5px] font-medium uppercase tracking-wider text-[#5F646B]">{label}</label>
      <div className="eeshaan-koltey-field flex items-center bg-white px-2.5 py-1.5">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          value={draft ?? canonical}
          onChange={(e) => {
            setDraft(e.target.value);
            onChange(e.target.value === '' ? 0 : Number(e.target.value));
          }}
          onBlur={() => setDraft(null)}
          className="w-full min-w-0 bg-transparent text-[13px] font-semibold tabular-nums text-[#16181C] outline-none"
        />
        {suffix && <span className="ml-1 shrink-0 text-[10.5px] font-medium text-[#5F646B]">{suffix}</span>}
      </div>
      {hint && <p className="mt-0.5 text-[10px] font-light text-[#5F646B]">{hint}</p>}
    </div>
  );
}

function SliderRow({
  label,
  value,
  onChange,
  min,
  max,
  step,
  display,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  display: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[14px] border border-[rgba(22,24,28,0.07)] bg-[rgba(246,247,249,0.7)] p-2.5">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="min-w-0 text-[11.5px] font-medium leading-snug text-[#16181C]">{label}</span>
        <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[#16181C]">{display}</span>
      </div>
      <EkSlider
        label={label}
        min={min}
        max={max}
        step={step}
        value={clamp(value, min, max)}
        onChange={onChange}
      />
      {hint && <p className="mt-1 text-[10px] font-light leading-snug text-[#5F646B]">{hint}</p>}
    </div>
  );
}

/* --------------------------------------------------------------- primitives */
function StackBar({ slices }: { slices: { short: string; pct: number; color: string }[] }) {
  return (
    <div>
      <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-[rgba(22,24,28,0.08)]">
        {slices.map((s) => (
          <div
            key={s.short}
            className="flex h-full items-center justify-center text-[9px] font-bold tabular-nums"
            style={{ width: `${Math.max(0, s.pct)}%`, background: s.color, color: s.color === '#F4C74B' ? '#16181C' : '#FFFFFF' }}
            title={`${s.short}: ${vFmtNum(s.pct, 1)}%`}
          >
            {s.pct >= 8 ? `${vFmtNum(s.pct, 0)}%` : ''}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {slices.map((s) => (
          <span key={s.short} className="flex items-center gap-1.5 text-[11.5px] font-light text-[#5F646B]">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.short} <b className="font-medium tabular-nums text-[#16181C]">{vFmtNum(s.pct, 1)}%</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function CompareRow({
  label,
  baseline,
  tier1,
  delta,
  favorable,
}: { label: string; baseline: string; tier1: string; delta: string; favorable: boolean }) {
  return (
    <div className="flex flex-col items-stretch justify-between gap-1 rounded-[12px] bg-[rgba(246,247,249,0.8)] px-2.5 py-1.5 text-[11.5px] min-[420px]:flex-row min-[420px]:items-center">
      <span className="min-w-0 break-words leading-snug text-[#5F646B]">{label}</span>
      <span className="flex min-w-0 flex-wrap items-baseline justify-start gap-x-1 gap-y-0.5 tabular-nums text-[#16181C] min-[420px]:justify-end min-[420px]:text-right">
        <span className="whitespace-nowrap">{baseline}</span>
        <span className="text-[#9EA3AA]">→</span>
        <b className="whitespace-nowrap">{tier1}</b>
        <span className={`whitespace-nowrap font-semibold ${favorable ? 'text-[#2F5C44]' : 'text-[#96291D]'}`}>({delta})</span>
      </span>
    </div>
  );
}

function DualBar({ baselinePct, tierPct, color, scale }: { baselinePct: number; tierPct: number; color: string; scale: number }) {
  const safeScale = scale > 0 ? scale : 1;
  return (
    <div className="space-y-1" aria-hidden="true">
      <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(22,24,28,0.06)]">
        <div className="h-full rounded-full bg-[rgba(22,24,28,0.28)]" style={{ width: `${clamp((baselinePct / safeScale) * 100, 0, 100)}%` }} />
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(22,24,28,0.06)]">
        <div className="h-full rounded-full" style={{ width: `${clamp((tierPct / safeScale) * 100, 0, 100)}%`, background: color }} />
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  sub,
  tone = 'plain',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'plain' | 'good' | 'bad';
}) {
  const valueCls = tone === 'good' ? 'text-[#2F5C44]' : tone === 'bad' ? 'text-[#96291D]' : 'text-[#16181C]';
  return (
    <div className="min-w-0 rounded-[14px] border border-[rgba(22,24,28,0.06)] bg-white px-3 py-2">
      <div className="text-[10px] font-normal uppercase tracking-wider text-[#5F646B]">{label}</div>
      <div className={`mt-0.5 break-words text-[15px] font-semibold tabular-nums ${valueCls}`}>{value}</div>
      {sub && <div className="text-[10.5px] font-light text-[#5F646B]">{sub}</div>}
    </div>
  );
}

function ModeToggle({ mode, onChange }: { mode: CompareMode; onChange: (m: CompareMode) => void }) {
  const modes: { id: CompareMode; label: string; short: string }[] = [
    { id: 'median', label: 'Industry Median vs Live Scheme', short: 'Industry Median' },
    { id: 'tier1', label: 'Tier-1 Structural Advantage vs Live Scheme', short: 'Tier-1 Advantage' },
  ];
  return (
    <div className="flex w-full flex-col gap-1.5 rounded-[18px] border border-[rgba(22,24,28,0.08)] bg-white p-1.5 shadow-sm sm:w-auto sm:flex-row">
      {modes.map((m) => {
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(m.id)}
            className={`press min-w-0 flex-1 rounded-[13px] px-3.5 py-2 text-left text-[12px] font-medium leading-snug transition-colors sm:text-center ${
              active ? 'bg-[#16181C] text-white shadow-[0_8px_20px_-12px_rgba(22,24,28,0.8)]' : 'text-[#5F646B] hover:bg-[rgba(22,24,28,0.05)] hover:text-[#16181C]'
            }`}
          >
            <span className="hidden sm:inline">{m.short}</span>
            <span className="sm:hidden">{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ======================================================================= */
export default function BenchmarkAnalyzer({
  inputs,
  result,
}: {
  inputs: ViabilityInputs;
  result: ViabilityResult;
}) {
  /* ---------------- persisted, fully editable baseline ---------------- */
  const [baseline, setBaseline] = useState<BenchmarkBaseline>(
    () => loadStored(BENCHMARK_STORAGE_KEYS.baseline, sanitizeBaseline) ?? baselineDefaults(),
  );
  const [tier1, setTier1] = useState<Tier1Scenario>(
    () => loadStored(BENCHMARK_STORAGE_KEYS.tier1, sanitizeTier1) ?? tier1Defaults(),
  );
  const [mode, setMode] = useState<CompareMode>('median');

  useEffect(() => { saveStored(BENCHMARK_STORAGE_KEYS.baseline, baseline); }, [baseline]);
  useEffect(() => { saveStored(BENCHMARK_STORAGE_KEYS.tier1, tier1); }, [tier1]);

  const derived = useMemo(() => deriveBaseline(baseline), [baseline]);

  /* ---------------- live scheme cost stack (from the engine) ---------------- */
  const live = useMemo(() => {
    const gfa = result.maxGfa > 0 ? result.maxGfa : 0;
    const nsa = result.nsa > 0 ? result.nsa : 0;
    const land = result.landCostPsfGfa;
    const hard = inputs.constructionPsfGfa;
    const soft = result.pmcPsfGfa + result.escalationPsfGfa + inputs.approvalsPsfGfa;
    const buffer = result.contingencyPsfGfa;
    const wc = result.workingCapitalPsfGfa;
    const total = land + hard + soft + buffer + wc;
    const factor = inputs.nsaEfficiency > 0 ? 100 / inputs.nsaEfficiency : 0;
    const byId: Record<BenchmarkSliceId, number> = { land, hard, soft, buffer, wc };
    const liveTotalNsaPsf = total * factor;
    return {
      gfa,
      nsa,
      byId,
      totalGfaPsf: total,
      totalNsaPsf: liveTotalNsaPsf,
      efficiencyPct: inputs.nsaEfficiency,
      nsaFactor: factor,
      marketCompPsf: inputs.marketCompPsf,
    };
  }, [result, inputs.constructionPsfGfa, inputs.approvalsPsfGfa, inputs.nsaEfficiency, inputs.marketCompPsf]);

  const livePctById = useMemo(() => {
    const out = {} as Record<BenchmarkSliceId, number>;
    BENCHMARK_SLICES.forEach(({ id }) => {
      out[id] = live.totalGfaPsf > 0 ? (live.byId[id] / live.totalGfaPsf) * 100 : 0;
    });
    return out;
  }, [live]);

  /* ---------------- Mode A deltas ---------------- */
  const deltaGfaPsf = live.totalGfaPsf - derived.totalGfaPsf;
  const deltaPctOfBaseline = derived.totalGfaPsf > 0 ? (deltaGfaPsf / derived.totalGfaPsf) * 100 : 0;
  const envelopeSwingAed = deltaGfaPsf * live.gfa;
  const withinTolerance = Math.abs(deltaPctOfBaseline) <= TOLERANCE_BAND_PCT;
  const liveCheaper = deltaGfaPsf <= 0;
  const statusTone: 'mint' | 'amber' | 'coral' = liveCheaper ? 'mint' : withinTolerance ? 'amber' : 'coral';
  const statusText = liveCheaper
    ? 'Below your median baseline'
    : withinTolerance
      ? 'Within tolerance band'
      : 'Above baseline envelope';

  const setPct = (id: BenchmarkSliceId) => (v: number) => setBaseline((prev) => withSlicePercent(prev, id, v));
  const setPsf = (id: BenchmarkSliceId) => (v: number) => setBaseline((prev) => withSlicePsf(prev, id, v));

  /** Copies the live project cost structure into the editable baseline. */
  const useLiveAsBaseline = () => {
    setBaseline((prev) => ({
      ...prev,
      label: 'Live Project Cost Structure',
      efficiencyPct: clamp(live.efficiencyPct, 40, 95),
      gfaPsf: Object.fromEntries(
        BENCHMARK_SLICES.map(({ id }) => [id, Math.max(0, live.byId[id])]),
      ) as BaselinePsfBySlice,
    }));
  };

  /* ---------------- Mode B: Tier-1 structural scenarios ---------------- */
  const tier1Model = useMemo(() => {
    const landSavingPsf = live.byId.land * (tier1.landDiscountPct / 100);
    const hardSavingPsf = live.byId.hard * (tier1.hardSavingPct / 100);
    const softUpliftPsf = (live.byId.soft + live.byId.wc) * (tier1.softUpliftPct / 100);

    const landAed = landSavingPsf * live.gfa;
    const hardAed = hardSavingPsf * live.gfa;

    // Brand model lives in revenue space (NSA), so it converts at live efficiency.
    const softUpliftPsfNsa = softUpliftPsf * live.nsaFactor;
    const premiumPsfNsa = live.marketCompPsf * (tier1.pricePremiumPct / 100);
    const brandNetPsfNsa = premiumPsfNsa - softUpliftPsfNsa;
    const brandAed = brandNetPsfNsa * live.nsa;

    const blendedGfaPsf = live.totalGfaPsf - landSavingPsf - hardSavingPsf + softUpliftPsf;
    const blendedNsaPsf = blendedGfaPsf * live.nsaFactor;
    const tier1ExitPsf = live.marketCompPsf + premiumPsfNsa;

    const liveMarginPct = live.marketCompPsf > 0
      ? ((live.marketCompPsf - live.totalNsaPsf) / live.marketCompPsf) * 100
      : 0;
    const tier1MarginPct = tier1ExitPsf > 0
      ? ((tier1ExitPsf - blendedNsaPsf) / tier1ExitPsf) * 100
      : 0;
    const liveCoverPct = live.marketCompPsf > 0 ? (live.totalGfaPsf / live.marketCompPsf) * 100 : 0;
    const tier1CoverPct = live.marketCompPsf > 0 ? (blendedGfaPsf / live.marketCompPsf) * 100 : 0;

    return {
      landSavingPsf, hardSavingPsf, softUpliftPsf,
      landAed, hardAed, brandAed, brandNetPsfNsa,
      premiumPsfNsa, softUpliftPsfNsa,
      blendedGfaPsf, blendedNsaPsf, tier1ExitPsf,
      liveMarginPct, tier1MarginPct, liveCoverPct, tier1CoverPct,
      combinedAed: landAed + hardAed + brandAed,
      marginEdgePts: tier1MarginPct - liveMarginPct,
    };
  }, [live, tier1]);

  const resetAll = () => { setBaseline(baselineDefaults()); setTier1(tier1Defaults()); };

  return (
    <EeshaanKolteyCard className="min-w-0 p-4 sm:p-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(22,24,28,0.08)] pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 shrink-0 rounded-full bg-[#F4C74B]" />
            <h3 className="text-[15.5px] font-medium tracking-tight text-[#16181C] sm:text-[16px]">
              Tier-1 Master Developer &amp; Premium Independent Benchmarking Analyzer
            </h3>
          </div>
          <p className="mt-0.5 text-[12px] font-normal text-[#5F646B] sm:text-[12.5px]">
            Fully editable baseline — no fixed reference rate. Compare your live scheme against your own
            private-developer median, or quantify Tier-1 structural advantages.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="amber">{`${vFmtNum(derived.totalGfaPsf, 0)} AED / GFA sf`}</Badge>
          <Badge tone="neutral">{`${vFmtNum(derived.totalNsaPsf, 2)} AED / NSA sf`}</Badge>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5">
        <ModeToggle mode={mode} onChange={setMode} />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={useLiveAsBaseline}
            className="press rounded-full border border-[rgba(22,24,28,0.12)] bg-white px-3.5 py-1.5 text-[11.5px] font-medium text-[#16181C] shadow-[0_1px_3px_rgba(22,24,28,0.06)] transition-colors hover:bg-[#FDF6E3]"
          >
            Use live project as baseline
          </button>
          <button
            type="button"
            onClick={resetAll}
            className="press rounded-full bg-[rgba(22,24,28,0.045)] px-3.5 py-1.5 text-[11.5px] font-medium text-[#5F646B] transition-colors hover:bg-[rgba(22,24,28,0.09)] hover:text-[#16181C]"
          >
            Reset to median
          </button>
        </div>
      </div>

      {/* ------------------------------------------------ editable baseline (always visible) */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <TextField
          label="Baseline scheme name"
          value={baseline.label}
          onChange={(v) => setBaseline((prev) => ({ ...prev, label: v }))}
          placeholder="e.g. Dubai Private Developer Median"
        />
        <div className="w-[132px] shrink-0">
          <MiniField
            label="Efficiency"
            value={derived.efficiencyPct}
            onChange={(v) => setBaseline((prev) => withEfficiency(prev, v))}
            suffix="%"
            step={0.5}
            min={40}
            max={95}
            hint="GFA → NSA"
          />
        </div>
      </div>

      <div className="mt-3 rounded-[18px] border border-[rgba(22,24,28,0.08)] bg-[rgba(246,247,249,0.6)] p-3.5">
        <StackBar slices={derived.slices.map((s) => ({ short: s.short, pct: s.pct, color: s.color }))} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {derived.slices.map((slice) => {
          const livePsf = live.byId[slice.id];
          const sliceDelta = livePsf - slice.gfaPsf;
          const favorable = sliceDelta <= 0;
          return (
            <div key={slice.id} className="min-w-0 rounded-[18px] border border-[rgba(22,24,28,0.08)] bg-white p-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-1.5">
                  <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: slice.color }} />
                  <span className="min-w-0 break-words text-[12px] font-medium leading-tight text-[#16181C]">{slice.label}</span>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold tabular-nums ${
                  favorable ? 'bg-[#EFF6F1] text-[#2F5C44]' : 'bg-[#FEECEA] text-[#96291D]'
                }`}>
                  {sliceDelta >= 0 ? '+' : '−'}AED {vFmtNum(Math.abs(sliceDelta), 0)}
                </span>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <MiniField
                  label="Share"
                  value={slice.pct}
                  onChange={setPct(slice.id)}
                  suffix="%"
                  step={0.5}
                  min={0}
                  max={100}
                  hint={`live ${vFmtNum(livePctById[slice.id], 1)}%`}
                />
                <MiniField
                  label="GFA PSF"
                  value={slice.gfaPsf}
                  onChange={setPsf(slice.id)}
                  suffix="AED"
                  step={5}
                  hint={`live ${vFmtNum(livePsf, 0)}`}
                />
              </div>

              <div className="mt-2 space-y-1 border-t border-[rgba(22,24,28,0.06)] pt-2 text-[11.5px]">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[#5F646B]">NSA sf</span>
                  <span className="font-semibold tabular-nums text-[#16181C]">AED {vFmtNum(slice.nsaPsf, 2)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[#5F646B]">Envelope @ live GFA</span>
                  <span className="font-medium tabular-nums text-[#16181C]">{vFmtM(slice.gfaPsf * live.gfa)}</span>
                </div>
              </div>
              <div className="mt-1.5 text-[10.5px] font-light leading-snug text-[#5F646B]">{slice.note}</div>
            </div>
          );
        })}
      </div>

      {/* ================================================== MODE A · median vs live */}
      {mode === 'median' && (
        <div className="mt-4 rounded-[18px] border border-[rgba(22,24,28,0.08)] bg-[rgba(246,247,249,0.7)] p-3.5 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 text-[12px] font-medium text-[#16181C]">
              Live scheme vs <span className="font-semibold">{derived.label}</span>
              <span className="ml-1.5 text-[11px] font-light text-[#5F646B]">ex-financing, per GFA sf</span>
            </div>
            <Badge tone={statusTone} dot>{statusText}</Badge>
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <StatBox label="Live all-in" value={`AED ${vFmtNum(live.totalGfaPsf, 0)}`} sub={`per GFA sf · ${vFmtNum(live.totalNsaPsf, 0)} NSA`} />
            <StatBox label="Baseline" value={`AED ${vFmtNum(derived.totalGfaPsf, 0)}`} sub={`${baseline.label} · editable`} />
            <StatBox
              label="Variance"
              value={`${deltaGfaPsf >= 0 ? '+' : '−'}AED ${vFmtNum(Math.abs(deltaGfaPsf), 0)}`}
              sub={`${deltaPctOfBaseline >= 0 ? '+' : '−'}${vFmtNum(Math.abs(deltaPctOfBaseline), 1)}% vs baseline`}
              tone={liveCheaper ? 'good' : 'bad'}
            />
            <StatBox
              label="Envelope swing"
              value={`${envelopeSwingAed >= 0 ? '+' : '−'}${vFmtM(Math.abs(envelopeSwingAed))}`}
              sub={`on ${vFmtNum(live.gfa, 0)} sf GFA`}
            />
          </div>

          <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {derived.slices.map((slice) => {
              const livePsf = live.byId[slice.id];
              const d = livePsf - slice.gfaPsf;
              return (
                <CompareRow
                  key={slice.id}
                  label={`${slice.short} / GFA sf`}
                  baseline={`AED ${vFmtNum(livePsf, 0)} live`}
                  tier1={`AED ${vFmtNum(slice.gfaPsf, 0)} base`}
                  delta={`${d >= 0 ? '+' : '−'}AED ${vFmtNum(Math.abs(d), 0)}`}
                  favorable={d <= 0}
                />
              );
            })}
          </div>

          <p className="mt-2.5 text-[11.5px] font-light leading-relaxed text-[#5F646B]">
            Editing any share or rate above rewrites this comparison instantly — the baseline is your assumption set,
            not a fixed industry constant. Variance is measured against your editable envelope of{' '}
            <b className="font-medium text-[#16181C]">AED {vFmtNum(derived.totalGfaPsf, 0)}/GFA sf</b> at{' '}
            {vFmtNum(derived.efficiencyPct, 1)}% efficiency.
          </p>
        </div>
      )}

      {/* ================================================== MODE B · Tier-1 advantage */}
      {mode === 'tier1' && (
        <div className="mt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-[13px] font-medium text-[#16181C]">Tier-1 Margin Structuring Advantage</h4>
            <span className="text-[11.5px] font-light text-[#5F646B]">
              Adjustable scenarios applied to your live scheme
            </span>
          </div>

          <div className="mt-2.5 grid grid-cols-1 gap-3.5 lg:grid-cols-3">
            {/* Model 01 · Land Banking */}
            <article className="flex min-w-0 flex-col rounded-[20px] border border-[rgba(22,24,28,0.08)] bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge tone="mint" dot>Land Banking Advantage</Badge>
                <span className="text-[10.5px] font-medium uppercase tracking-wider text-[#5F646B]">Model 01</span>
              </div>
              <h5 className="mt-2.5 text-[14px] font-medium tracking-tight text-[#16181C]">Master Developer Model</h5>
              <p className="text-[11.5px] font-normal text-[#5F646B]">Historic land bank compresses land basis</p>

              <div className="mt-2.5">
                <SliderRow
                  label="Land basis a banked-land partner pays"
                  value={tier1.landDiscountPct}
                  onChange={(v) => setTier1((p) => ({ ...p, landDiscountPct: v }))}
                  min={0}
                  max={90}
                  step={1}
                  display={`${vFmtNum(tier1.landDiscountPct, 0)}% discount`}
                  hint={`AED ${vFmtNum(live.byId.land, 0)} → AED ${vFmtNum(tier1Model.landSavingPsf > 0 ? live.byId.land - tier1Model.landSavingPsf : 0, 0)} per GFA sf`}
                />
              </div>

              <div className="mt-2.5 space-y-1.5">
                <CompareRow
                  label="Land share of cost"
                  baseline={`${vFmtNum(livePctById.land, 1)}%`}
                  tier1={`${vFmtNum(live.totalGfaPsf > 0 ? ((live.byId.land - tier1Model.landSavingPsf) / live.totalGfaPsf) * 100 : 0, 1)}%`}
                  delta={`${tier1Model.landSavingPsf > 0 ? '−' : ''}${vFmtNum(live.totalGfaPsf > 0 ? (tier1Model.landSavingPsf / live.totalGfaPsf) * 100 : 0, 1)} pts`}
                  favorable
                />
                <CompareRow
                  label="Land PSF / GFA"
                  baseline={`AED ${vFmtNum(live.byId.land, 0)}`}
                  tier1={`AED ${vFmtNum(live.byId.land - tier1Model.landSavingPsf, 0)}`}
                  delta={`${tier1Model.landSavingPsf > 0 ? '−' : ''}AED ${vFmtNum(Math.abs(tier1Model.landSavingPsf), 0)}`}
                  favorable={tier1Model.landSavingPsf >= 0}
                />
                <CompareRow
                  label="Structural headroom"
                  baseline="your envelope"
                  tier1={vFmtM(tier1Model.landAed)}
                  delta="to margin"
                  favorable
                />
              </div>

              <div className="mt-2.5">
                <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-[#5F646B]">
                  <span>Your land load</span>
                  <span>Banked land load</span>
                </div>
                <DualBar
                  baselinePct={livePctById.land}
                  tierPct={live.totalGfaPsf > 0 ? ((live.byId.land - tier1Model.landSavingPsf) / live.totalGfaPsf) * 100 : 0}
                  color="#579973"
                  scale={Math.max(30, livePctById.land)}
                />
              </div>

              <p className="mt-2.5 text-[11.5px] font-light leading-relaxed text-[#5F646B]">
                At a {vFmtNum(tier1.landDiscountPct, 0)}% land basis advantage, Tier-1 releases{' '}
                <b className="font-medium text-[#16181C]">{vFmtM(tier1Model.landAed)}</b> of structural headroom across
                your {vFmtNum(live.gfa, 0)} sf envelope.
              </p>
              <p className="mt-2 rounded-[12px] bg-[#EFF6F1] px-2.5 py-1.5 text-[11px] font-normal leading-relaxed text-[#2F5C44]">
                Pitch line — landowners: a banked-land partner can concede headline price and still clear hurdle margin.
              </p>
            </article>

            {/* Model 02 · In-House Contracting */}
            <article className="flex min-w-0 flex-col rounded-[20px] border border-[rgba(22,24,28,0.08)] bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge tone="amber" dot>In-House Contracting</Badge>
                <span className="text-[10.5px] font-medium uppercase tracking-wider text-[#5F646B]">Model 02</span>
              </div>
              <h5 className="mt-2.5 text-[14px] font-medium tracking-tight text-[#16181C]">Vertically Integrated Model</h5>
              <p className="text-[11.5px] font-normal text-[#5F646B]">Captive contracting, MEP &amp; joinery</p>

              <div className="mt-2.5">
                <SliderRow
                  label="Hard cost removed by in-house delivery"
                  value={tier1.hardSavingPct}
                  onChange={(v) => setTier1((p) => ({ ...p, hardSavingPct: v }))}
                  min={0}
                  max={40}
                  step={0.5}
                  display={`${vFmtNum(tier1.hardSavingPct, 1)}% saving`}
                  hint={`AED ${vFmtNum(live.byId.hard, 0)} → AED ${vFmtNum(live.byId.hard - tier1Model.hardSavingPsf, 0)} per GFA sf`}
                />
              </div>

              <div className="mt-2.5 space-y-1.5">
                <CompareRow
                  label="Hard cost / GFA sf"
                  baseline={`AED ${vFmtNum(live.byId.hard, 0)}`}
                  tier1={`≈ AED ${vFmtNum(live.byId.hard - tier1Model.hardSavingPsf, 0)}`}
                  delta={`${tier1Model.hardSavingPsf > 0 ? '−' : ''}AED ${vFmtNum(Math.abs(tier1Model.hardSavingPsf), 0)}`}
                  favorable={tier1Model.hardSavingPsf >= 0}
                />
                <CompareRow
                  label="Hard share of cost"
                  baseline={`${vFmtNum(livePctById.hard, 1)}%`}
                  tier1={`≈ ${vFmtNum(live.totalGfaPsf > 0 ? ((live.byId.hard - tier1Model.hardSavingPsf) / live.totalGfaPsf) * 100 : 0, 1)}%`}
                  delta={`${tier1Model.hardSavingPsf > 0 ? '−' : ''}${vFmtNum(live.totalGfaPsf > 0 ? (tier1Model.hardSavingPsf / live.totalGfaPsf) * 100 : 0, 1)} pts`}
                  favorable
                />
                <CompareRow
                  label="Released capital"
                  baseline="your envelope"
                  tier1={vFmtM(tier1Model.hardAed)}
                  delta="to margin"
                  favorable
                />
              </div>

              <div className="mt-2.5">
                <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-[#5F646B]">
                  <span>Your hard load</span>
                  <span>Integrated hard load</span>
                </div>
                <DualBar
                  baselinePct={livePctById.hard}
                  tierPct={live.totalGfaPsf > 0 ? ((live.byId.hard - tier1Model.hardSavingPsf) / live.totalGfaPsf) * 100 : 0}
                  color="#F4C74B"
                  scale={Math.max(60, livePctById.hard)}
                />
              </div>

              <p className="mt-2.5 text-[11.5px] font-light leading-relaxed text-[#5F646B]">
                Captive delivery strips out main-contractor profit at identical specification —{' '}
                <b className="font-medium text-[#16181C]">{vFmtM(tier1Model.hardAed)}</b> of released capital on your
                envelope.
              </p>
              <p className="mt-2 rounded-[12px] bg-[#FDF6E3] px-2.5 py-1.5 text-[11px] font-normal leading-relaxed text-[#7A4A0E]">
                Pitch line — financiers: in-house delivery de-risks cost overrun and protects the debt service cushion.
              </p>
            </article>

            {/* Model 03 · High Brand Equity */}
            <article className="flex min-w-0 flex-col rounded-[20px] border border-[rgba(22,24,28,0.08)] bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge tone="coral" dot>Elevated Channel Spend</Badge>
                <span className="text-[10.5px] font-medium uppercase tracking-wider text-[#5F646B]">Model 03</span>
              </div>
              <h5 className="mt-2.5 text-[14px] font-medium tracking-tight text-[#16181C]">High Brand Equity Independents</h5>
              <p className="text-[11.5px] font-normal text-[#5F646B]">Design-led independent · lifestyle premium</p>

              <div className="mt-2.5 space-y-2">
                <SliderRow
                  label="Soft + working-capital uplift"
                  value={tier1.softUpliftPct}
                  onChange={(v) => setTier1((p) => ({ ...p, softUpliftPct: v }))}
                  min={0}
                  max={150}
                  step={1}
                  display={`+${vFmtNum(tier1.softUpliftPct, 0)}%`}
                  hint={`+AED ${vFmtNum(tier1Model.softUpliftPsfNsa, 0)} per NSA sf of cost`}
                />
                <SliderRow
                  label="Achievable exit premium"
                  value={tier1.pricePremiumPct}
                  onChange={(v) => setTier1((p) => ({ ...p, pricePremiumPct: v }))}
                  min={0}
                  max={80}
                  step={1}
                  display={`+${vFmtNum(tier1.pricePremiumPct, 0)}%`}
                  hint={`+AED ${vFmtNum(tier1Model.premiumPsfNsa, 0)} per NSA sf of revenue`}
                />
              </div>

              <div className="mt-2.5 space-y-1.5">
                <CompareRow
                  label="Soft + marketing PSF"
                  baseline={`AED ${vFmtNum((live.byId.soft + live.byId.wc) * live.nsaFactor, 0)}`}
                  tier1={`AED ${vFmtNum((live.byId.soft + live.byId.wc) * live.nsaFactor + tier1Model.softUpliftPsfNsa, 0)}`}
                  delta={`+AED ${vFmtNum(tier1Model.softUpliftPsfNsa, 0)}`}
                  favorable={false}
                />
                <CompareRow
                  label="Net brand effect / NSA sf"
                  baseline="premium − spend"
                  tier1={`${tier1Model.brandNetPsfNsa >= 0 ? '+' : '−'}AED ${vFmtNum(Math.abs(tier1Model.brandNetPsfNsa), 0)}`}
                  delta={tier1Model.brandNetPsfNsa >= 0 ? 'accretive' : 'dilutive'}
                  favorable={tier1Model.brandNetPsfNsa >= 0}
                />
                <CompareRow
                  label="Cost-to-revenue"
                  baseline={`${vFmtNum(tier1Model.liveCoverPct, 1)}% live`}
                  tier1={`${vFmtNum(tier1Model.tier1CoverPct, 1)}% blended`}
                  delta={`${tier1Model.tier1CoverPct - tier1Model.liveCoverPct >= 0 ? '+' : '−'}${vFmtNum(Math.abs(tier1Model.tier1CoverPct - tier1Model.liveCoverPct), 1)} pts`}
                  favorable={tier1Model.tier1CoverPct <= tier1Model.liveCoverPct}
                />
              </div>

              <div className="mt-2.5">
                <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-[#5F646B]">
                  <span>Your soft + channel</span>
                  <span>Brand-led spend</span>
                </div>
                <DualBar
                  baselinePct={(livePctById.soft + livePctById.wc)}
                  tierPct={(livePctById.soft + livePctById.wc) * (1 + tier1.softUpliftPct / 100)}
                  color="#FA6C5D"
                  scale={Math.max(20, (livePctById.soft + livePctById.wc) * (1 + tier1.softUpliftPct / 100))}
                />
              </div>

              <p className="mt-2.5 text-[11.5px] font-light leading-relaxed text-[#5F646B]">
                At a {vFmtNum(tier1.pricePremiumPct, 0)}% lifestyle premium against {vFmtNum(tier1.softUpliftPct, 0)}%
                extra channel spend, the net effect is{' '}
                <b className="font-medium text-[#16181C]">{vFmtM(tier1Model.brandAed)}</b> across{' '}
                {vFmtNum(live.nsa, 0)} sf NSA.
              </p>
              <p className="mt-2 rounded-[12px] bg-[#FEECEA] px-2.5 py-1.5 text-[11px] font-normal leading-relaxed text-[#96291D]">
                Pitch line — off-plan buyers: brand and design equity convert channel spend into resale resilience.
              </p>
            </article>
          </div>

          {/* Tier-1 net position vs live scheme */}
          <div className="mt-3.5 rounded-[18px] border border-[rgba(22,24,28,0.08)] bg-[rgba(246,247,249,0.7)] p-3.5 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[12px] font-medium text-[#16181C]">
                Tier-1 combined structural position vs your live scheme
              </div>
              <Badge tone={tier1Model.combinedAed >= 0 ? 'mint' : 'coral'} dot>
                {`${tier1Model.combinedAed >= 0 ? '+' : '−'}${vFmtM(Math.abs(tier1Model.combinedAed))} structural edge`}
              </Badge>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <StatBox label="Land banking" value={`+${vFmtM(tier1Model.landAed)}`} sub={`${vFmtNum(tier1.landDiscountPct, 0)}% land discount`} />
              <StatBox label="In-house delivery" value={`+${vFmtM(tier1Model.hardAed)}`} sub={`${vFmtNum(tier1.hardSavingPct, 1)}% hard saving`} />
              <StatBox
                label="Brand equity (net)"
                value={`${tier1Model.brandAed >= 0 ? '+' : '−'}${vFmtM(Math.abs(tier1Model.brandAed))}`}
                sub={`+${vFmtNum(tier1.pricePremiumPct, 0)}% exit vs +${vFmtNum(tier1.softUpliftPct, 0)}% spend`}
                tone={tier1Model.brandAed >= 0 ? 'plain' : 'bad'}
              />
              <StatBox
                label="Combined edge"
                value={`${tier1Model.combinedAed >= 0 ? '+' : '−'}${vFmtM(Math.abs(tier1Model.combinedAed))}`}
                sub={`on ${vFmtNum(live.gfa, 0)} sf GFA`}
                tone={tier1Model.combinedAed >= 0 ? 'good' : 'bad'}
              />
            </div>

            <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <CompareRow
                label="All-in envelope / GFA sf"
                baseline={`AED ${vFmtNum(live.totalGfaPsf, 0)} live`}
                tier1={`≈ AED ${vFmtNum(tier1Model.blendedGfaPsf, 0)} Tier-1`}
                delta={`${tier1Model.blendedGfaPsf - live.totalGfaPsf >= 0 ? '+' : '−'}AED ${vFmtNum(Math.abs(tier1Model.blendedGfaPsf - live.totalGfaPsf), 0)}`}
                favorable={tier1Model.blendedGfaPsf <= live.totalGfaPsf}
              />
              <CompareRow
                label="Margin at exit"
                baseline={`${vFmtNum(tier1Model.liveMarginPct, 1)}% live`}
                tier1={`${vFmtNum(tier1Model.tier1MarginPct, 1)}% Tier-1`}
                delta={`${tier1Model.marginEdgePts >= 0 ? '+' : '−'}${vFmtNum(Math.abs(tier1Model.marginEdgePts), 1)} pts`}
                favorable={tier1Model.marginEdgePts <= 0}
              />
              <CompareRow
                label="Independent competitive read"
                baseline={`AED ${vFmtNum(live.totalNsaPsf, 0)} / NSA sf`}
                tier1={`${vFmtNum(tier1Model.liveMarginPct, 1)}% margin`}
                delta={tier1Model.liveMarginPct > 0 ? 'viable' : 'reprice'}
                favorable={tier1Model.liveMarginPct > 0}
              />
            </div>

            <p className="mt-2.5 text-[11.5px] font-light leading-relaxed text-[#5F646B]">
              Even granting Tier-1 every structural advantage above, your live scheme still underwrites a{' '}
              <b className="font-medium text-[#16181C]">{vFmtNum(tier1Model.liveMarginPct, 1)}%</b> margin at the{' '}
              {`AED ${vFmtNum(live.marketCompPsf, 0)}`} comp — the gap to a fully-integrated Tier-1 structure is{' '}
              {vFmtNum(Math.abs(tier1Model.marginEdgePts), 1)} points, which is a land-basis and delivery-chain
              conversation rather than a viability failure.
            </p>
          </div>
        </div>
      )}

      {/* Development Manager pitch summary — live numbers only */}
      <div className="mt-4 rounded-[18px] border border-[#FBE6A4] bg-[#FDF6E3] p-4">
        <div className="text-[12px] font-semibold text-[#7A4A0E]">Development Manager — how to deploy this benchmark in the room</div>
        <div className="mt-2 grid grid-cols-1 gap-2.5 text-[11.5px] font-normal leading-relaxed text-[#7A4A0E] sm:grid-cols-3">
          <p>
            <b>Landowners:</b> anchor negotiations on the{' '}
            <b className="font-medium tabular-nums">AED {vFmtNum(derived.byId.land.gfaPsf, 0)}/GFA sf</b> (
            {vFmtNum(derived.byId.land.pct, 1)}%) land slice you set above — any plot priced above it must be defended by
            superior FAR or a higher exit.
          </p>
          <p>
            <b>Financiers:</b> the live scheme sits{' '}
            <b className="font-medium tabular-nums">
              {deltaGfaPsf >= 0 ? '+' : '−'}AED {vFmtNum(Math.abs(deltaGfaPsf), 0)}
            </b>{' '}
            ({deltaPctOfBaseline >= 0 ? '+' : '−'}
            {vFmtNum(Math.abs(deltaPctOfBaseline), 1)}%) versus your own {derived.label} — that spread sizes the
            contingency the facility must underwrite.
          </p>
          <p>
            <b>Off-plan buyers:</b> an ex-finance build of{' '}
            <b className="font-medium tabular-nums">AED {vFmtNum(live.totalGfaPsf, 0)}/GFA sf</b> against a{' '}
            {`AED ${vFmtNum(live.marketCompPsf, 0)}`} comp leaves visible margin to fund specification, DLP cover and
            timely handover.
          </p>
        </div>
      </div>
    </EeshaanKolteyCard>
  );
}
