import { useId, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  PRODUCT_TYPOLOGIES,
  VIABILITY_DEFAULTS,
  vFmtM,
  vFmtNum,
  vFmtPct,
  type ProductTypology,
  type SensitivityRow,
  type ViabilityInputs,
  type ViabilitySimulationController,
} from '../engine/viabilityEngine';
import { Card as EeshaanKolteyCard, PillBtn } from './eeshaan-koltey/ui';
import { Sparkles, Download } from './eeshaan-koltey/icons';
import BenchmarkAnalyzer from './BenchmarkAnalyzer';
import WcMicroBudgetPanel from './WcMicroBudgetPanel';
import { EkSlider } from './EkSlider';
import { ChangeFlash } from './ChangeFlash';

/* ---------------------------------------------------------- local glass UI */
function Panel({
  title,
  subtitle,
  children,
  className = '',
  right,
  variant = 'plain',
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  right?: React.ReactNode;
  variant?: 'plain' | 'cream' | 'flat';
}) {
  return (
    <EeshaanKolteyCard variant={variant} className={`min-w-0 p-4 sm:p-6 ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(22,24,28,0.08)] pb-4 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 shrink-0 rounded-full bg-[#F4C74B]" />
            <h3 className="text-[15.5px] sm:text-[16px] font-medium tracking-tight text-[#16181C]">{title}</h3>
          </div>
          {subtitle && <p className="mt-0.5 text-[12px] sm:text-[12.5px] font-normal text-[#5F646B]">{subtitle}</p>}
        </div>
        {right}
      </header>
      <div>{children}</div>
    </EeshaanKolteyCard>
  );
}

function NumField({
  label,
  value,
  onChange,
  unit,
  step = 1,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
}) {
  const id = useId();
  return (
    <div className="min-w-0 flex-1 basis-[150px]">
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-medium text-[#16181C]">{label}</label>
      <div className="eeshaan-koltey-field flex items-center px-3 py-2 bg-white">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          className="w-full min-w-0 bg-transparent text-[13.5px] font-medium text-[#16181C] outline-none tabular-nums"
        />
        {unit && (
          <span className="ml-2 text-[11px] font-medium text-[#5F646B] uppercase tracking-wider whitespace-nowrap">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const id = useId();
  return (
    <div className="min-w-0 flex-1 basis-[190px]">
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-medium text-[#16181C]">{label}</label>
      <div className="eeshaan-koltey-field flex items-center px-3 py-2 bg-white">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 cursor-pointer appearance-none bg-transparent text-[13.5px] font-medium text-[#16181C] outline-none"
        >
          {options.map((option) => (
            <option key={option} value={option} className="text-[#16181C]">
              {option}
            </option>
          ))}
        </select>
        <span className="ml-1 text-[10px] text-[#5F646B]">▼</span>
      </div>
    </div>
  );
}

function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  display,
  delta,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
  display: string;
  delta?: string;
}) {
  return (
    <div className="rounded-[20px] border border-[rgba(22,24,28,0.08)] bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-medium text-[#16181C]">{label}</span>
        <span className="text-[14px] font-semibold tabular-nums text-[#16181C]">
          {display}
          {unit ? <span className="ml-0.5 text-[11px] font-normal text-[#5F646B]">{unit}</span> : null}
        </span>
      </div>
      <EkSlider
        label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
      />
      <div className="mt-1.5 flex justify-between text-[11px] text-[#5F646B]">
        <span>{vFmtNum(min, min < 10 ? 1 : 0)}</span>
        {delta && <span className="font-medium text-[#16181C]">{delta}</span>}
        <span>{vFmtNum(max, max < 10 ? 1 : 0)}</span>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  tone = 'light',
  className = '',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'light' | 'amber' | 'dark';
  className?: string;
}) {
  const toneCls =
    tone === 'amber'
      ? 'surface-cream border border-[#F4C74B]/40'
      : tone === 'dark'
        ? 'bg-[#16181C] text-white shadow-md'
        : 'surface';
  const labelCls = tone === 'dark' ? 'text-white/70' : 'text-[#5F646B]';
  const valCls = tone === 'dark' ? 'text-white' : 'text-[#16181C]';
  const subCls = tone === 'dark' ? 'text-white/60' : 'text-[#5F646B]';
  return (
    <div className={`min-w-0 rounded-[20px] sm:rounded-[22px] p-3.5 sm:p-4 ${toneCls} ${className}`}>
      <div className={`min-h-[2.4em] break-words text-[10px] sm:text-[11px] leading-[1.2] font-normal uppercase tracking-wider ${labelCls}`}>{label}</div>
      <div className={`mt-1 break-words text-[19px] sm:text-[22px] xl:text-[24px] font-light tracking-[-0.03em] tabular-nums ${valCls}`}><ChangeFlash value={value}>{value}</ChangeFlash></div>
      {sub && <div className={`text-[11.5px] sm:text-[12px] font-normal mt-0.5 ${subCls}`}>{sub}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- chart tooltips */
function AllocTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-[16px] bg-[#16181C] px-3.5 py-2.5 text-[12px] text-white shadow-xl">
      <div className="font-normal text-white/70">{p.name}</div>
      <div className="font-semibold text-white tabular-nums mt-0.5">{vFmtM(p.value)}</div>
    </div>
  );
}

function BarTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[16px] bg-[#16181C] px-3.5 py-2.5 text-[12px] text-white shadow-xl">
      <div className="font-normal text-white/70">{label}</div>
      <div className="font-semibold text-white tabular-nums mt-0.5">AED {vFmtNum(payload[0].value, 1)} / GFA sf</div>
    </div>
  );
}

/* ------------------------------------------------- high-contrast status tone */
function rowTone(r: SensitivityRow, targetMarginPercent: number) {
  if (r.grossMarginPercent < 0) {
    return {
      row: 'bg-[#FEECEA] hover:bg-[#FCD6D2]/60',
      metric: 'font-semibold text-[#96291D]',
      labelText: 'text-[#96291D]',
      chip: 'bg-[#FCD6D2] text-[#6B1D14] border border-[#FBB0A8]',
      status: 'Loss Territory',
    };
  }
  if (r.grossMarginPercent <= targetMarginPercent) {
    return {
      row: 'bg-[#FDF6E3] hover:bg-[#FBE6A4]/40',
      metric: 'font-semibold text-[#7A4A0E]',
      labelText: 'text-[#7A4A0E]',
      chip: 'bg-[#FBE6A4] text-[#7A4A0E] border border-[#F9D97E]',
      status: 'Below Target Margin',
    };
  }
  return {
    row: 'bg-[#EFF6F1] hover:bg-[#DFEDE4]/60',
    metric: 'font-semibold text-[#2F5C44]',
    labelText: 'text-[#224332]',
    chip: 'bg-[#DFEDE4] text-[#224332] border border-[#CFE3D6]',
    status: 'Meets Target Hurdle',
  };
}

/* ======================================================================= */
export default function ViabilitySpotlight({
  simulation,
  onSeedUnderwriting,
  onSeedCfo,
}: {
  simulation: ViabilitySimulationController;
  onSeedUnderwriting: () => void;
  onSeedCfo: () => void;
}) {
  const { inputs, result, underwritingBaseline, update, updateNum, reset } = simulation;
  const seedHelpId = useId();

  const set = (k: keyof ViabilityInputs) => (v: number) => updateNum(k, v);

  const [landAnchor, setLandAnchor] = useState(() => inputs.quotedLandPrice);
  const landRangeBase = landAnchor > 0 ? landAnchor : 1;
  const landMin = landRangeBase * 0.2;
  const landMax = landRangeBase * 3.0;

  const setLandPrice = (v: number) => {
    updateNum('quotedLandPrice', v);
    if (v > 0) setLandAnchor(v);
  };

  const handleReset = () => {
    reset();
    setLandAnchor(VIABILITY_DEFAULTS.quotedLandPrice);
  };

  const targetRow = result.sensitivity.find((r) => r.id === 'target');
  const baselineMargin = targetRow?.grossMarginPercent ?? 0;
  const effDelta = result.totalDevCostPsfNsa;
  const gapPositive = result.gapToMarket >= 0;

  const constructionPhases = result.constructionDrawdowns;
  const constructionMetrics = result.constructionCostMetrics;
  const peakConstructionPhase = constructionPhases.reduce(
    (peak, phase) => (phase.allInCostAed > peak.allInCostAed ? phase : peak),
    constructionPhases[0],
  );
  const openingConstructionPhase = constructionPhases[0];
  const finalConstructionPhase = constructionPhases[constructionPhases.length - 1];
  const totalConstructionFunding = finalConstructionPhase?.cumulativeFundingAed ?? 0;
  const programmeMonths = constructionMetrics.projectDurationMonths;
  const programmeLabel = `${vFmtNum(programmeMonths, programmeMonths % 1 === 0 ? 0 : 1)} months`;

  return (
    <div className="space-y-6">
      {/* Page Title & Intro */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[21px] sm:text-[26px] font-light leading-tight tracking-[-0.02em] text-[#16181C]">
            Capital Origination &amp; Macro Feasibility
          </h2>
          <p className="mt-0.5 text-[12.5px] sm:text-[13px] font-normal text-[#5F646B] max-w-2xl">
            Plot scanning, cost-approach underwriting and institutional 4-tier strategic sensitivity simulation.
          </p>
        </div>
        <PillBtn tone="soft" onClick={handleReset}>
          Reset Assumptions
        </PillBtn>
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3.5 lg:grid-cols-5">
        <Metric
          tone="dark"
          label="Max GFA Envelope"
          value={`${vFmtNum(result.maxGfa)} sf`}
          sub={`NSA ${vFmtNum(result.nsa)} sf @ ${vFmtPct(inputs.nsaEfficiency, 1)}`}
        />
        <Metric
          label="Effective Land Basis"
          value={vFmtM(result.landEffective)}
          sub={`AED ${vFmtNum(result.landCostPsfGfa, 0)}/GFA sf`}
        />
        <Metric
          label="Total Dev Cost / NSA"
          value={`AED ${vFmtNum(result.totalDevCostPsfNsa, 0)}`}
          sub="cost-approach all-in rate"
        />
        <Metric
          tone="amber"
          label="Baseline Breakeven Floor"
          value={`AED ${vFmtNum(result.breakevenPsf, 0)}`}
          sub={`incl. ${vFmtPct(result.totalSalesLeakage, 0)} sales leakage`}
        />
        <Metric
          className="col-span-2 sm:col-span-1"
          label="Gap to Market Comp"
          value={`${gapPositive ? '+' : ''}AED ${vFmtNum(result.gapToMarket, 0)}`}
          sub={gapPositive ? 'positive underwriting alpha' : 'below market floor'}
        />
      </div>

      <BenchmarkAnalyzer inputs={inputs} result={result} />

      {/* Sync Card */}
      <EeshaanKolteyCard variant="cream" className="p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1 basis-full md:basis-[320px]">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber text-ink text-[12px] font-bold">
                ⚡
              </span>
              <h3 className="text-[15.5px] sm:text-[16px] font-medium text-[#16181C]">Cross-Workspace Underwriting Sync</h3>
            </div>
            <p id={seedHelpId} className="mt-1 text-[12px] sm:text-[12.5px] font-normal text-[#5F646B] leading-relaxed">
              Push validated plot envelope, land basis, market rate and duration directly to Workspace 2 (Treasury) or Workspace 3 (SPV CFO).
            </p>
          </div>
          <div className="flex w-full sm:w-auto flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
            <PillBtn
              tone="amber"
              icon={<Sparkles />}
              onClick={onSeedUnderwriting}
              disabled={!underwritingBaseline.valid}
              className="w-full sm:w-auto"
            >
              Seed to Treasury Workspace
            </PillBtn>
            <PillBtn
              tone="dark"
              icon={<Download />}
              onClick={onSeedCfo}
              disabled={!underwritingBaseline.valid}
              className="w-full sm:w-auto"
            >
              Seed to CFO Workspace
            </PillBtn>
          </div>
        </div>
      </EeshaanKolteyCard>

      {/* Inputs + live sliders */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title="Plot &amp; Asset Parameters" subtitle="Core parcel geometry, planning envelopes and land acquisition friction." className="lg:col-span-2">
          <div className="flex flex-wrap gap-4">
            <NumField label="Plot Area" unit="sqft" step={0.01} value={inputs.plotArea} onChange={set('plotArea')} />
            <NumField label="Permissible FAR" unit="x" step={0.01} value={inputs.permissibleFar} onChange={set('permissibleFar')} />
            <NumField label="Quoted Land Price" unit="AED" step={100000} value={inputs.quotedLandPrice} onChange={setLandPrice} />
            <NumField label="Market Comp Price" unit="AED/sf" step={25} value={inputs.marketCompPsf} onChange={set('marketCompPsf')} />
            <NumField label="DLD Transfer Fee" unit="%" step={0.1} value={inputs.landDldFee} onChange={set('landDldFee')} />
            <NumField label="Land Brokerage" unit="%" step={0.1} value={inputs.landBrokerage} onChange={set('landBrokerage')} />
            <SelectField
              label="Product Typology"
              value={inputs.productTypology}
              onChange={(v) => update('productTypology', v as ProductTypology)}
              options={PRODUCT_TYPOLOGIES}
            />
          </div>

          <label className="mt-4 flex w-full sm:w-fit max-w-full cursor-pointer items-start sm:items-center gap-3 rounded-[18px] border border-[rgba(22,24,28,0.08)] bg-white px-3.5 py-2.5 sm:px-4">
            <input
              type="checkbox"
              className="mt-0.5 sm:mt-0 h-4 w-4 shrink-0 accent-amber cursor-pointer rounded"
              checked={inputs.landPriceInclusive}
              onChange={(e) => update('landPriceInclusive', e.target.checked)}
            />
            <span className="min-w-0 text-[12.5px] sm:text-[13px] font-normal text-[#16181C] leading-snug">
              Land price is inclusive of transaction costs
              <span className="block sm:inline sm:ml-1 text-[11.5px] font-light text-[#5F646B]">
                {inputs.landPriceInclusive ? '(no fee uplift applied)' : `(+${(inputs.landDldFee + inputs.landBrokerage).toFixed(1)}% DLD & brokerage)`}
              </span>
            </span>
          </label>

          <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <SliderField
              label="NSA Efficiency Ratio"
              unit="%"
              display={vFmtPct(inputs.nsaEfficiency, 1)}
              value={inputs.nsaEfficiency}
              onChange={set('nsaEfficiency')}
              min={55}
              max={92}
              step={0.5}
              delta={`Impact: AED ${vFmtNum(effDelta, 0)}/NSA sf`}
            />
            <SliderField
              label="Quoted Land Price"
              unit="AED"
              display={vFmtM(inputs.quotedLandPrice)}
              value={Math.min(landMax, Math.max(landMin, inputs.quotedLandPrice))}
              onChange={setLandPrice}
              min={landMin}
              max={landMax}
              step={100000}
              delta={`Effective: ${vFmtM(result.landEffective)}`}
            />
          </div>
        </Panel>

        <Panel title="Build, Soft &amp; Working Capital" subtitle="Physical and consulting expenditure budgeted per GFA sf.">
          <div className="flex flex-wrap gap-3">
            <NumField label="Base Construction" unit="AED/GFA" step={5} value={inputs.constructionPsfGfa} onChange={set('constructionPsfGfa')} />
            <NumField label="Approvals & Soft" unit="AED/GFA" step={1} value={inputs.approvalsPsfGfa} onChange={set('approvalsPsfGfa')} />
            <NumField label="PMC Fee" unit="%" step={0.1} value={inputs.pmcPercent} onChange={set('pmcPercent')} />
            <NumField label="Escalation Buffer" unit="%" step={0.1} value={inputs.escalationPercent} onChange={set('escalationPercent')} />
            <NumField label="Contingency Buffer" unit="%" step={0.1} value={inputs.contingencyPercent} onChange={set('contingencyPercent')} />
            <NumField label="Financing ARR" unit="%" step={0.25} value={inputs.financingArr} onChange={set('financingArr')} />
            <NumField label="Project Duration" unit="years" step={0.5} min={0.5} value={inputs.projectDurationYears} onChange={set('projectDurationYears')} />
          </div>

          <div className="mt-4 rounded-[20px] border border-[rgba(22,24,28,0.08)] bg-white p-4">
            <div className="text-[11px] font-normal uppercase tracking-wider text-[#5F646B]">
              Working capital wallet allocations (flat PSF GFA)
            </div>
            <div className="mt-2.5 grid grid-cols-2 sm:flex sm:flex-wrap gap-2 text-[12px]">
              {([
                ['Office/Team', 'wcOfficeTeam'],
                ['Marketing', 'wcMarketing'],
                ['Hospitality', 'wcHospitality'],
                ['Legal', 'wcLegal'],
                ['RERA', 'wcRera'],
                ['Reserve', 'wcReserve'],
              ] as [string, keyof ViabilityInputs][]).map(([lbl, key]) => (
                <div key={key} className="flex items-center justify-between gap-1.5 rounded-full bg-[rgba(246,247,249,0.9)] px-3 py-1 border border-[rgba(22,24,28,0.06)]">
                  <span className="truncate text-[#5F646B]">{lbl}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    aria-label={`${lbl} working capital PSF`}
                    value={inputs[key] as number}
                    onChange={(e) => updateNum(key, e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-12 sm:w-14 shrink-0 rounded bg-white px-1.5 py-0.5 text-right font-medium tabular-nums text-[#16181C] outline-none border border-[rgba(22,24,28,0.1)]"
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 text-[12.5px] font-normal text-[#16181C]">
              Total Working Capital: <b>AED {vFmtNum(result.workingCapitalPsfGfa, 0)}/GFA sf</b>
            </div>
            <div className="mt-2 rounded-[14px] bg-[#FDF6E3] p-2.5 text-[11.5px] font-normal text-[#7A4A0E] border border-[#FBE6A4]">
              Compounded financing carry ×<b>{result.dynamicFinanceMultiplier.toFixed(3)}</b> ({inputs.financingArr}% over {inputs.projectDurationYears} yrs) = <b>{vFmtM(result.financeCostTotalAed)}</b>
            </div>
          </div>
        </Panel>
      </div>

      {/* Visual Analytics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Panel title="Capital Allocation Profile" subtitle="Relative distribution of all-in project capitalization." className="lg:col-span-2">
          <div className="h-[240px] sm:h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={result.allocation} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={54} outerRadius={88} paddingAngle={2} stroke="none" isAnimationActive={false}>
                  {result.allocation.map((a) => (
                    <Cell key={a.name} fill={a.color} />
                  ))}
                </Pie>
                <Tooltip content={<AllocTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {result.allocation.map((a) => (
              <div key={a.name} className="flex items-center gap-2 text-[12px]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a.color }} />
                <span className="min-w-0 flex-1 truncate text-[#5F646B]">{a.name}</span>
                <span className="shrink-0 font-medium tabular-nums text-[#16181C]">{vFmtM(a.value)}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Cost-Plus Stack (AED / GFA sf)" subtitle="Cost components per gross building footprint." className="lg:col-span-3">
          <div className="h-[290px] sm:h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={result.costBars} margin={{ top: 8, right: 12, left: -8, bottom: 16 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#5F646B', fontSize: 10.5 }}
                  axisLine={{ stroke: 'rgba(22,24,28,0.1)' }}
                  tickLine={false}
                  interval={0}
                  angle={-22}
                  textAnchor="end"
                  height={48}
                />
                <YAxis tick={{ fill: '#5F646B', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip cursor={{ fill: 'rgba(244,199,75,0.08)' }} content={<BarTooltip />} />
                <Bar dataKey="psf" radius={[6, 6, 0, 0]} maxBarSize={68} isAnimationActive={false}>
                  {result.costBars.map((c) => (
                    <Cell key={c.name} fill={c.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Four-phase S-curve construction capital release */}
      <Panel
        title="Underwritten Construction Capital Release Profile"
        subtitle="Institutional 4-phase S-curve scheduling hard outlays and pro-rata approvals/soft costs across the certified build programme."
        right={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FBE6A4] bg-[#FDF6E3] px-3 py-1 text-[11px] font-semibold text-[#7A4A0E]">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-deep" />
            4-Phase S-Curve
          </span>
        }
      >
        {/* Aggregate schedule metrics */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
          {[
            {
              label: 'All-in Build Funding',
              value: vFmtM(constructionMetrics.allInConstructionAed),
              note: `AED ${vFmtNum(constructionMetrics.allInConstructionPsfNsa, 0)} / NSA sf`,
              accent: false,
            },
            {
              label: 'Hard Outlay',
              value: vFmtM(constructionMetrics.hardCostTotalAed),
              note: `AED ${vFmtNum(constructionMetrics.hardCostTotalPsfNsa, 0)} / NSA sf`,
              accent: false,
            },
            {
              label: 'Approvals',
              value: vFmtM(constructionMetrics.approvalsTotalAed),
              note: `AED ${vFmtNum(constructionMetrics.approvalsTotalPsfNsa, 0)} / NSA sf`,
              accent: false,
            },
            {
              label: 'Programme',
              value: programmeLabel,
              note: `Peak: ${peakConstructionPhase?.shortLabel} · ${vFmtM(constructionMetrics.peakPhaseFundingAed)}`,
              accent: true,
            },
          ].map((metric) => (
            <div
              key={metric.label}
              className={`min-w-0 rounded-[16px] border px-3 py-2.5 sm:px-3.5 ${
                metric.accent ? 'border-[#F4C74B]/35 bg-[#FBF7E9]' : 'border-hair bg-[rgba(246,247,249,0.7)]'
              }`}
            >
              <div className={`text-[9.5px] font-medium uppercase leading-tight tracking-wider sm:text-[10px] ${metric.accent ? 'text-[#7A4A0E]' : 'text-[#5F646B]'}`}>
                {metric.label}
              </div>
              <div className="mt-1 break-words text-[15px] font-semibold tabular-nums text-[#16181C] sm:text-[16px]">{metric.value}</div>
              <div className={`mt-0.5 break-words text-[10px] font-light leading-snug ${metric.accent ? 'text-[#7A4A0E]' : 'text-[#5F646B]'}`}>
                {metric.note}
              </div>
            </div>
          ))}
        </div>

        {/* Phase cards */}
        <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          {constructionPhases.map((phase) => (
            <article
              key={phase.id}
              className="relative flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-[rgba(22,24,28,0.08)] bg-white p-4 shadow-[0_1px_3px_rgba(22,24,28,0.04)] transition-shadow hover:shadow-[0_10px_28px_-18px_rgba(22,24,28,0.28)]"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-amber/30 via-amber-deep to-amber/30" />

              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FBE6A4] bg-[#FDF6E3] px-2.5 py-1 text-[10.5px] font-semibold text-[#7A4A0E]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-deep" />
                  {phase.timelineLabel}
                </span>
                <span className="shrink-0 text-[20px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-amber-deep">
                  {phase.weightPercent}%
                </span>
              </div>

              <div className="mt-3 text-[9.5px] font-medium uppercase tracking-[0.12em] text-[#5F646B]">
                Phase {phase.sequence} · {phase.durationMonths} mo window
              </div>
              <h4 className="mt-0.5 min-h-[2.4em] text-[13px] font-medium leading-snug tracking-[-0.01em] text-[#16181C]">
                {phase.label}
              </h4>

              <div className="mt-3 space-y-2 border-t border-[rgba(22,24,28,0.06)] pt-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11.5px] font-normal text-[#5F646B]">Hard Cost Outlay</span>
                  <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-[#16181C]">
                    {vFmtM(phase.hardCostAed)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11.5px] font-normal text-[#5F646B]">All-in Phased Funding</span>
                  <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-[#16181C]">
                    {vFmtM(phase.allInCostAed)}
                  </span>
                </div>
                <div className="rounded-[10px] bg-[rgba(246,247,249,0.8)] px-2.5 py-1.5 text-[10.5px] font-light leading-relaxed text-[#5F646B]">
                  Approvals {vFmtM(phase.approvalsAed)} · Soft loadings {vFmtM(phase.pmcAed + phase.escalationAed + phase.contingencyAed)}
                </div>
              </div>

              <div className="mt-auto pt-3.5">
                <div className="mb-1 flex items-center justify-between gap-2 text-[9.5px] font-medium uppercase tracking-wider text-[#5F646B]">
                  <span>Loading weight</span>
                  <span className="tabular-nums text-[#16181C]">{phase.weightPercent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[rgba(22,24,28,0.06)]" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber to-amber-deep"
                    style={{ width: `${phase.weightPercent}%` }}
                  />
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2 text-[10.5px]">
                  <span className="text-[#5F646B]">Cumulative funding</span>
                  <span className="shrink-0 font-semibold tabular-nums text-[#16181C]">{vFmtM(phase.cumulativeFundingAed)}</span>
                </div>
                <div className="mt-0.5 text-right text-[10px] font-light tabular-nums text-[#5F646B]">
                  AED {vFmtNum(phase.allInCostPsfNsa, 0)} / NSA sf
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Financier carry narrative */}
        <div className="mt-4 flex flex-col gap-3 rounded-[20px] border border-[#FBE6A4] bg-[#FDF6E3] p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber text-[13px] font-semibold text-[#16181C]">
              ↘
            </span>
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold text-[#7A4A0E]">
                Milestone cadence protects accrued interest and financier exposure
              </div>
              <p className="mt-1 text-[11.5px] font-normal leading-relaxed text-[#7A4A0E] sm:text-[12px]">
                Only {openingConstructionPhase?.weightPercent ?? 0}% ({vFmtM(openingConstructionPhase?.allInCostAed ?? 0)}) is released during enabling works, while the {' '}
                {peakConstructionPhase?.weightPercent ?? 0}% structural peak ({vFmtM(peakConstructionPhase?.allInCostAed ?? 0)}) lands in{' '}
                {peakConstructionPhase?.timelineLabel.toLowerCase()}. Staging the {vFmtM(totalConstructionFunding)} all-in requirement against certified WIP,
                rather than funding it as a Day-1 bullet, keeps average drawn principal lower through the {programmeLabel} build and flattens the compounded
                interest carry curve. Facility drawdowns step up to the structural peak, taper to {vFmtM(finalConstructionPhase?.allInCostAed ?? 0)} through
                fit-out, and align capital calls with visible asset value creation for financier and landowner diligence.
              </p>
              <p className="mt-1.5 text-[10.5px] font-light leading-relaxed text-[#7A4A0E]/85">
                All-in values include the approvals envelope plus pro-rata PMC, escalation and contingency. Financing carry is modelled separately in the
                underwriting block above; phase AED allocations reconcile exactly to the aggregate construction budget.
              </p>
            </div>
          </div>
          <div className="shrink-0 rounded-[14px] border border-[#F4C74B]/40 bg-white/75 px-3.5 py-2.5 lg:text-right">
            <div className="text-[9.5px] font-medium uppercase tracking-wider text-[#7A4A0E]/75">Cumulative all-in funding</div>
            <div className="mt-0.5 text-[17px] font-semibold tabular-nums text-[#16181C]">{vFmtM(totalConstructionFunding)}</div>
            <div className="mt-0.5 text-[10px] font-light text-[#7A4A0E]/80">
              {constructionPhases.map((phase) => `${phase.weightPercent}%`).join(' · ')} across four release gates
            </div>
          </div>
        </div>
      </Panel>

      {/* 4-Tier Institutional Sensitivity Matrix */}
      <Panel
        title="4-Tier Institutional Sensitivity Matrix"
        subtitle="Downmarket stress-testing with dynamic leakage scaling and escrow cancellation penalties."
        right={
          <div className="flex w-full sm:w-auto flex-wrap items-end justify-between sm:justify-end gap-3">
            <div className="sm:text-right">
              <span className="text-[11px] font-normal uppercase tracking-wider text-[#5F646B]">Target Margin:</span>
              <span className="ml-1.5 text-[14px] font-semibold tabular-nums text-[#16181C]">
                {vFmtPct(baselineMargin, 1)}
              </span>
            </div>
            <div className="w-[140px] sm:w-[150px]">
              <NumField
                label="Hurdle"
                unit="%"
                step={0.5}
                min={0}
                max={100}
                value={inputs.targetMarginPercent}
                onChange={(v) => updateNum('targetMarginPercent', Math.min(100, Math.max(0, v)))}
              />
            </div>
          </div>
        }
      >
        {/* Mobile native scenario tier cards (< md) */}
        <div className="space-y-3 md:hidden">
          {result.sensitivity.map((r) => {
            const tone = rowTone(r, inputs.targetMarginPercent);
            return (
              <div
                key={r.id}
                className={`rounded-[20px] border border-[rgba(22,24,28,0.08)] p-4 shadow-sm transition-colors ${tone.row}`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0">
                    <div className={`text-[14.5px] font-semibold ${tone.labelText}`}>{r.label}</div>
                    <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${tone.chip}`}>
                      {tone.status}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-[#5F646B]">Gross Margin</div>
                    <span className={`mt-0.5 inline-block rounded-full px-2.5 py-0.5 text-[13px] font-bold tabular-nums ${tone.chip}`}>
                      {vFmtPct(r.grossMarginPercent, 1)}
                    </span>
                  </div>
                </div>

                <div className="mt-3.5 grid grid-cols-2 gap-2.5 rounded-[14px] bg-white/80 p-3 text-[12px] border border-[rgba(22,24,28,0.05)]">
                  <div>
                    <span className="block text-[10.5px] uppercase tracking-wider text-[#5F646B]">Target Price</span>
                    <span className={`font-semibold tabular-nums ${tone.metric}`}>AED {vFmtNum(r.price, 0)}</span>
                    {r.id !== 'target' && (
                      <span className="ml-1 text-[10.5px] text-[#5F646B]">(×{r.priceMultiplier.toFixed(2)})</span>
                    )}
                  </div>
                  <div>
                    <span className="block text-[10.5px] uppercase tracking-wider text-[#5F646B]">Effective GDV</span>
                    <span className="font-semibold tabular-nums text-[#16181C]">{vFmtM(r.gdv)}</span>
                    {r.id === 'stress_case' && (
                      <span className="block text-[10.5px] font-semibold text-[#96291D]">15% cancellation</span>
                    )}
                  </div>
                  <div>
                    <span className="block text-[10.5px] uppercase tracking-wider text-[#5F646B]">Net Proceeds / sf</span>
                    <span className="font-medium tabular-nums text-[#16181C]">
                      AED {vFmtNum(r.netProceedsPsf, 0)} ({vFmtPct(r.dynamicLeakagePercent, 0)} leak)
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10.5px] uppercase tracking-wider text-[#5F646B]">PBT / sf</span>
                    <span className={`font-semibold tabular-nums ${tone.metric}`}>
                      {r.pbtPsf >= 0 ? '+' : ''}AED {vFmtNum(r.pbtPsf, 0)}
                    </span>
                  </div>
                </div>

                <p className="mt-3 text-[12px] font-normal leading-relaxed text-[#5F646B]">
                  {r.rationale}
                </p>
              </div>
            );
          })}
        </div>

        {/* Tablet & Desktop 8-column matrix table (md+) */}
        <div className="hidden md:block overflow-x-auto scroll-thin rounded-[20px] border border-[rgba(22,24,28,0.08)] bg-white shadow-sm">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[rgba(22,24,28,0.08)] bg-[rgba(246,247,249,0.7)] text-[11px] font-medium uppercase tracking-wider text-[#5F646B]">
                <th scope="col" className="px-5 py-3.5">Scenario Tier</th>
                <th scope="col" className="px-3 py-3.5 text-right">Target Price</th>
                <th scope="col" className="px-3 py-3.5 text-right">Effective GDV</th>
                <th scope="col" className="px-3 py-3.5 text-right">Sales Leakage</th>
                <th scope="col" className="px-3 py-3.5 text-right">Net Proceeds / sf</th>
                <th scope="col" className="px-3 py-3.5 text-right">PBT / sf</th>
                <th scope="col" className="px-3 py-3.5 text-right">Gross Margin</th>
                <th scope="col" className="px-5 py-3.5">Institutional Risk Narrative</th>
              </tr>
            </thead>
            <tbody>
              {result.sensitivity.map((r) => {
                const tone = rowTone(r, inputs.targetMarginPercent);
                return (
                  <tr key={r.id} className={`border-b border-[rgba(22,24,28,0.05)] align-top transition-colors ${tone.row}`}>
                    <td className="px-5 py-3.5">
                      <div className={`font-semibold text-[14px] ${tone.labelText}`}>
                        {r.label}
                      </div>
                      <span className={`inline-block mt-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${tone.chip}`}>
                        {tone.status}
                      </span>
                    </td>
                    <td className={`whitespace-nowrap px-3 py-3.5 text-right tabular-nums text-[13.5px] ${tone.metric}`}>
                      AED {vFmtNum(r.price, 0)}
                      {r.id !== 'target' && (
                        <span className="block text-[11px] font-normal text-[#5F646B]">
                          ×{r.priceMultiplier.toFixed(3)}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums text-[13.5px] font-medium text-[#16181C]">
                      {vFmtM(r.gdv)}
                      {r.id === 'stress_case' && (
                        <span className="block text-[11px] font-semibold text-[#96291D]">
                          15% cancellation breach
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 text-right text-[13px] font-medium text-[#16181C] tabular-nums">
                      {vFmtPct(r.dynamicLeakagePercent, 0)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums text-[13.5px] text-[#16181C]">
                      AED {vFmtNum(r.netProceedsPsf, 0)}
                    </td>
                    <td className={`whitespace-nowrap px-3 py-3.5 text-right font-semibold tabular-nums text-[13.5px] ${tone.metric}`}>
                      {r.pbtPsf >= 0 ? '+' : ''}AED {vFmtNum(r.pbtPsf, 0)}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-[12.5px] font-bold tabular-nums ${tone.chip}`}>
                        {vFmtPct(r.grossMarginPercent, 1)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[12.5px] font-light leading-relaxed text-[#5F646B] max-w-[360px]">
                      {r.rationale}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* WC Micro-Budget · composition inside the fixed underwritten envelope */}
      <WcMicroBudgetPanel simulation={simulation} />
    </div>
  );
}
