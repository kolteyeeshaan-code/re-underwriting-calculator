import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";
import { cn } from "../../utils/cn";
import { ArrowUpRight, Close } from "./icons";

/* ============================================================ Card */
export function Card({
  className,
  variant = "plain",
  children,
  ...rest
}: {
  className?: string;
  variant?: "plain" | "cream" | "flat";
  children: ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative rounded-[24px]",
        variant === "plain" && "surface",
        variant === "cream" && "surface-cream",
        variant === "flat" && "surface-flat",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHead({
  title,
  sub,
  right,
  className,
  compact,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap sm:flex-nowrap items-start justify-between gap-3", className)}>
      <div className="min-w-0 flex-1">
        <h3
          className={cn(
            "break-words font-medium tracking-[-0.01em] text-ink",
            compact ? "text-[14px]" : "text-[15.5px]",
          )}
        >
          {title}
        </h3>
        {sub && <p className="mt-0.5 break-words text-[12.5px] font-light text-muted leading-relaxed">{sub}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

/* ============================================================ Buttons */
export function RoundBtn({
  icon,
  label,
  onClick,
  size = 40,
  className,
  tone = "outline",
}: {
  icon?: ReactNode;
  label: string;
  onClick?: () => void;
  size?: number;
  className?: string;
  tone?: "outline" | "solid" | "soft" | "ghost" | "amber";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{ width: size, height: size }}
      className={cn(
        "press inline-flex shrink-0 items-center justify-center rounded-full",
        tone === "outline" &&
          "border border-[rgba(22,24,28,0.12)] bg-white/60 text-ink hover:bg-white shadow-[0_1px_3px_rgba(22,24,28,0.06)]",
        tone === "solid" && "bg-ink text-white shadow-[0_8px_20px_-8px_rgba(22,24,28,0.7)]",
        tone === "soft" && "bg-[rgba(22,24,28,0.045)] text-ink-2 hover:bg-[rgba(22,24,28,0.09)]",
        tone === "ghost" && "text-ink-2 hover:bg-[rgba(22,24,28,0.06)] hover:text-ink",
        tone === "amber" && "bg-amber text-ink shadow-[0_4px_14px_-4px_rgba(240,169,59,0.5)] hover:bg-[#F0A93B]",
        className,
      )}
    >
      <span
        className="pointer-events-none flex items-center justify-center"
        style={{ width: size * 0.45, height: size * 0.45 }}
      >
        {icon ?? <ArrowUpRight width="100%" height="100%" />}
      </span>
    </button>
  );
}

export function PillBtn({
  children,
  onClick,
  tone = "soft",
  className,
  icon,
  active,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "soft" | "dark" | "ghost" | "white" | "amber";
  className?: string;
  icon?: ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "press inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-normal whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed",
        tone === "soft" && "bg-white/60 text-ink-2 hover:bg-white hover:text-ink shadow-[0_1px_2px_rgba(22,24,28,0.04)]",
        tone === "white" && "bg-white text-ink shadow-[0_2px_10px_-4px_rgba(22,24,28,0.18)] hover:bg-white/95",
        tone === "dark" && "bg-ink text-white shadow-[0_10px_24px_-12px_rgba(22,24,28,0.9)] hover:bg-[#24272C]",
        tone === "amber" && "bg-amber text-ink font-medium shadow-[0_4px_14px_-4px_rgba(240,169,59,0.5)] hover:bg-[#F0A93B]",
        tone === "ghost" && "text-ink-2 hover:text-ink hover:bg-[rgba(22,24,28,0.05)]",
        active && "bg-ink text-white",
        className,
      )}
    >
      {icon && <span className="h-4 w-4 [&>svg]:h-full [&>svg]:w-full">{icon}</span>}
      {children}
    </button>
  );
}

/* ============================================================ Badge */
export type Tone = "amber" | "coral" | "neutral" | "mint" | "plain";

export function Badge({
  children,
  tone = "neutral",
  dot,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-[4.5px] text-[12px] leading-none font-normal whitespace-nowrap",
        tone === "amber" && "bg-[#FDF6E3] text-[#7A4A0E] border border-[#FBE6A4]",
        tone === "coral" && "bg-[#FEECEA] text-[#96291D] border border-[#FCD6D2]",
        tone === "neutral" && "bg-[rgba(22,24,28,0.05)] text-ink-2 border border-hair",
        tone === "mint" && "bg-[#EFF6F1] text-[#2F5C44] border border-[#CFE3D6]",
        tone === "plain" && "text-ink-2",
        className,
      )}
    >
      {dot && (
        <i
          className={cn(
            "h-[6px] w-[6px] shrink-0 rounded-full",
            tone === "amber" && "bg-amber",
            tone === "coral" && "bg-coral",
            tone === "neutral" && "bg-faint",
            tone === "mint" && "bg-[#7BB694]",
          )}
        />
      )}
      {children}
    </span>
  );
}

