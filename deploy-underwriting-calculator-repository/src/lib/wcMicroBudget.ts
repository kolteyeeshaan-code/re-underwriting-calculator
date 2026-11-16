/* =====================================================================
 * WC MICRO-BUDGET · composition inside a fixed underwritten envelope
 *
 * The macro working-capital ceiling is set by underwriting. This module
 * only reallocates inside it: every helper here is presentation-layer
 * arithmetic (shares, target variances, roll-ups, prioritisation).
 * Project cost, margin and sensitivity are never recomputed here — they
 * come from the viability engine, which stays the single source of truth.
 *
 * Targets are seeded by the underwriter for this project (brand, location,
 * positioning, pricing mix). They are editable starting points, never an
 * industry standard.
 * ===================================================================== */

export const WC_WALLET_KEYS = [
  'wcOfficeTeam',
  'wcMarketing',
  'wcHospitality',
  'wcLegal',
  'wcRera',
  'wcReserve',
] as const;

export type WcWalletKey = (typeof WC_WALLET_KEYS)[number];

export type WalletRates = Record<WcWalletKey, number>;

export interface WalletMeta {
  key: WcWalletKey;
  label: string;
  short: string;
  color: string;
  note: string;
  /** Indicative spend window across the programme. Composition guidance only. */
  window: string;
  /** Six-bucket indicative intensity, M0 → handover. Not a cash-flow forecast. */
  profile: readonly [number, number, number, number, number, number];
}

export const WC_WALLETS: readonly WalletMeta[] = [
  {
    key: 'wcOfficeTeam',
    label: 'Office / Team',
    short: 'Office',
    color: '#579973',
    note: 'SPV overhead, rent and delivery payroll',
    window: 'Programme-wide',
    profile: [0.7, 1, 1, 1, 1, 0.8],
  },
  {
    key: 'wcMarketing',
    label: 'Marketing',
    short: 'Mktg',
    color: '#F4C74B',
    note: 'Launch, channel and broker activation',
    window: 'Pre-launch → 60%',
    profile: [0.5, 1, 1, 0.9, 0.5, 0.3],
  },
  {
    key: 'wcHospitality',
    label: 'Hospitality',
    short: 'Hosp',
    color: '#8CA0DC',
    note: 'Buyer lounge, events and site hosting',
    window: 'Launch → handover',
    profile: [0.2, 0.7, 1, 1, 0.8, 0.6],
  },
  {
    key: 'wcLegal',
    label: 'Legal',
    short: 'Legal',
    color: '#C98A3C',
    note: 'SPA, conveyancing and counsel retainers',
    window: 'Front-loaded',
    profile: [1, 1, 0.8, 0.6, 0.6, 0.7],
  },
  {
    key: 'wcRera',
    label: 'RERA',
    short: 'RERA',
    color: '#7C6BB0',
    note: 'Registration, escrow and statutory fees',
    window: 'Front-loaded',
    profile: [1, 0.9, 0.5, 0.4, 0.4, 0.5],
  },
  {
    key: 'wcReserve',
    label: 'Reserve',
    short: 'Reserve',
    color: '#FA6C5D',
    note: 'Unallocated buffer held against slippage',
    window: 'Held to handover',
    profile: [0.3, 0.3, 0.4, 0.6, 0.9, 1],
  },
];

export const WALLET_BY_KEY: Record<WcWalletKey, WalletMeta> = WC_WALLETS.reduce(
  (acc, wallet) => { acc[wallet.key] = wallet; return acc; },
  {} as Record<WcWalletKey, WalletMeta>,
);

/* ---------------------------------------------------------- seeded targets */

export interface WalletTarget {
  /** Our target for this project as a share of GDV. */
  gdvPct: number;
  /** Optional target as a share of underwritten development cost. */
  costPct: number | null;
}

export type WalletTargets = Record<WcWalletKey, WalletTarget>;

/**
 * Starting-point targets pre-filled for a first open. Every field is editable
 * and persists; the seeded mix deliberately leaves Marketing below target
 * while Hospitality / Legal / Reserve sit above it, so the prioritisation
 * read is legible immediately.
 */
