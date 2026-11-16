import { useCallback, useMemo, useState } from 'react';

export interface Inputs {
  parcelSize: number; // sq ft
  far: number;
  farEfficiency: number; // %
  landValue: number; // AED
  sellingPricePsf: number; // AED / sq ft NSA
  constructionCostGfa: number; // AED / sq ft GFA
  pmcChargesPct: number;
  escalationsPct: number;
  contingenciesPct: number;
  approvalsCostGfa: number; // AED / sq ft GFA
  workingCapitalGfa: number; // AED / sq ft GFA
  financingArr: number; // %
  projectDurationYears: number;
  /** Wallet A treatment: restricted cash escrow, or bank-guarantee plus fixed deposit. */
  walletATreatment: WalletATreatment;
  /** Wallet B simple yield on the still-invested balance (% per year). */
  walletBYieldPct: number;
  /** Wallet B internal hurdle on drawn balances (% per year, hits P&L). */
  walletBHurdlePct: number;
  vatRate: number; // %
  buyerMilestone1: number; // % of GDV collected at booking / 20%
  buyerMilestone2: number;
  buyerMilestone3: number;
  buyerMilestone4: number;
  reraRetentionPct: number;
}

/** Wallet A regulatory treatment. Cash escrow or bank guarantee plus fixed deposit. */
export type WalletATreatment = 'cash' | 'bg_fd';

export const WALLET_A_TREATMENTS: { value: WalletATreatment; label: string }[] = [
  { value: 'cash', label: 'Cash escrow' },
  { value: 'bg_fd', label: 'BG + fixed deposit' },
];

export const DEFAULT_INPUTS: Inputs = {
  parcelSize: 35628,
  far: 2.82,
  farEfficiency: 80,
  landValue: 75_000_000,
  sellingPricePsf: 2500,
  constructionCostGfa: 431,
  pmcChargesPct: 4,
  escalationsPct: 1,
  contingenciesPct: 2,
  approvalsCostGfa: 25,
  workingCapitalGfa: 75,
  financingArr: 15,
  projectDurationYears: 3,
  walletATreatment: 'cash',
  walletBYieldPct: 5,
  walletBHurdlePct: 15,
  vatRate: 5,
  buyerMilestone1: 20,
  buyerMilestone2: 20,
  buyerMilestone3: 20,
  buyerMilestone4: 20,
  reraRetentionPct: 10,
};

export type MilestoneKey =
  | 'buyerMilestone1'
  | 'buyerMilestone2'
  | 'buyerMilestone3'
  | 'buyerMilestone4';

export const MILESTONE_KEYS: MilestoneKey[] = [
  'buyerMilestone1',
  'buyerMilestone2',
  'buyerMilestone3',
  'buyerMilestone4',
];

/** Dubai Law No. 8 of 2007 — post-handover defects liability holdback (statutory, non-editable). */
export const DEFECTS_LIABILITY_PCT = 5;
export const DEFECTS_LIABILITY_MONTHS = 12;

/* ---------- formatting helpers ---------- */
export const fmtM = (v: number) => `${(v / 1_000_000).toFixed(2)}M`;
export const fmtAedM = (v: number) => `AED ${fmtM(v)}`;
export const fmtNum = (v: number, d = 0) =>
  v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtPct = (v: number, d = 1) => `${v.toFixed(d)}%`;

/**
 * Hardened parser for every controlled number input. A cleared field, a stray
 * "-" or a partial exponent ("1e") must never leak NaN/undefined into state.
 */
