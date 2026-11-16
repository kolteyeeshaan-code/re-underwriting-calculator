/* =====================================================================
 * Eeshaan Koltey · Benchmarking Analyzer baseline model
 *
 * Everything the analyzer compares against is user-owned data. There is no
 * institutional hard-coded reference rate anywhere in this module: the
 * "benchmark" is an editable private-developer cost stack plus an editable
 * efficiency, and the Tier-1 models are editable structural adjustments that
 * are applied to the live scheme.
 *
 * Pure presentation-layer arithmetic only — no calculation engine is imported
 * or modified. Persistence is localStorage with schema-validated hydration.
 * ===================================================================== */

export type BenchmarkSliceId = 'land' | 'hard' | 'soft' | 'buffer' | 'wc';

export interface BenchmarkSliceMeta {
  id: BenchmarkSliceId;
  label: string;
  short: string;
  color: string;
  note: string;
}

/** Ordered cost stack shared by the baseline and the live scheme. */
export const BENCHMARK_SLICES: BenchmarkSliceMeta[] = [
  { id: 'land', label: 'Land Plot Acquisition', short: 'Land', color: '#579973', note: 'Plot + DLD & brokerage friction' },
  { id: 'hard', label: 'Hard Costs (Construction & Finishes)', short: 'Hard', color: '#F4C74B', note: 'Structure, envelope & fit-out' },
  { id: 'soft', label: 'Soft Costs & Consultant Fees', short: 'Soft', color: '#AEBEE9', note: 'Design, PMC & approvals' },
  { id: 'buffer', label: 'Escrow & Contingency Buffer', short: 'Buffer', color: '#FA6C5D', note: 'Retention & risk cover' },
  { id: 'wc', label: 'Working Capital & Marketing', short: 'WC & Mkt', color: '#7BB694', note: 'Ops, launch & channel' },
];

export type BaselinePsfBySlice = Record<BenchmarkSliceId, number>;

export interface BenchmarkBaseline {
  /** Free-text scheme name so the comparison is self-describing in the room. */
  label: string;
  efficiencyPct: number;
  gfaPsf: BaselinePsfBySlice;
}

export interface Tier1Scenario {
  /** Model 01 · Land Banking: share of the live land basis a banked-land partner pays. */
  landDiscountPct: number;
  /** Model 02 · In-House Contracting: share of the live hard cost removed by captive delivery. */
  hardSavingPct: number;
  /** Model 03 · Brand Equity: uplift on live soft + working capital spend. */
  softUpliftPct: number;
  /** Model 03 · Brand Equity: achievable exit premium over the live market comp. */
  pricePremiumPct: number;
}

/* -------------------------------------------------- Dubai private-developer medians */
export const BASELINE_LABEL_DEFAULT = 'Dubai Private Developer Median';
export const BASELINE_EFFICIENCY_DEFAULT = 75;
export const BASELINE_GFA_PSF_DEFAULT: BaselinePsfBySlice = {
  land: 250,
  hard: 555,
  soft: 80,
  buffer: 70,
  wc: 45,
};

export const TIER1_DEFAULTS: Tier1Scenario = {
  landDiscountPct: 50,
  hardSavingPct: 13.5,
  softUpliftPct: 25,
  pricePremiumPct: 20,
};

export const BENCHMARK_STORAGE_KEYS = {
  baseline: 'ek.benchmark.baseline.v2',
  tier1: 'ek.benchmark.tier1.v2',
} as const;

/* ------------------------------------------------------------------ helpers */
export const clamp = (v: number, min: number, max: number) =>
  Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : min;

export const safe = (v: number, fallback = 0) => (Number.isFinite(v) ? v : fallback);

export interface DerivedSlice extends BenchmarkSliceMeta {
  /** Share of the baseline envelope, 0–100. */
  pct: number;
  gfaPsf: number;
  nsaPsf: number;
}

export interface DerivedBaseline {
  label: string;
  efficiencyPct: number;
  totalGfaPsf: number;
  totalNsaPsf: number;
  slices: DerivedSlice[];
  byId: Record<BenchmarkSliceId, DerivedSlice>;
}

/** Single derivation used by every read path, so UI and exports never diverge. */
export function deriveBaseline(baseline: BenchmarkBaseline): DerivedBaseline {
  const efficiency = clamp(safe(baseline.efficiencyPct, BASELINE_EFFICIENCY_DEFAULT), 20, 100);
  const totalGfaPsf = BENCHMARK_SLICES.reduce((sum, s) => sum + Math.max(0, safe(baseline.gfaPsf[s.id])), 0);
  const nsaFactor = efficiency > 0 ? 100 / efficiency : 0;

  const slices: DerivedSlice[] = BENCHMARK_SLICES.map((meta) => {
    const gfaPsf = Math.max(0, safe(baseline.gfaPsf[meta.id]));
    return {
      ...meta,
      gfaPsf,
      pct: totalGfaPsf > 0 ? (gfaPsf / totalGfaPsf) * 100 : 0,
      nsaPsf: gfaPsf * nsaFactor,
    };
  });

  const byId = {} as Record<BenchmarkSliceId, DerivedSlice>;
  slices.forEach((slice) => { byId[slice.id] = slice; });

  return {
    label: baseline.label.trim() || BASELINE_LABEL_DEFAULT,
    efficiencyPct: efficiency,
    totalGfaPsf,
    totalNsaPsf: totalGfaPsf * nsaFactor,
    slices,
    byId,
  };
}

