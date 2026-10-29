import { useMemo, useState } from 'react';

/* =====================================================================
 * WORKSPACE 1: CAPITAL ORIGINATION & MACRO UNDERWRITING
 * Independent calculation state; validated snapshots are transferred only
 * through the explicit App-level bridge into Treasury Management.
 * ===================================================================== */

export interface ViabilityInputs {
  plotArea: number; // sqft
  quotedLandPrice: number; // AED
  permissibleFar: number;
  marketCompPsf: number; // AED / sqft
  nsaEfficiency: number; // %
  landPriceInclusive: boolean;
  landDldFee: number; // %
  landBrokerage: number; // %
  constructionPsfGfa: number; // AED
  pmcPercent: number; // %
  escalationPercent: number; // %
  contingencyPercent: number; // %
  approvalsPsfGfa: number; // AED
  marketingPercent: number; // %
  salesBrokeragePercent: number; // %
  salesCommissionPercent: number; // %
  wcOfficeTeam: number; // flat PSF GFA
  wcMarketing: number;
  wcHospitality: number;
  wcLegal: number;
  wcRera: number;
  wcReserve: number;
  financingArr: number; // %
  projectDurationYears: number; // years
  targetMarginPercent: number; // %
  productTypology: ProductTypology;
  config1UnitCount: number;
  config2UnitCount: number;
}

export const VIABILITY_DEFAULTS: ViabilityInputs = {
  plotArea: 35628.54,
  quotedLandPrice: 69_444_444,
  permissibleFar: 2.82,
  marketCompPsf: 2500,
  nsaEfficiency: 80,
  landPriceInclusive: false,
  landDldFee: 4,
  landBrokerage: 2,
  constructionPsfGfa: 431,
  pmcPercent: 4,
  escalationPercent: 1,
  contingencyPercent: 2,
  approvalsPsfGfa: 25,
  marketingPercent: 3,
  salesBrokeragePercent: 2,
  salesCommissionPercent: 5,
  wcOfficeTeam: 15,
  wcMarketing: 20,
  wcHospitality: 15,
  wcLegal: 10,
  wcRera: 5,
  wcReserve: 10,
  financingArr: 15,
  projectDurationYears: 3,
  targetMarginPercent: 20,
  productTypology: 'Villas / Townhouses',
  config1UnitCount: 80,
  config2UnitCount: 57,
};

