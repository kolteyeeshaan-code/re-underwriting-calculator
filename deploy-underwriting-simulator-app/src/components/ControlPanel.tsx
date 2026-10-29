import {
  MILESTONE_KEYS,
  fmtNum,
  fmtAedM,
  parseNumericInput,
  parseTreasuryNumber,
  type Inputs,
  type MicroKey,
  type MicroState,
  type MilestoneKey,
  type Simulation,
} from '../engine/treasuryEngine';
import { Card, Field, Stat } from './ui';
import { AggregateStrip, MicroTable, Modal, type MicroRow } from './MicroMatrix';
import { PillBtn, Badge } from './eeshaan-koltey/ui';
import { Expand, Refresh } from './eeshaan-koltey/icons';
import { useState } from 'react';

interface Props {
  inputs: Inputs;
  micro: MicroState;
  sim: Simulation;
  update: (k: keyof Inputs, v: number) => void;
  updateMicro: (k: MicroKey, v: number) => void;
  resetMicro: () => void;
  reset: () => void;
  onNext: () => void;
}

const MILESTONE_META: Record<MilestoneKey, { label: string; sub: string; color: string }> = {
  buyerMilestone1: { label: 'Booking / 20% Milestone', sub: 'Ground & foundation', color: '#F4C74B' },
  buyerMilestone2: { label: '40% Milestone', sub: 'Structural core', color: '#F0A93B' },
  buyerMilestone3: { label: '60% Milestone', sub: 'MEP & facade', color: '#AEBEE9' },
  buyerMilestone4: { label: '80% Milestone', sub: 'Interior fit-out', color: '#8CA0DC' },
};

const C = {
  land: '#579973',
  closing: '#7BB694',
  hard: '#F4C74B',
  soft: '#AEBEE9',
  buffer: '#FA6C5D',
};

const pctOf = (v: number, total: number) => (total > 0 ? (v / total) * 100 : 0);
const aedFull = (v: number) => `AED ${fmtNum(v)}`;
const psf = (v: number) => `${fmtNum(v, 2)}`;

function ExpandButton({ onClick, count }: { onClick: () => void; count: string }) {
  return (
    <PillBtn
      tone="soft"
      onClick={onClick}
      icon={<Expand className="h-3.5 w-3.5" />}
      className="px-3 py-1.5 sm:px-4 sm:py-2 text-[12px] sm:text-[13px]"
    >
      <span>Expand Micro-Matrix</span>
      <span className="ml-1 rounded-full bg-[rgba(22,24,28,0.06)] px-2 py-0.5 text-[10.5px] font-medium text-ink">
        {count}
      </span>
    </PillBtn>
  );
}

interface Segment {
  label: string;
  value: number;
  color: string;
}

