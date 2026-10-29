/* =====================================================================
 * WORKSPACE 4 — UNDERWRITING REPORT · RECONCILED AUDIT DISCLOSURES
 *
 * Single source of truth for the audit disclosure register. The on-screen
 * report renders these rows and the Investment Committee Pack (PDF / XLSX /
 * MD) prints the identical text summaries, so the document and the download
 * can never diverge.
 *
 * Strictly additive: every figure is derived from the live engine states.
 * No calculation here mutates or re-implements an engine.
 * ===================================================================== */

import { fmtAedM, fmtNum, fmtPct } from '../engine/treasuryEngine';
import type { Inputs, MicroState, Simulation } from '../engine/treasuryEngine';
import type { ViabilityInputs, ViabilityResult } from '../engine/viabilityEngine';
import type { CfoSimulation } from '../engine/cfoEngine';

export type ReportSectionId = '1.0' | '2.0' | '3.0' | '4.0';

export type DisclosureStatus = 'pass' | 'watch' | 'flag';

export interface ReportDisclosure {
  /** Reporting section that owns the disclosure. */
  section: ReportSectionId;
  /** Stable reference code used across PDF, XLSX and the on-screen register. */
  code: string;
  label: string;
  /** Formatted, presentation-ready value. */
  value: string;
  /** Formula or engine field that produced the value. */
  basis: string;
  status: DisclosureStatus;
}

export const REPORT_SECTION_TITLES: Record<ReportSectionId, string> = {
  '1.0': 'Executive Synthesis',
  '2.0': 'Chronological Execution Ledger & Capital Clock',
  '3.0': 'Escrow Allocation Structure',
  '4.0': 'Waterfall Settlement Account',
};

/** Balance-sheet cross-check tolerance mandated for the audit loop (AED). */
export const BALANCE_TOLERANCE_AED = 0.05;

export interface ReportState {
  viabilityInputs: ViabilityInputs;
  viabilityResult: ViabilityResult;
  treasuryInputs: Inputs;
  treasurySim: Simulation;
  /** Itemised micro-matrix state behind the pro-rata parent aggregates. */
  micro: MicroState;
  cfoSim: CfoSimulation;
}

/* --------------------------------------------------------------------- */
/* Terminal waterfall — five immutable ranks resolved bottom-up over GDV. */
/* --------------------------------------------------------------------- */
export interface WaterfallRung {
  rank: number;
  label: string;
  obligation: number;
  funded: number;
  shortfall: number;
  recoveryPct: number;
  shareOfGdvPct: number;
  color: string;
  note: string;
}

export function buildTerminalWaterfall(sim: Simulation): { rungs: WaterfallRung[]; residual: number; settled: number } {
  const gdv = Math.max(0, sim.gdv);
  const obligations = [
    {
      rank: 1,
      label: 'Financier Debt Principal',
      obligation: Math.max(0, sim.externalDebtRequired),
      color: '#b9c8ee',
      note: 'Senior facility drawn principal retired first.',
    },
    {
      rank: 2,
      label: 'Financier Compounded Interest',
      obligation: Math.max(0, sim.totalFinancingCost),
      color: '#FA6C5D',
      note: 'Compounded carry on non-land principal to handover.',
    },
    {
      rank: 3,
      label: 'Land Partner Asset Core Equity Return',
      obligation: Math.max(0, sim.landValue),
      color: '#F4C74B',
      note: 'Contribution returned in cash only after senior claims clear.',
    },
    {
      rank: 4,
      label: 'Defects Warranty Isolation (5%)',
      obligation: Math.max(0, sim.defectsPool),
      color: '#FA6C5D',
      note: 'Statutory ring-fence; isolated, never distributed.',
    },
    {
      rank: 5,
      label: 'Residual Unallocated Developer Surplus',
      obligation: Math.max(0, gdv - (sim.externalDebtRequired + sim.totalFinancingCost + sim.landValue + sim.defectsPool)),
      color: '#7BB694',
      note: 'Retained earnings left inside the SPV after ranks 1-4.',
    },
  ];

  let available = gdv;
  const rungs: WaterfallRung[] = obligations.map((item) => {
    const funded = Math.max(0, Math.min(item.obligation, available));
    available -= funded;
    return {
      rank: item.rank,
      label: item.label,
      obligation: item.obligation,
      funded,
      shortfall: Math.max(0, item.obligation - funded),
      recoveryPct: item.obligation > 0 ? (funded / item.obligation) * 100 : 100,
      shareOfGdvPct: gdv > 0 ? (funded / gdv) * 100 : 0,
      color: item.color,
      note: item.note,
    };
  });

  const settled = rungs.reduce((sum, rung) => sum + rung.funded, 0);
  return { rungs, settled, residual: gdv - settled };
}