/* ---------- formatting helpers (local to Workspace 2) ---------- */
export const vFmtAed = (v: number) =>
  `AED ${(Number.isFinite(v) ? v : 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
export const vFmtM = (v: number) => `AED ${((Number.isFinite(v) ? v : 0) / 1_000_000).toFixed(2)}M`;
export const vFmtNum = (v: number, d = 0) =>
  (Number.isFinite(v) ? v : 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
export const vFmtPct = (v: number, d = 1) => `${(Number.isFinite(v) ? v : 0).toFixed(d)}%`;

const BASELINE_SALES_LEAKAGE_PCT = 10; // Reference floor; each sensitivity row uses its own cycle rate.

/** Product typology drives downside price acceleration in the sensitivity matrix. */
export type ProductTypology = 'Villas / Townhouses' | 'Apartments';
export const PRODUCT_TYPOLOGIES: ProductTypology[] = ['Villas / Townhouses', 'Apartments'];
/** Retired in the 4-tier engine: Villas and Apartments share identical scenario math. Kept for compatibility. */
export const APARTMENT_DOWNSIDE_FACTOR = 1.5;
/** Retired in the 4-tier engine: no cost-base uplift is applied. Kept for compatibility. */
export const APARTMENT_COST_BASE_DRAG = 1.15;

export type SensitivityTierId = 'target' | 'base_case' | 'bear_case' | 'stress_case';

export interface SensitivityRow {
  id: SensitivityTierId;
  label: string;
  price: number;
  priceMultiplier: number;
  /** Retained for compatibility; the 4-tier engine applies no typology shock. */
  downsideAccelerated: boolean;
  /** Retained for compatibility; always false in the 4-tier engine. */
  isCostBaseFloor: boolean;
  dynamicLeakagePercent: 10 | 12 | 18;
  baseGdv: number;
  /** Collection factor: 0.85 on stress_case (15% escrow cancellation breach), else 1. */
  cancellationFactor: number;
  gdv: number;
  netProceedsPsf: number;
  pbtPsf: number;
  grossMarginPercent: number;
  rationale: string;
}

export type ConstructionPhaseId = 'enabling' | 'superstructure' | 'mep_facade' | 'fitout_snagging';

/**
 * One temporal slice of the underwritten construction + approvals budget.
 * Monetary fields are AED; PSF metrics are AED per square foot.
 */
export interface ConstructionDrawdownPhase {
  id: ConstructionPhaseId;
  sequence: number;
  label: string;
  shortLabel: string;
  /** Allocation weight of the total construction/approvals budget (basis points sum to 100%). */
  weightPercent: number;
  startPercent: number;
  endPercent: number;
  startMonth: number;
  endMonth: number;
  durationMonths: number;
  /** Active construction window, e.g. "Months 0 – 7". */
  timelineLabel: string;
  /** Construction budget (constructionPsfGfa × GFA) released in this phase. */
  hardCostAed: number;
  /** Approvals budget (approvalsPsfGfa × GFA) released in this phase. */
  approvalsAed: number;
  /** Pro-rata PMC fee, escalation, and contingency allocations. */
  pmcAed: number;
  escalationAed: number;
  contingencyAed: number;
  /** Hard outlay + approvals + pro-rata soft loadings. Financing is tracked separately. */
  allInCostAed: number;
  hardCostPsfGfa: number;
  approvalsPsfGfa: number;
  allInCostPsfGfa: number;
  hardCostPsfNsa: number;
  allInCostPsfNsa: number;
  cumulativeHardCostAed: number;
  cumulativeAllInCostAed: number;
  /** Cumulative funding requirement released from project inception to this phase end. */
  cumulativeFundingAed: number;
  cumulativeFundingPsfNsa: number;
}

/** Coverage-footprint metrics for the complete four-phase release schedule. */
export interface ConstructionCostMetrics {
  hardCostTotalAed: number;
  approvalsTotalAed: number;
  pmcTotalAed: number;
  escalationTotalAed: number;
  contingencyTotalAed: number;
  allInConstructionAed: number;
  hardCostTotalPsfNsa: number;
  approvalsTotalPsfNsa: number;
  allInConstructionPsfNsa: number;
  projectDurationMonths: number;
  peakPhaseFundingAed: number;
  peakPhaseId: ConstructionPhaseId;
}

export interface ViabilityResult {
  maxGfa: number;
  nsa: number;
  landEffective: number;
  landCostPsfGfa: number;
  landCostPsfNsa: number;
  pmcPsfGfa: number;
  escalationPsfGfa: number;
  contingencyPsfGfa: number;
  buildSoftPsfGfa: number;
  workingCapitalPsfGfa: number;
  buildSoftTotalAed: number;
  financeCostTotalAed: number;
  financeCostPsfNsa: number;
  totalDevCostPsfNsa: number;
  totalSalesLeakage: number;
  minSellingPsf: number;
  breakevenPsf: number;
  gapToMarket: number;
  totalUnits: number;
  // chart-ready aggregates
  landTotalAed: number;
  buildSoftOnlyAed: number;
  workingCapitalTotalAed: number;
  dynamicFinanceMultiplier: number;
  totalProjectCostAed: number;
  productTypology: ProductTypology;
  allocation: { name: string; value: number; color: string }[];
  costBars: { name: string; psf: number; color: string }[];
  sensitivity: SensitivityRow[];
  // S-curve construction phasing
  constructionDrawdowns: ConstructionDrawdownPhase[];
  constructionCostMetrics: ConstructionCostMetrics;
}

interface ConstructionPhaseBlueprint {
  id: ConstructionPhaseId;
  label: string;
  shortLabel: string;
  weightPercent: number;
  startPercent: number;
  endPercent: number;
}

/** Institutional four-phase construction drawdown profile (weights sum to 100%). */
export const CONSTRUCTION_PHASE_BLUEPRINT: readonly ConstructionPhaseBlueprint[] = [
  { id: 'enabling', label: 'Enabling & Substructure', shortLabel: 'Enabling', weightPercent: 12, startPercent: 0, endPercent: 20 },
  { id: 'superstructure', label: 'Superstructure & Core Slabs', shortLabel: 'Structure', weightPercent: 35, startPercent: 20, endPercent: 50 },
  { id: 'mep_facade', label: 'MEP, Glazing & Facade Envelope', shortLabel: 'MEP & Facade', weightPercent: 28, startPercent: 50, endPercent: 75 },
  { id: 'fitout_snagging', label: 'Interior Fit-Out & Snagging', shortLabel: 'Fit-Out', weightPercent: 25, startPercent: 75, endPercent: 100 },
] as const;

/**
 * Allocate an AED total across percentage weights in minor units (fils).
 * Largest-remainder rounding absorbs truncation so the slices always reconcile
 * to the aggregate budget with zero drift.
 */
function allocateAedByWeight(totalAed: number, weights: readonly number[]): number[] {
  const safeTotal = Number.isFinite(totalAed) ? Math.max(0, totalAed) : 0;
  const totalMinor = Math.round(safeTotal * 100);
  const weightSum = weights.reduce((sum, weight) => sum + (Number.isFinite(weight) ? weight : 0), 0);
  if (totalMinor <= 0 || weightSum <= 0) return weights.map(() => 0);

  const raw = weights.map((weight) => (totalMinor * Math.max(0, weight)) / weightSum);
  const minor = raw.map((value) => Math.floor(value));
  let remainder = totalMinor - minor.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (let pass = 0; remainder > 0 && order.length > 0; pass += 1, remainder -= 1) {
    minor[order[pass % order.length].index] += 1;
  }
  return minor.map((value) => value / 100);
}

export function computeViability(inputs: ViabilityInputs): ViabilityResult {
  const {
    plotArea, quotedLandPrice, permissibleFar, marketCompPsf, nsaEfficiency, landPriceInclusive,
    landDldFee, landBrokerage, constructionPsfGfa, pmcPercent, escalationPercent, contingencyPercent,
    approvalsPsfGfa, wcOfficeTeam, wcMarketing, wcHospitality, wcLegal, wcRera, wcReserve,
    financingArr, projectDurationYears, productTypology, config1UnitCount, config2UnitCount,
  } = inputs;

  const eff = nsaEfficiency / 100 || 1;

  const maxGfa = plotArea * permissibleFar;
  const nsa = maxGfa * eff;

  const landEffective = landPriceInclusive
    ? quotedLandPrice
    : quotedLandPrice * (1 + (landDldFee + landBrokerage) / 100);
  const landCostPsfGfa = maxGfa > 0 ? landEffective / maxGfa : 0;
  const landCostPsfNsa = landCostPsfGfa / eff;

  const pmcPsfGfa = constructionPsfGfa * (pmcPercent / 100);
  const escalationPsfGfa = constructionPsfGfa * (escalationPercent / 100);
  const contingencyPsfGfa = constructionPsfGfa * (contingencyPercent / 100);
  const buildSoftPsfGfa = constructionPsfGfa + pmcPsfGfa + escalationPsfGfa + contingencyPsfGfa + approvalsPsfGfa;

  const workingCapitalPsfGfa = wcOfficeTeam + wcMarketing + wcHospitality + wcLegal + wcRera + wcReserve;

  // Cost totals accumulate at GFA before the efficiency conversion, matching Workspace 1.
  const buildSoftTotalAed = buildSoftPsfGfa * maxGfa;
  const workingCapitalTotalAed = workingCapitalPsfGfa * maxGfa;

  // Compounded carrying cost on the combined build + working-capital base.
  const dynamicFinanceMultiplier = Math.pow(1 + financingArr / 100, projectDurationYears) - 1;
  const financeCostTotalAed = (buildSoftTotalAed + workingCapitalTotalAed) * dynamicFinanceMultiplier;
  const financeCostPsfNsa = nsa > 0 ? financeCostTotalAed / nsa : 0;

  const totalProjectCostAed = landEffective + buildSoftTotalAed + workingCapitalTotalAed + financeCostTotalAed;
  const totalDevCostPsfNsa = nsa > 0 ? totalProjectCostAed / nsa : 0;

  const totalSalesLeakage = BASELINE_SALES_LEAKAGE_PCT;
  const minSellingPsf = totalDevCostPsfNsa / (1 - totalSalesLeakage / 100);
  const breakevenPsf = minSellingPsf;
  const gapToMarket = marketCompPsf - breakevenPsf;

  // chart aggregates (AED)
  const landTotalAed = landEffective;
  const buildSoftOnlyAed = buildSoftTotalAed;
  const workingCapitalAed = workingCapitalTotalAed;

  const allocation = [
    { name: 'Land (effective)', value: landTotalAed, color: '#b08d3a' },
    { name: 'Build + Soft Costs', value: buildSoftOnlyAed, color: '#1e3a8a' },
    { name: 'Working Capital', value: workingCapitalAed, color: '#0ea5e9' },
    { name: 'Financing Carry', value: financeCostTotalAed, color: '#dc2626' },
  ];

  const costBars = [
    { name: 'Construction', psf: constructionPsfGfa, color: '#1e3a8a' },
    { name: 'PMC', psf: pmcPsfGfa, color: '#2563eb' },
    { name: 'Escalation', psf: escalationPsfGfa, color: '#0ea5e9' },
    { name: 'Contingency', psf: contingencyPsfGfa, color: '#38bdf8' },
    { name: 'Approvals', psf: approvalsPsfGfa, color: '#7c3aed' },
    { name: 'Working Cap.', psf: workingCapitalPsfGfa, color: '#b08d3a' },
  ];

  /* ------------------------------------------------------------------ *
   * Institutional S-curve phasing.
   * The hard cost and approvals budgets are independently allocated across
   * four certified construction windows. PMC, escalation and contingency
   * follow the same weights so every phase carries its full pro-rata load.
   * Allocations use minor-unit largest-remainder rounding to guarantee that
   * the four phases reconcile exactly to the aggregate underwritten budget.
   * ------------------------------------------------------------------ */
  const projectDurationMonths = Number.isFinite(projectDurationYears) && projectDurationYears > 0
    ? projectDurationYears * 12
    : 0;
  const phaseWeights = CONSTRUCTION_PHASE_BLUEPRINT.map((phase) => phase.weightPercent);
  const constructionBudgetAed = constructionPsfGfa * maxGfa;
  const approvalsBudgetAed = approvalsPsfGfa * maxGfa;
  const pmcBudgetAed = pmcPsfGfa * maxGfa;
  const escalationBudgetAed = escalationPsfGfa * maxGfa;
  const contingencyBudgetAed = contingencyPsfGfa * maxGfa;

  const hardCostByPhase = allocateAedByWeight(constructionBudgetAed, phaseWeights);
  const approvalsByPhase = allocateAedByWeight(approvalsBudgetAed, phaseWeights);
  const pmcByPhase = allocateAedByWeight(pmcBudgetAed, phaseWeights);
  const escalationByPhase = allocateAedByWeight(escalationBudgetAed, phaseWeights);
  const contingencyByPhase = allocateAedByWeight(contingencyBudgetAed, phaseWeights);

  let cumulativeHardCostAed = 0;
  let cumulativeAllInCostAed = 0;

  const constructionDrawdowns: ConstructionDrawdownPhase[] = CONSTRUCTION_PHASE_BLUEPRINT.map((phase, index) => {
    const startMonth = Math.round((phase.startPercent / 100) * projectDurationMonths);
    const endMonth = Math.round((phase.endPercent / 100) * projectDurationMonths);
    const hardCostAed = hardCostByPhase[index];
    const approvalsAed = approvalsByPhase[index];
    const pmcAed = pmcByPhase[index];
    const escalationAed = escalationByPhase[index];
    const contingencyAed = contingencyByPhase[index];
    const allInCostAed = hardCostAed + approvalsAed + pmcAed + escalationAed + contingencyAed;

    cumulativeHardCostAed += hardCostAed;
    cumulativeAllInCostAed += allInCostAed;

    return {
      id: phase.id,
      sequence: index + 1,
      label: phase.label,
      shortLabel: phase.shortLabel,
      weightPercent: phase.weightPercent,
      startPercent: phase.startPercent,
      endPercent: phase.endPercent,
      startMonth,
      endMonth,
      durationMonths: Math.max(0, endMonth - startMonth),
      timelineLabel: `Months ${startMonth} – ${endMonth}`,
      hardCostAed,
      approvalsAed,
      pmcAed,
      escalationAed,
      contingencyAed,
      allInCostAed,
      hardCostPsfGfa: maxGfa > 0 ? hardCostAed / maxGfa : 0,
      approvalsPsfGfa: maxGfa > 0 ? approvalsAed / maxGfa : 0,
      allInCostPsfGfa: maxGfa > 0 ? allInCostAed / maxGfa : 0,
      hardCostPsfNsa: nsa > 0 ? hardCostAed / nsa : 0,
      allInCostPsfNsa: nsa > 0 ? allInCostAed / nsa : 0,
      cumulativeHardCostAed,
      cumulativeAllInCostAed,
      cumulativeFundingAed: cumulativeAllInCostAed,
      cumulativeFundingPsfNsa: nsa > 0 ? cumulativeAllInCostAed / nsa : 0,
    };
  });

  const peakPhase = constructionDrawdowns.reduce(
    (peak, phase) => (phase.allInCostAed > peak.allInCostAed ? phase : peak),
    constructionDrawdowns[0],
  );

  // Metrics are derived from the same minor-unit allocations rendered per phase,
  // so headline totals and the four cards reconcile to the fil.
  const allocatedHardCostTotal = hardCostByPhase.reduce((sum, value) => sum + value, 0);
  const allocatedApprovalsTotal = approvalsByPhase.reduce((sum, value) => sum + value, 0);
  const allocatedPmcTotal = pmcByPhase.reduce((sum, value) => sum + value, 0);
  const allocatedEscalationTotal = escalationByPhase.reduce((sum, value) => sum + value, 0);
  const allocatedContingencyTotal = contingencyByPhase.reduce((sum, value) => sum + value, 0);
  const allocatedAllInTotal = constructionDrawdowns.reduce((sum, phase) => sum + phase.allInCostAed, 0);

  const constructionCostMetrics: ConstructionCostMetrics = {
    hardCostTotalAed: allocatedHardCostTotal,
    approvalsTotalAed: allocatedApprovalsTotal,
    pmcTotalAed: allocatedPmcTotal,
    escalationTotalAed: allocatedEscalationTotal,
    contingencyTotalAed: allocatedContingencyTotal,
    allInConstructionAed: allocatedAllInTotal,
    hardCostTotalPsfNsa: nsa > 0 ? allocatedHardCostTotal / nsa : 0,
    approvalsTotalPsfNsa: nsa > 0 ? allocatedApprovalsTotal / nsa : 0,
    allInConstructionPsfNsa: nsa > 0 ? allocatedAllInTotal / nsa : 0,
    projectDurationMonths,
    peakPhaseFundingAed: peakPhase?.allInCostAed ?? 0,
    peakPhaseId: peakPhase?.id ?? CONSTRUCTION_PHASE_BLUEPRINT[0].id,
  };

  // 4-tier institutional engine: fixed price multipliers, leakages and a stress
  // collection breach. Identical keys and math are mirrored in cfoEngine.ts.
  type TierDef = {
    id: SensitivityTierId;
    label: string;
    priceMultiplier: number;
    dynamicLeakagePercent: 10 | 12 | 18;
    cancellationFactor: number;
    rationale: string;
  };
  const rowDefs: TierDef[] = [
    { id: 'target', label: 'Target Rate', priceMultiplier: 1.0, dynamicLeakagePercent: 10, cancellationFactor: 1, rationale: 'Target market selling rate benchmarked directly to prevailing, verified transactional comparables in adjacent plots. Baseline 10% leakage determines net cash proceeds available to fund the downstream operational wallets.' },
    { id: 'base_case', label: 'Base Case', priceMultiplier: 1.065, dynamicLeakagePercent: 10, cancellationFactor: 1, rationale: 'Healthy cyclical market tailwinds aligning with normalized global hub growth. Influx velocity remains optimal, supporting baseline underwriting projections with zero incentive overhead.' },
    { id: 'bear_case', label: 'Bear Case (Soft Landing)', priceMultiplier: 0.90, dynamicLeakagePercent: 12, cancellationFactor: 1, rationale: 'Macroeconomic cooling triggers a soft landing. Asset values contract by -10%, and sales leakage expands to 12% as broker commission channels inflate by +2% to maintain transaction volume.' },
    { id: 'stress_case', label: 'Stress Case (Severe Correction)', priceMultiplier: 0.70, dynamicLeakagePercent: 18, cancellationFactor: 0.85, rationale: 'Severe cyclical correction mimicking the 2014-2019 cycle. Values drop -30% with extended Post-Handover Payment Plan locks lifting cost strain, paired with a systemic 15% cancellation rate breach on active Escrow accounts.' },
  ];

  const sensitivity: SensitivityRow[] = rowDefs.map((r) => {
    const price = marketCompPsf * r.priceMultiplier;
    const baseGdv = nsa * price;
    const gdv = r.id === 'stress_case' ? baseGdv * 0.85 : baseGdv;
    const netProceedsPsf = price * (1 - r.dynamicLeakagePercent / 100) * (r.id === 'stress_case' ? 0.85 : 1);
    const pbtPsf = netProceedsPsf - totalDevCostPsfNsa;
    const grossMarginPercent = netProceedsPsf > 0 ? (pbtPsf / netProceedsPsf) * 100 : 0;
    return {
      id: r.id,
      label: r.label,
      price,
      priceMultiplier: r.priceMultiplier,
      downsideAccelerated: false,
      isCostBaseFloor: false,
      dynamicLeakagePercent: r.dynamicLeakagePercent,
      baseGdv,
      cancellationFactor: r.cancellationFactor,
      gdv,
      netProceedsPsf,
      pbtPsf,
      grossMarginPercent,
      rationale: r.rationale,
    };
  });

  return {
    maxGfa, nsa, landEffective, landCostPsfGfa, landCostPsfNsa, pmcPsfGfa, escalationPsfGfa,
    contingencyPsfGfa, buildSoftPsfGfa, workingCapitalPsfGfa, buildSoftTotalAed, financeCostTotalAed,
    financeCostPsfNsa, totalDevCostPsfNsa, totalSalesLeakage, minSellingPsf, breakevenPsf, gapToMarket,
    totalUnits: config1UnitCount + config2UnitCount,
    landTotalAed, buildSoftOnlyAed, workingCapitalTotalAed, dynamicFinanceMultiplier, totalProjectCostAed,
    productTypology, allocation, costBars, sensitivity,
    constructionDrawdowns, constructionCostMetrics,
  };
}

export interface ViabilityUnderwritingBaseline {
  plotArea: number;
  permissibleFar: number;
  nsaEfficiency: number;
  landEffective: number;
  marketCompPsf: number;
  financingArr: number;
  projectDurationYears: number;
}

export type UnderwritingBaselineValidation =
  | { valid: true; baseline: ViabilityUnderwritingBaseline }
  | { valid: false; error: string };

export function validateUnderwritingBaseline(
  inputs: ViabilityInputs,
  result: ViabilityResult,
): UnderwritingBaselineValidation {
  const invalidAssumption = Object.values(inputs).some(
    (value) => typeof value === 'number' && (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER),
  );
  if (invalidAssumption) {
    return { valid: false, error: 'Use finite, non-negative assumptions before seeding Treasury.' };
  }
  if (inputs.plotArea <= 0 || inputs.permissibleFar <= 0 || inputs.marketCompPsf <= 0 || inputs.projectDurationYears <= 0) {
    return { valid: false, error: 'Plot area, FAR, market selling rate and project duration must be greater than zero.' };
  }
  if (inputs.nsaEfficiency <= 0 || inputs.nsaEfficiency > 100) {
    return { valid: false, error: 'NSA efficiency must be greater than zero and no more than 100%.' };
  }
  if (Object.values(result).some((value) => typeof value === 'number' && !Number.isFinite(value))
    || result.nsa <= 0 || result.landEffective < 0 || result.landEffective > Number.MAX_SAFE_INTEGER) {
    return { valid: false, error: 'The feasibility calculation must produce a finite land value, project cost and saleable area.' };
  }

  return {
    valid: true,
    baseline: {
      plotArea: inputs.plotArea,
      permissibleFar: inputs.permissibleFar,
      nsaEfficiency: inputs.nsaEfficiency,
      landEffective: result.landEffective,
      marketCompPsf: inputs.marketCompPsf,
      financingArr: inputs.financingArr,
      projectDurationYears: inputs.projectDurationYears,
    },
  };
}

export function useViabilitySimulation(seed: Partial<ViabilityInputs> = {}) {
  const [inputs, setInputs] = useState<ViabilityInputs>({ ...VIABILITY_DEFAULTS, ...seed });

  const result = useMemo(() => computeViability(inputs), [inputs]);
  const underwritingBaseline = useMemo(() => validateUnderwritingBaseline(inputs, result), [inputs, result]);

  const update = <K extends keyof ViabilityInputs>(key: K, value: ViabilityInputs[K]) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const updateNum = (key: keyof ViabilityInputs, value: number) =>
    setInputs((prev) => ({ ...prev, [key]: Number.isFinite(value) ? value : 0 }));

  const reset = () => setInputs({ ...VIABILITY_DEFAULTS, ...seed });

  return { inputs, result, underwritingBaseline, update, updateNum, reset };
}

export type ViabilitySimulationController = ReturnType<typeof useViabilitySimulation>;
