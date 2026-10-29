import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { parseNumericInput } from '../engine/treasuryEngine';
import { Close } from './eeshaan-koltey/icons';
import { RoundBtn, PillBtn } from './eeshaan-koltey/ui';

/* ---------------------------------------------------------------- Tooltip */
export function InfoTip({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [coords, setCoords] = useState<{ top?: number; bottom?: number; left: number; width: number }>({
    top: 0,
    left: 12,
    width: 280,
  });

  const updatePosition = useCallback(() => {
    const el = btnRef.current;
    if (!el || typeof window === 'undefined') return;
    const rect = el.getBoundingClientRect();
    const maxW = Math.min(288, window.innerWidth - 24);
    const rawLeft = align === 'left' ? rect.left : rect.right - maxW;
    const clampedLeft = Math.max(12, Math.min(window.innerWidth - maxW - 12, rawLeft));
    const placeAbove = rect.bottom + 150 > window.innerHeight && rect.top > 160;
    setCoords(
      placeAbove
        ? {
            bottom: Math.max(12, window.innerHeight - rect.top + 8),
            left: clampedLeft,
            width: maxW,
          }
        : {
            top: rect.bottom + 8,
            left: clampedLeft,
            width: maxW,
          },
    );
  }, [align]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onPointerDown = (e: PointerEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setPinned(false);
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinned(false);
        setOpen(false);
      }
    };
    const onScrollOrResize = () => updatePosition();
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, updatePosition]);

  return (
    <span className="relative inline-flex shrink-0 align-middle">
      <button
        ref={btnRef}
        type="button"
        aria-label="Show allocation formula"
        aria-expanded={open}
        onMouseEnter={() => {
          updatePosition();
          setOpen(true);
        }}
        onMouseLeave={() => {
          if (!pinned) setOpen(false);
        }}
        onFocus={() => {
          updatePosition();
          setOpen(true);
        }}
        onBlur={() => {
          if (!pinned) setOpen(false);
        }}
        onClick={(e) => {
          e.stopPropagation();
          updatePosition();
          const next = !pinned;
          setPinned(next);
          setOpen(next);
        }}
        className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(22,24,28,0.07)] text-[10.5px] font-semibold text-ink-2 transition hover:bg-amber hover:text-ink focus:outline-none"
      >
        i
      </button>
      {open &&
        createPortal(
          <div
            role="tooltip"
            style={{ top: coords.top, bottom: coords.bottom, left: coords.left, width: coords.width }}
            className="pointer-events-none fixed z-[70] rounded-[18px] bg-ink px-3.5 py-3 text-left text-[11.5px] font-light leading-relaxed text-white shadow-[0_16px_40px_-16px_rgba(22,24,28,0.55)]"
          >
            {children}
          </div>,
          document.body,
        )}
    </span>
  );
}