/* --------------------------------------------------------------------- */
/* Capital clock windows — canonical five-window execution ledger spine.  */
/* --------------------------------------------------------------------- */
export interface LedgerWindow {
  id: string;
  code: string;
  label: string;
  fromMonth: number;
  toMonth: number;
  fromDay: number;
  toDay: number;
  /** Certified build progress at the close of the window. */
  progressPct: number;
  /** Buyer collections landing inside the window (AED). */
  collections: number;
  /** Temporal decay burn accrued inside the window (AED). */
  burn: number;
  /** Facility drawdowns scheduled inside the window (AED). */
  draws: number;
  escrowStatus: 'Blocked' | 'Gated' | 'Open';
  gate: string;
  cashAtClose: number;
  escrowAtClose: number;
  note: string;
}

const MONTH_DAYS = 30.4375;

/** Cash sample nearest to a day offset, read from the CFO history track. */
function sampleAt(history: CfoSimulation['history'], day: number) {
  if (history.length === 0) return { treasuryCash: 0, escrowCash: 0 };
  let best = history[0];
  let bestDelta = Math.abs(best.day - day);
  for (const point of history) {
    const delta = Math.abs(point.day - day);
    if (delta < bestDelta) {
      best = point;
      bestDelta = delta;
    }
  }
  return { treasuryCash: best.treasuryCash, escrowCash: best.escrowCash };
}