function MiniStack({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-[rgba(22,24,28,0.06)]">
        {segments.map((s) => (
          <div key={s.label} className="h-full transition-all" style={{ width: `${pctOf(s.value, total)}%`, background: s.color }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-[11.5px] font-light text-[#5F646B]">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label} <b className="tabular-nums text-[#16181C] font-medium">{pctOf(s.value, total).toFixed(0)}%</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function SummaryTile({
  title,
  value,
  unit,
  sub,
  segments,
  children,
  accent,
  className = '',
}: {
  title: string;
  value: string;
  unit: string;
  sub?: string;
  segments?: Segment[];
  children?: React.ReactNode;
  accent: string;
  className?: string;
}) {
  return (
    <div className={`relative flex min-w-0 sm:min-w-[220px] flex-1 basis-full sm:basis-[220px] flex-col overflow-hidden rounded-[20px] bg-white p-3.5 sm:p-4 border border-[rgba(22,24,28,0.08)] shadow-sm ${className}`}>
      <div className="absolute inset-y-0 left-0 w-1 rounded-l" style={{ background: accent }} />
      <div className="text-[11px] font-normal uppercase tracking-wider text-[#5F646B]">{title}</div>
      <div className="mt-1 flex flex-wrap items-baseline gap-1.5">
        <span className="text-[20px] sm:text-[22px] font-light tabular-nums tracking-tight text-[#16181C]">{value}</span>
        <span className="text-[12px] font-normal text-[#5F646B]">{unit}</span>
      </div>
      {sub && <div className="mt-0.5 break-words text-[11.5px] sm:text-[12px] font-light text-[#5F646B]">{sub}</div>}
      {segments && <div className="mt-3">{<MiniStack segments={segments} />}</div>}
      {children && <div className="mt-4 flex flex-wrap gap-3">{children}</div>}
    </div>
  );
}

const Formula = ({ children }: { children: React.ReactNode }) => (
  <code className="mt-1 block rounded-[12px] bg-[#16181C] px-3 py-2 font-mono text-[11px] text-[#F4C74B] leading-relaxed">
    {children}
  </code>
);

export default function ControlPanel({ inputs, micro, sim, update, updateMicro, resetMicro, reset, onNext }: Props) {
  const u = (k: keyof Inputs) => (v: number) => update(k, v);
  const [modal, setModal] = useState<null | 'land' | 'costs'>(null);
  const close = () => setModal(null);

  const gfa = sim.gfa;
  const hardTotal = inputs.constructionCostGfa;
  const softTotal = inputs.approvalsCostGfa;
  const bufferPct = inputs.escalationsPct + inputs.contingenciesPct;
  const bufferAed = sim.escalations + sim.contingencies;
  const loadedHard = hardTotal * (1 + bufferPct / 100);

  /* ---- land matrix rows ---- */
  const landRows: MicroRow[] = [
    {
      key: 'landPurchase',
      label: 'Land Purchase Price (Base)',
      sublabel: 'Agreed consideration for the plot',
      tip: (
        <>
          <b>Base land consideration.</b> Absolute agreed plot consideration.
          <Formula>Securitised Land Value = Purchase Price + Closing Costs</Formula>
        </>
      ),
      value: micro.landPurchase,
      unit: 'AED',
      step: 1_000_000,
      onChange: (v) => updateMicro('landPurchase', v),
      share: pctOf(micro.landPurchase, inputs.landValue),
      impact: fmtAedM(micro.landPurchase),
    },
    {
      key: 'landClosing',
      label: 'Closing Costs & Stamp Duty',
      sublabel: `Transaction costs · ${pctOf(micro.landClosing, micro.landPurchase).toFixed(2)}% of base`,
      tip: (
        <>
          <b>Transaction friction.</b> Capitalised DLD transfer fee (4%), registration and brokerage.
          <Formula>Closing % of base = Closing ÷ Purchase Price</Formula>
        </>
      ),
      value: micro.landClosing,
      unit: 'AED',
      step: 100_000,
      onChange: (v) => updateMicro('landClosing', v),
      share: pctOf(micro.landClosing, inputs.landValue),
      impact: fmtAedM(micro.landClosing),
    },
  ];

  /* ---- hard rows ---- */
  const hardRow = (key: MicroKey, label: string, sublabel: string, tipBody: string): MicroRow => ({
    key,
    label,
    sublabel,
    tip: (
      <>
        <b>{label}.</b> {tipBody}
        <Formula>AED impact = rate × GFA ({fmtNum(gfa)} sf)</Formula>
      </>
    ),
    value: micro[key],
    unit: 'AED / GFA sf',
    step: 1,
    onChange: (v) => updateMicro(key, v),
    share: pctOf(micro[key], hardTotal),
    impact: fmtAedM(micro[key] * gfa),
  });

  const hardRows: MicroRow[] = [
    hardRow('hardCivil', 'Site Prep & Civil Works', 'Enabling, excavation, piling, substructure', 'Enabling works, excavation, shoring and substructure packages.'),
    hardRow('hardStructural', 'Structural & Core Construction', 'Frame, slabs, vertical core, building envelope', 'Reinforced frame, slabs, vertical cores and facade envelope.'),
    hardRow('hardFinishes', 'Interior Fit-Out & Finishes', 'Internal finishes, joinery, MEP architectural fit-out', 'Internal finishes, joinery, fixtures and fit-out packages.'),
  ];

  const softRow = (key: MicroKey, label: string, sublabel: string, tipBody: string): MicroRow => ({
    key,
    label,
    sublabel,
    tip: (
      <>
        <b>{label}.</b> {tipBody}
        <Formula>AED impact = rate × GFA ({fmtNum(gfa)} sf)</Formula>
      </>
    ),
    value: micro[key],
    unit: 'AED / GFA sf',
    step: 0.5,
    onChange: (v) => updateMicro(key, v),
    share: pctOf(micro[key], softTotal),
    impact: fmtAedM(micro[key] * gfa),
  });

  const softRows: MicroRow[] = [
    softRow('softDesign', 'Architectural & Engineering Design', 'Concept through IFC drawings', 'Consultant design fees from concept through IFC.'),
    softRow('softPermits', 'Permits & Municipal Fees', 'DDA, Trakhees, DEWA, NOC clearances', 'Building permits, authority approvals and connection fees.'),
    softRow('softLegal', 'Legal & Professional Retainers', 'Counsel, audit, RERA escrow compliance', 'Legal counsel, audit and RERA escrow setup.'),
    softRow('softMarketing', 'Marketing & Sales Commissions', 'Launch gallery, campaigns, broker network', 'Launch campaign, sales gallery and brokerage.'),
  ];

  const bufferRows: MicroRow[] = [
    {
      key: 'escalationsPct',
      label: 'Project Escalations',
      sublabel: 'Price inflation cushion over build period',
      tip: (
        <>
          <b>Escalation premium</b> loaded on total Hard Costs.
          <Formula>Escalations = Hard × GFA × {inputs.escalationsPct}%</Formula>
        </>
      ),
      value: inputs.escalationsPct,
      unit: '% of Hard',
      step: 0.1,
      onChange: u('escalationsPct'),
      share: pctOf(inputs.escalationsPct, bufferPct),
      impact: fmtAedM(sim.escalations),
    },
    {
      key: 'contingenciesPct',
      label: 'Project Contingencies',
      sublabel: 'Unforeseen site and procurement risk',
      tip: (
        <>
          <b>Contingency premium</b> loaded on total Hard Costs.
          <Formula>Contingency = Hard × GFA × {inputs.contingenciesPct}%</Formula>
        </>
      ),
      value: inputs.contingenciesPct,
      unit: '% of Hard',
      step: 0.1,
      onChange: u('contingenciesPct'),
      share: pctOf(inputs.contingenciesPct, bufferPct),
      impact: fmtAedM(sim.contingencies),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Title + Action Toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[21px] sm:text-[26px] font-light leading-tight tracking-[-0.02em] text-[#16181C]">
            Underwriting Control Panel
          </h2>
          <p className="mt-0.5 text-[12.5px] sm:text-[13px] font-normal text-[#5F646B] max-w-2xl">
            Live parameter matrix. Adjust any parameter below to immediately recalculate the dual-Sankey capital flow, priority ladder, and debt multiplier.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PillBtn tone="soft" icon={<Refresh />} onClick={reset}>
            Reset Defaults
          </PillBtn>
          <PillBtn tone="dark" onClick={onNext}>
            View Exec Dashboard →
          </PillBtn>
        </div>
      </div>

      {/* High-level live metrics strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat tone="dark" label="Implied GFA" value={`${fmtNum(sim.gfa)} sf`} />
        <Stat tone="dark" label="Net Saleable Area" value={`${fmtNum(sim.nsa)} sf`} />
        <Stat tone="dark" label="Gross Dev Value" value={fmtAedM(sim.gdv)} />
        <Stat tone="dark" label="Total Dev Cost" value={fmtAedM(sim.totalDevelopmentCost)} />
        <Stat tone="dark" label="External Debt Req" value={fmtAedM(sim.externalDebtRequired)} />
        <Stat tone="amber" label="Project Surplus" value={fmtAedM(sim.totalProjectSurplus)} sub={`${sim.margin.toFixed(1)}% margin`} />
      </div>

      <div className="flex flex-wrap gap-5 sm:gap-6">
        {/* Card 1: Land */}
        <Card
          className="min-w-0 sm:min-w-[320px] flex-1 basis-full lg:basis-[460px]"
          icon="01"
          title="Land &amp; Asset Parameters"
          subtitle="Plot footprint and permissible envelope drive GFA and sellable economic area."
          right={<ExpandButton onClick={() => setModal('land')} count="2 items" />}
        >
          <div className="flex flex-wrap gap-4">
            <Field label="Plot Parcel Size" unit="sqft" value={inputs.parcelSize} onChange={u('parcelSize')} step={100} />
            <Field label="Permissible FAR" unit="x" value={inputs.far} onChange={u('far')} step={0.01} slider sliderMax={6} />
            <Field label="FAR Efficiency (E)" unit="%" value={inputs.farEfficiency} onChange={u('farEfficiency')} step={1} max={100} slider sliderMax={100} />
          </div>

          <SummaryTile
            className="mt-5"
            accent={C.land}
            title="Securitised Land Value · Aggregated"
            value={fmtAedM(inputs.landValue)}
            unit="AED"
            sub={`${aedFull(inputs.landValue)} = Base purchase + transaction friction`}
            segments={[
              { label: 'Purchase price', value: micro.landPurchase, color: C.land },
              { label: 'Closing & stamp duty', value: micro.landClosing, color: C.closing },
            ]}
          >
            <Field
              label="Override aggregate"
              unit="AED"
              value={Math.round(inputs.landValue)}
              onChange={u('landValue')}
              step={1_000_000}
              proRata
            />
          </SummaryTile>

          <p className="mt-4 text-[12px] font-normal text-[#5F646B]">
            GFA = {fmtNum(inputs.parcelSize)} × {inputs.far} = <b className="text-[#16181C]">{fmtNum(sim.gfa)} sf</b> · NSA ={' '}
            <b className="text-[#16181C]">{fmtNum(sim.nsa)} sf</b> · Land cost ={' '}
            <b className="text-[#16181C]">AED {fmtNum(inputs.landValue / Math.max(gfa, 1))}/GFA sf</b>
          </p>
        </Card>

        {/* Card 2: Revenue */}
        <Card
          className="min-w-0 sm:min-w-[300px] flex-1 basis-full lg:basis-[320px]"
          icon="02"
          title="Revenue &amp; Sales Modeling"
          subtitle="Gross Development Value = Net Sellable Area × target average selling rate."
        >
          <div className="flex flex-wrap gap-4">
            <Field label="Target Average Selling Rate" unit="AED / PSF" value={inputs.sellingPricePsf} onChange={u('sellingPricePsf')} step={25} slider sliderMax={6000} />
          </div>
          <div className="mt-5 rounded-[20px] bg-[#FBF7E9] p-4 sm:p-5 border border-[#F4C74B]/40">
            <div className="text-[11px] font-medium uppercase tracking-wider text-[#7A4A0E]">Implied GDV Potential</div>
            <div className="mt-1 text-[23px] sm:text-[26px] font-light tracking-tight text-[#16181C] tabular-nums">{fmtAedM(sim.gdv)}</div>
            <div className="text-[12px] font-normal text-[#5F646B] mt-1">
              {fmtNum(sim.nsa)} sf NSA × AED {fmtNum(inputs.sellingPricePsf)}/sf
            </div>
          </div>
        </Card>

        {/* Card 3: Hard & Soft Costs */}
        <Card
          className="min-w-0 sm:min-w-[320px] flex-1 basis-full lg:basis-[460px]"
          icon="03"
          title="Hard &amp; Soft Costs Management"
          subtitle="Construction and approvals aggregated from itemised rates; buffers load on top of Hard Costs."
          right={<ExpandButton onClick={() => setModal('costs')} count="9 items" />}
        >
          <div className="flex flex-wrap gap-4">
            <SummaryTile
              accent={C.hard}
              title="Target Construction Cost · Aggregated"
              value={psf(hardTotal)}
              unit="AED / GFA sf"
              sub={`${fmtAedM(sim.baseConstruction)} base construction`}
              segments={[
                { label: 'Civil', value: micro.hardCivil, color: '#F4C74B' },
                { label: 'Structural', value: micro.hardStructural, color: '#F0A93B' },
                { label: 'Finishes', value: micro.hardFinishes, color: '#D98A21' },
              ]}
            >
              <Field label="Override aggregate" unit="AED / GFA sf" value={Number(hardTotal.toFixed(2))} onChange={u('constructionCostGfa')} step={5} proRata />
            </SummaryTile>

            <SummaryTile
              accent={C.soft}
              title="Cost of Approvals · Aggregated"
              value={psf(softTotal)}
              unit="AED / GFA sf"
              sub={`${fmtAedM(sim.approvals)} soft budget`}
              segments={[
                { label: 'Design', value: micro.softDesign, color: '#AEBEE9' },
                { label: 'Permits', value: micro.softPermits, color: '#8CA0DC' },
                { label: 'Legal', value: micro.softLegal, color: '#6B81C4' },
                { label: 'Marketing', value: micro.softMarketing, color: '#DDE4F8' },
              ]}
            >
              <Field label="Override aggregate" unit="AED / GFA sf" value={Number(softTotal.toFixed(2))} onChange={u('approvalsCostGfa')} step={1} proRata />
            </SummaryTile>
          </div>

          <div className="mt-4 rounded-[18px] bg-[#FDF6E3] p-4 border border-[#FBE6A4] text-[12.5px] text-[#7A4A0E]">
            <div className="font-semibold uppercase tracking-wider text-[11px] mb-0.5">Project Buffer Allocation</div>
            <div>
              +{bufferPct.toFixed(1)}% on Hard Costs · <b>{fmtAedM(bufferAed)}</b> (Escalations: {inputs.escalationsPct}% · Contingencies: {inputs.contingenciesPct}%) · Loaded rate: <b>{psf(loadedHard)}</b> / GFA sf
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-4">
            <Field label="PMC Fee Charges" unit="%" value={inputs.pmcChargesPct} onChange={u('pmcChargesPct')} step={0.1} slider sliderMax={15} />
            <Field label="Working Capital Allotment" unit="AED / GFA sf" value={inputs.workingCapitalGfa} onChange={u('workingCapitalGfa')} step={5} hint="Starting operational cash buffer" />
          </div>
          <p className="mt-4 text-[12px] font-normal text-[#5F646B]">
            Direct development cost (pre-VAT): <b className="text-[#16181C]">{fmtAedM(sim.directDevelopmentCosts)}</b>
          </p>
        </Card>

        {/* Card 4: Debt & Capitalization */}
        <Card
          className="min-w-0 sm:min-w-[300px] flex-1 basis-full lg:basis-[320px]"
          icon="04"
          title="Debt &amp; Capitalization Settings"
          subtitle="Financier return compounds annually on non-land principal; VAT is bridged and recovered via the FTA loop."
        >
          <div className="flex flex-wrap gap-4">
            <Field label="Financing ARR Rate" unit="% p.a." value={inputs.financingArr} onChange={u('financingArr')} step={0.25} slider sliderMax={30} />
            <Field label="Project Duration" unit="years" value={inputs.projectDurationYears} onChange={u('projectDurationYears')} step={0.5} slider sliderMax={8} />
            <Field label="UAE VAT Layer" unit="%" value={inputs.vatRate} onChange={u('vatRate')} step={0.5} slider sliderMax={15} />
          </div>
          <p className="mt-4 text-[12px] font-normal text-[#5F646B]">
            Trailing compounded interest carry: <b className="text-[#16181C]">{fmtAedM(sim.totalFinancingCost)}</b> ({sim.nonLandDebtMultiplier.toFixed(3)}× on non-land costs)
          </p>
        </Card>
      </div>

      {/* Card 5: Escrow Milestones & Dubai Law No. 8 */}
      <Card
        icon="05"
        title="Buyer Escrow Milestone Schedules"
        subtitle="Progressive collection triggers mapped to construction progress gates under Dubai Law No. 8 of 2007."
      >
        <div className="flex flex-wrap gap-6 lg:gap-8">
          <div className="min-w-0 sm:min-w-[320px] flex-[3] basis-full lg:basis-[520px] space-y-5">
            {MILESTONE_KEYS.map((k) => {
              const m = MILESTONE_META[k];
              return (
                <div key={k}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2.5">
                    <div className="min-w-0">
                      <span className="inline-block h-2.5 w-2.5 rounded-full align-middle mr-1.5" style={{ background: m.color }} />
                      <span className="text-[13px] sm:text-[13.5px] font-medium text-[#16181C]">{m.label}</span>{' '}
                      <span className="block sm:inline text-[11px] sm:text-[11.5px] font-light text-muted">{m.sub}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="hidden text-[12px] font-light text-muted sm:inline">{fmtAedM(sim.gdv * (inputs[k] / 100))}</span>
                      <div className="eeshaan-koltey-field flex items-center px-2 py-1 bg-white">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={100}
                          step={1}
                          value={inputs[k]}
                          aria-label={`${m.label} collection percentage`}
                          onChange={(e) => update(k, parseNumericInput(e.target.value))}
                          className="w-12 sm:w-14 text-right text-[13px] font-medium tabular-nums outline-none text-[#16181C]"
                        />
                        <span className="ml-1 text-[11px] font-light text-muted">%</span>
                      </div>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={inputs[k]}
                    aria-label={`${m.label} collection slider`}
                    onChange={(e) => update(k, parseTreasuryNumber(e.currentTarget.valueAsNumber, 100))}
                    className="range-amber h-2 w-full cursor-pointer appearance-none rounded-full bg-[rgba(22,24,28,0.1)]"
                  />
                </div>
              );
            })}

            <div className="rounded-[20px] bg-[rgba(246,247,249,0.7)] p-3.5 sm:p-4 border border-[rgba(22,24,28,0.06)]">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-1 text-[12.5px] sm:text-[13px]">
                <span className="font-medium text-[#16181C]">Total collection schedule</span>
                <span className="font-bold tabular-nums text-amber">{(sim.milestoneSum + sim.handoverPct).toFixed(0)}% of GDV</span>
              </div>
              <div className="flex h-3.5 overflow-hidden rounded-full bg-[rgba(22,24,28,0.08)]">
                {MILESTONE_KEYS.map((k) => (
                  <div
                    key={k}
                    style={{ width: `${inputs[k]}%`, background: MILESTONE_META[k].color }}
                    className="flex items-center justify-center text-[9px] font-bold text-ink transition-all"
                  >
                    {inputs[k] >= 8 ? `${inputs[k]}%` : ''}
                  </div>
                ))}
                <div style={{ width: `${sim.handoverPct}%` }} className="flex items-center justify-center bg-ink text-[9px] font-bold text-white transition-all">
                  {sim.handoverPct >= 8 ? `${sim.handoverPct}%` : ''}
                </div>
              </div>
              <p className="mt-2 text-[12px] font-light text-muted">
                Handover tranche (auto-balanced remainder): <b className="text-[#16181C]">{sim.handoverPct}%</b> · {fmtAedM(sim.gdv * (sim.handoverPct / 100))}
              </p>
            </div>
          </div>

          <div className="min-w-0 sm:min-w-[260px] flex-1 basis-full lg:basis-[260px]">
            <Field
              label="Statutory RERA Escrow Retention"
              unit="%"
              value={inputs.reraRetentionPct}
              onChange={u('reraRetentionPct')}
              step={0.5}
              max={100 - sim.defectsPct}
              slider
              sliderMax={25}
              hint="Trapped in escrow until building completion."
            />
            <div className="mt-4 rounded-[18px] bg-white p-3.5 border border-hair shadow-sm">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-medium text-[#16181C]">Post-handover defects lock</span>
                <Badge tone="amber">🔒 5% fixed by law</Badge>
              </div>
              <p className="mt-1.5 text-[11.5px] font-light text-muted leading-relaxed">
                Non-negotiable statutory holdback under Dubai Law No. 8 of 2007: locked for 12 months post-handover.
              </p>
            </div>
            <div className="mt-4 space-y-2">
              <Stat label="Milestone-unlocked operating capital" value={fmtAedM(sim.unlockedPool)} sub="GDV − retention − defects lock" />
            </div>
          </div>
        </div>

        {/* Dubai Law No. 8 framework summary panel */}
        <div className="mt-6 overflow-hidden rounded-[22px] border border-[rgba(22,24,28,0.08)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 bg-[rgba(246,247,249,0.8)] border-b border-[rgba(22,24,28,0.06)]">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-ink px-2.5 py-0.5 text-[10px] font-medium text-white uppercase tracking-wider">Regulatory</span>
              <h4 className="text-[14px] font-medium text-[#16181C]">Dubai Law No. 8 of 2007 Framework</h4>
            </div>
            <span className="text-[11.5px] font-light text-muted">Dual-tier ring-fenced escrow protection</span>
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <div className="rounded-[18px] bg-[rgba(246,247,249,0.6)] p-4 border border-hair">
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted">{fmtNum(sim.retentionPctEff, 1)}% Active Project Retention</span>
                <span className="text-[11px] font-normal text-muted">M0 → M{sim.handoverMonth}</span>
              </div>
              <div className="text-[22px] font-light tracking-tight tabular-nums text-[#16181C]">{fmtAedM(sim.retentionPool)}</div>
              <p className="mt-1 text-[11.5px] font-light text-muted">Trapped inside the escrow network until the building is certified as complete.</p>
            </div>

            <div className="rounded-[18px] bg-[#FDF6E3] p-4 border border-[#FBE6A4]">
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-[11px] font-medium uppercase tracking-wider text-[#7A4A0E]">🔒 5% Defects Liability Pool</span>
                <span className="text-[11px] font-medium text-[#7A4A0E]">M{sim.handoverMonth} → M{sim.dlpEndMonth}</span>
              </div>
              <div className="text-[22px] font-light tracking-tight tabular-nums text-[#16181C]">{fmtAedM(sim.defectsPool)}</div>
              <p className="mt-1 text-[11.5px] font-normal text-[#7A4A0E]">
                Locked for 12 months post-handover. RERA may release directly to third-party contractors if defects are ignored.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Modal: Land Micro-Matrix */}
      <Modal
        open={modal === 'land'}
        onClose={close}
        badge="Card 1 · Micro-Matrix"
        title="Securitised Land Value · Itemised Matrix"
        subtitle="Decompose acquisition consideration and closing friction. Aggregates update the engine live."
        footerLeft={
          <span>Committed: <b className="text-ink">{aedFull(inputs.landValue)}</b></span>
        }
      >
        <AggregateStrip
          items={[
            { label: 'Securitised Land Value', value: fmtAedM(inputs.landValue), sub: 'Σ line items' },
            { label: 'Closing % of Base', value: `${pctOf(micro.landClosing, micro.landPurchase).toFixed(2)}%` },
            { label: 'Land Cost / GFA sf', value: `AED ${fmtNum(inputs.landValue / Math.max(gfa, 1))}`, sub: `${fmtNum(gfa)} sf GFA` },
            { label: 'Land % of GDV', value: `${pctOf(inputs.landValue, sim.gdv).toFixed(1)}%` },
          ]}
        />
        <MicroTable
          title="Land Acquisition Matrix"
          description="Purchase price and capitalised closing costs."
          accent={C.land}
          inputHeader="Amount (AED)"
          impactHeader="Budget (AED M)"
          rows={landRows}
          totalLabel="Securitised Land Value"
          totalValue={fmtNum(inputs.landValue)}
          totalImpact={fmtAedM(inputs.landValue)}
        />
        <div className="flex justify-end">
          <button onClick={resetMicro} className="text-[12px] font-normal text-muted hover:text-ink transition-colors">
            Restore baseline ratios
          </button>
        </div>
      </Modal>

      {/* Modal: Costs Micro-Matrix */}
      <Modal
        open={modal === 'costs'}
        onClose={close}
        badge="Card 3 · Micro-Matrix"
        title="Hard, Soft &amp; Buffer Cost Matrix"
        subtitle="Itemised line items rolling up into Target Construction Cost, Cost of Approvals and buffer premiums."
        footerLeft={
          <span>
            Hard: <b className="text-ink">{psf(hardTotal)}</b> · Soft: <b className="text-ink">{psf(softTotal)}</b> · Buffers: <b className="text-ink">+{bufferPct.toFixed(1)}%</b>
          </span>
        }
      >
        <AggregateStrip
          items={[
            { label: 'Target Construction Cost', value: `${psf(hardTotal)}`, sub: 'AED / GFA sf (Σ hard)' },
            { label: 'Cost of Approvals', value: `${psf(softTotal)}`, sub: 'AED / GFA sf (Σ soft)' },
            { label: 'Loaded Hard Rate', value: `${psf(loadedHard)}`, sub: `incl. +${bufferPct.toFixed(1)}% buffers` },
            { label: 'Direct Dev Cost', value: fmtAedM(sim.directDevelopmentCosts), sub: 'pre-VAT' },
          ]}
        />

        <MicroTable
          title="Hard Costs Table"
          description="Priced in AED per GFA sf. Sum aggregates to Target Construction Cost."
          accent={C.hard}
          inputHeader="Rate (AED/sf)"
          impactHeader="Budget (AED M)"
          rows={hardRows}
          totalLabel="Total Hard Costs"
          totalValue={`${psf(hardTotal)} /sf`}
          totalImpact={fmtAedM(sim.baseConstruction)}
        />

        <MicroTable
          title="Soft Costs Table"
          description="Priced in AED per GFA sf. Sum aggregates to Cost of Approvals."
          accent={C.soft}
          inputHeader="Rate (AED/sf)"
          impactHeader="Budget (AED M)"
          rows={softRows}
          totalLabel="Total Soft Costs"
          totalValue={`${psf(softTotal)} /sf`}
          totalImpact={fmtAedM(sim.approvals)}
        />

        <MicroTable
          title="Project Buffers Table"
          description="Premium multipliers loaded on top of calculated total Hard Costs."
          accent={C.buffer}
          inputHeader="Loading (%)"
          impactHeader="Budget (AED M)"
          rows={bufferRows}
          totalLabel="Total Buffer Premium"
          totalValue={`+${bufferPct.toFixed(1)}%`}
          totalImpact={fmtAedM(bufferAed)}
        />

        <div className="flex items-center justify-between">
          <span className="text-[12px] font-light text-muted">
            PMC charges ({inputs.pmcChargesPct}%) set on the main card.
          </span>
          <button onClick={resetMicro} className="text-[12px] font-normal text-muted hover:text-ink transition-colors">
            Restore baseline ratios
          </button>
        </div>
      </Modal>
    </div>
  );
}
