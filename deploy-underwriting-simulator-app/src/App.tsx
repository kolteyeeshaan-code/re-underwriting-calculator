import { useCallback, useEffect, useMemo, useState } from 'react';
import TreasuryWorkspace from './components/TreasuryWorkspace';
import ViabilitySpotlight from './components/ViabilitySpotlight';
import CfoWorkspace from './components/CfoWorkspace';
import UnderwritingReport from './components/UnderwritingReport';
import TeamWorkspace from './components/TeamWorkspace';
import MethodologyModal from './components/MethodologyModal';
import { exportInvestmentPack } from './lib/exportPack';
import { buildReportDisclosures, type ReportState } from './lib/reportDisclosures';
import { useCfoSimulation } from './engine/cfoEngine';
import { useTreasurySimulation } from './engine/treasuryEngine';
import { useViabilitySimulation } from './engine/viabilityEngine';
import { EeshaanKolteyTopBar } from './components/eeshaan-koltey/topbar';
import { ToastProvider, useToast } from './components/eeshaan-koltey/ui';

type Workspace = 'viability' | 'treasury' | 'cfo' | 'report' | 'team';

const WORKSPACES = [
  {
    id: 'viability',
    label: 'Capital Origination',
    shortLabel: 'Origination',
    tag: 'Feasibility & 4-Tier Matrix',
  },
  {
    id: 'treasury',
    label: 'Treasury Management',
    shortLabel: 'Treasury',
    tag: 'Escrow Draws & Priority Sinks',
  },
  {
    id: 'cfo',
    label: 'SPV CFO Cash Burn',
    shortLabel: 'SPV CFO',
    tag: 'Capital Clock & Daily Statements',
  },
  {
    id: 'report',
    label: 'Underwriting Report',
    shortLabel: 'Report',
    tag: 'Reconciled Audit Disclosures',
  },
  {
    id: 'team',
    label: 'Team & Execution',
    shortLabel: 'Team',
    tag: 'Responsibilities & Dubai Stage Map',
  },
];