export const DEFAULT_TARGETS: WalletTargets = {
  wcOfficeTeam: { gdvPct: 0.8, costPct: 1.0 },
  wcMarketing: { gdvPct: 1.5, costPct: 1.9 },
  wcHospitality: { gdvPct: 0.45, costPct: 0.57 },
  wcLegal: { gdvPct: 0.35, costPct: 0.44 },
  wcRera: { gdvPct: 0.25, costPct: 0.32 },
  wcReserve: { gdvPct: 0.3, costPct: 0.38 },
};

/** Pre-fill mix for the optional project-context note. */
export const CONTEXT_PLACEHOLDER = 'e.g. Dubai Islands · boutique G+7 · premium PSF';

/** Free-text project context, stored alongside the seeded targets. */
export type ProjectContextNote = string;

export const MAX_CONTEXT_CHARS = 140;

/* ------------------------------------------------------------ nested Office */

export interface PersonRow {
  id: string;
  role: string;
  count: number;
  /** AED per person across the programme. */
  amount: number;
}

export type OfficeMode = 'single' | 'split' | 'people';

export interface OfficeBreakdown {
  mode: OfficeMode;
  /** AED / GFA sf. */
  rentPsf: number;
  /** AED / GFA sf. Used in `split` mode; derived from people in `people` mode. */
  salariesPsf: number;
  people: PersonRow[];
}

export const DEFAULT_OFFICE: OfficeBreakdown = {
  mode: 'single',
  rentPsf: 4,
  salariesPsf: 11,
  // Seeded so the roll-up lands on the underwritten Office / Team line:
  // 1,105,000 AED over ~100,472 GFA sf = 11.00 AED/GFA salaries + 4.00 rent = 15.00.
  people: [
    { id: 'p-dev-dir', role: 'Development Director', count: 1, amount: 420_000 },
    { id: 'p-pm', role: 'Project Manager', count: 1, amount: 300_000 },
    { id: 'p-site-eng', role: 'Site Engineer', count: 2, amount: 145_000 },
    { id: 'p-coord', role: 'Sales Coordinator', count: 1, amount: 95_000 },
  ],
};

/* ---------------------------------------------------------------- persisted */

export interface WcMicroState {
  ceilingPsfGfa: number;
  wallets: WalletRates;
  targets: WalletTargets;
  office: OfficeBreakdown;
  contextNote: ProjectContextNote;
}

export const WC_MICRO_STORAGE_KEY = 'ek.wcMicroBudget.v1';

/* ------------------------------------------------------------------ helpers */

const finite = (value: unknown, fallback = 0): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(finite(value, min), min), Math.max(min, max));

/** Rates are quoted to 2dp; everything internally reconciles at that grain. */
export const roundRate = (value: number): number => Math.round(finite(value) * 100) / 100;

export const sumRates = (rates: WalletRates): number =>
  roundRate(WC_WALLET_KEYS.reduce((total, key) => total + Math.max(0, finite(rates[key])), 0));

export const peopleTotalAed = (people: readonly PersonRow[]): number =>
  people.reduce((total, person) => total + Math.max(0, finite(person.count)) * Math.max(0, finite(person.amount)), 0);

export const peopleRate = (people: readonly PersonRow[], gfa: number): number =>
  gfa > 0 ? peopleTotalAed(people) / gfa : 0;

/**
 * Scale rates onto an exact total in integer hundredths (largest remainder),
 * so six rounded lines can never overshoot the ceiling by a cent.
 */
export function scaleRatesToTotal(rates: WalletRates, total: number): WalletRates {
  const targetCents = Math.max(0, Math.round(finite(total) * 100));
  const current = sumRates(rates);
  const out = {} as WalletRates;
  if (current <= 0) {
    for (const key of WC_WALLET_KEYS) out[key] = 0;
    return out;
  }
  const parts = WC_WALLET_KEYS.map((key, index) => {
    const exact = (Math.max(0, finite(rates[key])) / current) * targetCents;
    const floor = Math.floor(exact);
    return { key, index, floor, remainder: exact - floor };
  });
  let left = targetCents - parts.reduce((sum, part) => sum + part.floor, 0);
  const order = [...parts].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  const bump = new Map<WcWalletKey, number>();
  for (let i = 0; left > 0 && i < order.length * 2; i += 1) {
    const entry = order[i % order.length];
    bump.set(entry.key, (bump.get(entry.key) ?? 0) + 1);
    left -= 1;
  }
  for (const part of parts) out[part.key] = (part.floor + (bump.get(part.key) ?? 0)) / 100;
  return out;
}

