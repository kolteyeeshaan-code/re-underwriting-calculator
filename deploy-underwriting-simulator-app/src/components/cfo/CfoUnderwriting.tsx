import { cfoFmt, cfoMillions, cfoReadableDate, type CfoController, type CfoDrawdownFramework, type CfoTypology } from '../../engine/cfoEngine';
import { CfoDateField, CfoNumberField, CfoPanel, CfoSelect, CfoAlert } from './CfoUI';
import { Card as EeshaanKolteyCard, PillBtn } from '../eeshaan-koltey/ui';
import { Refresh } from '../eeshaan-koltey/icons';

export default function CfoUnderwriting({ controller, onMonitor }: { controller: CfoController; onMonitor?: () => void }) {
  const { inputs, simulation: sim, updateInput, updateNumber, reset } = controller;
  const field = (key: Parameters<typeof updateNumber>[0]) => (value: number) => updateNumber(key, value);
  return (
    <div className="space-y-6">
      {/* Page Header + Action Toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[21px] sm:text-[26px] font-light leading-tight tracking-[-0.02em] text-[#16181C]">
            SPV CFO Capital Clock &amp; Burn Controls
          </h2>
          <p className="mt-0.5 text-[12.5px] sm:text-[13px] font-normal text-[#5F646B] max-w-2xl">
            Configure opening capitalization, statutory RERA license dates, and daily operating bleed rates.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PillBtn tone="soft" icon={<Refresh />} onClick={reset}>
            Reset Defaults
          </PillBtn>
          {onMonitor && (
            <PillBtn tone="dark" onClick={onMonitor}>
              Open Operational Ledger →
            </PillBtn>
          )}
        </div>
      </div>

      {!sim.valid && <CfoAlert error>{sim.errors.join(' ')}</CfoAlert>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <CfoPanel
          number="01"
          title="Opening Capitalization & Balance Sheet Cushion"
          subtitle="Land enters as non-cash equity. The working-capital cushion is an earmark within developer cash, not an additional injection."
          className="xl:col-span-2"
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <CfoNumberField label="Land Partner Asset Equity" unit="AED" value={inputs.landEquity} onChange={field('landEquity')} step={1_000_000} />
            <CfoNumberField
              label="Developer Cash Equity Injection"
              unit="AED"
              value={inputs.developerCashEquity}
              onChange={field('developerCashEquity')}
              step={500_000}
              hint={sim.zeroEquityMode
                ? 'Zero-Equity Rule active: nil cash forces early outlays to draw from the senior facility at Day 0.'
                : 'Set to 0 to trigger the automated Zero-Equity debt bridge rule.'}
            />
            <CfoNumberField label="Debt Facility Cap" unit="AED" value={inputs.debtFacilityCap} onChange={field('debtFacilityCap')} step={1_000_000} />
            <CfoNumberField label="Financing ARR Rate" unit="% p.a." value={inputs.financingArr} onChange={field('financingArr')} step={0.25} max={100} />
            <CfoNumberField
              label="Seeded Working Capital Allotment"
              unit="AED / GFA sf"
              value={inputs.workingCapitalGfa}
              onChange={field('workingCapitalGfa')}
              step={5}
              hint={`AED ${cfoFmt(sim.initialWcPsfNsa, 2)} / NSA PSF; opening cushion ${cfoMillions(sim.initialWcCushionAed)}.`}
            />
            <CfoSelect
              label="Product Typology"
              value={inputs.productTypology}
              onChange={(value) => updateInput('productTypology', value as CfoTypology)}
              options={[{ value: 'Villas / Townhouses', label: 'Villas / Townhouses' }, { value: 'Apartments', label: 'Apartments' }]}
            />
            <div className="sm:col-span-2 lg:col-span-3">
              <CfoSelect
                label="Debt Drawdown Framework"
                value={inputs.drawdownFramework}
                onChange={(value) => updateInput('drawdownFramework', value as CfoDrawdownFramework)}
                options={[
                  { value: 'upfront', label: 'Upfront Full Facility Drop' },
                  { value: 'milestone', label: 'Milestone-Linked Drawdown Draws' },
                ]}
                hint="Milestone mode draws 25% at inception, then 25% each at 20%, 40% and 60% WIP. Interest compounds on live drawn debt using Actual/365."
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2 border-t border-[rgba(22,24,28,0.06)] pt-4 text-xs text-[#5F646B]">
            <span>Paid-in equity cushion</span>
            <span className="text-[17px] font-semibold tabular-nums text-[#16181C]">
              {cfoMillions(inputs.landEquity + inputs.developerCashEquity)}
            </span>
          </div>
        </CfoPanel>

        <CfoPanel
          number="02"
          title="HCVF Capital Clock & Off-Plan Runway"
          subtitle="Three project dates define the lifecycle. Set the independent reporting date and hourly cut-off on Screen 2."
          className="xl:col-span-2"
        >
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <CfoDateField label="Accounting Activation Date" value={inputs.activationDate} onChange={(value) => updateInput('activationDate', value)} />
            <CfoDateField label="Target RERA Off-Plan License Date" value={inputs.offPlanLicenseDate} onChange={(value) => updateInput('offPlanLicenseDate', value)} min={inputs.activationDate} max={inputs.handoverDate} />
            <CfoDateField label="Project Completion Date" value={inputs.handoverDate} onChange={(value) => updateInput('handoverDate', value)} min={inputs.activationDate} />
          </div>

          {sim.clock.forecastBeforeActivation && (
            <div role="alert" className="mt-4 rounded-[18px] border border-[#FCD6D2] bg-[#FEECEA] px-4 py-3 text-xs font-medium text-[#96291D]">
              Simulation forecast date cannot precede corporate initialization date.
            </div>
          )}

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-[20px] border border-[#F4C74B]/30 bg-[#FBF7E9] px-5 py-4">
              <div className="text-[11px] font-medium uppercase tracking-wider text-[#7A4A0E]">
                Total Project Lifecycle Window
              </div>
              <div className="mt-1 text-[24px] font-light tracking-tight tabular-nums text-[#16181C]">
                {cfoFmt(sim.clock.totalProjectDays)} <span className="text-[13px] font-normal text-[#5F646B]">calendar days</span>
              </div>
              <p className="mt-1 text-[12px] font-light text-[#5F646B]">
                {cfoReadableDate(inputs.activationDate)} to {cfoReadableDate(inputs.handoverDate)}
              </p>
            </div>

            <div className={`rounded-[20px] border px-5 py-4 ${
              sim.preLicenseDeficitDays > 0 ? 'border-[#FBE6A4] bg-[#FDF6E3]' : 'border-[#CFE3D6] bg-[#EFF6F1]'
            }`}>
              <div className={`text-[11px] font-medium uppercase tracking-wider ${
                sim.preLicenseDeficitDays > 0 ? 'text-[#7A4A0E]' : 'text-[#2F5C44]'
              }`}>
                Pre-Sales Capital Chasm Deficit
              </div>
              <div className="mt-1 text-[24px] font-light tracking-tight tabular-nums text-[#16181C]">
                {cfoFmt(sim.preLicenseDeficitDays)} <span className="text-[13px] font-normal text-[#5F646B]">days</span>
              </div>
              <p className="mt-1 text-[12px] font-light text-[#5F646B]">
                Buyer collections are blocked until {cfoReadableDate(inputs.offPlanLicenseDate)}. Pure deficit burn of {cfoMillions(sim.preLicenseBurn)} in that window.
              </p>
            </div>
          </div>
        </CfoPanel>

        <CfoPanel
          number="03"
          title="Daily Operational Burn Meter Matrix"
          subtitle="Parameter R = X + Y. Burn continues every calendar day, including pre-construction approval runway."
          className="xl:col-span-2"
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.25fr_1fr]">
            {/* Mobile native stacked cards (< sm) */}
            <div className="overflow-hidden rounded-[20px] border border-[rgba(22,24,28,0.08)] bg-white sm:hidden">
              <div className="divide-y divide-[rgba(22,24,28,0.06)]">
                {([
                  { key: 'nonHumanDailyBurn', label: 'X / Non-human operating bleed', detail: 'SaaS licences, rent and subscriptions' },
                  { key: 'humanDailyBurn', label: 'Y / Human capital retainers', detail: 'Core PMC and engineering salary commitments' },
                ] as const).map((row) => (
                  <div key={row.key} className="space-y-2.5 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-[#16181C]">{row.label}</div>
                        <div className="mt-0.5 text-[11px] font-normal text-[#5F646B]">{row.detail}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[10px] uppercase tracking-wider text-[#5F646B]">Exposure</div>
                        <div className="text-[13px] font-semibold tabular-nums text-[#16181C]">
                          {cfoMillions(inputs[row.key] * sim.duration)}
                        </div>
                      </div>
                    </div>
                    <CfoNumberField label="" unit="AED / day" value={inputs[row.key]} onChange={field(row.key)} step={500} />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#16181C] px-4 py-3 text-white">
                <div>
                  <div className="text-[12px] font-medium">R / Combined temporal decay</div>
                  <div className="text-[12px] font-semibold tabular-nums text-amber">{cfoFmt(sim.dailyBurn)} AED / day</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-white/60">Total Burn</div>
                  <div className="text-[13.5px] font-semibold tabular-nums">{cfoMillions(sim.projectedBurn)}</div>
                </div>
              </div>
            </div>

            {/* Tablet & Desktop table (sm+) */}
            <div className="hidden sm:block overflow-x-auto scroll-thin rounded-[20px] border border-[rgba(22,24,28,0.08)] bg-white">
              <table className="w-full min-w-[460px] text-sm">
                <thead>
                  <tr className="bg-[rgba(246,247,249,0.7)] text-left text-[11px] font-medium uppercase tracking-wider text-[#5F646B]">
                    <th scope="col" className="px-5 py-3">Operating cost driver</th>
                    <th scope="col" className="px-5 py-3">AED / calendar day</th>
                    <th scope="col" className="px-5 py-3 text-right">Project exposure</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    { key: 'nonHumanDailyBurn', label: 'X / Non-human operating bleed', detail: 'SaaS licences, rent and subscriptions' },
                    { key: 'humanDailyBurn', label: 'Y / Human capital retainers', detail: 'Core PMC and engineering salary commitments' },
                  ] as const).map((row) => (
                    <tr key={row.key} className="border-t border-[rgba(22,24,28,0.06)]">
                      <th scope="row" className="px-5 py-3.5 text-left font-medium text-[#16181C]">
                        {row.label}
                        <span className="mt-0.5 block text-[11px] font-normal text-[#5F646B]">{row.detail}</span>
                      </th>
                      <td className="w-[180px] px-3 py-3.5">
                        <CfoNumberField label="" value={inputs[row.key]} onChange={field(row.key)} step={500} />
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium tabular-nums text-[#16181C]">
                        {cfoMillions(inputs[row.key] * sim.duration)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#16181C] text-white">
                    <th className="px-5 py-3.5 text-left text-[13px] font-medium">R / Combined temporal decay</th>
                    <td className="px-3 py-3.5 font-semibold tabular-nums text-amber">{cfoFmt(sim.dailyBurn)} / day</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold tabular-nums">{cfoMillions(sim.projectedBurn)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="space-y-5">
              <CfoNumberField label="Sale Price Anchor P-Target" unit="AED / NSA sf" value={inputs.sellingPricePsf} onChange={field('sellingPricePsf')} step={25} />
              <div>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <label htmlFor="cfo-efficiency" className="text-[12.5px] font-medium text-[#16181C]">Aspirational Efficiency Ratio E</label>
                  <span className="text-[18px] font-semibold tabular-nums text-amber">{cfoFmt(inputs.efficiencyPct, 1)}%</span>
                </div>
                <input
                  id="cfo-efficiency"
                  type="range"
                  min={60}
                  max={95}
                  step={0.5}
                  value={inputs.efficiencyPct}
                  onChange={(e) => updateNumber('efficiencyPct', e.currentTarget.valueAsNumber)}
                  className="range-amber h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[rgba(22,24,28,0.1)]"
                />
                <div className="mt-1.5 flex justify-between text-[11px] text-[#5F646B]">
                  <span>60%</span><span>{cfoFmt(sim.nsa)} sf saleable</span><span>95%</span>
                </div>
              </div>
            </div>
          </div>
        </CfoPanel>
      </div>

      <EeshaanKolteyCard variant="plain" className="p-4 sm:p-6">
        <h4 className="text-[16px] font-medium text-[#16181C] mb-1">Independent Site Underwriting</h4>
        <p className="text-[12.5px] font-normal text-[#5F646B] mb-4">
          Local site cost allowances determine WIP inventory. Physical outlays: {cfoMillions(sim.buildBudget)} on {cfoFmt(sim.gfa)} sf GFA.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CfoNumberField label="Plot area" unit="sf" step={0.01} value={inputs.plotArea} onChange={field('plotArea')} />
          <CfoNumberField label="Permissible FAR" unit="x" step={0.01} max={20} value={inputs.far} onChange={field('far')} />
          <CfoNumberField label="Base Construction" unit="AED / GFA" step={5} value={inputs.constructionPsfGfa} onChange={field('constructionPsfGfa')} />
          <CfoNumberField label="PMC Fee" unit="%" step={0.1} max={100} value={inputs.pmcPct} onChange={field('pmcPct')} />
          <CfoNumberField label="Escalation" unit="%" step={0.1} max={100} value={inputs.escalationPct} onChange={field('escalationPct')} />
          <CfoNumberField label="Contingency" unit="%" step={0.1} max={100} value={inputs.contingencyPct} onChange={field('contingencyPct')} />
          <CfoNumberField label="Approvals / Soft" unit="AED / GFA" value={inputs.approvalsPsfGfa} onChange={field('approvalsPsfGfa')} />
        </div>
      </EeshaanKolteyCard>
    </div>
  );
}
