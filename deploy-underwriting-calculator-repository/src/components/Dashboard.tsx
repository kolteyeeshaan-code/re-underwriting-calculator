import { useId, useState } from 'react';
import { fmtAedM, fmtNum, type Inputs, type SankeyData, type Simulation } from '../engine/treasuryEngine';
import { Modal } from './MicroMatrix';
import Sankey from './Sankey';
import MilestoneGantt from './MilestoneGantt';
import RepaymentLadder from './RepaymentLadder';
import { Badge, RoundBtn, Card as EeshaanKolteyCard, CardHead } from './eeshaan-koltey/ui';
import { Expand } from './eeshaan-koltey/icons';
import { ChangeFlash } from './ChangeFlash';

interface KpiProps {
  label: string;
  value: string;
  sub: string;
  tone?: 'amber' | 'neutral' | 'coral';
  className?: string;
}

function Kpi({ label, value, sub, tone = 'neutral', className = '' }: KpiProps) {
  return (
    <EeshaanKolteyCard variant={tone === 'amber' ? 'cream' : 'plain'} className={`min-w-0 p-4 sm:p-5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
        <span className="min-w-0 text-[10.5px] sm:text-[11.5px] font-normal uppercase tracking-wider text-muted">{label}</span>
        {tone === 'amber' && <Badge tone="amber" className="hidden xl:inline-flex">Primary</Badge>}
      </div>
      <div className="break-words text-[20px] sm:text-[24px] xl:text-[26px] font-light tracking-[-0.03em] text-ink tabular-nums">
        <ChangeFlash value={value}>{value}</ChangeFlash>
      </div>
      <div className="mt-1.5 text-[11.5px] sm:text-[12px] font-light text-muted leading-snug">{sub}</div>
    </EeshaanKolteyCard>
  );
}

export default function Dashboard({ sim, inputs }: { sim: Simulation; inputs: Inputs }) {
  const surplusPositive = sim.totalProjectSurplus >= 0;
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[21px] sm:text-[26px] font-light leading-tight tracking-[-0.02em] text-ink">
            Exec Committee Dashboard
          </h2>
          <p className="mt-0.5 text-[12.5px] sm:text-[13px] font-light text-muted">
            Underwriting snapshot for {fmtNum(sim.nsa)} sf NSA scheme at AED {fmtNum(inputs.sellingPricePsf)}/sf · {inputs.financingArr}% ARR over {inputs.projectDurationYears} yrs
          </p>
        </div>
        <Badge tone={surplusPositive ? 'mint' : 'coral'} dot>
          {surplusPositive ? `Profitable · ${sim.margin.toFixed(1)}% margin` : 'Funding Shortfall'}
        </Badge>
      </div>

      {sim.shortfall > 0 && (
        <EeshaanKolteyCard variant="flat" className="p-4 border-coral/30 bg-[#FEECEA]/60 text-[#96291D] text-[12.5px] sm:text-[13px]">
          <b>Funding Shortfall Alert:</b> GDV does not cover Total Development Cost by {fmtAedM(sim.shortfall)}.
          The repayment ladder settles obligations in priority order, so land partner return is impaired first.
        </EeshaanKolteyCard>
      )}

      {/* KPI row in Eeshaan Koltey Card style */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3.5 lg:grid-cols-5">
        <Kpi
          label="Gross Dev Value (GDV)"
          value={fmtAedM(sim.gdv)}
          sub={`${fmtNum(sim.nsa)} sf × AED ${fmtNum(inputs.sellingPricePsf)}`}
          tone="amber"
        />
        <Kpi
          label="Total Dev Cost (TDC)"
          value={fmtAedM(sim.totalDevelopmentCost)}
          sub="Land + debt principal + compounded financing"
        />
        <Kpi
          label="Debt Facility · Drawn"
          value={fmtAedM(sim.totalDrawnPrincipal)}
          sub={`of ${fmtAedM(sim.totalDebtFacility)} committed · ${sim.ltv.toFixed(1)}% of GDV`}
        />
        <Kpi
          label="Financing Cost Drag"
          value={fmtAedM(sim.totalFinancingCost)}
          sub={`${inputs.walletBHurdlePct}% hurdle on drawn B · ${sim.blendedFinancingMultiplier.toFixed(3)}× blended`}
        />
        <Kpi
          className="col-span-2 sm:col-span-1"
          label="Unallocated Project Surplus"
          value={fmtAedM(sim.totalProjectSurplus)}
          sub={`${sim.margin.toFixed(1)}% margin on GDV`}
          tone={surplusPositive ? 'amber' : 'coral'}
        />
      </div>

      {/* Stage-linked debt tranche strip */}
      <EeshaanKolteyCard variant="plain" className="p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hair pb-4 mb-4">
          <div className="min-w-0">
            <h3 className="text-[16px] sm:text-[17px] font-medium tracking-tight text-ink">Stage-linked Debt Tranche Schedule</h3>
            <p className="mt-0.5 text-[12px] sm:text-[12.5px] font-light text-muted">
              One pre-development draw, followed by 20%, 40%, 60%, 80% and Handover construction draws.
            </p>
          </div>
          <Badge tone={sim.totalUndrawnCapacity > 0.5 ? 'mint' : 'neutral'} dot>
            {fmtAedM(sim.totalUndrawnCapacity)} undrawn
          </Badge>
        </div>

        <div className="space-y-2">
          {sim.trancheSchedule.map((tranche) => {
            const capacityPct = sim.totalDebtFacility > 0 ? (tranche.capacity / sim.totalDebtFacility) * 100 : 0;
            const drawnShare = tranche.capacity > 0 ? (tranche.drawn / tranche.capacity) * 100 : 0;
            return (
              <div key={tranche.id} className="rounded-[18px] border border-hair bg-[rgba(246,247,249,0.7)] px-3.5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-ink" style={{ background: tranche.color }}>{tranche.id === 'predev' ? 'PD' : tranche.id}</span>
                    <div className="min-w-0">
                      <span className="block text-[12.5px] font-medium text-ink">{tranche.label}</span>
                      <span className="text-[11px] font-light text-muted">
                        {tranche.gate} · {tranche.drawPct >= 99.999 ? 'Fully drawn' : tranche.drawPct <= 0.001 ? 'Undrawn' : `${fmtNum(tranche.drawPct)}% drawn`} · M{tranche.drawMonth} · fee {fmtNum(tranche.commitmentFeePct, 2)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-baseline gap-3 text-right">
                    <span className="text-[12px] font-light tabular-nums text-muted">{fmtAedM(tranche.drawn)} drawn</span>
                    <span className="text-[13px] font-medium tabular-nums text-ink">{fmtAedM(tranche.capacity)}</span>
                  </div>
                </div>
                <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[rgba(22,24,28,0.06)]">
                  <div className="h-full" style={{ width: `${capacityPct * (drawnShare / 100)}%`, background: tranche.color }} />
                  <div className="h-full" style={{ width: `${capacityPct * (1 - drawnShare / 100)}%`, background: 'rgba(22,24,28,0.16)' }} />
                </div>
                <div className="mt-1 flex flex-wrap justify-between gap-x-3 text-[10.5px] font-light text-muted">
                  <span>{fmtAedM(tranche.interest)} interest · {fmtAedM(tranche.commitmentFee)} fee</span>
                  <span>{tranche.undrawn > 0.5 ? `${fmtAedM(tranche.interestSaved)} interest avoided` : 'No undrawn residual'}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-[18px] bg-[rgba(246,247,249,0.7)] px-4 py-3">
            <div className="text-[10.5px] font-medium uppercase tracking-wider text-muted">Undrawn capacity</div>
            <div className="mt-0.5 text-[18px] font-light tabular-nums text-ink"><ChangeFlash value={sim.totalUndrawnCapacity}>{fmtAedM(sim.totalUndrawnCapacity)}</ChangeFlash></div>
            <div className="text-[11px] font-light text-muted">funded by unlocked escrow</div>
          </div>
          <div className="rounded-[18px] bg-[rgba(246,247,249,0.7)] px-4 py-3">
            <div className="text-[10.5px] font-medium uppercase tracking-wider text-muted">Interest saved</div>
            <div className="mt-0.5 text-[18px] font-light tabular-nums text-ink"><ChangeFlash value={sim.interestSaved}>{fmtAedM(sim.interestSaved)}</ChangeFlash></div>
            <div className="text-[11px] font-light text-muted">less {fmtAedM(sim.commitmentFees)} commitment fees</div>
          </div>
          <div className="rounded-[18px] bg-[#FDF6E3] border border-[#FBE6A4] px-4 py-3">
            <div className="text-[10.5px] font-medium uppercase tracking-wider text-[#7A4A0E]">Incremental developer surplus</div>
            <div className="mt-0.5 text-[18px] font-light tabular-nums text-ink"><ChangeFlash value={sim.incrementalDeveloperSurplus}>{fmtAedM(sim.incrementalDeveloperSurplus)}</ChangeFlash></div>
            <div className="text-[11px] font-normal text-[#7A4A0E]">released into the priority ladder</div>
          </div>
        </div>
      </EeshaanKolteyCard>

      {/* 1 + 2 · Dual Sankey scoreboard in responsive grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SankeyCanvasCard
          index="1"
          title="Macro Underwriting & Fiscal Capitalization"
          subtitle="Land equity and the debt facility split into pre-development plus five buyer-gate draws; drawn cash flows once to project cost sinks."
          hint={`Committed facility ${fmtAedM(sim.totalDebtFacility)} · drawn ${fmtAedM(sim.totalDrawnPrincipal)} · undrawn ${fmtAedM(sim.totalUndrawnCapacity)} funded by unlocked escrow.`}
          data={sim.underwritingSankey}
          uidSeed="macro-flow"
          balanced={sim.underwritingFlowAudit.balanced}
        >
          <div className="grid grid-cols-2 gap-3 border-t border-hair px-5 py-3.5 text-xs sm:grid-cols-4 bg-[rgba(246,247,249,0.5)]">
            <MiniStat label="Total Debt Facility" value={fmtAedM(sim.totalDebtFacility)} />
            <MiniStat label="Drawn Principal" value={fmtAedM(sim.totalDrawnPrincipal)} />
            <MiniStat label="Undrawn Capacity" value={fmtAedM(sim.totalUndrawnCapacity)} />
            <MiniStat label="Interest & Fees" value={fmtAedM(sim.totalFinancingCost)} />
          </div>
        </SankeyCanvasCard>

        <SankeyCanvasCard
          index="2"
          title="Operational Escrow & Wallet Disbursement"
          subtitle="Upfront wallets deploy to site; buyer receipts transit the 3-way split and settle principal, interest, then land."
          hint="Site draws bypass DLD escrow; buyer deposits fund the principal-first settlement cascade."
          data={sim.escrowSankey}
          uidSeed="op-flow"
          balanced={sim.escrowFlowAudit.balanced}
        >
          <div className="grid grid-cols-2 gap-3 border-t border-hair px-5 py-3.5 text-xs sm:grid-cols-4 bg-[rgba(246,247,249,0.5)]">
            <MiniStat label="Unlocked Capital" value={fmtAedM(sim.unlockedPool)} />
            <MiniStat label="10% Retention" value={fmtAedM(sim.retentionPool)} />
            <MiniStat label="5% Defects Lock" value={fmtAedM(sim.defectsPool)} />
            <MiniStat label="Buyer Deposits to Hub" value={fmtAedM(sim.escrowFlowAudit.hubInflows)} />
          </div>
        </SankeyCanvasCard>
      </div>

      {/* Escrow detail strip */}
      <EeshaanKolteyCard
        variant="plain"
        className="p-4 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h3 className="text-[16px] sm:text-[17px] font-medium tracking-tight text-ink">
              Escrow Protection &amp; Wallet Composition
            </h3>
            <p className="mt-0.5 text-[12px] sm:text-[12.5px] font-light text-muted">
              Dubai Law No. 8 of 2007 three-way escrow split alongside dedicated upfront operating wallets.
            </p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <EscrowTier
            color="#7BB694"
            label="Milestone-Unlocked Operating Capital"
            value={sim.unlockedPool}
            pct={(sim.unlockedPool / Math.max(sim.gdv, 1)) * 100}
            note="GDV − retention − defects lock"
          />
          <EscrowTier
            color="#F4C74B"
            label={`${fmtNum(sim.retentionPctEff, 1)}% Active Project Retention`}
            value={sim.retentionPool}
            pct={sim.retentionPctEff}
            note="Withheld from draws until completion"
          />
          <EscrowTier
            color="#FA6C5D"
            label={`${sim.defectsPct}% Ring-Fenced Defects Liability`}
            value={sim.defectsPool}
            pct={sim.defectsPct}
            note={`Locked M${sim.handoverMonth} → M${sim.dlpEndMonth}`}
            locked
          />
          <EscrowTier
            color="#AEBEE9"
            label="Dedicated Site Wallets"
            value={sim.operatingWalletTotal}
            pct={(sim.operatingWalletTotal / Math.max(sim.gdv, 1)) * 100}
            note="Construction, working capital, soft costs & PMC"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="min-w-0">
            <h4 className="mb-2.5 text-[11.5px] sm:text-[12px] font-medium uppercase tracking-wider text-muted">
              Construction vs Collection Timeline · 12-Month Defects Liability Period
            </h4>
            <MilestoneGantt sim={sim} />
          </div>
          <div className="min-w-0 space-y-3">
            <h4 className="text-[11.5px] sm:text-[12px] font-medium uppercase tracking-wider text-muted">
              Wallet Composition &amp; Repayment Coverage
            </h4>
            <div className="space-y-2">
              {sim.walletLedger.map((wallet) => (
                <div
                  key={wallet.id}
                  className="rounded-[18px] bg-[rgba(246,247,249,0.7)] px-3.5 py-3 sm:px-4 border border-hair flex items-baseline justify-between gap-3"
                >
                  <div className="min-w-0">
                    <span className="text-[13px] font-medium text-ink">{wallet.label}</span>
                    <div className="text-[11.5px] font-light text-muted">{wallet.note}</div>
                  </div>
                  <span className="shrink-0 text-[13.5px] sm:text-[14px] font-medium tabular-nums text-ink">{fmtAedM(wallet.value)}</span>
                </div>
              ))}
            </div>

            <div
              className={`rounded-[18px] p-3.5 sm:p-4 text-[12px] sm:text-[12.5px] leading-relaxed border ${
                sim.repaymentShortfall > 0.05
                  ? 'bg-[#FEECEA] text-[#96291D] border-[#FCD6D2]'
                  : 'bg-[#EFF6F1] text-[#2F5C44] border-[#CFE3D6]'
              }`}
            >
              <b>Unlocked repayment coverage: {fmtNum(sim.repaymentCoveragePct, 1)}%.</b>{' '}
              {sim.repaymentShortfall > 0.05
                ? `${fmtAedM(sim.repaymentShortfall)} of principal, interest or land remains unsettled in this unlocked-pool view.`
                : `Principal, accrued interest and land are covered in full; ${fmtAedM(sim.unlockedSettlementSurplus)} surplus remains.`}
            </div>
          </div>
        </div>
      </EeshaanKolteyCard>

      {/* 3. Priority Ladder */}
      <EeshaanKolteyCard variant="plain" className="p-4 sm:p-6">
        <CardHead
          title="Capital Return Priority Repayment Ladder"
          sub="GDV settles obligations strictly bottom-up: financier principal → interest → land partner return → retained surplus"
          className="mb-4"
        />
        <RepaymentLadder sim={sim} />
      </EeshaanKolteyCard>
    </div>
  );
}

function EscrowTier({
  color,
  label,
  value,
  pct,
  note,
  locked,
}: {
  color: string;
  label: string;
  value: number;
  pct: number;
  note: string;
  locked?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-[20px] p-4 border ${
        locked ? 'bg-[#FEECEA]/70 border-[#FCD6D2]' : 'bg-white border-hair shadow-sm'
      }`}
    >
      <div className="flex items-start gap-2 text-[11px] font-normal uppercase tracking-wider text-muted">
        <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
        <span className="min-w-0">
          {locked && '🔒 '}
          {label}
        </span>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[19px] sm:text-[20px] font-light tabular-nums text-ink">{fmtAedM(value)}</span>
        <span className="shrink-0 text-[12px] font-medium tabular-nums text-muted">{pct.toFixed(1)}%</span>
      </div>
      <div className="text-[11.5px] font-light text-muted mt-0.5">{note}</div>
    </div>
  );
}