export function parseNumericInput(raw: string | null | undefined): number {
  if (raw == null) return 0;
  const t = String(raw).trim().replace(/,/g, '');
  if (t === '' || t === '-' || t === '.' || t === '-.') return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

/** Clamp to a finite value inside [min, max]; guarantees no NaN/Infinity reaches the engine. */
export function clampFinite(value: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/** Read valueAsNumber safely and clamp it to the supplied numeric boundary. */
export function parseTreasuryNumber(value: number, max = Number.MAX_SAFE_INTEGER): number {
  return clampFinite(value, 0, clampFinite(max));
}

/* ---------- Sankey data types ---------- */
export interface SankeyNodeDef {
  id: string;
  label: string;
  value?: number;
  column: number;
  color: string;
  note?: string;
}
export interface SankeyLinkDef {
  source: string;
  target: string;
  value: number;
}
export interface SankeyData {
  nodes: SankeyNodeDef[];
  links: SankeyLinkDef[];
}

export function auditSankeyFlows(data: SankeyData) {
  const nodes = data.nodes.map((node) => {
    const incoming = data.links.filter((link) => link.target === node.id).reduce((sum, link) => sum + link.value, 0);
    const outgoing = data.links.filter((link) => link.source === node.id).reduce((sum, link) => sum + link.value, 0);
    return { id: node.id, incoming, outgoing, residual: incoming > 0 && outgoing > 0 ? incoming - outgoing : 0 };
  });
  const sourceTotal = nodes.filter((node) => node.incoming === 0).reduce((sum, node) => sum + node.outgoing, 0);
  const sinkTotal = nodes.filter((node) => node.outgoing === 0).reduce((sum, node) => sum + node.incoming, 0);
  const validLinks = data.links.every((link) => Number.isFinite(link.value) && link.value >= 0
    && data.nodes.some((node) => node.id === link.source) && data.nodes.some((node) => node.id === link.target));
  const residual = sourceTotal - sinkTotal;
  return { sourceTotal, sinkTotal, residual, balanced: validLinks && Math.abs(residual) <= 0.05
    && nodes.every((node) => Math.abs(node.residual) <= 0.05) };
}

export interface MilestoneRow {
  id: string;
  label: string;
  phase: string;
  pct: number; // construction progress at which collection triggers
  collectionPct: number;
  collection: number;
  cumulativePct: number;
  month: number;
  retained: number;
  defectsHeld: number;
  released: number;
}

const COLORS = {
  land: '#f6ce52',
  debt: '#b9c8ee',
  interest: '#fa6c5d',
  budget: '#c9d5f2',
  hard: '#f6d45c',
  soft: '#fbe9a8',
  esc: '#fcbfb6',
  wc: '#b9c8ee',
  vat: '#fa6c5d',
  fta: '#c9d5f2',
  loop: '#94a3b8',
  surplus: '#f6ce52',
  escrow: '#b9c8ee',
  retention: '#f6d45c',
  unlocked: '#f6ce52',
  defects: '#fa6c5d',
  warranty: '#fcbfb6',
};

/* =====================================================================
 * STAGE-LINKED DEBT TRANCHES
 * The senior facility is a pre-development draw plus five scheduled draw
 * rights mapped to the buyer escrow's five delivery progress gates. Each is
 * a right to draw, not a wallet: interest only accrues on the amount actually
 * drawn, from its planned draw month to handover. Capacity left undrawn is
 * funded by milestone-unlocked escrow and reduces the interest line.
 * ===================================================================== */

export type TrancheId = 'predev' | 'A' | 'B' | 'C' | 'D' | 'E';

export interface DebtTranche {
  id: TrancheId;
  /** Maximum drawable amount under this right (AED). */
  capacity: number;
  /** Share of capacity the developer elects to draw, 0–100. */
  drawPct: number;
  /** Planned draw month measured from financial close. */
  drawMonth: number;
  /** Optional annual commitment fee charged on the undrawn balance (% p.a.). */
  commitmentFeePct: number;
}

export interface TrancheMeta {
  id: TrancheId;
  label: string;
  gate: string;
  color: string;
  note: string;
}

/** Pre-development first, then the same five progress gates as buyer escrow. */
export const TRANCHE_META: TrancheMeta[] = [
  { id: 'predev', label: 'Pre-Development Draw', gate: 'Before construction · before 20% collection', color: '#b9c8ee', note: 'SPV set-up, licences, design, approvals, land-side soft costs and early working capital; typically debt- or equity-funded before meaningful escrow inflow.' },
  { id: 'A', label: 'Tranche A · 20% Milestone', gate: '20% · Ground & Foundation', color: '#a8bbe8', note: 'First construction draw at the booking / ground-and-foundation progress gate.' },
  { id: 'B', label: 'Tranche B · 40% Milestone', gate: '40% · Structural Core', color: '#97aee2', note: 'Structural core draw aligned to the 40% buyer collection gate.' },
  { id: 'C', label: 'Tranche C · 60% Milestone', gate: '60% · MEP & Facade', color: '#859fdb', note: 'MEP and facade draw aligned to the 60% buyer collection gate.' },
  { id: 'D', label: 'Tranche D · 80% Milestone', gate: '80% · Fit-out', color: '#738fd4', note: 'Fit-out draw aligned to 80% progress; unlocked escrow can reduce or replace this draw.' },
  { id: 'E', label: 'Tranche E · Handover', gate: 'Handover / DLP', color: '#657fc2', note: 'Handover certification, unit registration and defects-liability buffer.' },
];

/** Default capacity split; the construction shares preserve the previous A–E proportions. */
export const DEFAULT_TRANCHE_SPLIT = [15, 12.75, 21.25, 25.5, 17, 8.5] as const;
/** Draw timing: pre-development at financial close, then the 20/40/60/80/100% gates. */
export const DEFAULT_TRANCHE_TIMING = [0, 0.2, 0.4, 0.6, 0.8, 1] as const;

/** Build one pre-development draw plus five progress-gated tranches. */
export function buildDefaultTranches(pool: number, durationYears: number): DebtTranche[] {
  const safePool = clampFinite(pool, 0);
  const months = Math.max(1, Math.round(clampFinite(durationYears, 0.25, 20) * 12));
  let allocated = 0;
  return TRANCHE_META.map((meta, index) => {
    const isLast = index === TRANCHE_META.length - 1;
    // The final tranche absorbs rounding so committed capacity always equals the pool.
    const capacity = isLast ? Math.max(0, safePool - allocated) : Math.round(safePool * (DEFAULT_TRANCHE_SPLIT[index] / 100));
    allocated += capacity;
    return {
      id: meta.id,
      capacity,
      drawPct: 100,
      drawMonth: Math.round(months * DEFAULT_TRANCHE_TIMING[index]),
      commitmentFeePct: 0,
    };
  });
}

/** The non-land funding pool the senior facility is sized against (AED). */
export function debtFundingPool(inputs: Inputs): number {
  const gfa = inputs.parcelSize * inputs.far;
  const baseConstruction = gfa * inputs.constructionCostGfa;
  const escalations = baseConstruction * (inputs.escalationsPct / 100);
  const contingencies = baseConstruction * (inputs.contingenciesPct / 100);
  const pmcCharges = baseConstruction * (inputs.pmcChargesPct / 100);
  const approvals = gfa * inputs.approvalsCostGfa;
  const workingCapital = gfa * inputs.workingCapitalGfa;
  const directDevelopmentCosts = baseConstruction + pmcCharges + escalations + contingencies + approvals;
  return (baseConstruction)
    + (workingCapital + escalations + contingencies)
    + (pmcCharges + approvals)
    + directDevelopmentCosts * (inputs.vatRate / 100);
}

export function simulate(inputs: Inputs, tranches?: DebtTranche[]) {
  const {
    parcelSize, far, farEfficiency, landValue, sellingPricePsf, constructionCostGfa,
    pmcChargesPct, escalationsPct, contingenciesPct, approvalsCostGfa, workingCapitalGfa,
    financingArr, projectDurationYears, walletATreatment, walletBYieldPct, walletBHurdlePct,
    vatRate, reraRetentionPct,
  } = inputs;

  // --- Area & revenue ---
  const gfa = parcelSize * far;
  const nsa = gfa * (farEfficiency / 100);
  const gdv = nsa * sellingPricePsf;

  // --- Hard / soft costs (pre-VAT) ---
  const baseConstruction = gfa * constructionCostGfa;
  const pmcCharges = baseConstruction * (pmcChargesPct / 100);
  const escalations = baseConstruction * (escalationsPct / 100);
  const contingencies = baseConstruction * (contingenciesPct / 100);
  const approvals = gfa * approvalsCostGfa;
  const directDevelopmentCosts =
    baseConstruction + pmcCharges + escalations + contingencies + approvals;
  const workingCapital = gfa * workingCapitalGfa;
  const constructionWallet = baseConstruction;
  const wcWallet = workingCapital + escalations + contingencies;
  const softWallet = pmcCharges + approvals;

  // PMC, approvals, buffers and working capital are held in the senior pool.
  const nonLandPrincipal = constructionWallet + wcWallet + softWallet;
  const nonLandDebtMultiplier = Math.pow(1 + financingArr / 100, projectDurationYears);
  const monolithicFinancingCost = nonLandPrincipal * (nonLandDebtMultiplier - 1);

  // --- Fiscal layer ---
  const grossVatLiability = directDevelopmentCosts * (vatRate / 100);
  const quarterlyVatRecovery = grossVatLiability / Math.max(1, projectDurationYears * 4);

  const externalDebtRequired = constructionWallet + wcWallet + softWallet + grossVatLiability;

  // --- Stage-linked tranche draw schedule (Wallet B buckets) ---
  // Wallet B is the developer yield reserve: each tranche is a maturity bucket
  // aligned to its construction gate. Drawn balances carry the internal hurdle
  // (simple rate × drawn balance × time drawn) straight into P&L. Balances
  // still invested earn the reserve yield (simple rate × time in bucket).
  // Undrawn capacity otherwise carries only an optional commitment fee.
  const durationMonths = Math.max(1, Math.round(projectDurationYears * 12));
  const hurdleRate = Math.max(0, walletBHurdlePct) / 100;
  const yieldRate = Math.max(0, walletBYieldPct) / 100;
  const resolvedTranches = tranches ?? buildDefaultTranches(externalDebtRequired, projectDurationYears);
  // Reference: the funding requirement fully drawn across the five standard stage rights.
  // Savings are always measured against this counterfactual, so shrinking a tranche's
  // size and reducing its draw percentage both register as avoided interest.
  const referenceTranches = buildDefaultTranches(externalDebtRequired, projectDurationYears);

  const trancheSchedule = TRANCHE_META.map((meta, index) => {
    const source = resolvedTranches.find((tranche) => tranche.id === meta.id) ?? resolvedTranches[index];
    const reference = referenceTranches.find((tranche) => tranche.id === meta.id) ?? referenceTranches[index];
    const capacity = clampFinite(source?.capacity ?? 0);
    const drawPct = clampFinite(source?.drawPct ?? 100, 0, 100);
    const drawMonth = Math.round(clampFinite(source?.drawMonth ?? 0, 0, durationMonths));
    const commitmentFeePct = clampFinite(source?.commitmentFeePct ?? 0, 0, 100);
    const drawn = capacity * (drawPct / 100);
    const undrawn = Math.max(0, capacity - drawn);
    const yearsDrawn = (durationMonths - drawMonth) / 12;
    const bucketYears = drawMonth / 12;
    const hurdleCost = drawn * hurdleRate * yearsDrawn;
    const fullDrawHurdle = clampFinite(reference?.capacity ?? capacity, 0) * hurdleRate * yearsDrawn;
    const yieldEarned = undrawn * yieldRate * bucketYears;
    const commitmentFee = undrawn * (commitmentFeePct / 100) * yearsDrawn;
    return {
      ...meta,
      capacity,
      drawPct,
      drawn,
      undrawn,
      /** Share of capacity still invested in Wallet B and earning yield. */
      stillInvested: undrawn,
      drawMonth,
      commitmentFeePct,
      yearsDrawn,
      bucketYears,
      /** Internal hurdle cost on the drawn balance — the P&L carry line. */
      interest: hurdleCost,
      hurdleCost,
      /** Simple yield earned on the still-invested balance while in its bucket. */
      yieldEarned,
      fullDrawInterest: fullDrawHurdle,
      interestSaved: Math.max(0, fullDrawHurdle - hurdleCost),
      commitmentFee,
    };
  });

  const totalDebtFacility = trancheSchedule.reduce((sum, tranche) => sum + tranche.capacity, 0);
  const totalDrawnPrincipal = trancheSchedule.reduce((sum, tranche) => sum + tranche.drawn, 0);
  const totalUndrawnCapacity = Math.max(0, totalDebtFacility - totalDrawnPrincipal);
  const interestOnDrawn = trancheSchedule.reduce((sum, tranche) => sum + tranche.interest, 0);
  const commitmentFees = trancheSchedule.reduce((sum, tranche) => sum + tranche.commitmentFee, 0);
  /** Simple yield earned across every still-invested Wallet B bucket. */
  const walletBYield = trancheSchedule.reduce((sum, tranche) => sum + tranche.yieldEarned, 0);
  /** Net carry: yield earned less hurdle cost less commitment drag. Positive protects margin. */
  const walletBNetCarry = walletBYield - interestOnDrawn - commitmentFees;
  const totalFinancingCost = interestOnDrawn + commitmentFees - walletBYield;
  /** Interest avoided by leaving capacity undrawn, versus drawing every tranche in full. */
  const interestSaved = trancheSchedule.reduce((sum, tranche) => sum + tranche.interestSaved, 0);
  /** Net developer benefit once commitment fees on the undrawn balance are paid. */
  const incrementalDeveloperSurplus = interestSaved - commitmentFees;
  /** Interest avoided versus the legacy monolithic day-one facility. */
  const interestSavedVsMonolithic = Math.max(0, monolithicFinancingCost - interestOnDrawn);
  const blendedFinancingMultiplier = externalDebtRequired > 0
    ? (externalDebtRequired + totalFinancingCost) / externalDebtRequired : 1;
  /** Portion of the non-land funding pool that drawn debt covers; the rest is escrow-funded. */
  const debtFundingCoveragePct = externalDebtRequired > 0
    ? Math.min(999, (totalDrawnPrincipal / externalDebtRequired) * 100) : 0;

  const openingCapitalBase = landValue + externalDebtRequired;
  const totalDevelopmentCost = openingCapitalBase + totalFinancingCost;
  const allInFacilityMultiplier = externalDebtRequired > 0
    ? (externalDebtRequired + totalFinancingCost) / externalDebtRequired : 1;
  const totalProjectSurplus = gdv - totalDevelopmentCost;
  const shortfall = Math.max(0, -totalProjectSurplus);
  const retentionPctEff = clampFinite(reraRetentionPct, 0, 100 - DEFECTS_LIABILITY_PCT);

  // --- Milestone schedule ---
  const pcts = [
    inputs.buyerMilestone1,
    inputs.buyerMilestone2,
    inputs.buyerMilestone3,
    inputs.buyerMilestone4,
  ];
  const milestoneSum = pcts.reduce((a, b) => a + b, 0);
  const handoverPct = Math.max(0, 100 - milestoneSum);
  const phaseNames = [
    'Booking · Ground & Foundation',
    'Structural Core',
    'MEP & Facade',
    'Interior Fit-out',
    'Handover & Completion',
  ];
  const progress = [20, 40, 60, 80, 100];
  const allPcts = [...pcts, handoverPct];
  let cum = 0;
  const milestones: MilestoneRow[] = allPcts.map((p, i) => {
    cum += p;
    const collection = gdv * (p / 100);
    return {
      id: `m${i + 1}`,
      label: i === 4 ? 'Handover' : `${progress[i]}% Milestone`,
      phase: phaseNames[i],
      pct: progress[i],
      collectionPct: p,
      collection,
      cumulativePct: cum,
      month: Math.round((progress[i] / 100) * projectDurationYears * 12),
      retained: collection * (retentionPctEff / 100),
      defectsHeld: collection * (DEFECTS_LIABILITY_PCT / 100),
      released: collection * (1 - (retentionPctEff + DEFECTS_LIABILITY_PCT) / 100),
    };
  });

  // --- Ladder: GDV settles bottom-up (greedy priority) ---
  let remaining = gdv;
  const take = (need: number) => {
    const v = Math.max(0, Math.min(need, remaining));
    remaining -= v;
    return v;
  };
  const ladderPrincipal = take(externalDebtRequired);
  const ladderInterest = take(totalFinancingCost);
  const ladderLand = take(landValue);
  const ladderSurplus = take(Math.max(0, gdv - totalDevelopmentCost));

  const distributionLadder = [
    { name: 'Financier Debt Principal', short: 'Debt Principal', value: ladderPrincipal, color: '#b9c8ee' },
    { name: 'Financier Compounded Interest', short: 'Compounded Interest', value: ladderInterest, color: '#fa6c5d' },
    { name: 'Land Partner Asset Core Return', short: 'Land Partner Return', value: ladderLand, color: '#f6ce52' },
    { name: 'Unallocated Project Cash Surplus / Retained Earnings', short: 'Retained Surplus', value: ladderSurplus, color: '#f6d45c' },
  ];

  // --- Underwriting Sankey: three-wallet, buyer-first capitalisation ---
  // Wallet A is the 20% RERA regulatory lock (cash escrow, or BG plus fixed
  // deposit). Wallet B is the developer yield reserve that splits into the six
  // stage-linked draw rights. Wallet C is buyer operating inflows. Uses clear
  // buyer-first: C funds each cost sink first, A releases into milestone
  // construction next, and drawn B covers only the residual.
  const walletALock = externalDebtRequired * 0.2;
  const walletATreatmentLabel = walletATreatment === 'bg_fd' ? 'Bank guarantee + fixed deposit' : 'Restricted cash escrow';
  const escrowFundingBridge = Math.max(0, externalDebtRequired - totalDrawnPrincipal);
  const sinkNeeds = [constructionWallet, wcWallet, softWallet, grossVatLiability];
  const sinkIds = ['u_site', 'u_logistics', 'u_consultants', 'u_fta'] as const;
  const walletCFunding = sinkNeeds.map((need, index) => {
    const before = sinkNeeds.slice(0, index).reduce((sum, value) => sum + value, 0);
    return Math.max(0, Math.min(need, escrowFundingBridge - before));
  });
  const walletARelease = Math.min(walletALock, Math.max(0, constructionWallet - walletCFunding[0]));
  const walletARestricted = Math.max(0, walletALock - walletARelease);
  const drawnCashToSinks = sinkNeeds.map((need, index) =>
    Math.max(0, need - walletCFunding[index] - (index === 0 ? walletARelease : 0)),
  );
  const drawnCashToUses = drawnCashToSinks.reduce((sum, value) => sum + value, 0);
  const idleDrawnCash = Math.max(0, totalDrawnPrincipal - drawnCashToUses);

  const underwritingSankey: SankeyData = {
    nodes: [
      { id: 'land', label: 'Land Partner Equity', column: 0, color: COLORS.land, value: landValue,
        note: 'Securitised land value contributed in kind on Day 1' },
      { id: 'fpCapital', label: 'Finance Partner Capital', column: 0, color: COLORS.debt, value: totalDebtFacility,
        note: `Committed partner capital across a pre-development draw and five buyer-milestone construction draws. Non-land requirement ${fmtAedM(externalDebtRequired)}.` },
      { id: 'walletA', label: 'Wallet A · RERA 20% Lock', column: 0, color: COLORS.retention, value: walletALock,
        note: `${walletATreatmentLabel}. Restricted to milestone construction; ${fmtAedM(walletARelease)} released, ${fmtAedM(walletARestricted)} held restricted.` },
      { id: 'walletC', label: 'Wallet C · Buyer Operating Inflows', column: 0, color: COLORS.unlocked, value: escrowFundingBridge,
        note: 'PDCs, Oqood and milestone collections — first source for contractor payments before Wallet B is touched' },
      // Column 1 — land lock plus the Wallet B yield reserve and its six draw rights
      { id: 'landLock', label: 'Land Capitalisation Lock', column: 1, color: COLORS.land,
        note: 'Land equity capitalises in kind and is returned at close' },
      { id: 'walletB', label: 'Wallet B · Yield Reserve (80% pool)', column: 1, color: COLORS.budget, value: totalDebtFacility,
        note: `Developer reserve held in gate-aligned buckets. ${fmtAedM(totalUndrawnCapacity)} still invested earning ${fmtAedM(walletBYield)} yield; ${fmtAedM(totalDrawnPrincipal)} drawn at ${fmtPct(walletBHurdlePct, 2)} hurdle.` },
      ...trancheSchedule.map((tranche) => ({
        id: `tranche_${tranche.id}`,
        label: `${tranche.label}`,
        column: 1,
        color: tranche.color,
        value: tranche.capacity,
        note: `${tranche.gate}. Draw month ${tranche.drawMonth}. ${fmtAedM(tranche.drawn)} drawn at hurdle, ${fmtAedM(tranche.stillInvested)} still invested earning ${fmtAedM(tranche.yieldEarned)} yield.`,
      })),
      // Column 2 — drawn B capital, plus the still-invested reserve earning yield
      { id: 'drawnCash', label: 'Drawn Capital (B)', column: 2, color: COLORS.budget, value: totalDrawnPrincipal,
        note: `Drawn Wallet B balances funding the residual after buyer-first C and A releases. Hurdle cost ${fmtAedM(interestOnDrawn)} hits P&L.` },
      { id: 'undrawnResidual', label: 'Still Invested (B)', column: 2, color: COLORS.loop, value: totalUndrawnCapacity,
        note: `Reserve balances left invested, earning ${fmtAedM(walletBYield)} yield. Net carry ${fmtAedM(walletBNetCarry)} protects developer surplus.` },
      { id: 'idleDebtCash', label: 'Excess Drawn Capital', column: 2, color: COLORS.budget, value: idleDrawnCash,
        note: 'Drawn capital above the buyer-first residual need; held as idle liquidity' },
      { id: 'aRestricted', label: 'A Restricted Balance', column: 2, color: COLORS.retention, value: walletARestricted,
        note: 'Wallet A lock held restricted beyond this gate’s milestone construction need' },
      // Column 3 — terminal cost sinks (no duplicate wallet layer)
      { id: 'u_site', label: 'Construction · Contractor & Site', column: 3, color: COLORS.hard, value: constructionWallet,
        note: 'Physical construction and site preparation' },
      { id: 'u_logistics', label: 'Working Capital & Contingencies', column: 3, color: COLORS.wc, value: wcWallet,
        note: 'Working capital, escalations and contingency absorption' },
      { id: 'u_consultants', label: 'Design, PMC & Approvals', column: 3, color: COLORS.soft, value: softWallet,
        note: 'Design, professional fees and authority approvals' },
      { id: 'u_fta', label: 'VAT Bridge · FTA Recovery', column: 3, color: COLORS.fta, value: grossVatLiability,
        note: 'Input VAT bridge; recovered through the FTA loop' },
    ],
    links: [
      // Land equity capitalises in kind.
      { source: 'land', target: 'landLock', value: landValue },
      // Finance Partner capital is committed into the Wallet B yield reserve.
      { source: 'fpCapital', target: 'walletB', value: totalDebtFacility },
      // The reserve splits into pre-development, then the five progress gates.
      ...trancheSchedule.map((tranche) => ({ source: 'walletB', target: `tranche_${tranche.id}`, value: tranche.capacity })),
      // Each right releases only the elected drawn amount; the rest stays invested.
      ...trancheSchedule.flatMap((tranche) => [
        { source: `tranche_${tranche.id}`, target: 'drawnCash', value: tranche.drawn },
        { source: `tranche_${tranche.id}`, target: 'undrawnResidual', value: tranche.undrawn },
      ]),
      // Buyer-first layering: Wallet C funds each sink first…
      ...sinkIds.map((sinkId, index) => ({ source: 'walletC', target: sinkId, value: walletCFunding[index] })),
      // …Wallet A releases into milestone construction next…
      { source: 'walletA', target: 'u_site', value: walletARelease },
      { source: 'walletA', target: 'aRestricted', value: walletARestricted },
      // …and drawn B covers only the residual, with any excess held idle.
      ...sinkIds.map((sinkId, index) => ({ source: 'drawnCash', target: sinkId, value: drawnCashToSinks[index] })),
      { source: 'drawnCash', target: 'idleDebtCash', value: idleDrawnCash },
    ],
  };

  // --- Escrow Sankey ---
  // Dubai Law No. 8 of 2007 — dual-tier ring-fenced holdbacks
  const retentionPool = gdv * (retentionPctEff / 100);
  const defectsPool = gdv * (DEFECTS_LIABILITY_PCT / 100);
  const unlockedPool = Math.max(0, gdv - retentionPool - defectsPool);
  const handoverMonth = Math.round(projectDurationYears * 12);
  const dlpEndMonth = handoverMonth + DEFECTS_LIABILITY_MONTHS;

  // Part of book surplus remains unavailable until the statutory defects hold expires.
  const defectsTrappedInSurplus = Math.min(defectsPool, Math.max(0, totalProjectSurplus));

  // --- Parallel operating wallets: each funded channel is a dedicated column-0 source ---
  const loanWallet = constructionWallet;

  // The unlocked pool settles actual obligations in priority order. Retention and the 5%
  // warranty pool are not used as if available before their release dates. Show shortfalls
  // rather than overpaying a rung merely to make the drawing fill its entire width.
  const repaymentObligations = [
    { id: 'use_principal', label: 'Finance Partner Capital', obligation: externalDebtRequired, color: '#b9c8ee' },
    { id: 'use_interest', label: 'Finance Partner Preferred Return', obligation: Math.max(0, totalFinancingCost), color: COLORS.interest },
    { id: 'use_land', label: 'Land Partner Return', obligation: landValue, color: COLORS.land },
  ];
  const obligationTotal = repaymentObligations.reduce((sum, item) => sum + item.obligation, 0);
  let availableForRepayment = unlockedPool;
  const uses = repaymentObligations.map((item) => {
    const funded = Math.min(item.obligation, availableForRepayment);
    availableForRepayment = Math.max(0, availableForRepayment - funded);
    return { ...item, funded, shortfall: Math.max(0, item.obligation - funded) };
  });
  const repaymentShortfall = uses.reduce((sum, item) => sum + item.shortfall, 0);
  const unlockedSettlementSurplus = availableForRepayment;
  const repaymentCoveragePct = obligationTotal > 0
    ? Math.min(100, ((obligationTotal - repaymentShortfall) / obligationTotal) * 100) : 100;

  // Ring-fenced wallet sinks that never draw on the DLD escrow account.
  const ringFencedSinks = [
    {
      id: 'sink_contractor',
      label: 'Construction Draws - Contractor & Site',
      source: 'loanWallet',
      value: loanWallet,
      color: COLORS.hard,
      note: 'Funded from the dedicated construction loan facility wallet',
    },
    {
      id: 'sink_consultant',
      label: 'Consultants, Professional Fees & Authority Charges',
      source: 'softWallet',
      value: softWallet,
      color: COLORS.soft,
      note: 'PMC and itemised soft-cost/approval fees. Funded once from the dedicated wallet.',
    },
    {
      id: 'sink_working',
      label: 'Site Working Capital & Contingency Absorption',
      source: 'wcWallet',
      value: wcWallet,
      color: COLORS.wc,
      note: 'Site logistics, insurance and escalation/contingency draw-down',
    },
  ];

  /** Seeded treasury wallets feeding the operational escrow diagram. */
  const walletLedger = [
    { id: 'loanWallet', label: 'Construction Loan Facility Wallet', value: loanWallet, note: 'Ring-fenced contractor & site preparation draws' },
    { id: 'wcWallet', label: 'Working Capital & Contingency Wallet', value: wcWallet, note: 'Working capital + contingencies + escalations' },
    { id: 'softWallet', label: 'Soft Costs, PMC & Approvals Wallet', value: softWallet, note: 'PMC charges + authority approvals' },
    { id: 'escrow_src', label: 'DLD RERA Escrow Account (Buyer Deposits)', value: gdv, note: 'Buyer milestone collections under Law No. 8 of 2007' },
  ];
  const operatingWalletTotal = loanWallet + wcWallet + softWallet;

  const escrowSankey: SankeyData = {
    nodes: [
      // Column 0 — the DLD escrow account plus the three debt-funded operating wallets
      { id: 'escrow_src', label: 'DLD RERA Escrow Account (Buyer Deposits)', value: gdv, column: 0, color: '#f6d45c', note: 'GDV collected across five buyer payment tranches: booking, 40%, 60%, 80% and handover.' },
      { id: 'loanWallet', label: 'Construction Loan Facility Wallet', value: baseConstruction, column: 0, color: '#b9c8ee', note: 'Sub-allocation of the External Debt Facility; funds contractor draws' },
      { id: 'wcWallet', label: 'Working Capital & Contingency Wallet', value: wcWallet, column: 0, color: '#b9c8ee', note: 'Working capital, contingencies and escalations' },
      { id: 'softWallet', label: 'Soft Costs, PMC & Approvals Wallet', value: softWallet, column: 0, color: '#fbe9a8', note: 'PMC charges and authority approvals' },
      // Column 1 — the operating treasury hub collects 100% of buyer deposits
      { id: 'escrow', label: 'Active Project Operating Treasury Hub', column: 1, color: COLORS.escrow, note: 'Inflows = 100% of DLD RERA buyer deposits (gdv). Operating wallets bypass the hub and deploy straight to site.' },
      // Column 2 — three-way regulatory split of buyer deposits
      { id: 'unlocked', label: 'Milestone-Unlocked Operating Capital', column: 2, color: COLORS.unlocked, note: 'Released on engineer-certified construction progress' },
      { id: 'retention', label: `Statutory Project Retention (${fmtNum(retentionPctEff, 1)}%)`, column: 2, color: COLORS.retention, note: 'Withheld from construction draws; trapped until certification' },
      { id: 'defects', label: `Post-Handover Defects Liability Lock (${DEFECTS_LIABILITY_PCT}%)`, column: 2, color: COLORS.defects, note: 'Non-negotiable — locked 12 months after unit registration' },
      // Column 3 — physical site sinks funded once by the operating wallets
      ...ringFencedSinks.map((s) => ({ id: s.id, label: s.label, column: 3, color: s.color, note: s.note })),
      // Column 4 — the true repayment rows cleared by milestone-unlocked buyer capital
      ...uses.map((u) => ({ id: u.id, label: u.label, column: 4, color: u.color,
        note: u.shortfall > 0
          ? `AED ${fmtM(u.funded)} funded from unlocked collections; AED ${fmtM(u.shortfall)} remains to settle after further collections or certification.`
          : `AED ${fmtM(u.obligation)} obligation fully settled from unlocked buyer collections.` })),
      { id: 'use_surplus', label: 'Unallocated Unlocked Project Surplus', column: 4, color: COLORS.surplus,
        note: 'Residual unlocked buyer cash after principal, interest and land; 10% retention and 5% defects remain restricted.' },
      { id: 'warranty', label: 'DLD-Regulated Defects Warranty Pool (12-Month Hold)', column: 4, color: COLORS.warranty, note: 'Restricted defects reserve, not an operating disbursement.' },
    ],
    links: [
      // Operating wallets deploy straight to site; they do not transit the escrow hub.
      { source: 'loanWallet', target: 'sink_contractor', value: loanWallet },
      { source: 'softWallet', target: 'sink_consultant', value: softWallet },
      { source: 'wcWallet', target: 'sink_working', value: wcWallet },
      // The hub collects 100% of buyer deposits.
      { source: 'escrow_src', target: 'escrow', value: gdv },
      // Regulatory three-way split of buyer deposits.
      { source: 'escrow', target: 'unlocked', value: unlockedPool },
      { source: 'escrow', target: 'retention', value: retentionPool },
      { source: 'escrow', target: 'defects', value: defectsPool },
      { source: 'defects', target: 'warranty', value: defectsPool },
      // Milestone-unlocked capital exits to the true repayment rows.
      ...uses.map((u) => ({ source: 'unlocked', target: u.id, value: u.funded })),
      { source: 'unlocked', target: 'use_surplus', value: unlockedSettlementSurplus },
    ],
  };
  // Drawn B plus buyer-first C and A releases must clear the four cost sinks in full,
  // with any drawn capital above the residual need held idle.
  const capitalizationResidual = totalDrawnPrincipal - (drawnCashToUses + idleDrawnCash);
  const facilitySizingResidual = totalDebtFacility - externalDebtRequired;
  const underwritingFlowAudit = {
    ...auditSankeyFlows(underwritingSankey), capitalizationResidual, facilitySizingResidual,
  };
  underwritingFlowAudit.balanced = underwritingFlowAudit.balanced
    && Math.abs(capitalizationResidual) <= 0.05;
  // Hub re-verification: the hub collects 100% of buyer deposits and splits them three ways.
  const hubInflows = gdv;
  const hubOutflows = unlockedPool + retentionPool + defectsPool;
  const escrowFlowAudit = {
    ...auditSankeyFlows(escrowSankey),
    hubInflows,
    hubOutflows,
    hubBalanceResidual: hubInflows - hubOutflows,
  };
  escrowFlowAudit.balanced = escrowFlowAudit.balanced && Math.abs(escrowFlowAudit.hubBalanceResidual) <= 0.05;

  return {
    gfa,
    nsa,
    gdv,
    baseConstruction,
    pmcCharges,
    escalations,
    contingencies,
    approvals,
    directDevelopmentCosts,
    workingCapital,
    nonLandPrincipal,
    nonLandDebtMultiplier,
    allInFacilityMultiplier,
    openingCapitalBase,
    totalFinancingCost,
    grossVatLiability,
    quarterlyVatRecovery,
    externalDebtRequired,
    totalDevelopmentCost,
    totalProjectSurplus,
    shortfall,
    margin: gdv > 0 ? (totalProjectSurplus / gdv) * 100 : 0,
    ltv: gdv > 0 ? (externalDebtRequired / gdv) * 100 : 0,
    // --- Stage-linked debt tranches ---
    trancheSchedule,
    totalDebtFacility,
    totalDrawnPrincipal,
    totalUndrawnCapacity,
    interestOnDrawn,
    commitmentFees,
    interestSaved,
    incrementalDeveloperSurplus,
    interestSavedVsMonolithic,
    monolithicFinancingCost,
    blendedFinancingMultiplier,
    debtFundingCoveragePct,
    escrowFundingBridge,
    excessDrawnCash: idleDrawnCash,
    // --- Three-wallet treasury policy ---
    walletATreatment,
    walletALock,
    walletARelease,
    walletARestricted,
    walletCApplied: escrowFundingBridge,
    walletBPool: totalDebtFacility,
    walletBInvested: totalUndrawnCapacity,
    walletBYield,
    walletBHurdle: interestOnDrawn,
    walletBNetCarry,
    walletBYieldPct,
    walletBHurdlePct,
    facilitySizingResidual,
    milestoneSum,
    handoverPct,
    retentionPool,
    retentionPctEff,
    landValue,
    walletLedger,
    ringFencedSinks,
    operatingWalletTotal,
    repaymentCoveragePct,
    repaymentShortfall,
    unlockedSettlementSurplus,
    underwritingFlowAudit,
    escrowFlowAudit,
    defectsPool,
    defectsPct: DEFECTS_LIABILITY_PCT,
    defectsMonths: DEFECTS_LIABILITY_MONTHS,
    defectsTrappedInSurplus,
    handoverMonth,
    dlpEndMonth,
    unlockedPool,
    milestones,
    underwritingSankey,
    escrowSankey,
    distributionLadder,
  };
}

export type Simulation = ReturnType<typeof simulate>;

/* =====================================================================
 * MICRO-MATRIX LAYER
 * Itemised line items that aggregate upward into three macro parameters:
 *   landValue            = landPurchase + landClosing                (AED)
 *   constructionCostGfa  = Σ hard-cost items                         (AED / GFA sf)
 *   approvalsCostGfa     = Σ soft-cost items                         (AED / GFA sf)
 * Escalations % and Contingencies % are premium multipliers loaded on the
 * aggregated Hard Costs and live directly in `Inputs`.
 * ===================================================================== */
export interface MicroState {
  landPurchase: number;
  landClosing: number;
  hardCivil: number;
  hardStructural: number;
  hardFinishes: number;
  softDesign: number;
  softPermits: number;
  softLegal: number;
  softMarketing: number;
}
export type MicroKey = keyof MicroState;

export const LAND_KEYS: MicroKey[] = ['landPurchase', 'landClosing'];
export const HARD_KEYS: MicroKey[] = ['hardCivil', 'hardStructural', 'hardFinishes'];
export const SOFT_KEYS: MicroKey[] = ['softDesign', 'softPermits', 'softLegal', 'softMarketing'];

/** Project-snapshot ratios. Hard: 5% civil / 30% structural / 15% finishes of the overall budget
 *  balance (normalised so the default total remains AED 431 / GFA sf). */
const LAND_BASELINE_WEIGHTS = [100, 4]; // purchase price : closing & stamp duty (4% of base)
const HARD_BASELINE_WEIGHTS = [5, 30, 15];
const SOFT_BASELINE_WEIGHTS = [40, 28, 12, 20]; // design / permits / legal / marketing

export type MacroAggregateKey = 'landValue' | 'constructionCostGfa' | 'approvalsCostGfa';
export const AGGREGATE_KEYS: MacroAggregateKey[] = ['landValue', 'constructionCostGfa', 'approvalsCostGfa'];

const GROUPS: Record<MacroAggregateKey, { keys: MicroKey[]; weights: number[]; decimals: number }> = {
  landValue: { keys: LAND_KEYS, weights: LAND_BASELINE_WEIGHTS, decimals: 2 },
  constructionCostGfa: { keys: HARD_KEYS, weights: HARD_BASELINE_WEIGHTS, decimals: 2 },
  approvalsCostGfa: { keys: SOFT_KEYS, weights: SOFT_BASELINE_WEIGHTS, decimals: 2 },
};

/** Largest-remainder allocation in minor units, with the exact residual retained in the last cell. */
function allocate(total: number, weights: number[], decimals: number): number[] {
  const wSum = weights.reduce((a, b) => a + b, 0) || 1;
  const f = 10 ** decimals;
  const units = Math.floor(total * f);
  const allocations = weights.map((weight, index) => {
    const exact = units * weight / wSum;
    return { index, units: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let remainder = units - allocations.reduce((sum, entry) => sum + entry.units, 0);
  const ranked = [...allocations].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const entry of ranked) {
    if (remainder <= 0) break;
    entry.units += 1;
    remainder -= 1;
  }
  const values = allocations.map((entry) => entry.units / f);
  const last = values.length - 1;
  values[last] = Math.max(0, total - values.slice(0, last).reduce((sum, value) => sum + value, 0));
  const rounded = Math.round(values[last] * f) / f;
  if (Math.abs(rounded - values[last]) <= Number.EPSILON * Math.max(total, 1) * weights.length) values[last] = rounded;
  return values;
}

const sumKeys = (m: MicroState, keys: MicroKey[]) => keys.reduce((s, k) => s + m[k], 0);

/** Upward propagation: micro → macro aggregates. */
export const aggregateMicro = (m: MicroState): Pick<Inputs, MacroAggregateKey> => ({
  landValue: sumKeys(m, LAND_KEYS),
  constructionCostGfa: sumKeys(m, HARD_KEYS),
  approvalsCostGfa: sumKeys(m, SOFT_KEYS),
});

export function buildBaselineMicro(seed: Pick<Inputs, MacroAggregateKey> = DEFAULT_INPUTS): MicroState {
  const [landPurchase, landClosing] = allocate(seed.landValue, LAND_BASELINE_WEIGHTS, 2);
  const [hardCivil, hardStructural, hardFinishes] = allocate(seed.constructionCostGfa, HARD_BASELINE_WEIGHTS, 2);
  const [softDesign, softPermits, softLegal, softMarketing] = allocate(seed.approvalsCostGfa, SOFT_BASELINE_WEIGHTS, 2);
  return { landPurchase, landClosing, hardCivil, hardStructural, hardFinishes, softDesign, softPermits, softLegal, softMarketing };
}

/** Downward propagation: a macro edit rescales its micro items pro-rata (or by baseline ratios if all are zero). */
function rescaleGroup(m: MicroState, macro: MacroAggregateKey, newTotal: number): MicroState {
  const { keys, weights, decimals } = GROUPS[macro];
  const current = keys.map((k) => m[k]);
  const useCurrent = current.reduce((a, b) => a + b, 0) > 0;
  const next = allocate(newTotal, useCurrent ? current : weights, decimals);
  const out = { ...m };
  keys.forEach((k, i) => (out[k] = next[i]));
  return out;
}

export type TreasuryUnderwritingBaseline = Pick<
  Inputs,
  'parcelSize' | 'far' | 'farEfficiency' | 'landValue' | 'sellingPricePsf' | 'financingArr' | 'projectDurationYears'
>;

interface TreasuryState {
  base: Inputs;
  micro: MicroState;
  tranches: DebtTranche[];
  defaults: { base: Inputs; micro: MicroState; tranches: DebtTranche[] };
}

function createTreasuryState(initialInputs: Partial<Inputs>): TreasuryState {
  const base = { ...DEFAULT_INPUTS, ...initialInputs };
  const micro = buildBaselineMicro(base);
  // Size the pre-development right and five progress-gated rights to the current pool.
  const tranches = buildDefaultTranches(debtFundingPool(base), base.projectDurationYears);
  return { base, micro, tranches, defaults: { base, micro, tranches } };
}

function isValidUnderwritingBaseline(baseline: TreasuryUnderwritingBaseline): boolean {
  const values = [
    baseline.parcelSize,
    baseline.far,
    baseline.farEfficiency,
    baseline.landValue,
    baseline.sellingPricePsf,
    baseline.financingArr,
    baseline.projectDurationYears,
  ];
  return values.every((value) => Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER)
    && baseline.parcelSize > 0
    && baseline.far > 0
    && baseline.farEfficiency > 0
    && baseline.farEfficiency <= 100
    && baseline.sellingPricePsf > 0
    && baseline.projectDurationYears > 0;
}

export const useTreasurySimulation = (initialInputs: Partial<Inputs> = {}) => {
  const [state, setState] = useState<TreasuryState>(() => createTreasuryState(initialInputs));
  const { base, micro, tranches } = state;

  // Effective inputs: the three aggregated macros are always the live sum of their micro items.
  const inputs = useMemo<Inputs>(() => ({ ...base, ...aggregateMicro(micro) }), [base, micro]);

  const simulationData = useMemo(() => simulate(inputs, tranches), [inputs, tranches]);

  const updateParameter = useCallback((key: keyof Inputs, value: number) => {
    const v = clampFinite(value);
    setState((current) => {
      if ((AGGREGATE_KEYS as string[]).includes(key)) {
        return { ...current, micro: rescaleGroup(current.micro, key as MacroAggregateKey, v) };
      }
      const prev = current.base;
      if ((MILESTONE_KEYS as string[]).includes(key)) {
        const targetKey = key as MilestoneKey;
        const nextVal = Math.round(Math.min(100, v));
        const otherKeys = MILESTONE_KEYS.filter((k) => k !== targetKey);
        const nextState = { ...prev, [targetKey]: nextVal };

        otherKeys.forEach((k) => {
          nextState[k] = Math.round(clampFinite(prev[k], 0, 100));
        });
        const currentOthersSum = otherKeys.reduce((s, k) => s + nextState[k], 0);
        const totalNewSum = nextVal + currentOthersSum;

        if (totalNewSum > 100) {
          let excess = totalNewSum - 100;
          let keysToReduce = otherKeys.filter((k) => nextState[k] > 0);

          while (excess > 0 && keysToReduce.length > 0) {
            const reductionPool = keysToReduce.reduce((s, k) => s + nextState[k], 0);
            const reductions = keysToReduce.map((k) => {
              const share = nextState[k] / reductionPool;
              const exactReduction = excess * share;
              const reduction = Math.min(nextState[k], Math.floor(exactReduction));
              return { key: k, reduction, remainder: exactReduction - reduction };
            });

            // Largest-remainder rounding removes exactly the excess without over-reducing peers.
            let roundingRemainder = excess - reductions.reduce((s, item) => s + item.reduction, 0);
            reductions.sort((a, b) => b.remainder - a.remainder);
            for (const item of reductions) {
              if (roundingRemainder === 0) break;
              if (item.reduction < nextState[item.key]) {
                item.reduction += 1;
                roundingRemainder -= 1;
              }
            }

            let distributedExcess = 0;
            reductions.forEach(({ key: k, reduction }) => {
              nextState[k] -= reduction;
              distributedExcess += reduction;
            });
            excess -= distributedExcess;
            keysToReduce = keysToReduce.filter((k) => nextState[k] > 0);
            if (distributedExcess === 0) break;
          }
        }
        return { ...current, base: nextState };
      }
      if (key === 'reraRetentionPct') {
        // retention + 5% defects lock can never exceed 100% of collections
        return { ...current, base: { ...prev, reraRetentionPct: Math.min(v, 100 - DEFECTS_LIABILITY_PCT) } };
      }
      return { ...current, base: { ...prev, [key]: v } };
    });
  }, []);

  const seedUnderwriting = useCallback((baseline: TreasuryUnderwritingBaseline): boolean => {
    if (!isValidUnderwritingBaseline(baseline)) return false;

    const patch: TreasuryUnderwritingBaseline = {
      parcelSize: baseline.parcelSize,
      far: baseline.far,
      farEfficiency: baseline.farEfficiency,
      landValue: baseline.landValue,
      sellingPricePsf: baseline.sellingPricePsf,
      financingArr: baseline.financingArr,
      projectDurationYears: baseline.projectDurationYears,
    };

    // Commit the seven macros and their land micros together; other Treasury assumptions stay intact.
    setState((current) => ({
      ...current,
      base: { ...current.base, ...patch },
      micro: rescaleGroup(current.micro, 'landValue', patch.landValue),
      defaults: {
        ...current.defaults,
        base: { ...current.defaults.base, ...patch },
        micro: rescaleGroup(current.defaults.micro, 'landValue', patch.landValue),
      },
    }));
    return true;
  }, []);

  /** Set the Wallet A regulatory treatment. Cash escrow or bank guarantee plus fixed deposit. */
  const updateWalletATreatment = useCallback((treatment: WalletATreatment) => {
    setState((current) => ({
      ...current,
      base: { ...current.base, walletATreatment: treatment },
    }));
  }, []);

  /** Patch one stage-linked draw right. Values are clamped so no NaN reaches the engine. */
  const updateTranche = useCallback((id: TrancheId, patch: Partial<Omit<DebtTranche, 'id'>>) => {
    setState((current) => {
      const months = Math.max(1, Math.round(clampFinite(current.base.projectDurationYears, 0.25, 20) * 12));
      const predevLatestMonth = Math.max(0, Math.round(months * 0.2) - 1);
      const tranchesNext = current.tranches.map((tranche) => {
        if (tranche.id !== id) return tranche;
        const next = { ...tranche, ...patch };
        return {
          ...next,
          capacity: clampFinite(next.capacity, 0, Number.MAX_SAFE_INTEGER),
          drawPct: clampFinite(next.drawPct, 0, 100),
          drawMonth: Math.round(clampFinite(next.drawMonth, 0, id === 'predev' ? predevLatestMonth : months)),
          commitmentFeePct: clampFinite(next.commitmentFeePct, 0, 100),
        };
      });
      return { ...current, tranches: tranchesNext };
    });
  }, []);

  /** Restore the six draw rights to their programme-derived defaults. */
  const resetTranches = useCallback(() => {
    setState((current) => ({ ...current, tranches: current.defaults.tranches.map((tranche) => ({ ...tranche })) }));
  }, []);

  /** Re-size the committed facility so the five tranches exactly cover the current requirement. */
  const sizeTranchesToRequirement = useCallback(() => {
    setState((current) => {
      const effective = { ...current.base, ...aggregateMicro(current.micro) };
      return {
        ...current,
        tranches: buildDefaultTranches(debtFundingPool(effective), effective.projectDurationYears).map((tranche) => {
          const existing = current.tranches.find((item) => item.id === tranche.id);
          return existing ? { ...tranche, drawPct: existing.drawPct, drawMonth: existing.drawMonth, commitmentFeePct: existing.commitmentFeePct } : tranche;
        }),
      };
    });
  }, []);

  const updateMicro = useCallback((key: MicroKey, value: number) => {
    // A cleared or malformed cell coerces to 0, then re-aggregates the macro upward.
    setState((current) => ({ ...current, micro: { ...current.micro, [key]: clampFinite(value) } }));
  }, []);

  const resetMicro = useCallback(() => {
    setState((current) => ({ ...current, micro: { ...current.defaults.micro } }));
  }, []);

  const reset = useCallback(() => {
    setState((current) => ({
      ...current,
      base: { ...current.defaults.base },
      micro: { ...current.defaults.micro },
      tranches: current.defaults.tranches.map((tranche) => ({ ...tranche })),
    }));
  }, []);

  return {
    inputs, micro, tranches, simulationData,
    updateParameter, updateMicro, updateTranche, updateWalletATreatment, resetTranches, sizeTranchesToRequirement,
    seedUnderwriting, resetMicro, reset,
  };
};

export type TreasurySimulationController = ReturnType<typeof useTreasurySimulation>;
