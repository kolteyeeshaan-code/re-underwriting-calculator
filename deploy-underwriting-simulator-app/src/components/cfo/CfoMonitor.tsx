import { useState } from 'react';
import { cfoAed, cfoFmt, cfoMillions, cfoReadableDate, type CfoController, type CfoCycleId, type CfoFlows, type CfoSimulation } from '../../engine/cfoEngine';
import { CfoBalanceChart, CfoCashChart, CfoProfitChart } from './CfoCharts';
import { CfoAlert, CfoDateField, CfoMetric, CfoPanel, CfoSelect, CfoStatementTable, type CfoTableRow } from './CfoUI';
import { Card as EeshaanKolteyCard, Badge, UnderlineTabs } from '../eeshaan-koltey/ui';
import { Download } from '../eeshaan-koltey/icons';

type StatementView = 'cfs' | 'pnl' | 'balance';

const STATEMENT_TABS = [
  'Cash Flow Statement (CFS)',
  'High-Frequency P&L',
  'Balance Sheet Snapshot',
] as const;

function cashRows(sim: CfoSimulation): CfoTableRow[] {
  const current = sim.current.flows;
  const daily = sim.dailyFlows;
  const operating = (f: CfoFlows) => -f.nonHumanPaid - f.humanPaid - f.salesLeakagePaid;
  const financing = (f: CfoFlows) => f.equityCash + f.debtDrawdowns + f.buyerDeposits;
  return [
    { id: 'opening', label: 'Opening cash and escrow', period: sim.openingCash, cumulative: 0 },
    { id: 'operating-header', label: 'I / Operating cash flows', heading: true },
    { id: 'x', label: 'X / Non-human operating payments', detail: 'SaaS, rents and subscriptions actually paid', period: -daily.nonHumanPaid, cumulative: -current.nonHumanPaid },
    { id: 'y', label: 'Y / Human capital payments', detail: 'Salary retainers paid from the operating wallet', period: -daily.humanPaid, cumulative: -current.humanPaid },
    { id: 'sales', label: 'Exit selling costs and incentives', detail: 'Cycle-dependent leakage on recognized exits', period: -daily.salesLeakagePaid, cumulative: -current.salesLeakagePaid },
    { id: 'op-net', label: 'Net operating cash flow', period: operating(daily), cumulative: operating(current) },
    { id: 'investing-header', label: 'II / Investing cash flows', heading: true },
    { id: 'site', label: 'Capitalized site construction outlays', detail: 'Hard and soft costs paid from escrow or treasury', period: -daily.siteCashPaid, cumulative: -current.siteCashPaid },
    { id: 'funding-net', label: 'Net financing / funding cash', period: financing(daily) - daily.escrowDebtSwipes, cumulative: financing(current) - current.escrowDebtSwipes },
    { id: 'terminal-header', label: 'IV / Exit outflows', heading: true },
    { id: 'terminal-debt', label: 'Terminal financier settlement', detail: 'Remaining principal plus compounded partner return', period: -daily.terminalDebtSettlement, cumulative: -current.terminalDebtSettlement },
    { id: 'land-dist', label: 'Terminal Land Partner Cash Distributions', detail: 'Return of contributed land capital, not a P&L expense', period: -daily.landDistributions, cumulative: -current.landDistributions },
    { id: 'net', label: 'Net movement in cash', period: sim.dailyNetCash, cumulative: sim.cumulativeNetCash, emphasis: true },
    { id: 'closing', label: 'Closing cash and escrow', detail: 'Opening cash + net movement = closing cash', period: sim.current.totalCash, cumulative: sim.current.totalCash, emphasis: true },
    { id: 'dev-surplus', label: 'Unallocated Free Developer Cash Surplus', detail: 'Internal terminal designation; cash stays in the SPV wallet and is not a dividend outflow', cumulative: sim.current.freeDeveloperCashSurplus },
  ];
}

