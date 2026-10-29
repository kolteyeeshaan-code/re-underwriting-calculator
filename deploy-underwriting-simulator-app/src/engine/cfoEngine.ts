import { useCallback, useMemo, useState } from 'react';

// The CFO ledger owns its assumptions; only the explicit App bridge can seed it.
export type CfoTypology = 'Villas / Townhouses' | 'Apartments';
export type CfoDrawdownFramework = 'upfront' | 'milestone';
export type CfoCycleId = 'target' | 'base_case' | 'bear_case' | 'stress_case';

export interface CfoInputs {
  landEquity: number;
  developerCashEquity: number;
  debtFacilityCap: number;
  financingArr: number;
  drawdownFramework: CfoDrawdownFramework;
  activationDate: string;
  offPlanLicenseDate: string;
  handoverDate: string;
  forecastDate: string;
  productTypology: CfoTypology;
  nonHumanDailyBurn: number;
  humanDailyBurn: number;
  workingCapitalGfa: number;
  sellingPricePsf: number;
  efficiencyPct: number;
  plotArea: number;
  far: number;
  constructionPsfGfa: number;
  pmcPct: number;
  escalationPct: number;
  contingencyPct: number;
  approvalsPsfGfa: number;
}

export interface CfoPosition {
  day: number;
  hour: number;
  registeredExitPct: number;
  cycleId: CfoCycleId;
}

export const CFO_DEFAULTS: CfoInputs = {
  landEquity: 75_000_000, developerCashEquity: 15_000_000, debtFacilityCap: 85_000_000,
  financingArr: 15, drawdownFramework: 'upfront', activationDate: '2026-11-01',
  offPlanLicenseDate: '2027-06-01', handoverDate: '2029-08-01', forecastDate: '2027-11-01',
  productTypology: 'Villas / Townhouses', nonHumanDailyBurn: 2000, humanDailyBurn: 90_000,
  workingCapitalGfa: 75, sellingPricePsf: 2500, efficiencyPct: 80, plotArea: 35628.54,
  far: 2.82, constructionPsfGfa: 431, pmcPct: 4, escalationPct: 1, contingencyPct: 2, approvalsPsfGfa: 25,
};
export const CFO_POSITION_DEFAULTS: CfoPosition = { day: 0, hour: 12, registeredExitPct: 100, cycleId: 'target' };
const DAY_MS = 86_400_000;
const YEAR_DAYS = 365;
const MAX_PROJECT_DAYS = 7305;
const PROJECT_RETENTION = 0.10;
const DEFECTS_RETENTION = 0.05;
const EPSILON_AED = 0.05;

export const cfoNumber = (value: number, min = 0, max = 1_000_000_000_000) =>
  Number.isFinite(value) ? Math.min(Math.max(min, max), Math.max(min, value)) : min;
export const cfoFmt = (value: number, decimals = 0) =>
  (Number.isFinite(value) ? value : 0).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
export const cfoAed = (value: number) => `AED ${cfoFmt(value, 2)}`;
export const cfoMillions = (value: number) => `AED ${cfoFmt(value / 1_000_000, 2)}M`;

export function cfoDateTimestamp(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
}

export function cfoDateAtDay(activationDate: string, day: number): string {
  const time = cfoDateTimestamp(activationDate) + Math.round(day) * DAY_MS;
  return Number.isFinite(time) && Number.isFinite(new Date(time).getTime()) ? new Date(time).toISOString().slice(0, 10) : '';
}

export function cfoDayForDate(activationDate: string, statementDate: string): number {
  return Math.round((cfoDateTimestamp(statementDate) - cfoDateTimestamp(activationDate)) / DAY_MS);
}

export function cfoReadableDate(value: string): string {
  const time = cfoDateTimestamp(value);
  return Number.isFinite(time)
    ? new Date(time).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : 'Select a date';
}

export interface CfoClock {
  totalProjectDays: number;
  licenseTriggerDay: number;
  elapsedDay: number;
  horizonDays: number;
  preLicenseDeficitDays: number;
  forecastBeforeActivation: boolean;
  forecastBeyondHorizon: boolean;
  datesValid: boolean;
}

export function cfoClock(inputs: CfoInputs): CfoClock {
  const activation = cfoDateTimestamp(inputs.activationDate);
  const license = cfoDateTimestamp(inputs.offPlanLicenseDate);
  const handover = cfoDateTimestamp(inputs.handoverDate);
  const forecast = cfoDateTimestamp(inputs.forecastDate);
  const totalProjectDays = Number.isFinite(activation) && Number.isFinite(handover) ? Math.round((handover - activation) / DAY_MS) : 0;
  const licenseTriggerDay = Number.isFinite(activation) && Number.isFinite(license) ? Math.round((license - activation) / DAY_MS) : 0;
  const horizonDays = Math.round(cfoNumber(totalProjectDays, 0, MAX_PROJECT_DAYS)) + YEAR_DAYS;
  const rawElapsed = Number.isFinite(activation) && Number.isFinite(forecast) ? Math.round((forecast - activation) / DAY_MS) : 0;
  return {
    totalProjectDays, licenseTriggerDay, horizonDays,
    elapsedDay: Math.round(cfoNumber(rawElapsed, 0, horizonDays)),
    preLicenseDeficitDays: cfoNumber(licenseTriggerDay, 0, Math.max(0, totalProjectDays)),
    forecastBeforeActivation: rawElapsed < 0, forecastBeyondHorizon: rawElapsed > horizonDays,
    datesValid: [activation, license, handover, forecast].every(Number.isFinite),
  };
}

