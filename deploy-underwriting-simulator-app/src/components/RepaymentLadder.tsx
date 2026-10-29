import { fmtAedM, fmtM, type Simulation } from '../engine/treasuryEngine';

export default function RepaymentLadder({ sim }: { sim: Simulation }) {
  const ladder = sim.distributionLadder;
  const gdv = sim.gdv;

  return (
    <div className="space-y-4">
      {/* Visual horizontal stack bar */}
      <div className="h-6 w-full rounded-full bg-[rgba(22,24,28,0.08)] overflow-hidden flex shadow-inner">
        {ladder.map((item) => {
          const pct = gdv > 0 ? (item.value / gdv) * 100 : 0;
          if (pct <= 0) return null;
          return (
            <div
              key={item.name}
              style={{ width: `${pct}%`, background: item.color }}
              className="h-full transition-all duration-500 relative group first:rounded-l-full last:rounded-r-full"
              title={`${item.name}: ${fmtAedM(item.value)} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* Itemised Rungs List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {ladder.map((item, index) => {
          const pct = gdv > 0 ? (item.value / gdv) * 100 : 0;
          return (
            <div
              key={item.name}
              className="rounded-[18px] bg-white p-4 border border-[rgba(22,24,28,0.06)] shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-white text-[10px] font-bold"
                    style={{ background: item.color }}
                  >
                    {index + 1}
                  </span>
                  <span className="text-[12.5px] font-medium text-ink truncate">{item.short}</span>
                </div>
                <div className="text-[11px] font-light text-muted">{item.name}</div>
              </div>

              <div className="mt-3 pt-2 border-t border-[rgba(22,24,28,0.06)] flex items-baseline justify-between">
                <span className="text-[16px] font-semibold tabular-nums text-ink">{fmtM(item.value)}</span>
                <span className="text-[11px] font-medium tabular-nums text-muted">{pct.toFixed(1)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