/** Headroom left inside the envelope, never negative. */
export const headroom = (ceiling: number, rates: WalletRates): number =>
  roundRate(Math.max(0, finite(ceiling) - sumRates(rates)));

/**
 * Hard rule: the envelope cannot expand from this panel. A proposed rate is
 * capped by what the other wallets leave available.
 */
export function clampWalletRate(
  key: WcWalletKey,
  proposed: number,
  ceiling: number,
  rates: WalletRates,
): { applied: number; blocked: boolean; requested: number } {
  const others = roundRate(sumRates(rates) - Math.max(0, finite(rates[key])));
  const available = roundRate(Math.max(0, finite(ceiling) - others));
  const requested = roundRate(Math.max(0, finite(proposed)));
  const applied = roundRate(Math.min(requested, available));
  return { applied, blocked: requested > applied + 0.004, requested };
}

/* ---------------------------------------------------------- target maths */

export type TargetVerdict = 'below' | 'at' | 'above';

/** ±5% relative band counts as "at target" so rounding never flags noise. */
export const verdictOf = (actualPct: number, targetPct: number): BenchVerdict => {
  if (!(targetPct > 0)) return 'at';
  const ratio = actualPct / targetPct;
  if (ratio < 0.95) return 'below';
  if (ratio > 1.05) return 'above';
  return 'at';
};

/** @deprecated Use TargetVerdict. Kept so older imports keep compiling. */
export type BenchVerdict = TargetVerdict;

export interface WalletRead {
  meta: WalletMeta;
  rate: number;
  totalAed: number;
  wcPct: number;
  gdvPct: number;
  costPct: number;
  target: WalletTarget;
  gdvVerdict: TargetVerdict;
  costVerdict: TargetVerdict | null;
  /** Actual minus our target, in percentage points. */
  gdvVariancePts: number;
  costVariancePts: number | null;
  /** AED above (+) / below (−) our GDV target. */
  gdvGapAed: number;
  /** AED above (+) / below (−) our cost target, when a cost target is seeded. */
  costGapAed: number | null;
  /** Rate that would land exactly on our GDV target. */
  rateToTarget: number;
  /** Rate that would land exactly on our cost target, when seeded. */
  rateToCostTarget: number | null;
}

export interface ReadInput {
  rates: WalletRates;
  targets: WalletTargets;
  gfa: number;
  gdv: number;
  totalCost: number;
}

export function readWallets({ rates, targets, gfa, gdv, totalCost }: ReadInput): WalletRead[] {
  const allocated = sumRates(rates);
  return WC_WALLETS.map((meta) => {
    const rate = Math.max(0, finite(rates[meta.key]));
    const totalAed = rate * gfa;
    const target = targets[meta.key];
    const gdvPct = gdv > 0 ? (totalAed / gdv) * 100 : 0;
    const costPct = totalCost > 0 ? (totalAed / totalCost) * 100 : 0;
    const targetAed = (Math.max(0, finite(target.gdvPct)) / 100) * gdv;
    const hasCostTarget = target.costPct !== null;
    const costTargetAed = hasCostTarget ? (Math.max(0, finite(target.costPct)) / 100) * totalCost : 0;
    return {
      meta,
      rate,
      totalAed,
      wcPct: allocated > 0 ? (rate / allocated) * 100 : 0,
      gdvPct,
      costPct,
      target,
      gdvVerdict: verdictOf(gdvPct, target.gdvPct),
      costVerdict: !hasCostTarget ? null : verdictOf(costPct, target.costPct as number),
      gdvVariancePts: roundRate(gdvPct - Math.max(0, finite(target.gdvPct))),
      costVariancePts: !hasCostTarget ? null : roundRate(costPct - Math.max(0, finite(target.costPct))),
      gdvGapAed: totalAed - targetAed,
      costGapAed: !hasCostTarget ? null : totalAed - costTargetAed,
      rateToTarget: gfa > 0 ? roundRate(targetAed / gfa) : 0,
      rateToCostTarget: !hasCostTarget || !(gfa > 0) ? null : roundRate(costTargetAed / gfa),
    };
  });
}