interface CfoCycleDefinition {
  id: CfoCycleId;
  label: string;
  multiplier: number;
  leakagePct: number;
  cancellationFactor: number;
  rationale: string;
}
// 4-tier institutional engine — keys, multipliers, leakages, cancellation breach and
// rationales are identical to viabilityEngine.ts to prevent cross-workspace drift.
const CFO_CYCLES: CfoCycleDefinition[] = [
  { id: 'target', label: 'Target Rate', multiplier: 1.0, leakagePct: 10, cancellationFactor: 1, rationale: 'Target market selling rate benchmarked directly to prevailing, verified transactional comparables in adjacent plots. Baseline 10% leakage determines net cash proceeds available to fund the downstream operational wallets.' },
  { id: 'base_case', label: 'Base Case', multiplier: 1.065, leakagePct: 10, cancellationFactor: 1, rationale: 'Healthy cyclical market tailwinds aligning with normalized global hub growth. Influx velocity remains optimal, supporting baseline underwriting projections with zero incentive overhead.' },
  { id: 'bear_case', label: 'Bear Case (Soft Landing)', multiplier: 0.90, leakagePct: 12, cancellationFactor: 1, rationale: 'Macroeconomic cooling triggers a soft landing. Asset values contract by -10%, and sales leakage expands to 12% as broker commission channels inflate by +2% to maintain transaction volume.' },
  { id: 'stress_case', label: 'Stress Case (Severe Correction)', multiplier: 0.70, leakagePct: 18, cancellationFactor: 0.85, rationale: 'Severe cyclical correction mimicking the 2014-2019 cycle. Values drop -30% with extended Post-Handover Payment Plan locks lifting cost strain, paired with a systemic 15% cancellation rate breach on active Escrow accounts.' },
];

export interface CfoScenario {
  id: CfoCycleId;
  label: string;
  price: number;
  leakagePct: number;
  baseGdv: number;
  cancellationFactor: number;
  rationale: string;
  gdv: number;
  pbt: number;
  marginPct: number;
  shocked: boolean;
}

export interface CfoFlows {
  equityCash: number;
  debtDrawdowns: number;
  buyerDeposits: number;
  nonHumanPaid: number;
  humanPaid: number;
  salesLeakagePaid: number;
  siteCashPaid: number;
  escrowDebtSwipes: number;
  interestRetiredBySwipes: number;
  landDistributions: number;
  terminalDebtSettlement: number;
  terminalPrincipalPaid: number;
  terminalInterestPaid: number;
  defectsPoolFunded: number;
  defectsPoolReleased: number;
  developerSurplusReleased: number;
}
const emptyFlows = (): CfoFlows => ({
  equityCash: 0, debtDrawdowns: 0, buyerDeposits: 0, nonHumanPaid: 0, humanPaid: 0,
  salesLeakagePaid: 0, siteCashPaid: 0, escrowDebtSwipes: 0, interestRetiredBySwipes: 0,
  landDistributions: 0, terminalDebtSettlement: 0, terminalPrincipalPaid: 0, terminalInterestPaid: 0,
  defectsPoolFunded: 0, defectsPoolReleased: 0, developerSurplusReleased: 0,
});

export interface CfoSnapshot {
  time: number;
  progress: number;
  treasuryCash: number;
  escrowCash: number;
  totalCash: number;
  projectRetention: number;
  defectsRetention: number;
  escrowOperatingLiquidity: number;
  wipBuilt: number;
  landInventory: number;
  wipInventory: number;
  inventoryImpairment: number;
  debtPrincipal: number;
  financingAccrued: number;
  financingExpense: number;
  buyerContractLiability: number;
  sitePayables: number;
  operatingPayables: number;
  salesPayables: number;
  totalPayables: number;
  defectsPoolBalance: number;
  landPartnerSettled: number;
  landPartnerOutstanding: number;
  waterfallComplete: boolean;
  terminalSettled: boolean;
  swipesApplied: number;
  freeDeveloperCashSurplus: number;
  nonHumanExpense: number;
  humanExpense: number;
  salesExpense: number;
  realizedRevenue: number;
  costOfSales: number;
  retainedEarnings: number;
  paidInEquity: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  fundingTotal: number;
  balanceDifference: number;
  flows: CfoFlows;
}

interface InternalLedger {
  time: number;
  treasuryCash: number;
  escrowCash: number;
  debtPrincipal: number;
  financingAccrued: number;
  financingExpensed: number;
  buildIncurred: number;
  sitePayables: number;
  nonHumanExpense: number;
  humanExpense: number;
  salesExpense: number;
  realizedRevenue: number;
  costOfSales: number;
  escrowSitePaid: number;
  escrowTransferred: number;
  defectsPool: number;
  landSettled: number;
  waterfallDone: boolean;
  flows: CfoFlows;
}

