import { useId, type ReactNode } from 'react';
import { cfoFmt, cfoNumber } from '../../engine/cfoEngine';
import { Card as EeshaanKolteyCard } from '../eeshaan-koltey/ui';

export function CfoPanel({
  title,
  subtitle,
  number,
  children,
  right,
  className = '',
}: {
  title: string;
  subtitle?: string;
  number?: string;
  children: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <EeshaanKolteyCard className={`min-w-0 p-4 sm:p-6 ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 sm:gap-4 border-b border-[rgba(22,24,28,0.08)] pb-4 mb-4">
        <div className="flex min-w-0 items-start gap-3">
          {number && (
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#16181C] text-[11px] font-medium text-white">
              {number}
            </span>
          )}
          <div className="min-w-0">
            <h3 className="text-[15.5px] sm:text-[16px] font-medium tracking-tight text-[#16181C]">{title}</h3>
            {subtitle && <p className="mt-0.5 text-[12px] sm:text-[12.5px] font-normal text-[#5F646B] leading-relaxed">{subtitle}</p>}
          </div>
        </div>
        {right}
      </header>
      <div>{children}</div>
    </EeshaanKolteyCard>
  );
}

export function CfoNumberField({
  label,
  value,
  onChange,
  unit,
  step = 1,
  min = 0,
  max,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="min-w-0 flex-1">
      {label && <label htmlFor={id} className="mb-1.5 block text-[12px] font-medium text-[#16181C]">{label}</label>}
      <div className="eeshaan-koltey-field flex items-center px-3 py-2 bg-white">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(cfoNumber(e.currentTarget.valueAsNumber, min, max))}
          className="w-full min-w-0 bg-transparent text-[13.5px] font-medium tabular-nums text-[#16181C] outline-none"
        />
        {unit && (
          <span className="ml-2 text-[11px] font-medium text-[#5F646B] uppercase tracking-wider whitespace-nowrap">
            {unit}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-[11px] font-normal text-[#5F646B]">{hint}</p>}
    </div>
  );
}

export function CfoSelect({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="min-w-0 flex-1">
      {label && <label htmlFor={id} className="mb-1.5 block text-[12px] font-medium text-[#16181C]">{label}</label>}
      <div className="eeshaan-koltey-field flex items-center px-3 py-2 bg-white">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          className="w-full min-w-0 cursor-pointer appearance-none bg-transparent text-[13.5px] font-medium text-[#16181C] outline-none"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="text-[#16181C]">
              {opt.label}
            </option>
          ))}
        </select>
        <span className="ml-1 text-[10px] text-[#5F646B]">▼</span>
      </div>
      {hint && <p className="mt-1 text-[11px] font-normal text-[#5F646B]">{hint}</p>}
    </div>
  );
}

export function CfoDateField({
  label,
  value,
  onChange,
  min,
  max,
  invalid = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  invalid?: boolean;
}) {
  const id = useId();
  return (
    <div className="min-w-0 flex-1">
      {label && <label htmlFor={id} className="mb-1.5 block text-[12px] font-medium text-[#16181C]">{label}</label>}
      <div className={`eeshaan-koltey-field flex items-center px-3 py-2 bg-white ${invalid ? 'border-[#FA6C5D]' : ''}`}>
        <input
          id={id}
          type="date"
          value={value}
          min={min}
          max={max}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.currentTarget.value)}
          className="w-full min-w-0 bg-transparent text-[13.5px] font-medium text-[#16181C] outline-none"
        />
      </div>
      {invalid && <p className="mt-1 text-[11px] font-medium text-[#96291D]">Date precedes corporate initialization.</p>}
    </div>
  );
}

export function CfoMetric({
  label,
  value,
  note,
  dark = false,
  warning = false,
}: {
  label: string;
  value: string;
  note: string;
  dark?: boolean;
  warning?: boolean;
}) {
  return (
    <EeshaanKolteyCard
      variant={dark ? 'plain' : 'plain'}
      className={`p-4 sm:p-5 min-w-0 ${dark ? 'bg-[#16181C] text-white' : ''}`}
    >
      <div className={`text-[10.5px] sm:text-[11px] font-medium uppercase tracking-wider ${dark ? 'text-white/60' : 'text-[#5F646B]'}`}>
        {label}
      </div>
      <div className={`mt-1 break-words text-[19px] sm:text-[22px] xl:text-[24px] font-light tracking-[-0.03em] tabular-nums ${
        warning ? 'text-[#96291D]' : dark ? 'text-white' : 'text-[#16181C]'
      }`}>
        {value}
      </div>
      <p className={`mt-1 text-[11.5px] sm:text-[12px] font-normal leading-snug ${dark ? 'text-white/50' : 'text-[#5F646B]'}`}>{note}</p>
    </EeshaanKolteyCard>
  );
}

export interface CfoTableRow {
  id: string;
  label: string;
  detail?: string;
  period?: number;
  cumulative?: number;
  emphasis?: boolean;
  heading?: boolean;
}

export function CfoStatementTable({
  rows,
  firstColumn = 'Account / movement',
  periodLabel = 'Today to cut-off',
  cumulativeLabel = 'Since activation',
  showPeriod = true,
}: {
  rows: CfoTableRow[];
  firstColumn?: string;
  periodLabel?: string;
  cumulativeLabel?: string;
  showPeriod?: boolean;
}) {
  return (
    <div className="overflow-x-auto scroll-thin rounded-[20px] border border-[rgba(22,24,28,0.08)] bg-white shadow-sm">
      <table className={`w-full border-collapse text-sm ${showPeriod ? 'min-w-[440px] sm:min-w-[560px]' : 'min-w-0'}`}>
        <thead>
          <tr className="bg-[rgba(246,247,249,0.7)] text-left text-[10.5px] sm:text-[11px] font-medium uppercase tracking-wider text-[#5F646B] border-b border-[rgba(22,24,28,0.08)]">
            <th scope="col" className="px-3.5 py-2.5 sm:px-5 sm:py-3">{firstColumn}</th>
            {showPeriod && <th scope="col" className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3 text-right">{periodLabel}</th>}
            <th scope="col" className="whitespace-nowrap px-3.5 py-2.5 sm:px-5 sm:py-3 text-right">{cumulativeLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) =>
            row.heading ? (
              <tr key={row.id} className="border-t border-[rgba(22,24,28,0.08)] bg-[rgba(246,247,249,0.5)]">
                <th colSpan={showPeriod ? 3 : 2} className="px-3.5 py-2 sm:px-5 text-left text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#7A4A0E]">
                  {row.label}
                </th>
              </tr>
            ) : (
              <tr
                key={row.id}
                className={`border-t border-[rgba(22,24,28,0.05)] hover:bg-[rgba(246,247,249,0.4)] ${
                  row.emphasis ? 'bg-[rgba(246,247,249,0.9)] font-medium' : ''
                }`}
              >
                <th scope="row" className="px-3.5 py-2.5 sm:px-5 sm:py-3 text-left font-normal text-[#16181C] text-[12.5px] sm:text-[13.5px]">
                  <span className="break-words">{row.label}</span>
                  {row.detail && <span className="mt-0.5 block max-w-sm text-[11px] font-light leading-snug text-[#5F646B]">{row.detail}</span>}
                </th>
                {showPeriod && (
                  <td className={`whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3 text-right tabular-nums text-[12.5px] sm:text-[13px] ${
                    row.period !== undefined && row.period < 0 ? 'text-[#96291D] font-medium' : 'text-[#16181C]'
                  }`}>
                    {row.period === undefined ? '-' : cfoFmt(row.period, 2)}
                  </td>
                )}
                <td className={`whitespace-nowrap px-3.5 py-2.5 sm:px-5 sm:py-3 text-right font-medium tabular-nums text-[12.5px] sm:text-[13px] ${
                  row.cumulative !== undefined && row.cumulative < 0 ? 'text-[#96291D]' : 'text-[#16181C]'
                }`}>
                  {row.cumulative === undefined ? '-' : cfoFmt(row.cumulative, 2)}
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

export function CfoAlert({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <div
      role={error ? 'alert' : undefined}
      className={`rounded-[18px] border px-4 py-3 text-[12.5px] leading-relaxed ${
        error
          ? 'border-[#FCD6D2] bg-[#FEECEA] text-[#96291D]'
          : 'border-[#FBE6A4] bg-[#FDF6E3] text-[#7A4A0E]'
      }`}
    >
      {children}
    </div>
  );
}