function SankeyCanvasCard({
  index,
  title,
  subtitle,
  hint,
  data,
  uidSeed,
  balanced,
  children,
}: {
  index: string;
  title: string;
  subtitle: string;
  hint: string;
  data: SankeyData;
  uidSeed: string;
  balanced: boolean;
  children?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const headingId = useId();

  return (
    <>
      <EeshaanKolteyCard className="min-w-0 flex flex-col overflow-hidden border-hair">
        <header className="flex items-start justify-between gap-3 border-b border-hair px-4 py-3.5 sm:px-5 sm:py-4 bg-[rgba(246,247,249,0.5)]">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-medium text-white">
              {index}
            </span>
            <div className="min-w-0">
              <h3 id={headingId} className="text-[14.5px] sm:text-[15px] font-medium tracking-tight text-ink">
                {title}
              </h3>
              <p className="mt-0.5 text-[12px] font-light text-muted leading-tight">{subtitle}</p>
            </div>
          </div>
          <RoundBtn
            icon={<Expand />}
            label="Expand Canvas"
            size={36}
            tone="outline"
            onClick={() => setExpanded(true)}
          />
        </header>

        <div className="p-3 bg-white/70 min-w-0">
          <p className="mb-1.5 text-[11px] font-light text-muted sm:hidden">
            ← Swipe diagram horizontally or tap any flow ribbon →
          </p>
          <Sankey
            uid={`${uidSeed}-mini`}
            data={data}
            width={1360}
            height={520}
            marginLeft={186}
            marginRight={196}
            minWidth={620}
            compact
            showInspector
            className="w-full"
            format={fmtAedM}
          />
        </div>

        <div className="mt-auto">{children}</div>
      </EeshaanKolteyCard>

      <Modal
        open={expanded}
        onClose={() => setExpanded(false)}
        size="fullscreen"
        closeLabel="Minimize Canvas"
        badge={`Diagram ${index}`}
        title={title}
        subtitle={hint}
        footerLeft={
          <span className={balanced ? 'text-[#2F5C44]' : 'text-[#96291D]'}>
            {balanced ? '✓ Flow conservation verified to AED 0.05.' : 'Review current capital allocations.'} Tap or hover any ribbon to inspect.
          </span>
        }
      >
        <div className="rounded-[18px] sm:rounded-[22px] bg-white p-3 sm:p-5 border border-hair">
          <Sankey
            uid={`${uidSeed}-modal`}
            data={data}
            width={1600}
            height={900}
            marginLeft={290}
            marginRight={300}
            minWidth={780}
            className="h-[64dvh] sm:h-[74vh] min-h-[340px] sm:min-h-[500px]"
            format={(v) => `AED ${fmtNum(v, 2)}`}
          />
        </div>
      </Modal>
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-normal uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-0.5 text-[13.5px] font-medium tabular-nums text-ink">{value}</div>
    </div>
  );
}
