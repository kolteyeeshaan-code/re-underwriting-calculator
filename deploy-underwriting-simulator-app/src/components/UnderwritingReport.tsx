import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtAedM, fmtNum, fmtPct, parseNumericInput } from '../engine/treasuryEngine';
import type { TreasurySimulationController } from '../engine/treasuryEngine';
import type { ViabilitySimulationController } from '../engine/viabilityEngine';
import type { CfoController } from '../engine/cfoEngine';
import { Badge, Card, PillBtn } from './eeshaan-koltey/ui';
import { Download } from './eeshaan-koltey/icons';
import {
  BALANCE_TOLERANCE_AED,
  REPORT_SECTION_TITLES,
  buildLedgerWindows,
  buildProRataGroups,
  buildReconciliation,
  buildReportDisclosures,
  buildTerminalWaterfall,
  type DisclosureStatus,
  type ReportSectionId,
  type ReportState,
} from '../lib/reportDisclosures';

/* =====================================================================
 * WORKSPACE 4 — UNDERWRITING REPORT · RECONCILED AUDIT DISCLOSURES
 * Presentation layer only. Every figure is read from the live unified
 * engine state; nothing here recomputes or overrides an engine result.
 * ===================================================================== */

const SECTION_IDS: ReportSectionId[] = ['1.0', '2.0', '3.0', '4.0'];

const STATUS_META: Record<DisclosureStatus, { label: string; dot: string; chip: string }> = {
  pass: { label: 'Verified', dot: 'bg-[#7BB694]', chip: 'bg-[#EFF6F1] border-[#CFE3D6] text-[#2F5C44]' },
  watch: { label: 'Monitor', dot: 'bg-[#F4C74B]', chip: 'bg-[#FDF6E3] border-[#FBE6A4] text-[#7A4A0E]' },
  flag: { label: 'Variance', dot: 'bg-[#FA6C5D]', chip: 'bg-[#FEECEA] border-[#FCD6D2] text-[#96291D]' },
};

const TIER_COLORS = { retention: '#F4C74B', defects: '#FA6C5D', unlocked: '#7BB694' };