export function buildLedgerWindows(state: ReportState): LedgerWindow[] {
  const { treasurySim, cfoSim } = state;
  const durationDays = Math.max(1, cfoSim.clock.totalProjectDays);
  const handoverMonth = Math.max(1, treasurySim.handoverMonth);
  const dlpEndMonth = Math.max(handoverMonth + 1, treasurySim.dlpEndMonth);
  const licenseDay = Math.max(0, Math.min(durationDays, cfoSim.clock.licenseTriggerDay));
  const licenseMonth = Math.round((licenseDay / MONTH_DAYS) * 10) / 10;

  // Monotonic boundary set: canonical marks are clamped to the live calendar so
  // the spine never inverts when duration or licence date assumptions change.
  const monotonic = (marks: number[]) =>
    marks.reduce<number[]>((acc, mark) => {
      const floor = acc.length ? acc[acc.length - 1] : 0;
      acc.push(Math.max(floor, mark));
      return acc;
    }, []);

  const marks = monotonic([
    0,
    Math.min(2, handoverMonth),
    Math.min(Math.max(licenseMonth, 2), handoverMonth),
    Math.min(Math.max(12, licenseMonth), handoverMonth),
    handoverMonth,
    dlpEndMonth,
  ]);

  const monthToDay = (month: number) => Math.round(Math.max(0, Math.min(1, month / Math.max(1, handoverMonth))) * durationDays);

  const specs = [
    { id: 'compliance', code: 'L-01', label: 'Compliance & SPV Inception', gate: 'M0 – M2 · corporate setup, escrow account opening' },
    { id: 'chasm', code: 'L-02', label: 'Pre-Sales Capital Chasm', gate: 'Theta decay · collections blockaded to zero' },
    { id: 'inflow', code: 'L-03', label: 'Early Network Inflow', gate: 'RERA off-plan licence cleared · first tranches' },
    { id: 'midcycle', code: 'L-04', label: 'Mid-Cycle WIP', gate: '20 / 40 / 60 / 80% certified progress gates' },
    { id: 'terminal', code: 'L-05', label: 'Terminal Handover & DLP', gate: 'Waterfall settlement · 12-month warranty lock' },
  ];

  return specs.map((spec, index) => {
    const fromMonth = marks[index];
    const toMonth = marks[index + 1];
    const fromDay = monthToDay(fromMonth);
    const toDay = index === specs.length - 1 ? durationDays + Math.round(treasurySim.defectsMonths * MONTH_DAYS) : monthToDay(toMonth);
    const progressPct = Math.max(0, Math.min(100, (toMonth / Math.max(1, handoverMonth)) * 100));

    const collections = treasurySim.milestones
      .filter((milestone) => milestone.month >= fromMonth && milestone.month < toMonth)
      .reduce((sum, milestone) => sum + milestone.collection, 0);

    const drawDays = index === specs.length - 1 ? durationDays : toDay;
    const draws = cfoSim.drawPlan
      .filter((draw) => draw.day >= fromDay && draw.day < Math.max(fromDay + 1, drawDays))
      .reduce((sum, draw) => sum + draw.amount, 0);

    const activeDays = Math.max(0, Math.min(toDay, durationDays) - Math.min(fromDay, durationDays));
    const burn = cfoSim.dailyBurn * activeDays;

    const close = sampleAt(cfoSim.history, Math.min(toDay, durationDays));
    const escrowOpen = toMonth > licenseMonth;
    const gated = fromMonth <= licenseMonth && toMonth > licenseMonth;

    return {
      id: spec.id,
      code: spec.code,
      label: spec.label,
      fromMonth,
      toMonth,
      fromDay,
      toDay,
      progressPct,
      collections,
      burn,
      draws,
      escrowStatus: (gated ? 'Gated' : escrowOpen ? 'Open' : 'Blocked') as LedgerWindow['escrowStatus'],
      gate: spec.gate,
      cashAtClose: close.treasuryCash,
      escrowAtClose: close.escrowCash,
      note:
        index === 0
          ? 'Zero buyer inflow; equity cushion absorbs corporate outlays.'
          : index === 1
            ? 'Pure equity deficit valley until the licence trigger day.'
            : index === 2
              ? 'Escrow-to-debt swipes begin retiring accrued carry.'
              : index === 3
                ? 'Unlocked operating capital funds certified progress gates.'
                : 'Remaining cash resolves down the terminal priority stack.',
    };
  });
}

/* --------------------------------------------------------------------- */
/* Reconciliation status                                                   */
/* --------------------------------------------------------------------- */
export interface ReconciliationState {
  reconciled: boolean;
  residual: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  fundingTotal: number;
  checksPassed: number;
  checksTotal: number;
  flowAuditBalanced: boolean;
  escrowAuditBalanced: boolean;
  tierResidual: number;
  label: 'Ledger Reconciled' | 'Audit Variance';
}

export function buildReconciliation(state: ReportState): ReconciliationState {
  const { treasurySim, cfoSim } = state;
  const current = cfoSim.current;
  const residual = current.balanceDifference;
  const tierResidual = treasurySim.gdv - (treasurySim.unlockedPool + treasurySim.retentionPool + treasurySim.defectsPool);
  const checksPassed = cfoSim.checks.filter((check) => check.passed).length;
  const reconciled =
    Math.abs(residual) <= BALANCE_TOLERANCE_AED &&
    Math.abs(tierResidual) <= BALANCE_TOLERANCE_AED &&
    treasurySim.underwritingFlowAudit.balanced &&
    treasurySim.escrowFlowAudit.balanced &&
    checksPassed === cfoSim.checks.length;

  return {
    reconciled,
    residual,
    totalAssets: current.totalAssets,
    totalLiabilities: current.totalLiabilities,
    totalEquity: current.totalEquity,
    fundingTotal: current.fundingTotal,
    checksPassed,
    checksTotal: cfoSim.checks.length,
    flowAuditBalanced: treasurySim.underwritingFlowAudit.balanced,
    escrowAuditBalanced: treasurySim.escrowFlowAudit.balanced,
    tierResidual,
    label: reconciled ? 'Ledger Reconciled' : 'Audit Variance',
  };
}