function profitRows(sim: CfoSimulation): CfoTableRow[] {
  const c = sim.current;
  const gross = c.realizedRevenue - c.costOfSales;
  return [
    { id: 'recognized', label: 'I / Recognized trading result', heading: true },
    { id: 'revenue', label: 'Realized value / recognized revenue', detail: 'Only registered unit exits at or after handover', cumulative: c.realizedRevenue },
    { id: 'cogs', label: 'Cost of registered unit exits', detail: 'Pro-rata land inventory + constructed cost base', cumulative: -c.costOfSales },
    { id: 'gross', label: 'Gross realized trading result', cumulative: gross },
    { id: 'decay', label: 'II / Temporal decay bleed', heading: true },
    { id: 'temporal-decay', label: 'Temporal Decay Bleed / X + Y', cumulative: -sim.accumulatedBurnAed,
      detail: `Current overhead burden 'c' has reached AED ${cfoFmt(sim.overheadLoadingC, 2)} / NSA PSF, depleting the initial AED ${cfoFmt(sim.initialWcPsfNsa, 2)} / NSA PSF underwriting allotment.` },
    { id: 'expense-sales', label: 'Cycle-dependent exit leakage', cumulative: -c.salesExpense },
    { id: 'expense-finance', label: 'Lifetime compounded financing expense', detail: 'Actual/365 expense including paid and unpaid interest; repayment never reverses expense', cumulative: -c.financingExpense },
    { id: 'expense-variance', label: 'Downward variance penalties', detail: 'Unsold inventory impairment to net realizable value; no upward revaluation', cumulative: -c.inventoryImpairment },
    { id: 'pbt', label: 'Recognized PBT / retained earnings', detail: 'Potential gains and repayment memos are excluded from this total', cumulative: c.retainedEarnings, emphasis: true },
    { id: 'rescue-header', label: 'III / De-leveraging rescue effect', heading: true },
    { id: 'swipe-relief', label: 'Accrued interest retired through escrow swipes', detail: 'Memo: cash settlement already shown in CFS; paid interest remains in lifetime P&L expense', cumulative: c.flows.interestRetiredBySwipes },
    { id: 'swipe-count', label: 'Cumulative escrow-to-debt swipes applied', detail: 'Cash used to de-lever; memo only, not an expense', cumulative: c.flows.escrowDebtSwipes },
    { id: 'wallet-outlay', label: 'Financier Wallet Outlay Position', detail: 'Live drawn debt principal remaining after drawdowns and recycling', cumulative: c.debtPrincipal },
    { id: 'interest-savings', label: 'Temporal Interest Savings vs Upfront Drop', detail: 'Like-for-like effective facility funded on Day 1 with no sweeps minus actual interest expense', cumulative: sim.financingSavingsAed },
    { id: 'terminal-header', label: 'IV / Transaction settlement memos (not P&L expenses)', heading: true },
    { id: 'terminal-debt', label: 'Terminal financier principal + return settled', cumulative: -c.flows.terminalDebtSettlement },
    { id: 'terminal-land', label: 'Terminal land partner core return', cumulative: -c.flows.landDistributions },
    { id: 'terminal-dlp', label: 'Ring-Fenced 5% Defects Warranty Pool (12-Month Law No. 8 Lock)', detail: 'Carved out of buyer collections, not an expense', cumulative: c.defectsPoolBalance },
    { id: 'potential-header', label: 'V / Unrecognized potential value', heading: true },
    { id: 'potential', label: 'Forecast net trading position at close', detail: 'Scenario net proceeds less the all-in close-date cost cap', cumulative: sim.netTradingPosition },
    { id: 'compression', label: 'Paper cost-compression opportunity', detail: 'Savings versus the local reference site rate; already reflected in forecast, not added to PBT', cumulative: sim.potentialCostCompression },
  ];
}