/* ------------------------------------------------------------------ Modal */
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: string;
  children: ReactNode;
  footerLeft?: ReactNode;
  size?: 'standard' | 'wide' | 'fullscreen';
  closeLabel?: string;
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  badge,
  children,
  footerLeft,
  size = 'standard',
  closeLabel = 'Close',
}: ModalProps) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 backdrop-blur-md bg-[rgba(22,24,28,0.32)] sm:p-6"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`anim-pop flex w-full flex-col overflow-hidden rounded-[22px] sm:rounded-[28px] bg-white shadow-[0_24px_60px_-20px_rgba(22,24,28,0.35)] border border-white ${
          size === 'fullscreen'
            ? 'h-[92dvh] max-w-[97vw]'
            : size === 'wide'
              ? 'max-h-[92dvh] max-w-[1240px]'
              : 'max-h-[90dvh] max-w-4xl'
        }`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[rgba(22,24,28,0.06)] px-4 py-4 sm:px-6 sm:py-5 bg-[rgba(246,247,249,0.6)]">
          <div className="min-w-0">
            {badge && (
              <span className="mb-1 inline-block rounded-full bg-[#FDF6E3] px-2.5 py-0.5 text-[11px] font-medium text-[#7A4A0E] border border-[#FBE6A4]">
                {badge}
              </span>
            )}
            <h3 className="text-[17px] sm:text-[19px] font-medium tracking-[-0.02em] text-ink">{title}</h3>
            {subtitle && <p className="mt-1 text-[12px] sm:text-[12.5px] font-light text-muted leading-relaxed">{subtitle}</p>}
          </div>
          <RoundBtn icon={<Close />} label="Close" size={36} tone="soft" onClick={onClose} />
        </header>

        <div className="flex-1 space-y-5 sm:space-y-6 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 scroll-thin bg-[#FAFAFC]">{children}</div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(22,24,28,0.06)] bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="min-w-0 text-[11.5px] sm:text-[12px] font-light text-muted">{footerLeft}</div>
          <PillBtn tone="dark" onClick={onClose}>
            {closeLabel}
          </PillBtn>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------ Micro table */
export interface MicroRow {
  key: string;
  label: string;
  sublabel?: string;
  tip: ReactNode;
  value: number;
  unit: string;
  step?: number;
  onChange: (v: number) => void;
  share: number;
  impact: string;
}

interface MicroTableProps {
  title: string;
  description: string;
  accent: string;
  rows: MicroRow[];
  inputHeader: string;
  impactHeader: string;
  totalLabel: string;
  totalValue: string;
  totalImpact: string;
  tableTip?: ReactNode;
}

export function MicroTable({
  title,
  description,
  accent,
  rows,
  inputHeader,
  impactHeader,
  totalLabel,
  totalValue,
  totalImpact,
  tableTip,
}: MicroTableProps) {
  return (
    <section className="rounded-[20px] sm:rounded-[22px] bg-white border border-[rgba(22,24,28,0.08)] shadow-[0_1px_3px_rgba(22,24,28,0.04)] overflow-hidden">
      <div className="flex items-start gap-3 border-b border-[rgba(22,24,28,0.06)] px-4 py-3 sm:px-5 sm:py-3.5 bg-[rgba(246,247,249,0.5)]">
        <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: accent }} />
        <div className="min-w-0 flex-1">
          <h4 className="flex items-center gap-2 text-[14px] font-medium text-ink">
            <span>{title}</span>
            {tableTip && <InfoTip>{tableTip}</InfoTip>}
          </h4>
          <p className="mt-0.5 text-[12px] font-light text-muted">{description}</p>
        </div>
      </div>

      {/* Mobile native stacked cards (< md) — full width inputs & visible share bars */}
      <div className="divide-y divide-[rgba(22,24,28,0.06)] md:hidden">
        {rows.map((r) => (
          <div key={r.key} className="space-y-2.5 p-4">
            <div className="flex items-start justify-between gap-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                  <span className="break-words">{r.label}</span>
                  <InfoTip>{r.tip}</InfoTip>
                </div>
                {r.sublabel && <div className="mt-0.5 text-[11.5px] font-light text-muted">{r.sublabel}</div>}
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[10px] uppercase tracking-wider text-muted">{impactHeader}</div>
                <div className="text-[13.5px] font-semibold tabular-nums text-ink">{r.impact}</div>
              </div>
            </div>

            <div className="eeshaan-koltey-field flex items-center px-3 py-2 bg-white">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={r.step ?? 1}
                aria-label={r.label}
                value={Number.isFinite(r.value) ? r.value : ''}
                onChange={(e) => r.onChange(parseNumericInput(e.target.value))}
                className="w-full min-w-0 bg-transparent text-[14px] font-medium text-ink outline-none tabular-nums"
              />
              <span className="ml-2 text-[11px] font-medium text-muted whitespace-nowrap">
                {r.unit}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[rgba(22,24,28,0.06)]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, r.share)}%`, background: accent }}
                />
              </div>
              <span className="text-[11px] font-medium tabular-nums text-ink-2">
                {r.share.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-2 bg-ink px-4 py-3 text-white">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-white/80">{totalLabel}</div>
            <div className="text-[12.5px] font-medium tabular-nums text-white/90">{totalValue}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-white/60">100% Share</div>
            <div className="text-[14px] font-semibold tabular-nums text-amber">{totalImpact}</div>
          </div>
        </div>
      </div>

      {/* Tablet / Desktop 4-column matrix table (md+) */}
      <table className="hidden w-full table-fixed border-collapse text-left md:table">
        <colgroup>
          <col className="w-[34%]" />
          <col className="w-[26%]" />
          <col className="w-[20%]" />
          <col className="w-[20%]" />
        </colgroup>
        <thead>
          <tr className="bg-[rgba(246,247,249,0.8)] text-[11px] font-medium uppercase tracking-wider text-muted">
            <th className="px-5 py-2.5">Line item</th>
            <th className="border-l border-[rgba(22,24,28,0.06)] px-3 py-2.5">{inputHeader}</th>
            <th className="border-l border-[rgba(22,24,28,0.06)] px-3 py-2.5">Share</th>
            <th className="border-l border-[rgba(22,24,28,0.06)] px-5 py-2.5 text-right">{impactHeader}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-[rgba(22,24,28,0.05)] align-middle hover:bg-[rgba(246,247,249,0.4)]">
              <td className="px-5 py-3">
                <div className="flex items-start gap-1.5 text-[13px] font-medium text-ink">
                  <span className="min-w-0 break-words">{r.label}</span>
                  <InfoTip>{r.tip}</InfoTip>
                </div>
                {r.sublabel && <div className="mt-0.5 text-[11.5px] font-light text-muted">{r.sublabel}</div>}
              </td>
              <td className="border-l border-[rgba(22,24,28,0.05)] px-3 py-3">
                <div className="eeshaan-koltey-field flex items-center px-2.5 py-1.5 bg-white">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={r.step ?? 1}
                    value={Number.isFinite(r.value) ? r.value : ''}
                    onChange={(e) => r.onChange(parseNumericInput(e.target.value))}
                    className="w-full min-w-0 bg-transparent text-[13px] font-medium text-ink outline-none tabular-nums"
                  />
                  <span className="ml-1 text-[10.5px] font-light text-muted whitespace-nowrap">
                    {r.unit}
                  </span>
                </div>
              </td>
              <td className="border-l border-[rgba(22,24,28,0.05)] px-3 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[rgba(22,24,28,0.06)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, r.share)}%`, background: accent }}
                    />
                  </div>
                  <span className="w-10 text-right text-[11.5px] font-light tabular-nums text-ink-2">
                    {r.share.toFixed(1)}%
                  </span>
                </div>
              </td>
              <td className="border-l border-[rgba(22,24,28,0.05)] px-5 py-3 text-right text-[13px] font-medium tabular-nums text-ink">
                <span className="whitespace-nowrap">{r.impact}</span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-[rgba(22,24,28,0.08)] bg-ink text-white">
            <td className="px-5 py-3 text-[12px] font-medium uppercase tracking-wide">{totalLabel}</td>
            <td className="border-l border-white/10 px-3 py-3 text-[13px] font-medium tabular-nums">{totalValue}</td>
            <td className="border-l border-white/10 px-3 py-3 text-[11px] text-white/60">100%</td>
            <td className="border-l border-white/10 px-5 py-3 text-right text-[13.5px] font-semibold tabular-nums text-amber">
              {totalImpact}
            </td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

/* --------------------------------------------------- Aggregate stat strip */
export function AggregateStrip({ items }: { items: { label: string; value: string; sub?: string }[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 rounded-[20px] bg-white p-3 sm:p-3.5 border border-[rgba(22,24,28,0.06)] shadow-sm">
      {items.map((it) => (
        <div key={it.label} className="min-w-0 rounded-[16px] bg-[rgba(246,247,249,0.7)] px-3 py-2.5 sm:px-3.5">
          <div className="min-h-[2.4em] break-words text-[10px] sm:text-[10.5px] leading-tight font-normal uppercase tracking-wider text-muted">{it.label}</div>
          <div className="mt-0.5 break-words text-[15.5px] sm:text-[17px] font-light tabular-nums text-ink">{it.value}</div>
          {it.sub && <div className="truncate text-[10.5px] sm:text-[11px] font-light text-muted">{it.sub}</div>}
        </div>
      ))}
    </div>
  );
}