/* --------------------------------------------------------------------- */
/* Pro-rata verification — proves zero drift on parent macro overrides.    */
/* --------------------------------------------------------------------- */
export interface ProRataGroup {
  parent: string;
  parentValue: number;
  unit: string;
  children: { label: string; value: number; weightPct: number }[];
  childSum: number;
  drift: number;
  driftZero: boolean;
}

export function buildProRataGroups(state: ReportState): ProRataGroup[] {
  const { treasuryInputs, viabilityResult } = state;
  const micro = state.micro;

  const group = (
    parent: string,
    parentValue: number,
    unit: string,
    children: { label: string; value: number }[],
  ): ProRataGroup => {
    const childSum = children.reduce((sum, child) => sum + child.value, 0);
    const drift = childSum - parentValue;
    return {
      parent,
      parentValue,
      unit,
      children: children.map((child) => ({
        label: child.label,
        value: child.value,
        weightPct: childSum > 0 ? (child.value / childSum) * 100 : 0,
      })),
      childSum,
      drift,
      driftZero: Math.abs(drift) <= 0.01,
    };
  };

  return [
    group('Securitised Land Value', treasuryInputs.landValue, 'AED', [
      { label: 'Land Purchase Price (Base)', value: micro.landPurchase },
      { label: 'Closing Costs & Stamp Duty', value: micro.landClosing },
    ]),
    group('Target Construction Cost', treasuryInputs.constructionCostGfa, 'AED / GFA sf', [
      { label: 'Site Prep & Civil Works', value: micro.hardCivil },
      { label: 'Structural & Core Construction', value: micro.hardStructural },
      { label: 'Interior Fit-Out & Finishes', value: micro.hardFinishes },
    ]),
    group('Cost of Approvals', treasuryInputs.approvalsCostGfa, 'AED / GFA sf', [
      { label: 'Architectural & Engineering Design', value: micro.softDesign },
      { label: 'Permits & Municipal Fees', value: micro.softPermits },
      { label: 'Legal & Professional Retainers', value: micro.softLegal },
      { label: 'Marketing & Sales Commissions', value: micro.softMarketing },
    ]),
    // Same-engine conservation proof: the four S-curve releases are a
    // largest-remainder allocation of one budget, so they must sum to it exactly.
    group(
      'Construction S-Curve Phase Releases',
      viabilityResult.constructionCostMetrics.allInConstructionAed,
      'AED',
      viabilityResult.constructionDrawdowns.map((phase) => ({
        label: `${phase.shortLabel} · ${phase.weightPercent}% weight`,
        value: phase.allInCostAed,
      })),
    ),
  ];
}