function balanceRows(sim: CfoSimulation): { assets: CfoTableRow[]; funding: CfoTableRow[] } {
  const c = sim.current;
  return {
    assets: [
      { id: 'assets-heading', label: 'Assets', heading: true },
      { id: 'cash', label: c.terminalSettled ? 'Unallocated Free Developer Cash Surplus / Cash Reserves' : 'Operating wallet cash',
        detail: c.terminalSettled ? `${cfoAed(c.freeDeveloperCashSurplus)} remains free after outstanding claims; the rest is reserved.` : undefined,
        cumulative: c.treasuryCash },
      { id: 'escrow', label: 'DLD escrow liquidity excluding defects reserve', detail: 'Shown separately from the restricted account to prevent double counting', cumulative: Math.max(0, c.escrowCash - c.defectsPoolBalance) },
      { id: 'land', label: 'Unrealized land inventory', cumulative: c.landInventory },
      { id: 'wip', label: 'WIP / completed unit inventory', cumulative: c.wipInventory },
      { id: 'impairment', label: 'Inventory downward variance allowance', cumulative: -c.inventoryImpairment },
      { id: 'defects-pool', label: 'Ring-Fenced 5% Defects Warranty Pool (12-Month Law No. 8 Lock)', detail: 'Restricted escrow sub-account; excluded from free liquidity', cumulative: c.defectsPoolBalance },
      { id: 'asset-total', label: 'Total assets', cumulative: c.totalAssets, emphasis: true },
    ],
    funding: [
      { id: 'liability-heading', label: 'Liabilities', heading: true },
      { id: 'principal', label: 'Financier drawn debt principal', cumulative: c.debtPrincipal },
      { id: 'interest', label: 'Accrued compounded financing', cumulative: c.financingAccrued },
      { id: 'deferred', label: 'Buyer contract liabilities', detail: 'Collected deposits less recognized exit revenue', cumulative: c.buyerContractLiability },
      { id: 'site-payables', label: 'Unfunded construction payables', cumulative: c.sitePayables },
      { id: 'burn-payables', label: 'Unfunded operating obligations', cumulative: c.operatingPayables + c.salesPayables },
      { id: 'liability-total', label: 'Total liabilities', cumulative: c.totalLiabilities },
      { id: 'equity-heading', label: 'Equity', heading: true },
      { id: 'contributions', label: 'Land + developer paid-in equity', cumulative: c.paidInEquity },
      { id: 'earnings', label: 'Retained project earnings / deficit', cumulative: c.retainedEarnings },
      { id: 'funding-total', label: 'Total liabilities + equity', cumulative: c.fundingTotal, emphasis: true },
    ],
  };
}

