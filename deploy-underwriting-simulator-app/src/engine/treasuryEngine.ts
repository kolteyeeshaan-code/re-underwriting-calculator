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
  vatRate: number; // %
  buyerMilestone1: number; // % of GDV collected at booking / 20%
  buyerMilestone2: number;
  buyerMilestone3: number;
  buyerMilestone4: number;
  reraRetentionPct: number;
}

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

export function simulate(inputs: Inputs) {
  const {
    parcelSize, far, farEfficiency, landValue, sellingPricePsf, constructionCostGfa,
    pmcChargesPct, escalationsPct, contingenciesPct, approvalsCostGfa, workingCapitalGfa,
    financingArr, projectDurationYears, vatRate, reraRetentionPct,
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

  // PMC, approvals, buffers and working capital are funded from opening debt, not interest.
  const nonLandPrincipal = constructionWallet + wcWallet + softWallet;
  const nonLandDebtMultiplier = Math.pow(1 + financingArr / 100, projectDurationYears);
  const totalFinancingCost = nonLandPrincipal * (nonLandDebtMultiplier - 1);

  // --- Fiscal layer ---
  const grossVatLiability = directDevelopmentCosts * (vatRate / 100);
  const quarterlyVatRecovery = grossVatLiability / Math.max(1, projectDurationYears * 4);

  const externalDebtRequired = constructionWallet + wcWallet + softWallet + grossVatLiability;
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

  // --- Underwriting Sankey (Summary View / morning-brief resolution) ---
  // Day-1 cash capitalisation is decoupled from trailing interest carry. Column 0 holds
  // exactly two source nodes; the debt facility sub-allocates directly into the four
  // pre-sales operating wallets. Interest (a lagging liability that expands the debt to a
  // 1.52x multiplier at closure) is deliberately absent from the Day-1 cash asset pool and
  // is surfaced only in the repayment waterfall and CFO ledger.
  const underwritingSankey: SankeyData = {
    nodes: [
      { id: 'land', label: 'Land Partner Equity', column: 0, color: COLORS.land, value: landValue,
        note: 'Securitised land value contributed in kind on Day 1' },
      { id: 'debt', label: 'External Debt Facility', column: 0, color: COLORS.debt, value: externalDebtRequired,
        note: 'Non-land principal incl. PMC + temporary VAT outlay. PMC fees are capitalised on Day 1.' },
      // Column 1 — the land lock plus the four debt-funded operating wallets
      { id: 'landLock', label: 'Land Capitalisation Lock', column: 1, color: COLORS.land,
        note: 'Land equity capitalises in kind and is returned at close' },
      { id: 'u_construction', label: 'Construction Loan Facility Wallet', column: 1, color: '#b9c8ee', value: constructionWallet,
        note: 'Sub-allocation of the debt facility; deploys to the physical build' },
      { id: 'u_wc', label: 'Working Capital & Contingency Wallet', column: 1, color: COLORS.wc, value: wcWallet,
        note: 'workingCapital + escalations + contingencies' },
      { id: 'u_soft', label: 'Soft Costs, PMC & Approvals Wallet', column: 1, color: COLORS.soft, value: softWallet,
        note: 'PMC fees + authority approvals, funded from the debt facility on Day 1' },
      { id: 'u_vat', label: 'Temporary VAT Outlay Wallet', column: 1, color: COLORS.vat, value: grossVatLiability,
        note: 'Input VAT bridge funded from the debt facility' },
      // Column 2 — physical site deployment, once per wallet
      { id: 'u_site', label: 'Main Contractor & Site Preparation', column: 2, color: COLORS.hard,
        note: 'Construction loan facility deploys once to the physical build' },
      { id: 'u_logistics', label: 'Site Logistics & Contingency Absorption', column: 2, color: COLORS.wc,
        note: 'Working capital + contingencies absorbed at site level' },
      { id: 'u_consultants', label: 'Consultants, PMC & Authority Fees', column: 2, color: COLORS.soft,
        note: 'PMC professional fees and approval charges paid once' },
      { id: 'u_fta', label: 'FTA VAT Recovery Loop', column: 2, color: COLORS.fta,
        note: 'Quarterly returns recycle input VAT back to the facility' },
    ],
    links: [
      // Land equity capitalises in kind.
      { source: 'land', target: 'landLock', value: landValue },
      // Four structural sub-allocation links drawn directly out of the primary facility.
      { source: 'debt', target: 'u_construction', value: constructionWallet },
      { source: 'debt', target: 'u_wc', value: wcWallet },
      { source: 'debt', target: 'u_soft', value: softWallet },
      { source: 'debt', target: 'u_vat', value: grossVatLiability },
      // Wallets land once at their site and consultant sinks (upfront draws).
      { source: 'u_construction', target: 'u_site', value: constructionWallet },
      { source: 'u_wc', target: 'u_logistics', value: wcWallet },
      { source: 'u_soft', target: 'u_consultants', value: softWallet },
      { source: 'u_vat', target: 'u_fta', value: grossVatLiability },
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
    { id: 'use_principal', label: 'Settle Senior Debt Principal', obligation: externalDebtRequired, color: '#b9c8ee' },
    { id: 'use_interest', label: 'Settle Accrued Financing Interest', obligation: totalFinancingCost, color: COLORS.interest },
    { id: 'use_land', label: 'Settle Land Partner Core Return', obligation: landValue, color: COLORS.land },
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
  const capitalizationResidual = externalDebtRequired
    - (constructionWallet + wcWallet + softWallet + grossVatLiability);
  const underwritingFlowAudit = {
    ...auditSankeyFlows(underwritingSankey), capitalizationResidual,
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
  defaults: { base: Inputs; micro: MicroState };
}

function createTreasuryState(initialInputs: Partial<Inputs>): TreasuryState {
  const base = { ...DEFAULT_INPUTS, ...initialInputs };
  const micro = buildBaselineMicro(base);
  return { base, micro, defaults: { base, micro } };
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
  const { base, micro } = state;

  // Effective inputs: the three aggregated macros are always the live sum of their micro items.
  const inputs = useMemo<Inputs>(() => ({ ...base, ...aggregateMicro(micro) }), [base, micro]);

  const simulationData = useMemo(() => simulate(inputs), [inputs]);

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
        base: { ...current.defaults.base, ...patch },
        micro: rescaleGroup(current.defaults.micro, 'landValue', patch.landValue),
      },
    }));
    return true;
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
    }));
  }, []);

  return { inputs, micro, simulationData, updateParameter, updateMicro, seedUnderwriting, resetMicro, reset };
};

export type TreasurySimulationController = ReturnType<typeof useTreasurySimulation>;