export function StageDot({ tone }: { tone: Tone }) {
  return (
    <i
      className={cn(
        "h-[7px] w-[7px] shrink-0 rounded-full inline-block",
        tone === "amber" && "bg-amber",
        tone === "coral" && "bg-coral",
        tone === "mint" && "bg-[#7BB694]",
        (tone === "neutral" || tone === "plain") && "bg-faint",
      )}
    />
  );
}

/* ============================================================ BigStat */
export function BigStat({
  prefix,
  value,
  unit,
  size = 46,
  className,
  splitUnit = true,
}: {
  prefix?: string;
  value: string | number;
  unit?: string;
  size?: number;
  className?: string;
  splitUnit?: boolean;
}) {
  return (
    <div
      className={cn("flex items-baseline font-light tracking-[-0.045em] text-ink", className)}
      style={{ fontSize: size, lineHeight: 1 }}
    >
      {prefix && (
        <span className="text-[0.6em] text-muted font-normal mr-[2px]">{prefix}</span>
      )}
      <span>{value}</span>
      {unit && (
        <span
          className={cn(
            "ml-1 font-light tracking-normal text-muted",
            splitUnit ? "text-[0.45em]" : "text-[0.6em]",
          )}
        >
          {unit}
        </span>
      )}
    </div>
  );
}

/* ============================================================ Eeshaan Koltey Field */
export function EeshaanKolteyField({
  label,
  value,
  onChange,
  unit,
  step = 1,
  min,
  max,
  hint,
  type = "number",
  className,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  hint?: string;
  type?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("min-w-0 flex-1", className)}>
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-medium text-ink-2">
        {label}
      </label>
      <div className="eeshaan-koltey-field flex items-center overflow-hidden px-3 py-2">
        <input
          id={id}
          type={type}
          step={step}
          min={min}
          max={max}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 bg-transparent text-[13.5px] font-medium text-ink outline-none tabular-nums"
        />
        {unit && (
          <span className="ml-2 text-[11px] font-medium text-muted uppercase tracking-wider whitespace-nowrap">
            {unit}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-[11px] font-light text-muted">{hint}</p>}
    </div>
  );
}

/* ============================================================ UnderlineTabs */
export function UnderlineTabs<T extends string>({
  tabs,
  value,
  onChange,
  shortLabels,
  className,
}: {
  tabs: readonly T[] | T[];
  value: T;
  onChange: (t: T) => void;
  shortLabels?: Partial<Record<T, string>>;
  className?: string;
}) {
  return (
    <div className={cn("flex max-w-full items-center gap-4 overflow-x-auto no-scrollbar border-b border-hair", className)}>
      {tabs.map((tab) => {
        const active = tab === value;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={cn(
              "relative shrink-0 whitespace-nowrap pb-2.5 text-[12.5px] sm:text-[13.5px] font-normal transition-colors",
              active ? "text-ink font-medium" : "text-muted hover:text-ink-2",
            )}
          >
            {shortLabels?.[tab] ? (
              <>
                <span className="lg:hidden">{shortLabels[tab]}</span>
                <span className="hidden lg:inline">{tab}</span>
              </>
            ) : tab}
            {active && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-ink" />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================ Modal (Eeshaan Koltey styled) */
export function Modal({
  open,
  onClose,
  title,
  sub,
  children,
  footer,
  size = "standard",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "standard" | "wide" | "fullscreen";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 backdrop-blur-md bg-[rgba(22,24,28,0.32)] sm:p-6"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "anim-pop flex w-full flex-col overflow-hidden rounded-[22px] sm:rounded-[28px] bg-white/95 shadow-[0_24px_60px_-20px_rgba(22,24,28,0.35)] backdrop-blur-2xl border border-white",
          size === "fullscreen" && "h-[92dvh] max-w-[97vw]",
          size === "wide" && "max-h-[92dvh] max-w-[1300px]",
          size === "standard" && "max-h-[90dvh] max-w-[620px]",
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-hair px-4 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <h3 className="text-[17px] sm:text-[19px] font-medium tracking-[-0.02em] text-ink">{title}</h3>
            {sub && <p className="mt-1 text-[12px] sm:text-[12.5px] font-light text-muted leading-relaxed">{sub}</p>}
          </div>
          <RoundBtn icon={<Close />} label="Close dialog" size={36} tone="soft" onClick={onClose} />
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 scroll-thin">{children}</div>

        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2.5 border-t border-hair bg-[rgba(246,247,249,0.7)] px-4 py-3.5 sm:px-6 sm:py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

/* ============================================================ Toast Provider */
type ToastItem = { id: string; msg: string };
const ToastCtx = createContext<((msg: string) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((msg: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-2), { id, msg }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 sm:bottom-5 inset-x-0 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="anim-pop flex max-w-full items-center gap-2 rounded-2xl sm:rounded-full bg-ink px-4 py-2 text-[12.5px] sm:text-[13px] text-white shadow-[0_12px_32px_-8px_rgba(22,24,28,0.5)]"
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber text-ink text-[10px] font-bold">
              ✓
            </span>
            <span className="min-w-0 break-words">{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): (msg: string) => void {
  const ctx = useContext(ToastCtx);
  return ctx ?? (() => {});
}