function downloadStatement(view: StatementView, sim: CfoSimulation) {
  const balance = balanceRows(sim);
  const rows = view === 'cfs' ? cashRows(sim) : view === 'pnl' ? profitRows(sim) : [...balance.assets, ...balance.funding];
  const quote = (text: string) => `"${text.replace(/"/g, '""')}"`;
  const csv = [
    'SPV CFO HCVF - simulated statement',
    `Statement date,${sim.cutOffDate},Cut-off hour,${sim.hour}:00 GST`,
    `View,${view.toUpperCase()},Currency,AED`,
    'Account,Today to cut-off,Cumulative / snapshot,Note',
    ...rows.map((row) => [quote(row.label), row.period ?? '', row.cumulative ?? '', quote(row.detail ?? '')].join(',')),
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `spv-cfo-${view}-${sim.cutOffDate}-${String(sim.hour).padStart(2, '0')}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function WorkingCapitalConsumptionMeter({ sim }: { sim: CfoSimulation }) {
  const remainingPct = sim.initialWcCushionAed > 0 ? sim.remainingWcCushionAed / sim.initialWcCushionAed * 100 : 0;
  const consumedPct = sim.initialWcCushionAed > 0 ? sim.erodedWcCushionAed / sim.initialWcCushionAed * 100 : sim.accumulatedBurnAed > 0 ? 100 : 0;
  const current = sim.current;
  const financingExposure = current.debtPrincipal + current.financingAccrued;
  const principalShare = financingExposure > 0 ? current.debtPrincipal / financingExposure * 100 : 0;
  const interestShare = financingExposure > 0 ? current.financingAccrued / financingExposure * 100 : 0;

  return (
    <CfoPanel
      title="HCVF Dual Capital Burn Control Panel"
      subtitle="Operational cushion depletion versus live lender wallet exposure."
      right={
        <div className="text-right text-[11.5px] font-normal text-muted">
          Capital clock: <b className="text-ink font-medium">{cfoFmt(sim.activeElapsedDays, 1)} days</b>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Meter 1 */}
        <div className="min-w-0 rounded-[20px] p-3.5 sm:p-4 bg-white border border-[rgba(22,24,28,0.06)] shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 mb-2">
            <span className="text-[12px] font-medium text-ink">Meter 1: Operational Buffer Cushion</span>
            <span className="text-[11px] text-muted tabular-nums">Pool: {cfoMillions(sim.initialWcCushionAed)}</span>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2 text-[12px]">
            <div>
              <span className="text-muted block text-[10.5px]">Unexpended Cushion</span>
              <span className="text-[16.5px] sm:text-[18px] font-semibold tabular-nums text-[#2F5C44]">
                {cfoMillions(sim.remainingWcCushionAed)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-muted block text-[10.5px]">Eroded via Time Decay</span>
              <span className="text-[16.5px] sm:text-[18px] font-semibold tabular-nums text-[#96291D]">
                {cfoMillions(sim.accumulatedBurnAed)}
              </span>
            </div>
          </div>

          <div className="h-3 rounded-full bg-[rgba(22,24,28,0.06)] overflow-hidden flex">
            <div
              className="h-full bg-[#7BB694] transition-all duration-500"
              style={{ width: `${remainingPct}%` }}
              title={`Remaining: ${remainingPct.toFixed(1)}%`}
            />
            <div
              className="h-full bg-[#FA6C5D] transition-all duration-500"
              style={{ width: `${consumedPct}%` }}
              title={`Consumed: ${consumedPct.toFixed(1)}%`}
            />
          </div>

          {sim.cushionExhausted && (
            <div className="mt-3 rounded-[14px] bg-[#FEECEA] border border-[#FCD6D2] p-2.5 text-[11.5px] font-medium text-[#96291D]">
              🚨 TREASURY ALARM: Seeded Working Capital Cushion completely exhausted by Temporal Decay.
            </div>
          )}
        </div>

        {/* Meter 2 */}
        <div className="min-w-0 rounded-[20px] p-3.5 sm:p-4 bg-white border border-[rgba(22,24,28,0.06)] shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 mb-2">
            <span className="text-[12px] font-medium text-ink">Meter 2: Lender Wallet Outlay (TVM Drag)</span>
            <span className="text-[11px] text-muted tabular-nums">Cap: {cfoMillions(sim.effectiveFacilityCap)}</span>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2 text-[12px]">
            <div>
              <span className="text-muted block text-[10.5px]">Active Drawn Principal</span>
              <span className="text-[16.5px] sm:text-[18px] font-semibold tabular-nums text-[#16181C]">
                {cfoMillions(current.debtPrincipal)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-muted block text-[10.5px]">Accrued Interest Drag</span>
              <span className="text-[16.5px] sm:text-[18px] font-semibold tabular-nums text-[#7A4A0E]">
                {cfoMillions(current.financingAccrued)}
              </span>
            </div>
          </div>

          <div className="h-3 rounded-full bg-[rgba(22,24,28,0.06)] overflow-hidden flex">
            <div
              className="h-full bg-ink transition-all duration-500"
              style={{ width: `${principalShare}%` }}
              title={`Principal: ${cfoMillions(current.debtPrincipal)}`}
            />
            <div
              className="h-full bg-amber transition-all duration-500"
              style={{ width: `${interestShare}%` }}
              title={`Interest: ${cfoMillions(current.financingAccrued)}`}
            />
          </div>

          <p className="mt-3 text-[11.5px] font-light text-muted">
            Overhead load c = <b className="text-ink font-medium">AED {cfoFmt(sim.overheadLoadingC, 2)}/NSA sf</b> · Runway: <b className="text-ink font-medium">{sim.cushionRunwayDays === null ? 'infinite' : `${cfoFmt(sim.cushionRunwayDays, 0)} days`}</b>
          </p>
        </div>
      </div>
    </CfoPanel>
  );
}

export default function CfoMonitor({ controller }: { controller: CfoController }) {
  const { inputs, simulation: sim, updateInput, updatePosition, jumpTo } = controller;
  const [view, setView] = useState<StatementView>('cfs');
  const c = sim.current;
  const balanceReconciled = Math.abs(c.balanceDifference) <= 0.05;
  const balanced = sim.valid && balanceReconciled && sim.checks.every((check) => check.passed);
  const exitsEnabled = sim.valid && sim.time >= sim.duration;
  const balance = balanceRows(sim);

  const activeTabStr =
    view === 'cfs'
      ? STATEMENT_TABS[0]
      : view === 'pnl'
        ? STATEMENT_TABS[1]
        : STATEMENT_TABS[2];

  return (
    <div className="space-y-6">
      {!sim.valid && <CfoAlert error>{sim.errors.join(' ')}</CfoAlert>}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <CfoMetric
          label="Project Duration"
          value={`${cfoFmt(sim.duration)} days`}
          note={`${cfoReadableDate(inputs.activationDate)} → ${cfoReadableDate(inputs.handoverDate)}`}
        />
        <CfoMetric
          label="Per-Diem Burn (X + Y)"
          value={`AED ${cfoFmt(sim.dailyBurn)}`}
          note={`AED ${cfoFmt(sim.dailyBurn / 24, 0)}/hr decay`}
        />
        <CfoMetric
          label="WIP Construction Value"
          value={cfoMillions(c.wipBuilt)}
          note={`${cfoFmt(c.progress * 100, 1)}% built · hard + soft`}
        />
        <CfoMetric
          dark
          warning={sim.netTradingPosition < 0}
          label="Net Trading Position"
          value={cfoMillions(sim.netTradingPosition)}
          note={`Target forecast PBT at ${sim.scenario.label}`}
        />
      </div>

      {/* Dual Cushion Burn Meter */}
      <WorkingCapitalConsumptionMeter sim={sim} />

      {/* Reporting Date & Cut-off Controls */}
      <CfoPanel
        title="Simulation Reporting Cut-off"
        subtitle="Independent statement date anchor. Changing this moves your balance sheet position, not the project calendar."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CfoDateField
            label="Active Simulation Reporting Date"
            value={inputs.forecastDate}
            min={inputs.activationDate}
            max={sim.horizonDate}
            invalid={sim.clock.forecastBeforeActivation}
            onChange={(date) => updateInput('forecastDate', date)}
          />
          <CfoSelect
            label="Hourly Cut-off (GST / UTC+4)"
            value={String(sim.hour)}
            onChange={(v) => updatePosition('hour', Number(v))}
            options={Array.from({ length: 24 }, (_, h) => ({
              value: String(h),
              label: `${String(h).padStart(2, '0')}:00 GST`,
            }))}
          />
          <CfoSelect
            label="Market Cycle Scenario"
            value={sim.scenario.id}
            onChange={(v) => updatePosition('cycleId', v as CfoCycleId)}
            options={sim.scenarios.map((s) => ({
              value: s.id,
              label: `${s.label} · AED ${cfoFmt(s.price)}`,
            }))}
          />
          <div>
            <div className="flex items-baseline justify-between mb-1.5 text-[12px] font-medium text-[#16181C]">
              <span>Registered Unit Exits</span>
              <span className="font-semibold tabular-nums text-amber">{cfoFmt(sim.registeredExitPct)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={sim.registeredExitPct}
              disabled={!exitsEnabled}
              onChange={(e) => updatePosition('registeredExitPct', e.currentTarget.valueAsNumber)}
              className="range-amber mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[rgba(22,24,28,0.1)] disabled:opacity-30"
            />
            <p className="mt-1 text-[11px] font-light text-muted">
              {exitsEnabled ? 'Recognizes unit exits and releases escrow.' : 'Enabled at project completion.'}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(22,24,28,0.06)] pt-3.5">
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Inception', d: 0 },
              { label: 'RERA License', d: sim.licenseTriggerDay },
              { label: 'Handover', d: sim.duration },
              { label: 'DLP End', d: sim.horizon },
            ].map((jump) => (
              <button
                key={jump.label}
                type="button"
                onClick={() => jumpTo(jump.d)}
                className="rounded-full bg-white px-3 py-1 text-[11.5px] font-medium text-[#16181C] border border-[rgba(22,24,28,0.08)] hover:bg-[#FDF6E3] hover:border-[#FBE6A4] transition-colors"
              >
                {jump.label}
              </button>
            ))}
          </div>

          <Badge tone={sim.preLicense ? 'amber' : 'mint'} dot>
            {sim.preLicense ? 'Pre-License Chasm · Zero Collections' : 'License Active · Collections Permitted'}
          </Badge>
        </div>
      </CfoPanel>

      {/* Terminal Stack Card */}
      <CfoPanel
        title="Escrow-to-Debt Recycling &amp; Liquidation Waterfall"
        subtitle="Mid-lifecycle senior facility sweeps and terminal handover priority cascade."
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="min-w-0">
            <h4 className="text-[13px] font-medium text-ink mb-3">Mid-Lifecycle De-leveraging Position</h4>
            <div className="space-y-2">
              {[
                { label: 'Escrow Swipes to Senior Facility', v: c.flows.escrowDebtSwipes },
                { label: 'Financing Drag Extinguished', v: c.flows.interestRetiredBySwipes },
                { label: 'Remaining Drawn Debt Principal', v: c.debtPrincipal },
                { label: 'Accrued Financing Remaining', v: c.financingAccrued },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center gap-3 p-3 rounded-[16px] bg-[rgba(246,247,249,0.7)] text-[12.5px]">
                  <span className="min-w-0 text-[#5F646B]">{row.label}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-[#16181C]">{cfoMillions(row.v)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="min-w-0">
            <h4 className="text-[13px] font-medium text-ink mb-3">Terminal Settlement Priority Stack</h4>
            <div className="space-y-2">
              {[
                { rank: 1, label: 'Financier Debt Principal', v: -c.flows.terminalPrincipalPaid, note: 'Retired first' },
                { rank: 2, label: 'Financier Accrued Return', v: -c.flows.terminalInterestPaid, note: 'Settled second' },
                { rank: 3, label: 'Land Partner Core Return', v: -c.flows.landDistributions, note: 'AED 75M equity release' },
                { rank: 4, label: 'Ring-Fenced 5% Defects Pool', v: c.defectsPoolBalance, note: '12-Month Law No. 8 Lock' },
                { rank: 5, label: 'Unallocated Free Developer Surplus', v: c.freeDeveloperCashSurplus, note: 'Retained project earnings' },
              ].map((r) => (
                <div key={r.rank} className="flex items-center gap-3 p-3 rounded-[16px] bg-white border border-[rgba(22,24,28,0.06)] shadow-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-white text-[11px] font-medium">
                    {r.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block break-words text-[12.5px] sm:text-[13px] font-medium text-[#16181C]">{r.label}</span>
                    <span className="text-[11px] font-light text-muted block">{r.note}</span>
                  </div>
                  <span className="shrink-0 text-[12.5px] sm:text-[13px] font-semibold tabular-nums text-ink">{cfoMillions(r.v)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CfoPanel>

      {/* Statement Panels */}
      <EeshaanKolteyCard variant="plain" className="p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4 border-b border-hair">
          <UnderlineTabs
            tabs={STATEMENT_TABS}
            value={activeTabStr}
            shortLabels={{
              [STATEMENT_TABS[0]]: 'Cash Flow',
              [STATEMENT_TABS[1]]: 'P&L',
              [STATEMENT_TABS[2]]: 'Balance Sheet',
            }}
            onChange={(t) => {
              if (t === STATEMENT_TABS[0]) setView('cfs');
              else if (t === STATEMENT_TABS[1]) setView('pnl');
              else setView('balance');
            }}
            className="min-w-0"
          />
          <button
            type="button"
            onClick={() => downloadStatement(view, sim)}
            className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-ink hover:text-amber transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
        </div>

        {view === 'cfs' && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_1fr]">
            <div>
              <CfoStatementTable rows={cashRows(sim)} />
            </div>
            <div>
              <h4 className="text-[13px] font-medium text-ink mb-2">Cash Velocity &amp; Trajectory</h4>
              <CfoCashChart sim={sim} />
            </div>
          </div>
        )}

        {view === 'pnl' && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_1fr]">
            <div>
              <CfoStatementTable rows={profitRows(sim)} showPeriod={false} cumulativeLabel="Recognized / Potential AED" />
            </div>
            <div>
              <h4 className="text-[13px] font-medium text-ink mb-2">P&amp;L Potential vs. Realized</h4>
              <CfoProfitChart sim={sim} />
            </div>
          </div>
        )}

        {view === 'balance' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.2fr]">
              <div>
                <h4 className="text-[13px] font-medium text-ink mb-2">Balance Sheet Assets vs. Liabilities</h4>
                <CfoBalanceChart sim={sim} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
                <CfoMetric label="Total Assets" value={cfoMillions(c.totalAssets)} note="Cash + net land and WIP" />
                <CfoMetric label="Total Liabilities + Equity" value={cfoMillions(c.fundingTotal)} note="Debt + deposits + equity" />
                <div className={`sm:col-span-2 rounded-[18px] p-4 text-[12.5px] border ${
                  balanced ? 'bg-[#EFF6F1] text-[#2F5C44] border-[#CFE3D6]' : 'bg-[#FEECEA] text-[#96291D] border-[#FCD6D2]'
                }`}>
                  <b>Double-Entry Verification:</b> Residual is <b>{cfoAed(c.balanceDifference)}</b> (tolerance: AED 0.05).
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <CfoStatementTable rows={balance.assets} showPeriod={false} cumulativeLabel="Assets Snapshot" />
              <CfoStatementTable rows={balance.funding} showPeriod={false} cumulativeLabel="Funding Snapshot" />
            </div>
          </div>
        )}
      </EeshaanKolteyCard>
    </div>
  );
}