export function computeCfoSimulation(inputs: CfoInputs, position: CfoPosition) {
  const clock = cfoClock(inputs);
  const duration = Math.round(cfoNumber(clock.totalProjectDays, 0, MAX_PROJECT_DAYS));
  const licenseTriggerDay = Math.round(cfoNumber(clock.licenseTriggerDay, 0, MAX_PROJECT_DAYS));
  const horizon = duration + YEAR_DAYS;
  const calendarValid = clock.datesValid && clock.totalProjectDays > 0 && clock.totalProjectDays <= MAX_PROJECT_DAYS
    && clock.licenseTriggerDay >= 0 && clock.licenseTriggerDay <= clock.totalProjectDays;
  const errors: string[] = [];
  if (!clock.datesValid) errors.push('Select valid inception, license, completion and reporting dates.');
  if (clock.totalProjectDays <= 0) errors.push('Completion must be later than accounting activation.');
  if (clock.totalProjectDays > MAX_PROJECT_DAYS) errors.push('The simulation supports a maximum 20-year project calendar.');
  if (clock.licenseTriggerDay < 0 || clock.licenseTriggerDay > clock.totalProjectDays) errors.push('The off-plan license must fall between inception and completion.');
  if (clock.forecastBeforeActivation) errors.push('Simulation forecast date cannot precede corporate initialization date.');
  if (inputs.plotArea <= 0 || inputs.far <= 0 || inputs.sellingPricePsf <= 0) errors.push('Plot area, FAR and the sale price anchor must be greater than zero.');
  if (inputs.efficiencyPct <= 0 || inputs.efficiencyPct > 100) errors.push('Efficiency must be between zero and 100%.');
  if (Object.values(inputs).some((value) => typeof value === 'number' && (!Number.isFinite(value) || value < 0))) errors.push('All financial inputs must be finite and non-negative.');

  const day = clock.elapsedDay;
  const hour = !clock.datesValid || clock.forecastBeforeActivation || day === horizon ? 0 : Math.round(cfoNumber(position.hour, 0, 23));
  const time = day + hour / 24;
  const activeElapsedDays = time;
  const exitFraction = cfoNumber(position.registeredExitPct, 0, 100) / 100;
  const maxGfa = inputs.plotArea * inputs.far;
  const gfa = maxGfa;
  const nsa = maxGfa * inputs.efficiencyPct / 100;
  const hardBudget = maxGfa * inputs.constructionPsfGfa;
  const softBudget = hardBudget * (inputs.pmcPct + inputs.escalationPct + inputs.contingencyPct) / 100 + inputs.approvalsPsfGfa * maxGfa;
  const buildBudget = hardBudget + softBudget;
  const dailyBurn = inputs.nonHumanDailyBurn + inputs.humanDailyBurn;
  // The cushion is earmarked within developer cash equity, not an extra cash injection or an expense.
  const initialWcCushionAed = inputs.workingCapitalGfa * maxGfa;
  const accumulatedBurnAed = (inputs.nonHumanDailyBurn + inputs.humanDailyBurn) * activeElapsedDays;
  const remainingWcCushionAed = Math.max(0, initialWcCushionAed - accumulatedBurnAed);
  const erodedWcCushionAed = Math.min(initialWcCushionAed, accumulatedBurnAed);
  const overheadLoadingC = nsa > 0 ? accumulatedBurnAed / nsa : 0;
  const initialWcPsfNsa = inputs.efficiencyPct > 0 ? inputs.workingCapitalGfa * (100 / inputs.efficiencyPct) : 0;
  const excessBurnAed = Math.max(0, accumulatedBurnAed - initialWcCushionAed);
  const cushionRunwayDays = dailyBurn > 0 ? initialWcCushionAed / dailyBurn : null;
  const progressAt = (t: number) => duration > 0 ? cfoNumber(t / duration, 0, 1) : 0;

  // Absolute Zero-Equity Rule: with no developer cash cushion the facility must finance 100%
  // of early-stage corporate outlays from Day Zero. The corporate outlay cushion
  // (initialWcCushionAed) is drawn straight into debt principal on Day 0, so per-diem interest
  // carrier penalties begin accruing immediately from Day 1.
  const zeroEquityMode = inputs.developerCashEquity <= 0;
  const zeroEquityCushionDraw = zeroEquityMode ? initialWcCushionAed : 0;
  // Four equal lender outlays: inception, then physical WIP gates at 20%, 40%, and 60%.
  const frameworkDraws = inputs.drawdownFramework === 'upfront'
    ? [{ day: 0, amount: inputs.debtFacilityCap, label: 'Full facility drop / inception' }]
    : [
      { day: 0, amount: inputs.debtFacilityCap * 0.25, label: '25% inception wallet outlay' },
      { day: Math.ceil(duration * 0.20), amount: inputs.debtFacilityCap * 0.25, label: '25% / WIP 20% gate' },
      { day: Math.ceil(duration * 0.40), amount: inputs.debtFacilityCap * 0.25, label: '25% / WIP 40% gate' },
      { day: Math.ceil(duration * 0.60), amount: inputs.debtFacilityCap * 0.25, label: '25% / WIP 60% gate' },
    ];
  const drawPlan = zeroEquityCushionDraw > 0
    ? [{ day: 0, amount: zeroEquityCushionDraw, label: 'Zero-equity: corporate outlay cushion draw' }, ...frameworkDraws]
    : frameworkDraws;
  // The cushion sits outside the construction facility cap because it replaces the equity
  // contribution that would otherwise fund corporate outlays.
  const effectiveFacilityCap = inputs.debtFacilityCap + zeroEquityCushionDraw;
  const buyerPlan = [0, 40, 60, 80, 100].map((pct) => ({
    day: Math.max(licenseTriggerDay, pct === 0 ? licenseTriggerDay : Math.ceil(duration * pct / 100)),
    label: pct === 0 ? 'Booking / 20%' : pct === 100 ? 'Handover' : `${pct}% milestone`,
    collectionPct: 20, blocked: !calendarValid,
  }));
  const projectedFinancing = drawPlan.reduce((sum, draw) => sum + draw.amount
    * (Math.pow(1 + inputs.financingArr / 100, Math.max(0, duration - draw.day) / YEAR_DAYS) - 1), 0);
  const costCap = inputs.landEquity + buildBudget + dailyBurn * duration + projectedFinancing;
  const breakevenPsf = nsa > 0 ? costCap / (nsa * 0.9) : 0;
  const scenarios: CfoScenario[] = CFO_CYCLES.map((cycle) => {
    const price = inputs.sellingPricePsf * cycle.multiplier;
    const baseGdv = nsa * price;
    const gdv = cycle.id === 'stress_case' ? baseGdv * 0.85 : baseGdv;
    const net = gdv * (1 - cycle.leakagePct / 100);
    return { id: cycle.id, label: cycle.label, price, leakagePct: cycle.leakagePct,
      baseGdv, cancellationFactor: cycle.cancellationFactor, rationale: cycle.rationale,
      gdv, pbt: net - costCap,
      marginPct: net > 0 ? (net - costCap) / net * 100 : 0,
      shocked: cycle.id === 'bear_case' || cycle.id === 'stress_case' };
  });
  const scenario = scenarios.find((cycle) => cycle.id === position.cycleId) ?? scenarios[0];
  const preLicense = time < licenseTriggerDay || !calendarValid;
  const ledger: InternalLedger = {
    time: 0, treasuryCash: 0, escrowCash: 0, debtPrincipal: 0, financingAccrued: 0, financingExpensed: 0,
    buildIncurred: 0, sitePayables: 0, nonHumanExpense: 0, humanExpense: 0, salesExpense: 0,
    realizedRevenue: 0, costOfSales: 0, escrowSitePaid: 0, escrowTransferred: 0, defectsPool: 0,
    landSettled: 0, waterfallDone: false, flows: emptyFlows(),
  };
  const holdsAt = (t: number) => ({
    project: duration > 0 && t < duration ? ledger.flows.buyerDeposits * PROJECT_RETENTION : 0,
    defects: ledger.defectsPool,
  });

  const payBills = (t: number) => {
    const holds = holdsAt(t);
    const fromEscrow = Math.min(ledger.sitePayables, Math.max(0, ledger.escrowCash - holds.project - holds.defects));
    ledger.escrowCash -= fromEscrow;
    ledger.sitePayables = Math.max(0, ledger.sitePayables - fromEscrow);
    ledger.escrowSitePaid += fromEscrow;
    ledger.flows.siteCashPaid += fromEscrow;
    if (calendarValid && t >= duration) {
      const residual = Math.max(0, ledger.flows.buyerDeposits - ledger.escrowSitePaid - ledger.flows.escrowDebtSwipes);
      const entitlement = Math.max(0, residual * exitFraction - ledger.defectsPool * exitFraction);
      const transfer = Math.min(Math.max(0, ledger.escrowCash - ledger.defectsPool), Math.max(0, entitlement - ledger.escrowTransferred));
      ledger.escrowCash -= transfer;
      ledger.treasuryCash += transfer;
      ledger.escrowTransferred += transfer;
    }
    const sitePaid = Math.min(ledger.sitePayables, ledger.treasuryCash);
    ledger.treasuryCash -= sitePaid;
    ledger.sitePayables = Math.max(0, ledger.sitePayables - sitePaid);
    ledger.flows.siteCashPaid += sitePaid;
    const xDue = Math.max(0, ledger.nonHumanExpense - ledger.flows.nonHumanPaid);
    const yDue = Math.max(0, ledger.humanExpense - ledger.flows.humanPaid);
    const operatingPaid = Math.min(xDue + yDue, ledger.treasuryCash);
    const xPaid = xDue + yDue > 0 ? operatingPaid * xDue / (xDue + yDue) : 0;
    ledger.flows.nonHumanPaid += xPaid;
    ledger.flows.humanPaid += operatingPaid - xPaid;
    ledger.treasuryCash -= operatingPaid;
    const salesPaid = Math.min(Math.max(0, ledger.salesExpense - ledger.flows.salesLeakagePaid), ledger.treasuryCash);
    ledger.flows.salesLeakagePaid += salesPaid;
    ledger.treasuryCash = Math.max(0, ledger.treasuryCash - salesPaid);
  };

  const sweepEscrowToDebt = (t: number) => {
    const holds = holdsAt(t);
    const available = Math.max(0, ledger.escrowCash - holds.project - holds.defects);
    const interestPaid = Math.min(ledger.financingAccrued, available);
    const principalPaid = Math.min(ledger.debtPrincipal, available - interestPaid);
    ledger.financingAccrued = Math.max(0, ledger.financingAccrued - interestPaid);
    ledger.debtPrincipal = Math.max(0, ledger.debtPrincipal - principalPaid);
    ledger.escrowCash = Math.max(0, ledger.escrowCash - interestPaid - principalPaid);
    ledger.flows.escrowDebtSwipes += interestPaid + principalPaid;
    ledger.flows.interestRetiredBySwipes += interestPaid;
  };

  const runTerminalWaterfall = () => {
    if (ledger.waterfallDone) return;
    ledger.waterfallDone = true;
    // Resolve all unrestricted cash together; retain the statutory 5% defects sub-account.
    let pool = ledger.treasuryCash + Math.max(0, ledger.escrowCash - ledger.defectsPool);

    // 1. Bank principal. 2. Accrued compounding. 3. Land partner core capital.
    const principalPaid = Math.min(ledger.debtPrincipal, pool);
    ledger.debtPrincipal = Math.max(0, ledger.debtPrincipal - principalPaid);
    pool -= principalPaid;
    const interestPaid = Math.min(ledger.financingAccrued, pool);
    ledger.financingAccrued = Math.max(0, ledger.financingAccrued - interestPaid);
    pool -= interestPaid;
    ledger.flows.terminalPrincipalPaid += principalPaid;
    ledger.flows.terminalInterestPaid += interestPaid;
    ledger.flows.terminalDebtSettlement += principalPaid + interestPaid;
    const seniorCleared = ledger.debtPrincipal + ledger.financingAccrued <= EPSILON_AED;
    const landPaid = seniorCleared ? Math.min(Math.max(0, inputs.landEquity * exitFraction - ledger.landSettled), pool) : 0;
    pool -= landPaid;
    ledger.landSettled += landPaid;
    ledger.flows.landDistributions += landPaid;

    // 4. Confirm the exact 5% buyer-collection asset reserve; it stays physically in escrow.
    const defectsTarget = ledger.flows.buyerDeposits * DEFECTS_RETENTION;
    const defectsTopUp = Math.min(Math.max(0, defectsTarget - ledger.defectsPool), pool);
    ledger.defectsPool += defectsTopUp;
    pool -= defectsTopUp;
    ledger.flows.defectsPoolFunded += defectsTopUp;

    // Pay terminal senior claims from treasury first, then from non-restricted escrow.
    let cashClaims = principalPaid + interestPaid + landPaid;
    const treasuryPayment = Math.min(ledger.treasuryCash, cashClaims);
    ledger.treasuryCash -= treasuryPayment;
    cashClaims -= treasuryPayment;
    if (cashClaims > 0) {
      const escrowPayment = Math.min(Math.max(0, ledger.escrowCash - ledger.defectsPool), cashClaims);
      ledger.escrowCash -= escrowPayment;
    }

    // 5. Residual is designated as free developer surplus, not double-booked as a dividend.
    ledger.flows.developerSurplusReleased += Math.max(0, pool);
    const freeEscrow = Math.max(0, ledger.escrowCash - ledger.defectsPool);
    ledger.treasuryCash += freeEscrow;
    ledger.escrowCash -= freeEscrow;
  };

  const snapshot = (): CfoSnapshot => {
    const completed = calendarValid && ledger.time >= duration;
    const registered = completed ? exitFraction : 0;
    const landInventory = inputs.landEquity * (1 - registered);
    const wipInventory = ledger.buildIncurred * (1 - registered);
    const remainingBuild = Math.max(0, buildBudget - ledger.buildIncurred) * (1 - registered);
    const nrv = Math.max(0, scenario.gdv * (1 - scenario.leakagePct / 100) * (1 - registered) - remainingBuild);
    const inventoryImpairment = Math.max(0, landInventory + wipInventory - nrv);
    const operatingPayables = Math.max(0, ledger.nonHumanExpense + ledger.humanExpense - ledger.flows.nonHumanPaid - ledger.flows.humanPaid);
    const salesPayables = Math.max(0, ledger.salesExpense - ledger.flows.salesLeakagePaid);
    const totalPayables = ledger.sitePayables + operatingPayables + salesPayables;
    const buyerContractLiability = Math.max(0, ledger.flows.buyerDeposits - ledger.realizedRevenue);
    const retainedEarnings = ledger.realizedRevenue - ledger.costOfSales - ledger.nonHumanExpense
      - ledger.humanExpense - ledger.salesExpense - ledger.financingExpensed - inventoryImpairment;
    const paidInEquity = inputs.landEquity + inputs.developerCashEquity - ledger.landSettled;
    const totalCash = ledger.treasuryCash + ledger.escrowCash;
    const totalAssets = totalCash + landInventory + wipInventory - inventoryImpairment;
    const totalLiabilities = ledger.debtPrincipal + ledger.financingAccrued + buyerContractLiability + totalPayables;
    const totalEquity = paidInEquity + retainedEarnings;
    const holds = holdsAt(ledger.time);
    const landDue = completed ? Math.max(0, inputs.landEquity * exitFraction - ledger.landSettled) : 0;
    const freeDeveloperCashSurplus = ledger.waterfallDone
      ? Math.max(0, ledger.treasuryCash - ledger.debtPrincipal - ledger.financingAccrued - landDue - totalPayables) : 0;
    return {
      time: ledger.time, progress: progressAt(ledger.time), treasuryCash: ledger.treasuryCash, escrowCash: ledger.escrowCash,
      totalCash, projectRetention: holds.project, defectsRetention: holds.defects,
      escrowOperatingLiquidity: Math.max(0, ledger.escrowCash - holds.project - holds.defects),
      wipBuilt: ledger.buildIncurred, landInventory, wipInventory, inventoryImpairment,
      debtPrincipal: ledger.debtPrincipal, financingAccrued: ledger.financingAccrued, financingExpense: ledger.financingExpensed,
      buyerContractLiability, sitePayables: ledger.sitePayables, operatingPayables, salesPayables, totalPayables,
      defectsPoolBalance: ledger.defectsPool, landPartnerSettled: ledger.landSettled,
      landPartnerOutstanding: Math.max(0, inputs.landEquity - ledger.landSettled), waterfallComplete: ledger.waterfallDone,
      terminalSettled: ledger.waterfallDone, swipesApplied: ledger.flows.escrowDebtSwipes, freeDeveloperCashSurplus,
      nonHumanExpense: ledger.nonHumanExpense, humanExpense: ledger.humanExpense, salesExpense: ledger.salesExpense,
      realizedRevenue: ledger.realizedRevenue, costOfSales: ledger.costOfSales, retainedEarnings, paidInEquity,
      totalAssets, totalLiabilities, totalEquity, fundingTotal: totalLiabilities + totalEquity,
      balanceDifference: totalAssets - totalLiabilities - totalEquity, flows: { ...ledger.flows },
    };
  };

  let openingFlows = emptyFlows();
  let openingCash = 0;
  let historicalEscrowOk = true;
  let historicalLicenseOk = true;
  const history: { day: number; treasuryCash: number; escrowCash: number; payables: number; burn: number }[] = [];
  const sampleInterval = Math.max(1, Math.ceil(time / 40));
  const postFundingEvents = (boundary: number) => {
    drawPlan.filter((draw) => draw.day === boundary && calendarValid).forEach((draw) => {
      ledger.debtPrincipal += draw.amount;
      ledger.flows.debtDrawdowns += draw.amount;
      ledger.treasuryCash += draw.amount;
    });
    const drops = buyerPlan.filter((drop) => drop.day === boundary && calendarValid && boundary >= licenseTriggerDay);
    drops.forEach(() => {
      const amount = scenario.gdv / 5;
      ledger.flows.buyerDeposits += amount;
      ledger.escrowCash += amount;
      const carve = amount * DEFECTS_RETENTION;
      ledger.defectsPool += carve;
      ledger.flows.defectsPoolFunded += carve;
    });
    // Handover uses the principal-first terminal stack instead of the mid-lifecycle swipe.
    if (drops.length > 0 && boundary < duration) sweepEscrowToDebt(boundary);
  };

  const rawBoundaries = Array.from({ length: day + 1 }, (_, index) => index);
  if (hour > 0 && !rawBoundaries.includes(time)) rawBoundaries.push(time);
  if (day >= duration && !rawBoundaries.includes(duration)) rawBoundaries.push(duration);
  const boundaries = Array.from(new Set(rawBoundaries)).sort((a, b) => a - b);
  for (const boundary of boundaries) {
    // Day-zero capital is posted separately: the zero-delta guard must not swallow opening equity.
    if (boundary === 0) {
      ledger.flows.equityCash = inputs.developerCashEquity;
      ledger.treasuryCash = inputs.developerCashEquity;
      postFundingEvents(0);
      payBills(0);
    } else {
      if (boundary - ledger.time <= 0.00001) { ledger.time = boundary; continue; }
      const dt = boundary - ledger.time;
      const targetBuild = calendarValid ? buildBudget * progressAt(boundary) : 0;
      const buildIncrement = Math.max(0, targetBuild - ledger.buildIncurred);
      ledger.buildIncurred = targetBuild;
      ledger.sitePayables += buildIncrement;
      ledger.nonHumanExpense += inputs.nonHumanDailyBurn * dt;
      ledger.humanExpense += inputs.humanDailyBurn * dt;
      const interestIncrement = (ledger.debtPrincipal + ledger.financingAccrued)
        * (Math.pow(1 + inputs.financingArr / 100, dt / YEAR_DAYS) - 1);
      ledger.financingAccrued += interestIncrement;
      ledger.financingExpensed += interestIncrement;
      ledger.time = boundary;
      payBills(boundary - 1e-7);
      if (boundary === day) { openingFlows = { ...ledger.flows }; openingCash = ledger.treasuryCash + ledger.escrowCash; }
      postFundingEvents(boundary);
      if (calendarValid && boundary === duration) {
        ledger.realizedRevenue = scenario.gdv * exitFraction;
        ledger.costOfSales = (inputs.landEquity + buildBudget) * exitFraction;
        ledger.salesExpense = ledger.realizedRevenue * scenario.leakagePct / 100;
        payBills(boundary);
        runTerminalWaterfall();
      } else {
        if (boundary === horizon && ledger.defectsPool > 0) {
          const release = ledger.defectsPool * exitFraction;
          ledger.defectsPool -= release;
          ledger.flows.defectsPoolReleased += release;
        }
        payBills(boundary);
      }
    }
    const current = snapshot();
    historicalEscrowOk = historicalEscrowOk && current.escrowCash + EPSILON_AED >= current.projectRetention + current.defectsPoolBalance;
    historicalLicenseOk = historicalLicenseOk && (boundary >= licenseTriggerDay || current.flows.buyerDeposits === 0);
    if (boundary === 0 || boundary === time || boundary === duration || boundary === licenseTriggerDay || boundary % sampleInterval === 0) {
      history.push({ day: boundary, treasuryCash: current.treasuryCash, escrowCash: current.escrowCash,
        payables: current.totalPayables, burn: current.nonHumanExpense + current.humanExpense });
    }
  }

  const current = snapshot();
  const dailyFlows = emptyFlows();
  (Object.keys(dailyFlows) as (keyof CfoFlows)[]).forEach((key) => { dailyFlows[key] = current.flows[key] - openingFlows[key]; });
  const cashNet = (flows: CfoFlows) => flows.equityCash + flows.debtDrawdowns + flows.buyerDeposits
    - flows.nonHumanPaid - flows.humanPaid - flows.salesLeakagePaid - flows.siteCashPaid
    - flows.escrowDebtSwipes - flows.terminalDebtSettlement - flows.landDistributions;
  // Compare like-for-like funding, including the supplemental corporate cushion in
  // zero-equity mode, to a Day-1 draw with no escrow-to-debt recycling.
  const upfrontNoSwipeInterest = effectiveFacilityCap
    * (Math.pow(1 + inputs.financingArr / 100, Math.max(0, time) / YEAR_DAYS) - 1);
  const financingSavingsAed = Math.max(0, upfrontNoSwipeInterest - current.financingExpense);
  const scheduledDrawsThroughCutoff = calendarValid
    ? drawPlan.filter((draw) => draw.day <= time).reduce((sum, draw) => sum + draw.amount, 0) : 0;
  const checks = [
    { label: 'Assets = liabilities + equity (epsilon 0.05 AED)', passed: Math.abs(current.balanceDifference) <= 0.05 },
    { label: 'Daily and cumulative cash reconcile', passed: Math.abs(openingCash + cashNet(dailyFlows) - current.totalCash) <= EPSILON_AED
      && Math.abs(cashNet(current.flows) - current.totalCash) <= EPSILON_AED },
    { label: 'Regulatory pools remain ring-fenced', passed: historicalEscrowOk },
    { label: '5% defects pool is funded without double counting', passed: Math.abs(current.defectsPoolBalance + current.flows.defectsPoolReleased
      - current.flows.buyerDeposits * DEFECTS_RETENTION) <= EPSILON_AED },
    { label: 'Land partner capital account reconciles', passed: Math.abs(current.landPartnerSettled + current.landPartnerOutstanding - inputs.landEquity) <= EPSILON_AED },
    { label: 'No buyer cash before the off-plan license', passed: historicalLicenseOk },
    { label: 'Gross draws never exceed the facility cap', passed: current.flows.debtDrawdowns <= effectiveFacilityCap + EPSILON_AED },
    { label: 'Financier draws post on their scheduled WIP gates', passed:
      Math.abs(current.flows.debtDrawdowns - scheduledDrawsThroughCutoff) <= EPSILON_AED },
    { label: 'Cushion remaining + consumed = opening allocation', passed: Math.abs(remainingWcCushionAed + erodedWcCushionAed - initialWcCushionAed) <= EPSILON_AED },
    { label: 'Accrued overhead matches the capital clock', passed: Math.abs(current.nonHumanExpense + current.humanExpense - accumulatedBurnAed) <= EPSILON_AED },
    { label: 'All statement positions are finite', passed: Object.values(current).every((value) => typeof value !== 'number' || Number.isFinite(value)) },
    { label: 'Zero-equity corporate cushion is drawn at inception', passed: !zeroEquityMode
      || (Math.abs(zeroEquityCushionDraw - initialWcCushionAed) <= EPSILON_AED
        && current.flows.debtDrawdowns >= zeroEquityCushionDraw - EPSILON_AED) },
  ];
  const potentialCostCompression = Math.max(0, (431 * 1.07 + 25) * maxGfa - buildBudget);
  const preLicenseBurn = dailyBurn * Math.max(0, Math.min(time, licenseTriggerDay));
  return {
    valid: errors.length === 0, errors, duration, horizon, day, hour, time, activeElapsedDays, clock,
    licenseTriggerDay, preLicense, preLicenseBurn, preLicenseDeficitDays: clock.preLicenseDeficitDays,
    statementDate: inputs.forecastDate, cutOffDate: cfoDateAtDay(inputs.activationDate, day),
    horizonDate: cfoDateAtDay(inputs.activationDate, horizon), licenseDate: inputs.offPlanLicenseDate,
    gfa, maxGfa, nsa, hardBudget, softBudget, buildBudget, dailyBurn,
    debtFacilityCap: inputs.debtFacilityCap, projectedFinancing, costCap, breakevenPsf,
    scenarios, scenario, current, dailyFlows, openingCash, dailyNetCash: cashNet(dailyFlows), cumulativeNetCash: cashNet(current.flows),
    drawPlan, buyerPlan, history, checks, potentialCostCompression, financingSavingsAed,
    registeredExitPct: calendarValid && time >= duration ? exitFraction * 100 : 0,
    projectedBurn: dailyBurn * duration, netTradingPosition: scenario.pbt,
    initialWcCushionAed, accumulatedBurnAed, remainingWcCushionAed, erodedWcCushionAed, overheadLoadingC,
    initialWcPsfNsa, excessBurnAed, cushionRunwayDays, cushionExhausted: accumulatedBurnAed > initialWcCushionAed,
    unfundedCushionAllocationAed: Math.max(0,
      initialWcCushionAed - inputs.developerCashEquity - zeroEquityCushionDraw),
    zeroEquityMode, zeroEquityCushionDraw, effectiveFacilityCap, effectiveDrawPlan: drawPlan,
  };
}