function AppInner() {
  const [workspace, setWorkspace] = useState<Workspace>('viability');
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState(false);
  const [methodologyOpen, setMethodologyOpen] = useState(false);

  const toast = useToast();
  const treasury = useTreasurySimulation();
  const viability = useViabilitySimulation();
  const cfo = useCfoSimulation();

  // Workspace 4 renders this state and the master package prints the identical
  // disclosure register, so the document and the download can never diverge.
  const reportState = useMemo<ReportState>(
    () => ({
      viabilityInputs: viability.inputs,
      viabilityResult: viability.result,
      treasuryInputs: treasury.inputs,
      treasurySim: treasury.simulationData,
      micro: treasury.micro,
      cfoSim: cfo.simulation,
    }),
    [viability.inputs, viability.result, treasury.inputs, treasury.simulationData, treasury.micro, cfo.simulation],
  );

  const reportDisclosures = useMemo(() => buildReportDisclosures(reportState), [reportState]);

  const seedTreasuryUnderwriting = useCallback(() => {
    const snapshot = viability.underwritingBaseline;
    if (!snapshot.valid) return;

    const baseline = snapshot.baseline;
    const accepted = treasury.seedUnderwriting({
      parcelSize: baseline.plotArea,
      far: baseline.permissibleFar,
      farEfficiency: baseline.nsaEfficiency,
      landValue: baseline.landEffective,
      sellingPricePsf: baseline.marketCompPsf,
      financingArr: baseline.financingArr,
      projectDurationYears: baseline.projectDurationYears,
    });
    if (accepted) {
      setSyncNotice('Underwriting baseline pushed to Treasury operating wallets.');
      toast('Underwriting baseline seeded to Treasury');
    }
  }, [viability.underwritingBaseline, treasury.seedUnderwriting, toast]);

  const seedCfoWorkspace = useCallback(() => {
    const snapshot = viability.underwritingBaseline;
    if (!snapshot.valid) return;
    const baseline = snapshot.baseline;
    const accepted = cfo.seedUnderwriting({
      plotArea: baseline.plotArea,
      permissibleFar: baseline.permissibleFar,
      nsaEfficiency: baseline.nsaEfficiency,
      landEffective: baseline.landEffective,
      marketCompPsf: baseline.marketCompPsf,
      financingArr: baseline.financingArr,
      projectDurationYears: baseline.projectDurationYears,
    });
    if (accepted) {
      setSyncNotice('Underwriting baseline pushed to SPV CFO capital clock.');
      toast('Underwriting baseline seeded to CFO Workspace');
    }
  }, [viability.underwritingBaseline, cfo.seedUnderwriting, toast]);

  const handleExportPack = useCallback(() => {
    const viabilityResult = viability.result;
    const viabilityInputs = viability.inputs;
    const treasurySim = treasury.simulationData;
    const cfoSim = cfo.simulation;
    const clock = cfoSim.clock;

    exportInvestmentPack({
      plotArea: viabilityInputs.plotArea,
      permissibleFar: viabilityInputs.permissibleFar,
      efficiencyPct: viabilityInputs.nsaEfficiency,
      marketCompPsf: viabilityInputs.marketCompPsf,
      landEquity: viabilityResult.landEffective,
      gdv: treasurySim.gdv,
      totalDevelopmentCost: treasurySim.totalDevelopmentCost,
      externalDebtRequired: treasurySim.externalDebtRequired,
      totalFinancingCost: treasurySim.totalFinancingCost,
      totalProjectSurplus: treasurySim.totalProjectSurplus,
      retentionPool: treasurySim.retentionPool,
      defectsPool: treasurySim.defectsPool,
      unlockedPool: treasurySim.unlockedPool,
      totalProjectDays: clock.totalProjectDays,
      licenseTriggerDay: clock.licenseTriggerDay,
      breaches: cfoSim.checks.filter((check) => !check.passed).length,
      dailyBurn: cfoSim.dailyBurn,
      cfoRealizedRevenue: cfoSim.current.realizedRevenue,
      cfoAccumulatedBurn: cfoSim.accumulatedBurnAed,
      cfoOperatingCashPaid:
        cfoSim.current.flows.nonHumanPaid +
        cfoSim.current.flows.humanPaid +
        cfoSim.current.flows.salesLeakagePaid,
      cfoSiteOutlaysPaid: cfoSim.current.flows.siteCashPaid,
      cfoDebtDrawn: cfoSim.current.flows.debtDrawdowns,
      cfoEscrowCash: cfoSim.current.escrowCash,
      cfoDefectsPool: cfoSim.current.defectsPoolBalance,
      cfoWipInventory: cfoSim.current.wipInventory,
      cfoDebtPrincipal: cfoSim.current.debtPrincipal,
      cfoAccruedInterest: cfoSim.current.financingAccrued,
      cfoRetainedEarnings: cfoSim.current.retainedEarnings,
      cfoCostOfSales: cfoSim.current.costOfSales,
      cfoGrossProfit: cfoSim.current.realizedRevenue - cfoSim.current.costOfSales,
      cfoSalesExpense: cfoSim.current.salesExpense,
      cfoFinancingExpense: cfoSim.current.financingExpense,
      cfoInventoryImpairment: cfoSim.current.inventoryImpairment,
      cfoOpeningCash: cfoSim.openingCash,
      cfoNetCashMovement: cfoSim.cumulativeNetCash,
      cfoClosingCash: cfoSim.current.totalCash,
      cfoCash: cfoSim.current.treasuryCash,
      cfoLandInventory: cfoSim.current.landInventory,
      cfoBuyerContractLiability: cfoSim.current.buyerContractLiability,
      cfoTotalPayables: cfoSim.current.totalPayables,
      cfoPaidInEquity: cfoSim.current.paidInEquity,
      cfoTotalAssets: cfoSim.current.totalAssets,
      cfoTotalLiabilities: cfoSim.current.totalLiabilities,
      cfoFundingTotal: cfoSim.current.fundingTotal,
      cfoBalanceDifference: cfoSim.current.balanceDifference,
      constructionDrawdowns: viability.result.constructionDrawdowns.map((phase) => ({
        label: phase.label,
        timelineLabel: phase.timelineLabel,
        weightPercent: phase.weightPercent,
        hardCostAed: phase.hardCostAed,
        approvalsAed: phase.approvalsAed,
        allInCostAed: phase.allInCostAed,
        cumulativeFundingAed: phase.cumulativeFundingAed,
        allInCostPsfNsa: phase.allInCostPsfNsa,
        startMonth: phase.startMonth,
        endMonth: phase.endMonth,
        startPercent: phase.startPercent,
        endPercent: phase.endPercent,
      })),
      distributionLadder: treasurySim.distributionLadder,
      gfa: treasurySim.gfa,
      nsa: treasurySim.nsa,
      sensitivity: viabilityResult.sensitivity,
      reportDisclosures,
      timeline: [
        'Phase 1 / SPV Corporate Inception & Compliance Setup',
        'Phase 2 / RERA Off-Plan Sales Licence Clearance',
        'Phase 3 / Groundbreaking & Substructure',
        'Phase 4 / 20% Certified Structural Core',
        'Phase 5 / 40-60% MEP, Facade & Fit-Out',
        'Phase 6 / Handover, Unit Registration & Exit',
        'Phase 7 / 12-Month Post-Handover Defects Liability Period',
      ],
    });
    setExportNotice(true);
    toast('Investment Committee Pack downloaded (PDF, XLSX, MD)');
  }, [viability.result, viability.inputs, treasury.simulationData, cfo.simulation, reportDisclosures, toast]);

  useEffect(() => {
    if (!syncNotice) return;
    const timer = window.setTimeout(() => setSyncNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [syncNotice]);

  useEffect(() => {
    if (!exportNotice) return;
    const timer = window.setTimeout(() => setExportNotice(false), 7000);
    return () => window.clearTimeout(timer);
  }, [exportNotice]);

  return (
    <div className="eeshaan-koltey-canvas font-sans antialiased text-ink flex flex-col min-h-screen">
      {/* Eeshaan Koltey TopBar with measured sliding pill */}
      <EeshaanKolteyTopBar
        workspaces={WORKSPACES}
        active={workspace}
        onSelect={(id) => setWorkspace(id as Workspace)}
        onExport={handleExportPack}
        onMethodology={() => setMethodologyOpen(true)}
      />

      {/* Sync / Export Notification Bar */}
      {(syncNotice || exportNotice) && (
        <div className="mx-auto mt-3 flex max-w-[1400px] flex-wrap gap-2 px-3.5 sm:px-7 w-full anim-pop">
          {syncNotice && (
            <div className="inline-flex max-w-full items-center gap-2 rounded-2xl sm:rounded-full bg-[#FDF6E3] border border-[#FBE6A4] px-3.5 py-1.5 text-[12px] sm:text-[12.5px] font-medium text-[#7A4A0E] shadow-sm">
              <span className="flex h-2 w-2 shrink-0 rounded-full bg-amber" />
              <span className="min-w-0 break-words">{syncNotice}</span>
            </div>
          )}
          {exportNotice && (
            <div className="inline-flex max-w-full items-center gap-2 rounded-2xl sm:rounded-full bg-[#EFF6F1] border border-[#CFE3D6] px-3.5 py-1.5 text-[12px] sm:text-[12.5px] font-medium text-[#2F5C44] shadow-sm">
              <span className="flex h-2 w-2 shrink-0 rounded-full bg-[#7BB694]" />
              <span className="min-w-0 break-words">
                Investment Pack exported: underwriting_executive_summary.pdf, treasury_ledger_snapshot.xlsx, pitch_deck_ai_blueprint.md
              </span>
            </div>
          )}
        </div>
      )}

      {/* Main Workspace Stage */}
      <main className="mx-auto max-w-[1400px] px-3.5 py-4 sm:px-7 sm:py-6 flex-1 w-full min-w-0">
        {workspace === 'team' ? (
          <TeamWorkspace />
        ) : workspace === 'report' ? (
          <UnderwritingReport
            viability={viability}
            treasury={treasury}
            cfo={cfo}
            onExportMaster={handleExportPack}
          />
        ) : workspace === 'cfo' ? (
          <CfoWorkspace controller={cfo} />
        ) : workspace === 'treasury' ? (
          <TreasuryWorkspace simulation={treasury} />
        ) : (
          <ViabilitySpotlight
            simulation={viability}
            onSeedUnderwriting={seedTreasuryUnderwriting}
            onSeedCfo={seedCfoWorkspace}
          />
        )}
      </main>

      {/* Eeshaan Koltey-styled clean hairline footer */}
      <footer className="mt-auto border-t border-[rgba(22,24,28,0.06)] py-5 text-center sm:text-left text-[12px] font-light text-muted">
        <div className="mx-auto max-w-[1400px] px-3.5 sm:px-7 flex flex-col sm:flex-row flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          <p className="leading-relaxed">Eeshaan Koltey · Real Estate Intelligence Suite · Dubai RERA Law No. 8 Underwriting Platform</p>
          <button
            type="button"
            onClick={() => setMethodologyOpen(true)}
            className="hover:text-ink transition-colors font-normal text-ink-2"
          >
            Platform Methodology &amp; Calculation Framework →
          </button>
        </div>
      </footer>

      <MethodologyModal open={methodologyOpen} onClose={() => setMethodologyOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