/* ----------------------------------------------------------- prioritisation */

export interface Move {
  id: string;
  from: WcWalletKey;
  to: WcWalletKey;
  /** AED / GFA sf transferred. Envelope total is unchanged. */
  rate: number;
  aed: number;
  reason: string;
}

/**
 * Ranked donor → recipient transfers. Donors sit above our seeded GDV target,
 * recipients below it. A transfer never changes the envelope total, so the
 * ceiling is untouched by construction.
 */
export function planMoves(reads: readonly WalletRead[], gfa: number, limit = 3): Move[] {
  if (!(gfa > 0)) return [];
  const donors = reads
    .filter((r) => r.gdvVerdict === 'above' && r.gdvGapAed > 0)
    .map((r) => ({ read: r, spare: roundRate(r.rate - r.rateToTarget) }))
    .filter((d) => d.spare > 0.04)
    .sort((a, b) => b.read.gdvGapAed - a.read.gdvGapAed);
  const recipients = reads
    .filter((r) => r.gdvVerdict === 'below' && r.gdvGapAed < 0)
    .map((r) => ({ read: r, need: roundRate(r.rateToTarget - r.rate) }))
    .filter((r) => r.need > 0.04)
    .sort((a, b) => a.read.gdvGapAed - b.read.gdvGapAed);

  const moves: Move[] = [];
  for (const recipient of recipients) {
    let need = recipient.need;
    for (const donor of donors) {
      if (need <= 0.04 || donor.spare <= 0.04) continue;
      const rate = roundRate(Math.min(need, donor.spare));
      if (rate <= 0.04) continue;
      moves.push({
        id: `${donor.read.meta.key}->${recipient.read.meta.key}`,
        from: donor.read.meta.key,
        to: recipient.read.meta.key,
        rate,
        aed: rate * gfa,
        reason: `${donor.read.meta.label} runs ${donor.read.gdvPct.toFixed(2)}% of GDV against our ${donor.read.target.gdvPct.toFixed(2)}% target; ${recipient.read.meta.label} runs ${recipient.read.gdvPct.toFixed(2)}% against our ${recipient.read.target.gdvPct.toFixed(2)}% target.`,
      });
      donor.spare = roundRate(donor.spare - rate);
      need = roundRate(need - rate);
      if (moves.length >= limit) return moves;
    }
  }
  return moves;
}

/* --------------------------------------------------------- office reconcile */

/**
 * Keeps the Office / Team children summing to the parent. The parent can move
 * from the macro wallet chips above this panel, so children are reconciled
 * rather than allowed to drift.
 */
export function reconcileOffice(
  office: OfficeBreakdown,
  parentRate: number,
  gfa: number,
): { office: OfficeBreakdown; note: string | null } {
  const parent = roundRate(Math.max(0, parentRate));
  if (office.mode === 'single') return { office, note: null };

  if (office.mode === 'people') {
    const salaries = roundRate(peopleRate(office.people, gfa));
    if (salaries > parent + 0.004) {
      return {
        office: { ...office, rentPsf: 0 },
        note: `Payroll roll-up (${salaries.toFixed(2)}) exceeds the Office / Team line (${parent.toFixed(2)}). Trim a role or lift the line inside headroom.`,
      };
    }
    const rent = roundRate(parent - salaries);
    return rent === office.rentPsf ? { office, note: null } : { office: { ...office, rentPsf: rent }, note: null };
  }

  const total = roundRate(office.rentPsf + office.salariesPsf);
  if (Math.abs(total - parent) <= 0.004) return { office, note: null };
  if (total <= 0) {
    return { office: { ...office, rentPsf: 0, salariesPsf: parent }, note: null };
  }
  const share = office.rentPsf / total;
  const rent = roundRate(parent * share);
  return { office: { ...office, rentPsf: rent, salariesPsf: roundRate(parent - rent) }, note: null };
}

