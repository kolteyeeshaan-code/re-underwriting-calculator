import { fmtAedM, type Simulation } from '../engine/treasuryEngine';
import { InfoTip } from './MicroMatrix';

const COLORS = ['#F4C74B', '#F0A93B', '#AEBEE9', '#8CA0DC', '#16181C'];
const GRID = 'grid grid-cols-[140px_1fr_76px] sm:grid-cols-[160px_1fr_84px] items-center gap-2.5 sm:gap-3';

export default function MilestoneGantt({ sim }: { sim: Simulation }) {
  const H = Math.max(1, sim.handoverMonth);
  const END = Math.max(1, sim.dlpEndMonth);
  const xm = (month: number) => (month / END) * 100;
  const xp = (pct: number) => xm((pct / 100) * H);

  const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1].map((f) => Math.round(f * H));
  const dlpStart = xm(H);
  const dlpWidth = 100 - dlpStart;

  return (
    <div className="overflow-x-auto scroll-thin pb-1.5">
      <div className="min-w-[500px] sm:min-w-[560px]">
        {/* axis */}
        <div className={`${GRID} items-end pb-1`}>
          <div className="text-[10.5px] font-medium uppercase tracking-wider text-muted">Construction Phase</div>
          <div className="relative h-9">
            {ticks.map((m, i) => (
              <div key={i} className="absolute top-0 -translate-x-1/2 text-center" style={{ left: `${xm(m)}%` }}>
                <div className="text-[11px] font-medium text-ink">{i * 20}%</div>
                <div className="text-[9.5px] text-muted">M{m}</div>
              </div>
            ))}
            <div className="absolute top-0 -translate-x-full text-right" style={{ left: '100%' }}>
              <div className="text-[11px] font-medium text-[#7A4A0E]">DLP End</div>
              <div className="text-[9.5px] text-muted">M{END}</div>
            </div>
          </div>
          <div className="text-right text-[10.5px] font-medium uppercase tracking-wider text-muted">Cum. Collected</div>
        </div>

        <div className="space-y-2">
          {sim.milestones.map((m, i) => {
            const prev = i === 0 ? 0 : sim.milestones[i - 1].pct;
            const lead = m.cumulativePct - m.pct;
            return (
              <div key={m.id} className={GRID}>
                <div>
                  <div className="text-[13px] font-medium text-ink">{m.label}</div>
                  <div className="text-[11px] font-light text-muted leading-tight">{m.phase}</div>
                </div>
                <div className="relative h-8 rounded-full bg-[rgba(22,24,28,0.04)] border border-[rgba(22,24,28,0.06)] overflow-hidden">
                  {/* construction duration window */}
                  <div
                    className="absolute inset-y-1 rounded-full opacity-90 transition-all duration-300"
                    style={{
                      left: `${xp(prev)}%`,
                      width: `${Math.max(2, xp(m.pct) - xp(prev))}%`,
                      background: COLORS[i],
                    }}
                    title={`Progress ${prev}% → ${m.pct}%`}
                  />
                  {/* collection marker */}
                  <div
                    className={`absolute top-1/2 z-10 -translate-y-1/2 ${
                      xp(m.pct) > 78
                        ? '-translate-x-[85%]'
                        : xp(m.pct) < 18
                          ? '-translate-x-[15%]'
                          : '-translate-x-1/2'
                    }`}
                    style={{ left: `${xp(m.pct)}%` }}
                  >
                    <div className="whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-[9.5px] font-medium text-ink shadow-[0_1px_4px_rgba(22,24,28,0.15)] border border-[rgba(22,24,28,0.08)]">
                      {m.collectionPct}% · {fmtAedM(m.collection)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-medium tabular-nums text-ink">{m.cumulativePct}%</div>
                  <div className={`text-[10px] font-normal ${lead >= 0 ? 'text-[#2F5C44]' : 'text-[#96291D]'}`}>
                    {lead >= 0 ? '+' : ''}{lead} pts vs built
                  </div>
                </div>
              </div>
            );
          })}

          {/* 5th lifecycle phase — post-handover DLP */}
          <div className={`${GRID} border-t border-dashed border-[#FBE6A4] pt-2.5 mt-2`}>
            <div>
              <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#7A4A0E]">
                <span>🔒 Defects Liability Period</span>
                <InfoTip>
                  <b>12-Month Law No. 8 Lock.</b> Exactly 5% of total buyer collections stays ring-fenced inside the escrow network. RERA has authority to release these funds directly to third-party contractors if structural or MEP defects are ignored.
                </InfoTip>
              </div>
              <div className="text-[11px] font-light text-muted">M{H} → M{END} · 12-month hold</div>
            </div>
            <div className="relative h-8 rounded-full bg-[#FDF6E3] border border-[#FBE6A4] overflow-hidden flex items-center">
              <div
                className="absolute inset-y-0 bg-[#F4C74B]/20"
                style={{ left: `${dlpStart}%`, width: `${dlpWidth}%` }}
              />
              <span className="relative z-10 ml-3 text-[10.5px] font-medium text-[#7A4A0E]">
                🔒 5% statutory holdback active · {fmtAedM(sim.defectsPool)}
              </span>
            </div>
            <div className="text-right">
              <div className="text-[13px] font-medium text-[#7A4A0E]">5.0%</div>
              <div className="text-[10px] text-muted">Ring-fenced</div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-[11.5px] text-muted border-t border-[rgba(22,24,28,0.06)] pt-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber" /> Progressive Collections
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#FA6C5D]" /> 5% Defects Hold
          </span>
          <span>Unlocked: <b>{fmtAedM(sim.unlockedPool)}</b></span>
        </div>
      </div>
    </div>
  );
}