export type CfoSimulation = ReturnType<typeof computeCfoSimulation>;
type NumericCfoKey = { [K in keyof CfoInputs]: CfoInputs[K] extends number ? K : never }[keyof CfoInputs];
export interface CfoUnderwritingBaseline {
  plotArea: number;
  permissibleFar: number;
  nsaEfficiency: number;
  landEffective: number;
  marketCompPsf: number;
  financingArr: number;
  projectDurationYears: number;
}

function calendarHandoverDate(activationDate: string, years: number): string {
  const start = cfoDateTimestamp(activationDate);
  if (!Number.isFinite(start) || !Number.isFinite(years) || years <= 0 || years > 20) return '';
  const date = new Date(start);
  const totalMonths = years * 12;
  const months = Math.floor(totalMonths);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const monthEnd = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), monthEnd));
  if (totalMonths > months) {
    const daysInMonth = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(target.getUTCDate() + Math.round((totalMonths - months) * daysInMonth));
  }
  return target.toISOString().slice(0, 10);
}

export function useCfoSimulation() {
  const [inputs, setInputs] = useState<CfoInputs>({ ...CFO_DEFAULTS });
  const [position, setPosition] = useState<CfoPosition>({ ...CFO_POSITION_DEFAULTS });
  const simulation = useMemo(() => computeCfoSimulation(inputs, position), [inputs, position]);
  const seedUnderwriting = useCallback((baseline: CfoUnderwritingBaseline): boolean => {
    const values = Object.values(baseline);
    if (!values.every((value) => Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER)
      || baseline.plotArea <= 0 || baseline.permissibleFar <= 0 || baseline.nsaEfficiency <= 0
      || baseline.nsaEfficiency > 100 || baseline.marketCompPsf <= 0) return false;
    const handoverDate = calendarHandoverDate(inputs.activationDate, baseline.projectDurationYears);
    if (!handoverDate) return false;
    setInputs((previous) => ({ ...previous, plotArea: baseline.plotArea, far: baseline.permissibleFar,
      efficiencyPct: baseline.nsaEfficiency, landEquity: baseline.landEffective, sellingPricePsf: baseline.marketCompPsf,
      financingArr: baseline.financingArr, handoverDate }));
    return true;
  }, [inputs.activationDate]);
  const updateInput = useCallback(<K extends keyof CfoInputs>(key: K, value: CfoInputs[K]) => {
    setInputs((previous) => ({ ...previous, [key]: value }));
  }, []);
  const updateNumber = useCallback((key: NumericCfoKey, value: number) => {
    let safe = cfoNumber(value);
    if (key === 'efficiencyPct') safe = cfoNumber(value, 60, 95);
    if (key === 'financingArr' || key === 'pmcPct' || key === 'escalationPct' || key === 'contingencyPct') safe = cfoNumber(value, 0, 100);
    if (key === 'far') safe = cfoNumber(value, 0, 20);
    setInputs((previous) => ({ ...previous, [key]: safe }));
  }, []);
  const updatePosition = useCallback(<K extends keyof CfoPosition>(key: K, value: CfoPosition[K]) => {
    const safe = typeof value === 'number' ? key === 'registeredExitPct' ? cfoNumber(value, 0, 100)
      : key === 'hour' ? Math.round(cfoNumber(value, 0, 23)) : Math.round(cfoNumber(value, 0, MAX_PROJECT_DAYS + YEAR_DAYS)) : value;
    setPosition((previous) => ({ ...previous, [key]: safe }));
  }, []);
  const jumpTo = useCallback((day: number, hour = 0) => {
    setInputs((previous) => ({ ...previous, forecastDate: cfoDateAtDay(previous.activationDate, cfoNumber(day, 0, cfoClock(previous).horizonDays)) }));
    setPosition((previous) => ({ ...previous, day: cfoNumber(day), hour: cfoNumber(hour, 0, 23) }));
  }, []);
  const reset = useCallback(() => { setInputs({ ...CFO_DEFAULTS }); setPosition({ ...CFO_POSITION_DEFAULTS }); }, []);
  return { inputs, position, simulation, updateInput, updateNumber, updatePosition, jumpTo, seedUnderwriting, reset };
}

export type CfoController = ReturnType<typeof useCfoSimulation>;