/* ------------------------------------------------------------- edit mutations */
/** Editing a share keeps the envelope constant and redistributes the rest pro-rata. */
export function withSlicePercent(baseline: BenchmarkBaseline, id: BenchmarkSliceId, pct: number): BenchmarkBaseline {
  const { totalGfaPsf } = deriveBaseline(baseline);
  if (totalGfaPsf <= 0) return baseline;
  const targetPsf = (clamp(safe(pct), 0, 100) / 100) * totalGfaPsf;
  const siblings = BENCHMARK_SLICES.filter((s) => s.id !== id).map((s) => s.id);
  const siblingTotal = totalGfaPsf - targetPsf;
  const currentSiblingTotal = siblings.reduce((sum, key) => sum + Math.max(0, safe(baseline.gfaPsf[key])), 0);
  const next: BaselinePsfBySlice = { ...baseline.gfaPsf, [id]: targetPsf };
  siblings.forEach((key) => {
    next[key] = currentSiblingTotal > 0
      ? (Math.max(0, safe(baseline.gfaPsf[key])) / currentSiblingTotal) * siblingTotal
      : siblingTotal / siblings.length;
  });
  return { ...baseline, gfaPsf: next };
}

/** Editing an absolute rate moves the envelope; shares re-derive automatically. */
export function withSlicePsf(baseline: BenchmarkBaseline, id: BenchmarkSliceId, psf: number): BenchmarkBaseline {
  return { ...baseline, gfaPsf: { ...baseline.gfaPsf, [id]: Math.max(0, safe(psf)) } };
}

export function withEfficiency(baseline: BenchmarkBaseline, pct: number): BenchmarkBaseline {
  return { ...baseline, efficiencyPct: clamp(safe(pct, BASELINE_EFFICIENCY_DEFAULT), 40, 95) };
}

export const baselineDefaults = (): BenchmarkBaseline => ({
  label: BASELINE_LABEL_DEFAULT,
  efficiencyPct: BASELINE_EFFICIENCY_DEFAULT,
  gfaPsf: { ...BASELINE_GFA_PSF_DEFAULT },
});

export const tier1Defaults = (): Tier1Scenario => ({ ...TIER1_DEFAULTS });

/* -------------------------------------------------------------- persistence */
function sanitizePsfMap(raw: unknown): BaselinePsfBySlice {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<BenchmarkSliceId, unknown>>;
  const out = {} as BaselinePsfBySlice;
  BENCHMARK_SLICES.forEach(({ id }) => {
    // null, undefined and blank strings are "absent", not zero — restore the median.
    const rawValue = source[id];
    const absent = rawValue === null || rawValue === undefined || (typeof rawValue === 'string' && rawValue.trim() === '');
    const value = absent ? NaN : Number(rawValue);
    out[id] = Number.isFinite(value) && value >= 0 ? value : BASELINE_GFA_PSF_DEFAULT[id];
  });
  return out;
}

export function sanitizeBaseline(raw: unknown): BenchmarkBaseline {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Partial<BenchmarkBaseline>;
  const label = typeof source.label === 'string' && source.label.trim() ? source.label : BASELINE_LABEL_DEFAULT;
  const efficiency = Number(source.efficiencyPct);
  return {
    label,
    efficiencyPct: Number.isFinite(efficiency) ? clamp(efficiency, 40, 95) : BASELINE_EFFICIENCY_DEFAULT,
    gfaPsf: sanitizePsfMap(source.gfaPsf),
  };
}

export function sanitizeTier1(raw: unknown): Tier1Scenario {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Partial<Tier1Scenario>;
  const read = (value: unknown, fallback: number, min: number, max: number) => {
    const num = Number(value);
    return Number.isFinite(num) ? clamp(num, min, max) : fallback;
  };
  return {
    landDiscountPct: read(source.landDiscountPct, TIER1_DEFAULTS.landDiscountPct, 0, 100),
    hardSavingPct: read(source.hardSavingPct, TIER1_DEFAULTS.hardSavingPct, 0, 100),
    softUpliftPct: read(source.softUpliftPct, TIER1_DEFAULTS.softUpliftPct, 0, 400),
    pricePremiumPct: read(source.pricePremiumPct, TIER1_DEFAULTS.pricePremiumPct, 0, 200),
  };
}

export function loadStored<T>(key: string, sanitize: (raw: unknown) => T): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return sanitize(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveStored(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable or full — the analyzer keeps working in-memory */
  }
}