/* --------------------------------------------------------------------- */
/* The disclosure register                                                 */
/* --------------------------------------------------------------------- */
export function buildReportDisclosures(input: ReportState): ReportDisclosure[] {
  const { viabilityInputs, viabilityResult, treasuryInputs, treasurySim, cfoSim } = input;
  const reconciliation = buildReconciliation(input);
  const waterfall = buildTerminalWaterfall(treasurySim);
  const windows = buildLedgerWindows(input);
  const efficiencyDragPsfNsa = viabilityResult.totalDevCostPsfNsa - viabilityResult.landCostPsfNsa;

  const d: ReportDisclosure[] = [
    /* ---------------- Section 1.0 ---------------- */
    {
      section: '1.0', code: 'EX-01', status: 'pass',
      label: 'Spatial envelope',
      value: `GFA ${fmtNum(treasurySim.gfa)} sf = ${fmtNum(treasuryInputs.parcelSize)} sf plot x ${treasuryInputs.far.toFixed(2)} FAR`,
      basis: 'GFA = Plot Area x Permissible FAR',
    },
    {
      section: '1.0', code: 'EX-02', status: treasuryInputs.farEfficiency >= 75 ? 'pass' : 'watch',
      label: 'Structural efficiency divisor (E)',
      value: `NSA ${fmtNum(treasurySim.nsa)} sf at ${fmtPct(treasuryInputs.farEfficiency, 1)} floorplate efficiency`,
      basis: 'NSA = GFA x E%; E divides every per-foot cost allocation',
    },
    {
      section: '1.0', code: 'EX-03', status: 'pass',
      label: 'Efficiency drag on the sellable layout',
      value: `AED ${fmtNum(efficiencyDragPsfNsa, 2)} / NSA sf of non-land cost base`,
      basis: 'Total dev cost / NSA less land cost / NSA',
    },
    {
      section: '1.0', code: 'EX-04', status: 'pass',
      label: 'Revenue foundation',
      value: `GDV ${fmtAedM(treasurySim.gdv)} = ${fmtNum(treasurySim.nsa)} sf NSA x AED ${fmtNum(treasuryInputs.sellingPricePsf)} blended retail PSF`,
      basis: 'GDV = NSA x Blended Retail Price PSF',
    },
    {
      section: '1.0', code: 'EX-05', status: treasurySim.shortfall > 0 ? 'flag' : 'pass',
      label: 'Total development cost cap',
      value: `${fmtAedM(treasurySim.totalDevelopmentCost)} (land ${fmtAedM(treasurySim.landValue)} + facility ${fmtAedM(treasurySim.externalDebtRequired)} + carry ${fmtAedM(treasurySim.totalFinancingCost)})`,
      basis: 'TDC = Opening capital base + compounded financing cost',
    },
    {
      section: '1.0', code: 'EX-06', status: treasurySim.ltv > 70 ? 'flag' : treasurySim.ltv > 60 ? 'watch' : 'pass',
      label: 'LTV leverage on the senior facility',
      value: `${fmtPct(treasurySim.ltv, 1)} of GDV · ${fmtAedM(treasurySim.externalDebtRequired)} drawn requirement`,
      basis: 'LTV = External debt required / GDV',
    },
    {
      section: '1.0', code: 'EX-07', status: treasurySim.totalProjectSurplus >= 0 ? 'pass' : 'flag',
      label: 'Unallocated project surplus and margin',
      value: `${fmtAedM(treasurySim.totalProjectSurplus)} · ${fmtPct(treasurySim.margin, 1)} margin on GDV`,
      basis: 'Surplus = GDV - TDC',
    },
    {
      section: '1.0', code: 'EX-08', status: 'pass',
      label: 'Dual-Sankey baseline aggregate (capitalisation)',
      value: `Sources ${fmtAedM(treasurySim.underwritingFlowAudit.sourceTotal)} vs sinks ${fmtAedM(treasurySim.underwritingFlowAudit.sinkTotal)} · residual ${fmtNum(treasurySim.underwritingFlowAudit.residual, 2)}`,
      basis: 'Flow conservation audit on the underwriting diagram',
    },
    {
      section: '1.0', code: 'EX-09', status: treasurySim.escrowFlowAudit.balanced ? 'pass' : 'flag',
      label: 'Dual-Sankey baseline aggregate (escrow hub)',
      value: `Hub in ${fmtAedM(treasurySim.escrowFlowAudit.hubInflows)} = hub out ${fmtAedM(treasurySim.escrowFlowAudit.hubOutflows)} · residual ${fmtNum(treasurySim.escrowFlowAudit.hubBalanceResidual, 2)}`,
      basis: 'Buyer deposits split three ways inside the operating hub',
    },
    {
      section: '1.0', code: 'EX-10', status: viabilityResult.gapToMarket >= 0 ? 'pass' : 'watch',
      label: 'Breakeven floor against the market comp',
      value: `Breakeven AED ${fmtNum(viabilityResult.breakevenPsf, 0)} / NSA sf vs comp AED ${fmtNum(viabilityInputs.marketCompPsf, 0)} · gap ${viabilityResult.gapToMarket >= 0 ? '+' : ''}AED ${fmtNum(viabilityResult.gapToMarket, 0)}`,
      basis: 'Breakeven = total dev cost / NSA / (1 - sales leakage)',
    },

    /* ---------------- Section 2.0 ---------------- */
    {
      section: '2.0', code: 'CC-01', status: 'pass',
      label: 'Active project calendar',
      value: `${fmtNum(cfoSim.clock.totalProjectDays)} calendar days from corporate inception; ${fmtNum(treasurySim.handoverMonth)} months to handover, DLP closes M${treasurySim.dlpEndMonth}`,
      basis: 'Clock starts at SPV activation, not at groundbreaking',
    },
    {
      section: '2.0', code: 'CC-02', status: cfoSim.preLicenseDeficitDays > 0 ? 'watch' : 'pass',
      label: 'Pre-sales capital chasm (theta decay)',
      value: `${fmtNum(cfoSim.preLicenseDeficitDays)} days of blockaded collections; ${fmtAedM(cfoSim.preLicenseBurn)} of pure equity deficit burn`,
      basis: 'Buyer inflows = 0 for all t < licence trigger day',
    },
    {
      section: '2.0', code: 'CC-03', status: cfoSim.cushionExhausted ? 'flag' : 'pass',
      label: 'Seeded working capital cushion erosion',
      value: `X ${fmtAedM(cfoSim.current.nonHumanExpense)} + Y ${fmtAedM(cfoSim.current.humanExpense)} = ${fmtAedM(cfoSim.accumulatedBurnAed)} eroded of ${fmtAedM(cfoSim.initialWcCushionAed)} seeded`,
      basis: 'R = X (non-human bleed) + Y (human retainers), linear per calendar day',
    },
    {
      section: '2.0', code: 'CC-04', status: cfoSim.cushionRunwayDays === null ? 'pass' : cfoSim.cushionRunwayDays < 180 ? 'flag' : 'watch',
      label: 'Cushion runway at the live burn rate',
      value: cfoSim.cushionRunwayDays === null
        ? 'No burn rate configured; runway indeterminate'
        : `${fmtNum(cfoSim.cushionRunwayDays, 0)} days of corporate overhead cover remaining`,
      basis: 'Runway = seeded cushion / (X + Y)',
    },
    {
      section: '2.0', code: 'CC-05', status: cfoSim.zeroEquityMode ? 'watch' : 'pass',
      label: 'Zero-equity debt bridge rule',
      value: cfoSim.zeroEquityMode
        ? `TRIGGERED — ${fmtAedM(cfoSim.zeroEquityCushionDraw)} drawn from the senior facility on Day 0; per-diem interest active from Day 1`
        : 'Dormant — developer cash equity present, cushion funded from equity',
      basis: 'If developer cash equity = 0, draw the full buffer at inception',
    },
    {
      section: '2.0', code: 'CC-06', status: 'pass',
      label: 'Milestone capital swipes (de-leveraging)',
      value: `${fmtAedM(cfoSim.current.flows.escrowDebtSwipes)} swept; ${fmtAedM(cfoSim.current.flows.interestRetiredBySwipes)} of accrued carry retired`,
      basis: 'Swipe = min(available escrow, accrued interest + drawn principal)',
    },
    {
      section: '2.0', code: 'CC-07', status: 'pass',
      label: 'Overhead loading per sellable foot (c)',
      value: `AED ${fmtNum(cfoSim.overheadLoadingC, 2)} / NSA sf consumed of AED ${fmtNum(cfoSim.initialWcPsfNsa, 2)} / NSA sf allotted`,
      basis: 'c = (R x elapsed days T) / NSA',
    },

    /* ---------------- Section 3.0 ---------------- */
    {
      section: '3.0', code: 'ES-01', status: 'pass',
      label: 'Tier 1 — Active project retention',
      value: `${fmtPct(treasurySim.retentionPctEff, 1)} · ${fmtAedM(treasurySim.retentionPool)} trapped until certified completion`,
      basis: 'Retention pool = GDV x retention %; adjustable, default 10%',
    },
    {
      section: '3.0', code: 'ES-02', status: 'pass',
      label: 'Tier 2 — Post-handover defects liability pool',
      value: `${fmtPct(treasurySim.defectsPct, 0)} fixed · ${fmtAedM(treasurySim.defectsPool)} locked M${treasurySim.handoverMonth} to M${treasurySim.dlpEndMonth} (${treasurySim.defectsMonths} months)`,
      basis: 'Defects pool = GDV x 5%; non-negotiable under Law No. 8 of 2007',
    },
    {
      section: '3.0', code: 'ES-03', status: 'pass',
      label: 'Tier 3 — Unlocked operating capital',
      value: `${fmtAedM(treasurySim.unlockedPool)} released at the 20 / 40 / 60 / 80% engineer-certified gates`,
      basis: 'Unlocked = GDV - retention pool - defects pool',
    },
    {
      section: '3.0', code: 'ES-04', status: Math.abs(reconciliation.tierResidual) <= BALANCE_TOLERANCE_AED ? 'pass' : 'flag',
      label: 'Three-tier conservation check',
      value: `Tiers sum to ${fmtAedM(treasurySim.unlockedPool + treasurySim.retentionPool + treasurySim.defectsPool)} against GDV ${fmtAedM(treasurySim.gdv)} · residual ${fmtNum(reconciliation.tierResidual, 2)}`,
      basis: 'Every incoming dirham is split into exactly three immutable tiers',
    },
    {
      section: '3.0', code: 'ES-05', status: treasurySim.repaymentShortfall > 0.05 ? 'flag' : 'pass',
      label: 'Unlocked-pool repayment coverage',
      value: `${fmtPct(treasurySim.repaymentCoveragePct, 1)} covered; ${fmtAedM(treasurySim.repaymentShortfall)} unsettled; ${fmtAedM(treasurySim.unlockedSettlementSurplus)} residual`,
      basis: 'Unlocked cash settles principal, then interest, then land',
    },

    /* ---------------- Section 4.0 ---------------- */
    ...waterfall.rungs.map((rung): ReportDisclosure => ({
      section: '4.0',
      code: `WF-0${rung.rank}`,
      status: rung.shortfall > 0.05 && rung.rank < 5 ? 'flag' : rung.shortfall > 0.05 ? 'watch' : 'pass',
      label: `Rank ${rung.rank} — ${rung.label}`,
      value: `Obligation ${fmtAedM(rung.obligation)} · settled ${fmtAedM(rung.funded)} · recovery ${fmtPct(rung.recoveryPct, 1)}`,
      basis: rung.note,
    })),
    {
      section: '4.0', code: 'WF-06', status: Math.abs(waterfall.residual) <= BALANCE_TOLERANCE_AED ? 'pass' : 'flag',
      label: 'Waterfall conservation',
      value: `GDV ${fmtAedM(treasurySim.gdv)} fully resolved; unallocated residual ${fmtNum(waterfall.residual, 2)} AED`,
      basis: 'Sum of funded ranks must equal GDV within AED 0.05',
    },
    {
      section: '4.0', code: 'WF-07', status: reconciliation.reconciled ? 'pass' : 'flag',
      label: 'Double-entry balance verification loop',
      value: `${reconciliation.label} — assets ${fmtAedM(reconciliation.totalAssets)} vs liabilities + equity ${fmtAedM(reconciliation.fundingTotal)} · residual ${fmtNum(reconciliation.residual, 2)} (tolerance AED ${BALANCE_TOLERANCE_AED})`,
      basis: 'Total assets = total liabilities + contributed equity',
    },
    {
      section: '4.0', code: 'WF-08', status: reconciliation.checksPassed === reconciliation.checksTotal ? 'pass' : 'flag',
      label: 'Engine assertion suite',
      value: `${reconciliation.checksPassed} of ${reconciliation.checksTotal} double-entry assertions passing`,
      basis: 'Live CFO simulation self-checks at the reporting cut-off',
    },
    {
      section: '4.0', code: 'WF-09', status: 'pass',
      label: 'Execution ledger coverage',
      value: windows.map((w) => `${w.code} M${fmtNum(w.fromMonth, 0)}-M${fmtNum(w.toMonth, 0)}`).join(' · '),
      basis: 'Five canonical windows mapped onto the live project calendar',
    },
  ];

  return d;
}
