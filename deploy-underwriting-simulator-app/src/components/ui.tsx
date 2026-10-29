import { parseNumericInput } from '../engine/treasuryEngine';
import type { ReactNode } from 'react';

export function Card({
  title,
  subtitle,
  icon,
  children,
  className = '',
  variant = 'plain',
  right,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  variant?: 'plain' | 'cream' | 'flat';
  dark?: boolean;
  right?: ReactNode;
}) {
  return (
    <section
      className={`relative min-w-0 rounded-[22px] sm:rounded-[24px] p-4 sm:p-6 transition-all duration-300 ${
        variant === 'cream'
          ? 'surface-cream'
          : variant === 'flat'
            ? 'surface-flat'
            : 'surface'
      } ${className}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(22,24,28,0.08)] pb-4 mb-4">
        <div className="flex min-w-0 items-start gap-3">
          {icon && (
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(22,24,28,0.06)] text-[13px] font-medium text-[#16181C]">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-[16px] font-medium tracking-[-0.01em] text-[#16181C]">{title}</h3>
            {subtitle && (
              <p className="mt-0.5 text-[12.5px] font-normal text-[#5F646B] leading-relaxed">{subtitle}</p>
            )}
          </div>
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </header>
      <div>{children}</div>
    </section>
  );
}

interface FieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  hint?: string;
  slider?: boolean;
  sliderMax?: number;
  proRata?: boolean;
}

export function Field({
  label,
  value,
  onChange,
  unit,
  step = 1,
  min = 0,
  max,
  hint,
  slider,
  sliderMax,
  proRata,
}: FieldProps) {
  const sMax = sliderMax ?? max ?? Math.max(100, value * 2);

  return (
    <div className="min-w-0 sm:min-w-[180px] flex-1 basis-[145px] sm:basis-[200px]">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="min-w-0 text-[12px] sm:text-[12.5px] font-medium text-[#16181C]">
          {label}
        </label>
        {proRata && (
          <span className="shrink-0 rounded-full bg-[#FDF6E3] px-2 py-0.5 text-[10px] font-medium text-[#7A4A0E] border border-[#FBE6A4]">
            Pro-rata
          </span>
        )}
      </div>

      <div className="eeshaan-koltey-field flex items-center px-3 py-2 bg-white">
        <input
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ''}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(parseNumericInput(e.target.value))}
          className="w-full min-w-0 bg-transparent text-[14px] font-medium text-[#16181C] outline-none tabular-nums"
        />
        {unit && (
          <span className="ml-2 text-[11px] sm:text-[11.5px] font-medium text-[#5F646B] uppercase tracking-wider whitespace-nowrap">
            {unit}
          </span>
        )}
      </div>

      {proRata && (
        <p className="mt-1 text-[11px] font-medium text-[#7A4A0E]">
          Downstream micro sub-line items rescale automatically.
        </p>
      )}

      {slider && (
        <input
          type="range"
          min={min}
          max={sMax}
          step={step}
          value={Math.min(value, sMax)}
          onChange={(e) => onChange(parseNumericInput(e.target.value))}
          className="range-amber mt-2.5 h-2 w-full cursor-pointer appearance-none rounded-full bg-[rgba(22,24,28,0.12)]"
        />
      )}
      {hint && !proRata && <p className="mt-1 text-[11.5px] font-normal text-[#5F646B]">{hint}</p>}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = 'light',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'light' | 'dark' | 'amber';
}) {
  return (
    <div
      className={`min-w-0 rounded-[18px] p-3 sm:p-3.5 transition-all ${
        tone === 'amber'
          ? 'bg-[#FBF7E9] border border-[#F4C74B]/50 shadow-sm'
          : tone === 'dark'
            ? 'bg-[#16181C] text-white shadow-md'
            : 'bg-white border border-[rgba(22,24,28,0.09)] shadow-sm'
      }`}
    >
      <div
        className={`truncate text-[10.5px] sm:text-[11px] font-medium uppercase tracking-wider ${
          tone === 'dark' ? 'text-white/70' : 'text-[#5F646B]'
        }`}
      >
        {label}
      </div>
      <div
        className={`mt-1 break-words text-[16.5px] sm:text-[18.5px] xl:text-[20px] font-semibold tracking-tight tabular-nums ${
          tone === 'dark' ? 'text-white' : 'text-[#16181C]'
        }`}
      >
        {value}
      </div>
      {sub && (
        <div
          className={`mt-0.5 truncate text-[11px] sm:text-[11.5px] font-normal ${
            tone === 'dark' ? 'text-white/60' : 'text-[#5F646B]'
          }`}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