/* ------------------------------------------------------------ primitives */
function StatusChip({ status }: { status: DisclosureStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-[3px] text-[10.5px] font-medium leading-none ${meta.chip}`}>
      <span className={`h-[6px] w-[6px] shrink-0 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function SectionShell({
  id,
  index,
  title,
  subtitle,
  aside,
  children,
}: {
  id: ReportSectionId;
  index: string;
  title: string;
  subtitle: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`report-section-${id}`}
      data-reveal
      className="report-reveal scroll-mt-32 rounded-[22px] border border-[rgba(22,24,28,0.09)] bg-white/92 shadow-[0_1px_2px_rgba(22,24,28,0.03),0_18px_44px_-30px_rgba(22,24,28,0.28)]"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(22,24,28,0.09)] px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 shrink-0 text-[26px] font-light leading-none tracking-[-0.05em] text-[#F0A93B] tabular-nums">
            {index}
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-medium tracking-[-0.01em] text-ink sm:text-[16.5px]">{title}</h3>
            <p className="mt-0.5 text-[11.5px] font-light leading-relaxed text-ink-2 sm:text-[12px]">{subtitle}</p>
          </div>
        </div>
        {aside && <div className="flex shrink-0 flex-wrap items-center gap-2">{aside}</div>}
      </header>
      <div className="px-4 py-4 sm:px-6 sm:py-5">{children}</div>
    </section>
  );
}

/** Dense institutional data table: sticky header, hairline rules, tabular figures. */
function DataTable({
  head,
  children,
  minWidth,
  align = 'left',
}: {
  head: string[];
  children: React.ReactNode;
  minWidth?: number;
  align?: 'left' | 'right';
}) {
  return (
    <div className="overflow-x-auto scroll-thin rounded-[14px] border border-[rgba(22,24,28,0.09)] bg-white">
      <table className="w-full border-collapse text-left" style={minWidth ? { minWidth } : undefined}>
        <thead className="sticky top-0 z-10">
          <tr className="bg-[#16181C] text-[10px] font-medium uppercase tracking-[0.08em] text-white/85">
            {head.map((label, i) => (
              <th
                key={label}
                scope="col"
                className={`whitespace-nowrap px-3 py-2.5 ${i === head.length - 1 && align === 'right' ? 'text-right' : i === 0 ? '' : 'text-right'}`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Td({ children, strong, tone, className = '' }: { children: React.ReactNode; strong?: boolean; tone?: string; className?: string }) {
  return (
    <td className={`whitespace-nowrap px-3 py-2 text-right text-[12.5px] tabular-nums ${strong ? 'font-semibold' : 'font-normal'} ${tone ?? 'text-ink'} ${className}`}>
      {children}
    </td>
  );
}

function TdLabel({ children, sub, className = '' }: { children: React.ReactNode; sub?: string; className?: string }) {
  return (
    <td className={`px-3 py-2 align-middle ${className}`}>
      <span className="block text-[12.5px] font-medium leading-snug text-ink">{children}</span>
      {sub && <span className="mt-0.5 block text-[10.5px] font-light leading-snug text-ink-2">{sub}</span>}
    </td>
  );
}

function Tr({ children, tone = '' }: { children: React.ReactNode; tone?: string }) {
  return (
    <tr className={`border-t border-[rgba(22,24,28,0.07)] transition-colors duration-150 hover:bg-[rgba(244,199,75,0.07)] ${tone}`}>
      {children}
    </tr>
  );
}

/** Light-cream container used to emphasise a headline figure. */
function CreamFigure({ label, value, unit, note, tone = 'ink' }: { label: string; value: string; unit?: string; note?: string; tone?: 'ink' | 'mint' | 'coral' | 'amber' }) {
  const valueTone =
    tone === 'mint' ? 'text-[#2F5C44]' : tone === 'coral' ? 'text-[#96291D]' : tone === 'amber' ? 'text-[#7A4A0E]' : 'text-ink';
  return (
    <div className="min-w-0 rounded-[16px] border border-[#F4C74B]/35 bg-cream px-3.5 py-3">
      <div className="break-words text-[10px] font-medium uppercase leading-tight tracking-[0.07em] text-[#7A4A0E]">{label}</div>
      <div className={`mt-1 break-words text-[19px] font-light leading-tight tracking-[-0.02em] tabular-nums sm:text-[21px] ${valueTone}`}>
        {value}
        {unit && <span className="ml-1 text-[11px] font-normal text-ink-2">{unit}</span>}
      </div>
      {note && <div className="mt-0.5 text-[10.5px] font-light leading-snug text-ink-2">{note}</div>}
    </div>
  );
}

/* ------------------------------------------------------- capital clock spine */
function TimelineSpine({ state }: { state: ReportState }) {
  const { cfoSim, treasurySim } = state;
  const horizon = Math.max(1, cfoSim.horizon);
  const at = (day: number) => Math.max(0, Math.min(100, (day / horizon) * 100));
  const windows = buildLedgerWindows(state);
  const totalMonths = Math.max(1, treasurySim.dlpEndMonth);
  const monthAt = (month: number) => Math.max(0, Math.min(100, (month / totalMonths) * 100));

  const markers = [
    { day: 0, label: 'Inception', sub: 'M0', color: '#5F646B' },
    { day: cfoSim.clock.licenseTriggerDay, label: 'RERA Licence', sub: `Day ${fmtNum(cfoSim.clock.licenseTriggerDay)}`, color: '#F0A93B' },
    { day: cfoSim.clock.totalProjectDays, label: 'Handover', sub: `M${treasurySim.handoverMonth}`, color: '#16181C' },
    { day: horizon, label: 'DLP End', sub: `M${treasurySim.dlpEndMonth}`, color: '#FA6C5D' },
  ];

  return (
    <div className="rounded-[16px] border border-[rgba(22,24,28,0.09)] bg-[rgba(246,247,249,0.7)] px-3.5 py-4 sm:px-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-2">Capital clock · collections blockade</span>
        <span className="text-[11px] font-light text-ink-2 tabular-nums">
          Horizon {fmtNum(horizon)} days · {fmtNum(cfoSim.clock.totalProjectDays)} build days + {treasurySim.defectsMonths}-month warranty
        </span>
      </div>

      {/* Window segments */}
      <div className="flex h-7 w-full overflow-hidden rounded-full border border-[rgba(22,24,28,0.1)] bg-white">
        {windows.map((w) => {
          const width = Math.max(0, monthAt(w.toMonth) - monthAt(w.fromMonth));
          const fill =
            w.escrowStatus === 'Blocked' ? 'rgba(22,24,28,0.16)' : w.escrowStatus === 'Gated' ? 'rgba(244,199,75,0.55)' : 'rgba(123,182,148,0.55)';
          return (
            <div
              key={w.id}
              className="group relative flex h-full items-center justify-center border-r border-white/70 transition-colors duration-200 last:border-r-0 hover:brightness-95"
              style={{ width: `${width}%`, background: fill }}
              title={`${w.code} ${w.label} · M${fmtNum(w.fromMonth, 0)}–M${fmtNum(w.toMonth, 0)} · escrow ${w.escrowStatus}`}
            >
              <span className="truncate px-1 text-[9.5px] font-semibold uppercase tracking-wide text-ink/80">{w.code}</span>
            </div>
          );
        })}
      </div>

      {/* Marker rail */}
      <div className="relative mt-1 h-11">
        <div className="absolute inset-x-0 top-0 h-px bg-[rgba(22,24,28,0.14)]" />
        {markers.map((m) => (
          <div key={m.label} className="absolute top-0 -translate-x-1/2" style={{ left: `${at(m.day)}%` }}>
            <div className="h-2.5 w-px" style={{ background: m.color }} />
            <div className="mt-0.5 whitespace-nowrap text-center">
              <div className="text-[10px] font-medium leading-tight text-ink">{m.label}</div>
              <div className="text-[9.5px] font-light leading-tight text-ink-2 tabular-nums">{m.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[rgba(22,24,28,0.07)] pt-2.5 text-[10.5px] font-light text-ink-2">
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-[rgba(22,24,28,0.16)]" /> Blocked — zero inflow</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-[rgba(244,199,75,0.55)]" /> Gated — licence window</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-[rgba(123,182,148,0.55)]" /> Open — milestone releases</span>
      </div>
    </div>
  );
}

/* =========================================================== main view */
export default function UnderwritingReport({
  viability,
  treasury,
  cfo,
  onExportMaster,
}: {
  viability: ViabilitySimulationController;
  treasury: TreasurySimulationController;
  cfo: CfoController;
  onExportMaster: () => void;
}) {
  const [activeSection, setActiveSection] = useState<ReportSectionId>('1.0');
  const [scrolled, setScrolled] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  const state = useMemo<ReportState>(
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

  const disclosures = useMemo(() => buildReportDisclosures(state), [state]);
  const reconciliation = useMemo(() => buildReconciliation(state), [state]);
  const waterfall = useMemo(() => buildTerminalWaterfall(state.treasurySim), [state.treasurySim]);
  const windows = useMemo(() => buildLedgerWindows(state), [state]);
  const proRata = useMemo(() => buildProRataGroups(state), [state]);

  const { treasurySim: sim, treasuryInputs: tInputs, cfoSim } = state;
  const current = cfoSim.current;

  /* Scroll-spy + reveal + sticky shadow — one observer pass each. */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          const id = visible[0].target.id.replace('report-section-', '') as ReportSectionId;
          setActiveSection(id);
        }
      },
      { rootMargin: '-110px 0px -55% 0px', threshold: [0, 0.12, 0.4] },
    );
    SECTION_IDS.forEach((id) => {
      const el = document.getElementById(`report-section-${id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = shellRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('report-revealed');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.05 },
    );
    root.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const reportId = `UR4-${cfoSim.cutOffDate.replace(/-/g, '')}-${String(cfoSim.hour).padStart(2, '0')}H`;
  const bySection = (id: ReportSectionId) => disclosures.filter((d) => d.section === id);
  const varianceCount = disclosures.filter((d) => d.status === 'flag').length;
  const watchCount = disclosures.filter((d) => d.status === 'watch').length;
  const efficiencyDrag = state.viabilityResult.totalDevCostPsfNsa - state.viabilityResult.landCostPsfNsa;
  const gdvSettledPct = sim.gdv > 0 ? (waterfall.settled / sim.gdv) * 100 : 0;

  const jump = (id: ReportSectionId) => {
    document.getElementById(`report-section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div ref={shellRef} className="space-y-5">
      {/* ---------------------------------------------------- masthead */}
      <Card variant="plain" className={`report-masthead overflow-hidden transition-shadow duration-300 ${scrolled ? 'shadow-[0_10px_34px_-22px_rgba(22,24,28,0.42)]' : ''}`}>
        <div className="report-ruled bg-ink px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/20 px-2.5 py-[3px] text-[10px] font-semibold uppercase tracking-[0.14em] text-white/75">
                  Workspace 4
                </span>
                <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/60">Reconciled Audit Disclosures</span>
              </div>
              <h2 className="mt-2 text-[24px] font-light leading-tight tracking-[-0.03em] text-white sm:text-[30px]">
                Underwriting Report
              </h2>
              <p className="mt-1 max-w-2xl text-[12px] font-light leading-relaxed text-white/60">
                Unified financial calculation engine · {fmtNum(tInputs.parcelSize)} sf parcel · {fmtNum(sim.gfa)} sf GFA ·{' '}
                {fmtNum(sim.nsa)} sf NSA · {fmtNum(cfoSim.clock.totalProjectDays)}-day calendar
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-start gap-2.5 sm:items-end">
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                  reconciliation.reconciled
                    ? 'border-[#7BB694]/50 bg-[#7BB694]/15 text-[#CFE3D6]'
                    : 'border-[#FA6C5D]/55 bg-[#FA6C5D]/15 text-[#FCD6D2]'
                }`}
              >
                <span className={`report-pulse h-2 w-2 rounded-full ${reconciliation.reconciled ? 'bg-[#7BB694]' : 'bg-[#FA6C5D]'}`} />
                {reconciliation.label}
              </span>
              <PillBtn tone="amber" icon={<Download />} onClick={onExportMaster}>
                Export Master Package
              </PillBtn>
            </div>
          </div>

          {/* Document control strip */}
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/12 pt-4 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { k: 'Report ID', v: reportId },
              { k: 'Cut-off', v: `${cfoSim.cutOffDate} · ${String(cfoSim.hour).padStart(2, '0')}:00 GST` },
              { k: 'Currency', v: 'AED (dirham)' },
              { k: 'Basis', v: 'Double-entry · Actual/365' },
              { k: 'Assertions', v: `${reconciliation.checksPassed}/${reconciliation.checksTotal} passing` },
              { k: 'Disclosures', v: `${disclosures.length} rows · ${varianceCount} variance · ${watchCount} monitor` },
            ].map((item) => (
              <div key={item.k} className="min-w-0">
                <dt className="text-[9.5px] font-medium uppercase tracking-[0.09em] text-white/60">{item.k}</dt>
                <dd className="mt-0.5 break-words text-[11.5px] font-medium leading-snug text-white/90 tabular-nums">{item.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Section index */}
        <nav aria-label="Report sections" className="no-scrollbar flex items-center gap-1.5 overflow-x-auto border-b border-[rgba(22,24,28,0.07)] bg-[rgba(246,247,249,0.75)] px-3 py-2.5 sm:px-5">
          {SECTION_IDS.map((id) => {
            const active = activeSection === id;
            const flags = bySection(id).filter((d) => d.status === 'flag').length;
            return (
              <button
                key={id}
                type="button"
                onClick={() => jump(id)}
                className={`press inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition-all duration-200 ${
                  active
                    ? 'border-ink bg-ink text-white shadow-[0_6px_16px_-8px_rgba(22,24,28,0.7)]'
                    : 'border-[rgba(22,24,28,0.12)] bg-white/70 text-ink-2 hover:border-ink/35 hover:text-ink'
                }`}
              >
                <span className="tabular-nums opacity-70">{id}</span>
                <span>{REPORT_SECTION_TITLES[id]}</span>
                {flags > 0 && (
                  <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9.5px] font-bold tabular-nums ${active ? 'bg-[#FA6C5D] text-white' : 'bg-[#FEECEA] text-[#96291D]'}`}>
                    {flags}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </Card>

      {/* ---------------------------------------- 1.0 Executive Synthesis */}
      <SectionShell
        id="1.0"
        index="1.0"
        title={REPORT_SECTION_TITLES['1.0']}
        subtitle="Macro plot parameters, development cost caps, leverage and dual-Sankey baseline aggregates."
        aside={<Badge tone={reconciliation.reconciled ? 'mint' : 'coral'} dot>{reconciliation.label}</Badge>}
      >
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-6">
          <CreamFigure label="Gross Development Value" value={fmtAedM(sim.gdv)} note={`${fmtNum(sim.nsa)} sf NSA × AED ${fmtNum(tInputs.sellingPricePsf)}`} tone="amber" />
          <CreamFigure label="Total Development Cost" value={fmtAedM(sim.totalDevelopmentCost)} note="Land + facility + compounded carry" />
          <CreamFigure
            label="Unallocated Surplus"
            value={fmtAedM(sim.totalProjectSurplus)}
            note={`${fmtPct(sim.margin, 1)} margin on GDV`}
            tone={sim.totalProjectSurplus >= 0 ? 'mint' : 'coral'}
          />
          <CreamFigure label="LTV Leverage" value={fmtPct(sim.ltv, 1)} note={`${fmtAedM(sim.externalDebtRequired)} facility`} tone={sim.ltv > 70 ? 'coral' : 'ink'} />
          <CreamFigure label="All-in Cost / NSA" value={`AED ${fmtNum(state.viabilityResult.totalDevCostPsfNsa, 0)}`} note="Cost-approach divisor basis" />
          <CreamFigure label="Breakeven Floor" value={`AED ${fmtNum(state.viabilityResult.breakevenPsf, 0)}`} note={`vs comp AED ${fmtNum(state.viabilityInputs.marketCompPsf, 0)}`} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div>
            <h4 className="mb-2 text-[10px] font-medium uppercase tracking-[0.09em] text-ink-2">1.1 · Spatial envelope &amp; revenue foundation</h4>
            <DataTable head={['Parameter', 'Value', 'Basis']}>
              <Tr><TdLabel sub="Registered parcel footprint">Plot area</TdLabel><Td>{fmtNum(tInputs.parcelSize)} sf</Td><Td className="text-[11px] font-light text-ink-2">Treasury input</Td></Tr>
              <Tr><TdLabel sub="Planning envelope multiplier">Permissible FAR</TdLabel><Td>{tInputs.far.toFixed(2)} ×</Td><Td className="text-[11px] font-light text-ink-2">Authority grant</Td></Tr>
              <Tr><TdLabel sub="GFA = Plot × FAR"><span className="font-semibold">Gross floor area</span></TdLabel><Td strong>{fmtNum(sim.gfa)} sf</Td><Td className="text-[11px] font-light text-ink-2">Engine derived</Td></Tr>
              <Tr><TdLabel sub="Structural efficiency ratio">Floorplate efficiency (E)</TdLabel><Td>{fmtPct(tInputs.farEfficiency, 1)}</Td><Td className="text-[11px] font-light text-ink-2">Design parameter</Td></Tr>
              <Tr><TdLabel sub="NSA = GFA × E% · divisor across the model"><span className="font-semibold">Net sellable area</span></TdLabel><Td strong>{fmtNum(sim.nsa)} sf</Td><Td className="text-[11px] font-light text-ink-2">Engine derived</Td></Tr>
              <Tr><TdLabel sub="Efficiency drag on the sellable layout">Non-land cost / NSA sf</TdLabel><Td>AED {fmtNum(efficiencyDrag, 2)}</Td><Td className="text-[11px] font-light text-ink-2">TDC/NSA − land/NSA</Td></Tr>
              <Tr><TdLabel sub="Blended retail price anchor">Selling rate / NSA sf</TdLabel><Td>AED {fmtNum(tInputs.sellingPricePsf)}</Td><Td className="text-[11px] font-light text-ink-2">Treasury input</Td></Tr>
              <Tr tone="bg-[rgba(244,199,75,0.08)]"><TdLabel sub="GDV = NSA × blended price"><span className="font-semibold">Gross development value</span></TdLabel><Td strong>{fmtAedM(sim.gdv)}</Td><Td className="text-[11px] font-light text-ink-2">Engine derived</Td></Tr>
              <Tr><TdLabel sub="Configured unit count">Saleable units</TdLabel><Td>{fmtNum(state.viabilityResult.totalUnits)}</Td><Td className="text-[11px] font-light text-ink-2">Typology mix</Td></Tr>
            </DataTable>
          </div>

          <div>
            <h4 className="mb-2 text-[10px] font-medium uppercase tracking-[0.09em] text-ink-2">1.2 · Cost caps, leverage &amp; fiscal layer</h4>
            <DataTable head={['Component', 'Amount', '% of GDV']}>
              <Tr><TdLabel sub="Securitised land contributed in kind">Land partner equity</TdLabel><Td>{fmtAedM(sim.landValue)}</Td><Td>{fmtPct(sim.gdv > 0 ? (sim.landValue / sim.gdv) * 100 : 0, 1)}</Td></Tr>
              <Tr><TdLabel sub="Base construction at GFA rate">Hard construction</TdLabel><Td>{fmtAedM(sim.baseConstruction)}</Td><Td>{fmtPct(sim.gdv > 0 ? (sim.baseConstruction / sim.gdv) * 100 : 0, 1)}</Td></Tr>
              <Tr><TdLabel sub="PMC professional charges">PMC fees</TdLabel><Td>{fmtAedM(sim.pmcCharges)}</Td><Td>{fmtPct(sim.gdv > 0 ? (sim.pmcCharges / sim.gdv) * 100 : 0, 1)}</Td></Tr>
              <Tr><TdLabel sub="Escalation + contingency loading">Buffers</TdLabel><Td>{fmtAedM(sim.escalations + sim.contingencies)}</Td><Td>{fmtPct(sim.gdv > 0 ? ((sim.escalations + sim.contingencies) / sim.gdv) * 100 : 0, 1)}</Td></Tr>
              <Tr><TdLabel sub="Authority approvals &amp; soft costs">Approvals</TdLabel><Td>{fmtAedM(sim.approvals)}</Td><Td>{fmtPct(sim.gdv > 0 ? (sim.approvals / sim.gdv) * 100 : 0, 1)}</Td></Tr>
              <Tr><TdLabel sub="Site working capital allotment">Working capital</TdLabel><Td>{fmtAedM(sim.workingCapital)}</Td><Td>{fmtPct(sim.gdv > 0 ? (sim.workingCapital / sim.gdv) * 100 : 0, 1)}</Td></Tr>
              <Tr><TdLabel sub={`Temporary VAT bridge at ${fmtPct(tInputs.vatRate, 1)}`}>VAT outlay</TdLabel><Td>{fmtAedM(sim.grossVatLiability)}</Td><Td>{fmtPct(sim.gdv > 0 ? (sim.grossVatLiability / sim.gdv) * 100 : 0, 1)}</Td></Tr>
              <Tr><TdLabel sub={`Compounded at ${fmtPct(tInputs.financingArr, 1)} ARR over ${tInputs.projectDurationYears} yrs`}>Financing carry</TdLabel><Td tone="text-[#96291D]">{fmtAedM(sim.totalFinancingCost)}</Td><Td>{fmtPct(sim.gdv > 0 ? (sim.totalFinancingCost / sim.gdv) * 100 : 0, 1)}</Td></Tr>
              <Tr tone="bg-[rgba(22,24,28,0.05)]"><TdLabel sub="Non-land principal + VAT bridge"><span className="font-semibold">External debt facility</span></TdLabel><Td strong>{fmtAedM(sim.externalDebtRequired)}</Td><Td strong>{fmtPct(sim.ltv, 1)}</Td></Tr>
              <Tr tone="bg-[rgba(244,199,75,0.1)]"><TdLabel sub="Opening capital base + carry"><span className="font-semibold">Total development cost cap</span></TdLabel><Td strong>{fmtAedM(sim.totalDevelopmentCost)}</Td><Td strong>{fmtPct(sim.gdv > 0 ? (sim.totalDevelopmentCost / sim.gdv) * 100 : 0, 1)}</Td></Tr>
            </DataTable>
          </div>
        </div>

        {/* Dual-Sankey baseline aggregates */}
        <h4 className="mb-2 mt-5 text-[10px] font-medium uppercase tracking-[0.09em] text-ink-2">1.3 · Dual-Sankey baseline aggregates &amp; flow conservation</h4>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {[
            {
              key: 'uw',
              title: 'Macro underwriting & fiscal capitalisation',
              audit: sim.underwritingFlowAudit,
              rows: [
                { k: 'Source total (land + facility)', v: fmtAedM(sim.underwritingFlowAudit.sourceTotal) },
                { k: 'Sink total (wallets deployed)', v: fmtAedM(sim.underwritingFlowAudit.sinkTotal) },
                { k: 'Conservation residual', v: `${fmtNum(sim.underwritingFlowAudit.residual, 2)} AED` },
                { k: 'Capitalisation residual', v: `${fmtNum(sim.underwritingFlowAudit.capitalizationResidual, 2)} AED` },
                { k: 'Opening capital base', v: fmtAedM(sim.openingCapitalBase) },
                { k: 'Facility multiplier to close', v: `${sim.allInFacilityMultiplier.toFixed(3)}×` },
              ],
            },
            {
              key: 'es',
              title: 'Operational escrow & wallet disbursement',
              audit: sim.escrowFlowAudit,
              rows: [
                { k: 'Hub inflows (buyer deposits)', v: fmtAedM(sim.escrowFlowAudit.hubInflows) },
                { k: 'Hub outflows (three tiers)', v: fmtAedM(sim.escrowFlowAudit.hubOutflows) },
                { k: 'Hub balance residual', v: `${fmtNum(sim.escrowFlowAudit.hubBalanceResidual, 2)} AED` },
                { k: 'Conservation residual', v: `${fmtNum(sim.escrowFlowAudit.residual, 2)} AED` },
                { k: 'Operating wallet total', v: fmtAedM(sim.operatingWalletTotal) },
                { k: 'Non-land debt multiplier', v: `${sim.nonLandDebtMultiplier.toFixed(3)}×` },
              ],
            },
          ].map((block) => (
            <div key={block.key} className="rounded-[16px] border border-[rgba(22,24,28,0.09)] bg-[rgba(246,247,249,0.6)] p-3.5">
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                <h5 className="text-[12px] font-medium text-ink">{block.title}</h5>
                <Badge tone={block.audit.balanced ? 'mint' : 'coral'} dot>{block.audit.balanced ? 'Conserved' : 'Residual'}</Badge>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {block.rows.map((row) => (
                  <div key={row.k} className="flex min-w-0 items-baseline justify-between gap-2 border-b border-dashed border-[rgba(22,24,28,0.09)] pb-1">
                    <dt className="min-w-0 break-words text-[10.5px] font-light leading-snug text-ink-2">{row.k}</dt>
                    <dd className="shrink-0 text-[11.5px] font-medium tabular-nums text-ink">{row.v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </SectionShell>

      {/* ---------------------------- 2.0 Execution Ledger & Capital Clock */}
      <SectionShell
        id="2.0"
        index="2.0"
        title={REPORT_SECTION_TITLES['2.0']}
        subtitle="Compliance milestones and revenue inflow windows resolved month-by-month against the live project calendar."
        aside={
          <Badge tone={cfoSim.preLicense ? 'amber' : 'mint'} dot>
            {cfoSim.preLicense ? 'Pre-licence · collections blocked' : 'Licence active · inflow permitted'}
          </Badge>
        }
      >
        <TimelineSpine state={state} />

        <div className="mt-4">
          <DataTable head={['Window', 'Months', 'Days', 'Build %', 'Escrow', 'Collections', 'Burn (X+Y)', 'Draws', 'Cash', 'Escrow']} minWidth={1040}>
            {windows.map((w) => (
              <Tr key={w.id}>
                <td className="px-3 py-2 align-middle">
                  <span className="block text-[12.5px] font-semibold text-ink">{w.code} · {w.label}</span>
                  <span className="mt-0.5 block max-w-[260px] text-[10.5px] font-light leading-snug text-ink-2">{w.gate}</span>
                </td>
                <Td>M{fmtNum(w.fromMonth, 0)}–M{fmtNum(w.toMonth, 0)}</Td>
                <Td>{fmtNum(w.fromDay)}–{fmtNum(w.toDay)}</Td>
                <Td>{fmtPct(w.progressPct, 0)}</Td>
                <td className="px-3 py-2 text-right">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] text-[10.5px] font-medium ${
                      w.escrowStatus === 'Blocked'
                        ? 'border-[rgba(22,24,28,0.18)] bg-[rgba(22,24,28,0.06)] text-ink-2'
                        : w.escrowStatus === 'Gated'
                          ? 'border-[#FBE6A4] bg-[#FDF6E3] text-[#7A4A0E]'
                          : 'border-[#CFE3D6] bg-[#EFF6F1] text-[#2F5C44]'
                    }`}
                  >
                    <span className={`h-[6px] w-[6px] rounded-full ${w.escrowStatus === 'Blocked' ? 'bg-faint' : w.escrowStatus === 'Gated' ? 'bg-amber' : 'bg-[#7BB694]'}`} />
                    {w.escrowStatus}
                  </span>
                </td>
                <Td tone={w.collections > 0 ? 'text-[#2F5C44]' : 'text-ink-2'} strong={w.collections > 0}>{w.collections > 0 ? fmtAedM(w.collections) : '—'}</Td>
                <Td tone="text-[#96291D]">{fmtAedM(w.burn)}</Td>
                <Td>{w.draws > 0 ? fmtAedM(w.draws) : '—'}</Td>
                <Td>{fmtAedM(w.cashAtClose)}</Td>
                <Td>{fmtAedM(w.escrowAtClose)}</Td>
              </Tr>
            ))}
            <tr className="border-t-2 border-ink bg-ink text-white">
              <td className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-white/80">Ledger total</td>
              <Td className="text-white/85">M0–M{fmtNum(sim.dlpEndMonth, 0)}</Td>
              <Td className="text-white/85">0–{fmtNum(windows[windows.length - 1].toDay)}</Td>
              <Td className="text-white/85">100%</Td>
              <Td className="px-3 py-2.5 text-right text-[11px] font-medium text-white/70">3-state</Td>
              <Td className="px-3 py-2.5 text-right text-[12.5px] font-semibold tabular-nums text-[#F4C74B]">{fmtAedM(windows.reduce((s, w) => s + w.collections, 0))}</Td>
              <Td className="px-3 py-2.5 text-right text-[12.5px] font-semibold tabular-nums text-[#FA6C5D]">{fmtAedM(windows.reduce((s, w) => s + w.burn, 0))}</Td>
              <Td className="px-3 py-2.5 text-right text-[12.5px] font-semibold tabular-nums text-white">{fmtAedM(windows.reduce((s, w) => s + w.draws, 0))}</Td>
              <Td className="px-3 py-2.5 text-right text-[12.5px] font-semibold tabular-nums text-white">{fmtAedM(current.treasuryCash)}</Td>
              <Td className="px-3 py-2.5 text-right text-[12.5px] font-semibold tabular-nums text-white">{fmtAedM(current.escrowCash)}</Td>
            </tr>
          </DataTable>
        </div>

        {/* Theta decay / zero-equity / swipe instruments */}
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-[16px] border border-[rgba(22,24,28,0.09)] bg-white p-3.5">
            <h5 className="text-[10px] font-medium uppercase tracking-[0.09em] text-ink-2">2.1 · Theta decay meter (R = X + Y)</h5>
            <dl className="mt-2.5 space-y-1.5">
              {[
                { k: 'X · Non-human operating bleed', v: `AED ${fmtNum(cfoSim.current.nonHumanExpense / Math.max(1, cfoSim.activeElapsedDays), 0)} / day`, s: fmtAedM(cfoSim.current.nonHumanExpense) },
                { k: 'Y · Human capital retainers', v: `AED ${fmtNum(cfoSim.current.humanExpense / Math.max(1, cfoSim.activeElapsedDays), 0)} / day`, s: fmtAedM(cfoSim.current.humanExpense) },
                { k: 'R · Combined daily burn', v: `AED ${fmtNum(cfoSim.dailyBurn, 0)} / day`, s: fmtAedM(cfoSim.accumulatedBurnAed) },
                { k: 'Overhead loading c / NSA sf', v: `AED ${fmtNum(cfoSim.overheadLoadingC, 2)}`, s: `of AED ${fmtNum(cfoSim.initialWcPsfNsa, 2)} allotted` },
              ].map((row) => (
                <div key={row.k} className="flex items-baseline justify-between gap-2 border-b border-dashed border-[rgba(22,24,28,0.09)] pb-1.5">
                  <dt className="min-w-0 text-[11px] font-light text-ink-2">{row.k}</dt>
                  <dd className="shrink-0 text-right">
                    <span className="block text-[12px] font-semibold tabular-nums text-ink">{row.v}</span>
                    <span className="block text-[10px] font-light tabular-nums text-ink-2">{row.s}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-2.5">
              <div className="mb-1 flex items-baseline justify-between text-[10.5px] font-light text-ink-2">
                <span>Cushion consumed</span>
                <span className="tabular-nums">{fmtPct(cfoSim.initialWcCushionAed > 0 ? (cfoSim.erodedWcCushionAed / cfoSim.initialWcCushionAed) * 100 : 0, 1)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[rgba(22,24,28,0.08)]">
                <div className="h-full rounded-full bg-[#FA6C5D] transition-all duration-500" style={{ width: `${Math.min(100, cfoSim.initialWcCushionAed > 0 ? (cfoSim.erodedWcCushionAed / cfoSim.initialWcCushionAed) * 100 : 0)}%` }} />
              </div>
            </div>
          </div>

          <div className={`rounded-[16px] border p-3.5 ${cfoSim.zeroEquityMode ? 'border-[#FBE6A4] bg-[#FDF6E3]' : 'border-[rgba(22,24,28,0.09)] bg-white'}`}>
            <h5 className="text-[10px] font-medium uppercase tracking-[0.09em] text-ink-2">2.2 · Zero-equity debt bridge rule</h5>
            <div className="mt-2 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${cfoSim.zeroEquityMode ? 'report-pulse bg-[#F0A93B]' : 'bg-[#7BB694]'}`} />
              <span className={`text-[13px] font-semibold ${cfoSim.zeroEquityMode ? 'text-[#7A4A0E]' : 'text-ink'}`}>
                {cfoSim.zeroEquityMode ? 'TRIGGERED' : 'Dormant'}
              </span>
            </div>
            <dl className="mt-2.5 space-y-1.5">
              {[
                { k: 'Developer cash equity input', v: fmtAedM(cfo.inputs.developerCashEquity) },
                { k: 'Day-0 cushion draw to facility', v: cfoSim.zeroEquityMode ? fmtAedM(cfoSim.zeroEquityCushionDraw) : 'AED 0.00M' },
                { k: 'Effective facility cap', v: fmtAedM(cfoSim.effectiveFacilityCap) },
                { k: 'Per-diem interest from', v: cfoSim.zeroEquityMode ? 'Day 1 (active)' : 'First scheduled draw' },
              ].map((row) => (
                <div key={row.k} className="flex items-baseline justify-between gap-2 border-b border-dashed border-[rgba(22,24,28,0.1)] pb-1.5">
                  <dt className="min-w-0 text-[11px] font-light text-ink-2">{row.k}</dt>
                  <dd className="shrink-0 text-[12px] font-semibold tabular-nums text-ink">{row.v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-[10.5px] font-light leading-relaxed text-ink-2">
              Rule: nil cash equity forces the entire seeded working-capital buffer into senior debt at inception,
              activating per-diem carry immediately rather than at the first construction draw.
            </p>
          </div>

          <div className="rounded-[16px] border border-[rgba(22,24,28,0.09)] bg-white p-3.5">
            <h5 className="text-[10px] font-medium uppercase tracking-[0.09em] text-ink-2">2.3 · Milestone capital swipes</h5>
            <dl className="mt-2.5 space-y-1.5">
              {[
                { k: 'Escrow liquidity swept to facility', v: fmtAedM(current.flows.escrowDebtSwipes), tone: 'text-ink' },
                { k: 'Accrued carry retired by swipes', v: fmtAedM(current.flows.interestRetiredBySwipes), tone: 'text-[#2F5C44]' },
                { k: 'Drawn principal outstanding', v: fmtAedM(current.debtPrincipal), tone: 'text-ink' },
                { k: 'Accrued interest outstanding', v: fmtAedM(current.financingAccrued), tone: 'text-[#96291D]' },
                { k: 'Interest saved vs Day-1 bullet', v: fmtAedM(cfoSim.financingSavingsAed), tone: 'text-[#2F5C44]' },
              ].map((row) => (
                <div key={row.k} className="flex items-baseline justify-between gap-2 border-b border-dashed border-[rgba(22,24,28,0.09)] pb-1.5">
                  <dt className="min-w-0 text-[11px] font-light text-ink-2">{row.k}</dt>
                  <dd className={`shrink-0 text-[12px] font-semibold tabular-nums ${row.tone}`}>{row.v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-2.5 rounded-[12px] bg-[rgba(246,247,249,0.85)] px-2.5 py-2">
              <div className="mb-1 flex items-baseline justify-between text-[10.5px] font-light text-ink-2">
                <span>Senior exposure split</span>
                <span className="tabular-nums">{fmtPct(current.debtPrincipal + current.financingAccrued > 0 ? (current.debtPrincipal / (current.debtPrincipal + current.financingAccrued)) * 100 : 0, 1)} principal</span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-[rgba(22,24,28,0.08)]">
                <div className="h-full bg-ink transition-all duration-500" style={{ width: `${current.debtPrincipal + current.financingAccrued > 0 ? (current.debtPrincipal / (current.debtPrincipal + current.financingAccrued)) * 100 : 0}%` }} />
                <div className="h-full bg-[#FA6C5D] transition-all duration-500" style={{ width: `${current.debtPrincipal + current.financingAccrued > 0 ? (current.financingAccrued / (current.debtPrincipal + current.financingAccrued)) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        </div>
      </SectionShell>

      {/* ----------------------------------- 3.0 Escrow Allocation Structure */}
      <SectionShell
        id="3.0"
        index="3.0"
        title={REPORT_SECTION_TITLES['3.0']}
        subtitle="Dubai Law No. 8 of 2007 — every incoming dirham split into three immutable ring-fenced tiers."
        aside={<Badge tone={Math.abs(reconciliation.tierResidual) <= BALANCE_TOLERANCE_AED ? 'mint' : 'coral'} dot>Residual {fmtNum(reconciliation.tierResidual, 2)}</Badge>}
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {[
            {
              tier: 'Tier 1', name: 'Active Project Retention', pct: sim.retentionPctEff, value: sim.retentionPool,
              color: TIER_COLORS.retention, editable: true,
              condition: `Trapped until certified completion · M0 → M${sim.handoverMonth}`,
              note: 'Withheld from monthly progress-linked contractor draws inside the escrow network.',
            },
            {
              tier: 'Tier 2', name: 'Post-Handover Defects Liability', pct: sim.defectsPct, value: sim.defectsPool,
              color: TIER_COLORS.defects, editable: false,
              condition: `Locked ${sim.defectsMonths} months · M${sim.handoverMonth} → M${sim.dlpEndMonth}`,
              note: 'Fixed by law. RERA may release directly to a third-party contractor if defects are ignored.',
            },
            {
              tier: 'Tier 3', name: 'Unlocked Operating Capital', pct: sim.gdv > 0 ? (sim.unlockedPool / sim.gdv) * 100 : 0, value: sim.unlockedPool,
              color: TIER_COLORS.unlocked, editable: false,
              condition: 'Released at 20 / 40 / 60 / 80% engineer-certified gates',
              note: 'Progressive release to active operating wallets against certified construction progress.',
            },
          ].map((tier) => (
            <div key={tier.tier} className="min-w-0 overflow-hidden rounded-[18px] border border-[rgba(22,24,28,0.09)] bg-cream">
              <div className="flex items-center justify-between gap-2 border-b border-[#F4C74B]/30 px-3.5 py-2.5">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: tier.color }} />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7A4A0E]">{tier.tier}</span>
                </span>
                <Badge tone={tier.editable ? 'amber' : 'neutral'}>{tier.editable ? 'Adjustable' : 'Immutable'}</Badge>
              </div>
              <div className="px-3.5 py-3">
                <h5 className="text-[13px] font-medium leading-snug text-ink">{tier.name}</h5>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-[26px] font-light leading-none tracking-[-0.035em] tabular-nums text-ink">{fmtPct(tier.pct, tier.pct % 1 === 0 ? 0 : 1)}</span>
                  <span className="text-[15px] font-light tabular-nums text-[#7A4A0E]">{fmtAedM(tier.value)}</span>
                </div>
                <div className="mt-2 text-[10.5px] font-medium uppercase tracking-wide text-[#7A4A0E]">{tier.condition}</div>
                <p className="mt-1.5 text-[11px] font-light leading-relaxed text-ink-2">{tier.note}</p>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[rgba(22,24,28,0.09)]">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, tier.pct)}%`, background: tier.color }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 100% split conservation bar */}
        <div className="mt-4 rounded-[16px] border border-[rgba(22,24,28,0.09)] bg-[rgba(246,247,249,0.6)] p-3.5">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[10px] font-medium uppercase tracking-[0.09em] text-ink-2">Per-dirham split of buyer collections</span>
            <span className="text-[11px] font-light text-ink-2 tabular-nums">
              Σ tiers {fmtAedM(sim.unlockedPool + sim.retentionPool + sim.defectsPool)} vs GDV {fmtAedM(sim.gdv)}
            </span>
          </div>
          <div className="flex h-8 w-full overflow-hidden rounded-[10px] border border-[rgba(22,24,28,0.1)] bg-white">
            {[
              { pct: sim.gdv > 0 ? (sim.unlockedPool / sim.gdv) * 100 : 0, color: TIER_COLORS.unlocked, label: `T3 ${fmtPct(sim.gdv > 0 ? (sim.unlockedPool / sim.gdv) * 100 : 0, 1)}` },
              { pct: sim.retentionPctEff, color: TIER_COLORS.retention, label: `T1 ${fmtPct(sim.retentionPctEff, 1)}` },
              { pct: sim.defectsPct, color: TIER_COLORS.defects, label: `T2 ${fmtPct(sim.defectsPct, 0)}` },
            ].map((seg) => (
              <div
                key={seg.label}
                className="flex h-full items-center justify-center transition-all duration-500"
                style={{ width: `${seg.pct}%`, background: seg.color }}
                title={seg.label}
              >
                <span className="whitespace-nowrap px-1 text-[10px] font-bold tabular-nums text-ink/85">{seg.pct >= 9 ? seg.label : ''}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Milestone-level tier split */}
        <h4 className="mb-2 mt-5 text-[10px] font-medium uppercase tracking-[0.09em] text-ink-2">3.1 · Tranche-level tier allocation</h4>
        <DataTable head={['Collection tranche', 'Month', 'Progress', 'Share', 'Gross (AED)', 'T1 Retained', 'T2 Defects', 'T3 Released']} minWidth={900}>
          {sim.milestones.map((m) => (
            <Tr key={m.id}>
              <TdLabel sub={m.phase}>{m.label}</TdLabel>
              <Td>M{fmtNum(m.month)}</Td>
              <Td>{fmtPct(m.pct, 0)}</Td>
              <Td>{fmtPct(m.collectionPct, 0)}</Td>
              <Td strong>{fmtAedM(m.collection)}</Td>
              <Td tone="text-[#7A4A0E]">{fmtAedM(m.retained)}</Td>
              <Td tone="text-[#96291D]">{fmtAedM(m.defectsHeld)}</Td>
              <Td tone="text-[#2F5C44]">{fmtAedM(m.released)}</Td>
            </Tr>
          ))}
          <tr className="border-t-2 border-ink bg-ink text-white">
            <td className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-white/80">Total collections</td>
            <Td className="text-white/85">M{fmtNum(sim.handoverMonth)}</Td>
            <Td className="text-white/85">100%</Td>
            <Td className="text-white/85">{fmtPct(sim.milestoneSum + sim.handoverPct, 0)}</Td>
            <Td className="px-3 py-2.5 text-right text-[12.5px] font-semibold tabular-nums text-[#F4C74B]">{fmtAedM(sim.gdv)}</Td>
            <Td className="px-3 py-2.5 text-right text-[12.5px] font-semibold tabular-nums text-white">{fmtAedM(sim.retentionPool)}</Td>
            <Td className="px-3 py-2.5 text-right text-[12.5px] font-semibold tabular-nums text-white">{fmtAedM(sim.defectsPool)}</Td>
            <Td className="px-3 py-2.5 text-right text-[12.5px] font-semibold tabular-nums text-[#7BB694]">{fmtAedM(sim.unlockedPool)}</Td>
          </tr>
        </DataTable>

        {/* Pro-rata scaling verification */}
        <h4 className="mb-2 mt-5 text-[10px] font-medium uppercase tracking-[0.09em] text-ink-2">
          3.2 · Pro-rata scaling framework — largest-remainder drift verification
        </h4>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {proRata.map((group) => (
            <div key={group.parent} className="rounded-[16px] border border-[rgba(22,24,28,0.09)] bg-white p-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h5 className="text-[12px] font-medium text-ink">{group.parent}</h5>
                <Badge tone={group.driftZero ? 'mint' : 'coral'} dot>
                  {group.driftZero ? `Drift ${fmtNum(group.drift, 2)}` : `Drift ${fmtNum(group.drift, 2)}`}
                </Badge>
              </div>
              <div className="mt-1 text-[18px] font-light tabular-nums text-ink">
                {group.unit === 'AED' ? fmtAedM(group.parentValue) : `${fmtNum(group.parentValue, 2)} ${group.unit}`}
              </div>
              <div className="mt-2.5 space-y-1.5">
                {group.children.map((child) => (
                  <div key={child.label}>
                    <div className="flex items-baseline justify-between gap-2 text-[11px]">
                      <span className="min-w-0 break-words font-light leading-snug text-ink-2">{child.label}</span>
                      <span className="shrink-0 font-medium tabular-nums text-ink">
                        {group.unit === 'AED' ? fmtAedM(child.value) : fmtNum(child.value, 2)}
                        <span className="ml-1.5 text-[10px] font-light text-ink-2">{fmtPct(child.weightPct, 1)}</span>
                      </span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-[rgba(22,24,28,0.07)]">
                      <div className="h-full rounded-full bg-[#F4C74B] transition-all duration-500" style={{ width: `${Math.min(100, child.weightPct)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2.5 flex items-baseline justify-between gap-2 border-t border-[rgba(22,24,28,0.08)] pt-2 text-[11px]">
                <span className="font-light text-ink-2">Σ children</span>
                <span className="font-semibold tabular-nums text-ink">
                  {group.unit === 'AED' ? fmtAedM(group.childSum) : fmtNum(group.childSum, 2)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Live override instrument — routes through the existing engine pro-rata loop */}
        <div className="mt-3 rounded-[16px] border border-[#FBE6A4] bg-[#FDF6E3] p-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h5 className="text-[12px] font-medium text-[#7A4A0E]">Parent macro override instrument</h5>
            <span className="text-[10.5px] font-light text-[#7A4A0E]">
              Editing a parent triggers the downward pro-rata reallocation loop across its children.
            </span>
          </div>
          <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {([
              { key: 'landValue' as const, label: 'Override securitised land value', unit: 'AED', step: 1_000_000, value: treasury.inputs.landValue },
              { key: 'constructionCostGfa' as const, label: 'Override target construction cost', unit: 'AED / GFA sf', step: 5, value: treasury.inputs.constructionCostGfa },
            ]).map((field) => (
              <div key={field.key}>
                <label htmlFor={`report-override-${field.key}`} className="mb-1.5 block text-[11px] font-medium text-[#7A4A0E]">
                  {field.label}
                </label>
                <div className="eeshaan-koltey-field flex items-center bg-white px-3 py-2">
                  <input
                    id={`report-override-${field.key}`}
                    type="number"
                    inputMode="decimal"
                    step={field.step}
                    min={0}
                    value={Number.isFinite(field.value) ? field.value : ''}
                    onChange={(e) => treasury.updateParameter(field.key, parseNumericInput(e.target.value))}
                    className="w-full min-w-0 bg-transparent text-[13.5px] font-medium tabular-nums text-ink outline-none"
                  />
                  <span className="ml-2 shrink-0 text-[10.5px] font-medium uppercase tracking-wider text-ink-2">{field.unit}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] font-light text-[#7A4A0E]">
            <span>Land children: {fmtNum(treasury.micro.landPurchase, 2)} + {fmtNum(treasury.micro.landClosing, 2)}</span>
            <span>Hard children: {fmtNum(treasury.micro.hardCivil, 2)} + {fmtNum(treasury.micro.hardStructural, 2)} + {fmtNum(treasury.micro.hardFinishes, 2)}</span>
            <span className="font-semibold">Aggregate drift across all groups: {fmtNum(proRata.reduce((s, g) => s + Math.abs(g.drift), 0), 4)} AED</span>
          </div>
        </div>
      </SectionShell>

      {/* -------------------------------------- 4.0 Waterfall Settlement */}
      <SectionShell
        id="4.0"
        index="4.0"
        title={REPORT_SECTION_TITLES['4.0']}
        subtitle="Terminal bottom-up priority liquidation ladder and recovery model at project completion."
        aside={<Badge tone={Math.abs(waterfall.residual) <= BALANCE_TOLERANCE_AED ? 'mint' : 'coral'} dot>Resolved {fmtPct(gdvSettledPct, 2)}</Badge>}
      >
        {/* Settlement bar */}
        <div className="rounded-[16px] border border-[rgba(22,24,28,0.09)] bg-[rgba(246,247,249,0.6)] p-3.5">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[10px] font-medium uppercase tracking-[0.09em] text-ink-2">GDV resolution sequence</span>
            <span className="text-[11px] font-light text-ink-2 tabular-nums">
              {fmtAedM(waterfall.settled)} settled of {fmtAedM(sim.gdv)} · residual {fmtNum(waterfall.residual, 2)} AED
            </span>
          </div>
          <div className="flex h-9 w-full overflow-hidden rounded-[10px] border border-[rgba(22,24,28,0.1)] bg-white">
            {waterfall.rungs.map((rung) => (
              <div
                key={rung.rank}
                className="group relative flex h-full items-center justify-center transition-all duration-500 hover:brightness-95"
                style={{ width: `${sim.gdv > 0 ? (rung.funded / sim.gdv) * 100 : 0}%`, background: rung.color }}
                title={`Rank ${rung.rank} · ${rung.label}: ${fmtAedM(rung.funded)} (${fmtPct(rung.shareOfGdvPct, 1)} of GDV)`}
              >
                <span className="whitespace-nowrap px-1 text-[10px] font-bold tabular-nums text-ink/85">
                  {rung.shareOfGdvPct >= 8 ? `R${rung.rank}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <DataTable head={['Rank', 'Priority claim', 'Obligation', 'Settled', 'Shortfall', 'Recovery', '% of GDV']} minWidth={860}>
            {waterfall.rungs.map((rung) => (
              <Tr key={rung.rank} tone={rung.rank === 5 ? 'bg-[rgba(123,182,148,0.08)]' : ''}>
                <td className="px-3 py-2 align-middle">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white tabular-nums" style={{ background: rung.rank === 5 ? '#7BB694' : '#16181C' }}>
                    {rung.rank}
                  </span>
                </td>
                <TdLabel sub={rung.note}>{rung.label}</TdLabel>
                <Td>{fmtAedM(rung.obligation)}</Td>
                <Td strong tone={rung.funded > 0 ? 'text-ink' : 'text-ink-2'}>{fmtAedM(rung.funded)}</Td>
                <Td tone={rung.shortfall > 0.05 ? 'text-[#96291D]' : 'text-ink-2'} strong={rung.shortfall > 0.05}>
                  {rung.shortfall > 0.05 ? fmtAedM(rung.shortfall) : '—'}
                </Td>
                <Td tone={rung.recoveryPct >= 99.99 ? 'text-[#2F5C44]' : rung.recoveryPct > 0 ? 'text-[#7A4A0E]' : 'text-[#96291D]'} strong>
                  {fmtPct(rung.recoveryPct, 1)}
                </Td>
                <Td>{fmtPct(rung.shareOfGdvPct, 1)}</Td>
              </Tr>
            ))}
            <tr className="border-t-2 border-ink bg-ink text-white">
              <td className="px-3 py-2.5" />
              <td className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-white/80">Waterfall total</td>
              <Td className="text-white">{fmtAedM(waterfall.rungs.reduce((s, r) => s + r.obligation, 0))}</Td>
              <Td className="px-3 py-2.5 text-right text-[12.5px] font-semibold tabular-nums text-[#F4C74B]">{fmtAedM(waterfall.settled)}</Td>
              <Td className="px-3 py-2.5 text-right text-[12.5px] font-semibold tabular-nums text-[#FA6C5D]">
                {fmtAedM(waterfall.rungs.reduce((s, r) => s + r.shortfall, 0))}
              </Td>
              <Td className="px-3 py-2.5 text-right text-[12.5px] font-semibold tabular-nums text-white">{fmtPct(gdvSettledPct, 1)}</Td>
              <Td className="px-3 py-2.5 text-right text-[12.5px] font-semibold tabular-nums text-white">100.0%</Td>
            </tr>
          </DataTable>
        </div>

        {/* Double-entry verification loop */}
        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[1.15fr_1fr]">
          <div className={`rounded-[18px] border p-4 ${reconciliation.reconciled ? 'border-[#CFE3D6] bg-[#EFF6F1]' : 'border-[#FCD6D2] bg-[#FEECEA]'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h5 className={`text-[12px] font-semibold uppercase tracking-[0.08em] ${reconciliation.reconciled ? 'text-[#2F5C44]' : 'text-[#96291D]'}`}>
                4.1 · Double-entry balance verification loop
              </h5>
              <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${reconciliation.reconciled ? 'border-[#7BB694]/60 bg-white/70 text-[#2F5C44]' : 'border-[#FA6C5D]/60 bg-white/70 text-[#96291D]'}`}>
                <span className={`report-pulse h-2 w-2 rounded-full ${reconciliation.reconciled ? 'bg-[#7BB694]' : 'bg-[#FA6C5D]'}`} />
                {reconciliation.label}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                { k: 'Total assets', v: reconciliation.totalAssets, tone: 'text-ink' },
                { k: 'Total liabilities', v: reconciliation.totalLiabilities, tone: 'text-ink' },
                { k: 'Contributed equity + retained', v: reconciliation.totalEquity, tone: 'text-ink' },
                { k: 'Liabilities + equity', v: reconciliation.fundingTotal, tone: 'text-ink' },
              ].map((row) => (
                <div key={row.k} className="flex items-baseline justify-between gap-2 rounded-[12px] bg-white/75 px-3 py-2">
                  <span className="min-w-0 break-words text-[11px] font-light leading-snug text-ink-2">{row.k}</span>
                  <span className={`shrink-0 text-[13px] font-semibold tabular-nums ${row.tone}`}>{fmtAedM(row.v)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-2 rounded-[12px] bg-white/85 px-3 py-2.5">
              <span className="text-[11.5px] font-medium text-ink">
                Assets − (liabilities + equity) = <span className="tabular-nums">{fmtNum(reconciliation.residual, 6)} AED</span>
              </span>
              <span className={`text-[11.5px] font-semibold tabular-nums ${Math.abs(reconciliation.residual) <= BALANCE_TOLERANCE_AED ? 'text-[#2F5C44]' : 'text-[#96291D]'}`}>
                Tolerance ≤ {BALANCE_TOLERANCE_AED} AED · {Math.abs(reconciliation.residual) <= BALANCE_TOLERANCE_AED ? 'PASS' : 'FAIL'}
              </span>
            </div>
            <p className="mt-2 text-[10.5px] font-light leading-relaxed text-ink-2">
              Cross-check enforced continuously at the reporting cut-off. A variance halts committee sign-off until the
              residual is traced to a specific ledger line.
            </p>
          </div>

          <div className="rounded-[18px] border border-[rgba(22,24,28,0.09)] bg-white p-4">
            <h5 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink">4.2 · Engine assertion suite</h5>
            <p className="mt-1 text-[11px] font-light text-ink-2">
              {reconciliation.checksPassed} of {reconciliation.checksTotal} assertions passing at the live cut-off.
            </p>
            <ul className="mt-2.5 space-y-1.5">
              {cfoSim.checks.map((check) => (
                <li key={check.label} className="flex items-start gap-2 rounded-[10px] bg-[rgba(246,247,249,0.75)] px-2.5 py-1.5">
                  <span className={`mt-[3px] h-2 w-2 shrink-0 rounded-full ${check.passed ? 'bg-[#7BB694]' : 'bg-[#FA6C5D]'}`} />
                  <span className="min-w-0 text-[11px] font-light leading-snug text-ink-2">{check.label}</span>
                  <span className={`ml-auto shrink-0 text-[10px] font-semibold uppercase tracking-wide ${check.passed ? 'text-[#2F5C44]' : 'text-[#96291D]'}`}>
                    {check.passed ? 'Pass' : 'Fail'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionShell>

      {/* -------------------------------------- Disclosure register */}
      <Card variant="flat" className="report-reveal overflow-hidden" data-reveal>
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(22,24,28,0.08)] bg-[rgba(246,247,249,0.75)] px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h3 className="text-[15px] font-medium tracking-[-0.01em] text-ink">Reconciled Audit Disclosure Register</h3>
            <p className="mt-0.5 text-[11.5px] font-light text-ink-2">
              {disclosures.length} machine-traceable disclosures. This register is the exact text summary emitted into the
              PDF, XLSX and Markdown master package.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Badge tone="mint" dot>{disclosures.filter((d) => d.status === 'pass').length} verified</Badge>
            <Badge tone="amber" dot>{watchCount} monitor</Badge>
            <Badge tone={varianceCount > 0 ? 'coral' : 'neutral'} dot>{varianceCount} variance</Badge>
          </div>
        </header>

        {SECTION_IDS.map((id) => (
          <div key={id} className="border-b border-[rgba(22,24,28,0.07)] last:border-b-0">
            <div className="flex flex-wrap items-baseline gap-2 bg-white px-4 py-2.5 sm:px-6">
              <span className="text-[15px] font-light tracking-[-0.04em] text-[#F0A93B] tabular-nums">{id}</span>
              <h4 className="text-[12px] font-semibold uppercase tracking-[0.07em] text-ink">{REPORT_SECTION_TITLES[id]}</h4>
              <span className="text-[10.5px] font-light text-ink-2">{bySection(id).length} disclosures</span>
            </div>
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <tbody>
                  {bySection(id).map((row) => (
                    <tr key={row.code} className="border-t border-[rgba(22,24,28,0.06)] transition-colors duration-150 hover:bg-[rgba(244,199,75,0.07)]">
                      <td className="w-[64px] px-4 py-2 align-top sm:w-[76px] sm:px-6">
                        <span className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-2 tabular-nums">{row.code}</span>
                      </td>
                      <td className="px-2 py-2 align-top">
                        <span className="block text-[11.5px] font-medium leading-snug text-ink">{row.label}</span>
                        <span className="mt-0.5 block text-[10.5px] font-light leading-snug text-ink-2">{row.basis}</span>
                      </td>
                      <td className="px-2 py-2 text-right align-top">
                        <span className="block text-[11.5px] font-medium leading-snug tabular-nums text-ink">{row.value}</span>
                      </td>
                      <td className="w-[92px] px-4 py-2 text-right align-top sm:w-[104px] sm:px-6">
                        <StatusChip status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </Card>

      {/* -------------------------------------- basis of preparation */}
      <Card variant="cream" className="report-reveal px-4 py-4 sm:px-6" data-reveal>
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[#7A4A0E]">Basis of preparation</h4>
        <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 text-[11px] font-light leading-relaxed text-[#7A4A0E] sm:grid-cols-2">
          <p>Currency AED. Interest compounds Actual/365 on live drawn principal; repayment never reverses recognised expense.</p>
          <p>Land enters as non-cash equity. The seeded working-capital cushion is an earmark within developer cash, not an additional injection.</p>
          <p>Tier 1 retention is adjustable; Tier 2 defects liability is fixed at 5% for 12 months post-handover and excluded from swipes and payouts.</p>
          <p>Terminal developer surplus remains an SPV asset; the ledger does not assume automatic dividend distribution.</p>
          <p>Escrow release, lending eligibility and defects claims require confirmation with the escrow agent, DLD/RERA and qualified UAE counsel.</p>
          <p>Illustrative management model. Not legal, tax, financial or investment advice, and not a determination of statutory entitlement.</p>
        </div>
      </Card>
    </div>
  );
}
