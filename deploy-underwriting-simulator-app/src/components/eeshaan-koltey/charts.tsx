import { useId } from "react";
import { cn } from "../../utils/cn";

export interface MiniGaugeProps {
  percent: number;
  label?: string;
  sub?: string;
  size?: number;
  className?: string;
}

export function EeshaanKolteyGauge({
  percent,
  label = "Underwritten Margin",
  sub = "of baseline hurdle",
  size = 200,
  className,
}: MiniGaugeProps) {
  const uid = useId().replace(/:/g, "");
  const p = Math.max(0, Math.min(100, percent));
  const W = size;
  const H = size * 0.58;
  const cx = W / 2;
  const cy = H - 8;
  const r = (size / 2) - 18;
  const len = Math.PI * r;
  const a = Math.PI * (1 - p / 100);
  const ex = cx + r * Math.cos(a);
  const ey = cy - r * Math.sin(a);
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const off = len * (1 - p / 100);

  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
        <defs>
          <linearGradient id={`gauge-bg-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#F6CE52" />
            <stop offset="60%" stopColor="#FBE6A4" />
            <stop offset="100%" stopColor="#E6EBF9" />
          </linearGradient>
          <filter id={`gauge-blur-${uid}`} x1="-20%" y1="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* Background track */}
        <path
          d={arc}
          fill="none"
          stroke="rgba(22, 24, 28, 0.08)"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Glow under-stroke */}
        <path
          d={arc}
          fill="none"
          stroke={`url(#gauge-bg-${uid})`}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={len}
          strokeDashoffset={off}
          filter={`url(#gauge-blur-${uid})`}
          opacity="0.5"
        />

        {/* Active gauge stroke */}
        <path
          d={arc}
          fill="none"
          stroke={`url(#gauge-bg-${uid})`}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={len}
          strokeDashoffset={off}
        />

        {/* Terminal endpoint circle */}
        {p > 0 && (
          <circle
            cx={ex}
            cy={ey}
            r="5"
            fill="#F4C74B"
            stroke="#ffffff"
            strokeWidth="2.5"
            className="shadow-sm"
          />
        )}
      </svg>

      <div className="text-center mt-[-18px]">
        <div className="flex items-baseline justify-center">
          <span className="text-[26px] font-light tracking-[-0.03em] text-ink">
            {p.toFixed(1)}
          </span>
          <span className="text-[13px] font-light text-muted ml-0.5">%</span>
        </div>
        <p className="text-[11.5px] font-light text-muted">{label}</p>
        {sub && <p className="text-[10px] text-faint">{sub}</p>}
      </div>
    </div>
  );
}

export function RangeTrack({
  value,
  min = 0,
  max = 100,
  unit = "%",
  label,
  className,
}: {
  value: number;
  min?: number;
  max?: number;
  unit?: string;
  label?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <div className="flex justify-between items-baseline mb-1.5 text-[12px]">
          <span className="text-muted font-light">{label}</span>
          <span className="text-ink font-medium tabular-nums">
            {value.toLocaleString()} {unit}
          </span>
        </div>
      )}
      <div className="relative h-2 rounded-full bg-[rgba(22,24,28,0.06)] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#FBE6A4] to-[#F4C74B] transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