/* -------------------------------------------------------------- persistence */

const sanitisePeople = (raw: unknown): PersonRow[] => {
  if (!Array.isArray(raw)) return DEFAULT_OFFICE.people.map((p) => ({ ...p }));
  return raw
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    .map((row, index) => ({
      id: typeof row.id === 'string' && row.id ? row.id : `p-${index}`,
      role: typeof row.role === 'string' ? row.role : '',
      count: Math.max(0, Math.round(finite(row.count, 0))),
      amount: Math.max(0, finite(row.amount, 0)),
    }))
    .slice(0, 40);
};

const sanitiseRates = (raw: unknown, fallback: WalletRates): WalletRates => {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out = {} as WalletRates;
  for (const key of WC_WALLET_KEYS) {
    const value = source[key];
    out[key] = value === undefined || value === null ? fallback[key] : roundRate(Math.max(0, finite(value, fallback[key])));
  }
  return out;
};

const sanitiseTargets = (raw: unknown): WalletTargets => {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out = {} as WalletTargets;
  for (const key of WC_WALLET_KEYS) {
    const entry = source[key];
    const base = DEFAULT_TARGETS[key];
    if (!entry || typeof entry !== 'object') { out[key] = { ...base }; continue; }
    const record = entry as Record<string, unknown>;
    const cost = record.costPct;
    out[key] = {
      gdvPct: clamp(finite(record.gdvPct, base.gdvPct), 0, 100),
      costPct: cost === null || cost === undefined || cost === '' ? null : clamp(finite(cost, 0), 0, 100),
    };
  }
  return out;
};

const sanitiseContextNote = (raw: unknown): ProjectContextNote => {
  if (typeof raw !== 'string') return '';
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_CONTEXT_CHARS);
};

export function sanitiseState(raw: unknown, fallback: WcMicroState): WcMicroState {
  if (!raw || typeof raw !== 'object') return fallback;
  const source = raw as Record<string, unknown>;
  const officeRaw = (source.office && typeof source.office === 'object' ? source.office : {}) as Record<string, unknown>;
  const mode: OfficeMode = officeRaw.mode === 'split' || officeRaw.mode === 'people' ? officeRaw.mode : 'single';
  // The envelope is authoritative: a payload that overflows it is scaled back,
  // never allowed to raise the ceiling.
  const ceiling = roundRate(Math.max(0, finite(source.ceilingPsfGfa, fallback.ceilingPsfGfa)));
  const wallets = sanitiseRates(source.wallets, fallback.wallets);
  const restoredTotal = sumRates(wallets);
  const fitted = restoredTotal > ceiling + 0.004 ? scaleRatesToTotal(wallets, ceiling) : wallets;
  return {
    ceilingPsfGfa: ceiling,
    wallets: fitted,
    targets: sanitiseTargets(source.targets ?? source.benchmarks),
    contextNote: sanitiseContextNote(source.contextNote),
    office: {
      mode,
      rentPsf: roundRate(Math.max(0, finite(officeRaw.rentPsf, DEFAULT_OFFICE.rentPsf))),
      salariesPsf: roundRate(Math.max(0, finite(officeRaw.salariesPsf, DEFAULT_OFFICE.salariesPsf))),
      people: sanitisePeople(officeRaw.people),
    },
  };
}

export function loadState(fallback: WcMicroState): WcMicroState | null {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(WC_MICRO_STORAGE_KEY);
    if (!raw) return null;
    return sanitiseState(JSON.parse(raw), fallback);
  } catch {
    return null;
  }
}

export function saveState(state: WcMicroState): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(WC_MICRO_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — the panel keeps working in memory */
  }
}

export function clearState(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(WC_MICRO_STORAGE_KEY);
  } catch {
    /* no-op */
  }
}
