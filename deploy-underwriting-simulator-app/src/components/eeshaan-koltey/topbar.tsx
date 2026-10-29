import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "../../utils/cn";
import { RoundBtn, PillBtn } from "./ui";
import { Logo, Download, Sparkles } from "./icons";

export interface WorkspaceTab {
  id: string;
  label: string;
  shortLabel?: string;
  tag?: string;
}

export function EeshaanKolteyTopBar({
  workspaces,
  active,
  onSelect,
  onExport,
  onMethodology,
}: {
  workspaces: WorkspaceTab[];
  active: string;
  onSelect: (id: string) => void;
  onExport: () => void;
  onMethodology: () => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const items = useRef<Record<string, HTMLButtonElement | null>>({});
  const [ind, setInd] = useState<{ x: number; w: number; ready: boolean }>({ x: 0, w: 0, ready: false });

  const measure = useCallback(() => {
    const el = items.current[active];
    if (!el || !wrap.current) return;
    setInd({ x: el.offsetLeft, w: el.offsetWidth, ready: true });
  }, [active]);

  useLayoutEffect(measure, [measure]);

  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (wrap.current) ro.observe(wrap.current);
    Object.values(items.current).forEach((el) => {
      if (el) ro.observe(el);
    });
    window.addEventListener("resize", measure, { passive: true });
    const t = window.setTimeout(measure, 300);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.clearTimeout(t);
    };
  }, [measure]);

  return (
    <header className="sticky top-0 z-40 border-b border-[rgba(22,24,28,0.06)] bg-[rgba(236,239,244,0.84)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-3 gap-y-2.5 px-3.5 py-2.5 sm:px-7 sm:py-3.5 lg:flex-nowrap">
        {/* Brand logo & mark */}
        <div className="order-1 flex min-w-0 shrink-0 items-center gap-2.5 sm:gap-3">
          <span className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_4px_14px_-6px_rgba(22,24,28,0.35)] text-ink">
            <Logo className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[14.5px] sm:text-[15px] font-medium tracking-[-0.01em] text-ink">
              Eeshaan Koltey
              <span className="text-[11px] font-normal text-muted">
                <span className="hidden xl:inline"> · Real Estate Intelligence Suite</span>
              </span>
            </h1>
            <p className="hidden sm:block truncate text-[11px] sm:text-[11.5px] font-light text-muted">
              Underwriting &amp; Treasury
            </p>
          </div>
        </div>

        {/* Action controls — accessible across mobile, tablet, and desktop */}
        <div className="order-2 lg:order-3 flex shrink-0 items-center gap-1.5 sm:gap-2">
          <PillBtn
            tone="amber"
            icon={<Download />}
            onClick={onExport}
            className="px-3 py-1.5 sm:px-3.5 xl:px-4 sm:py-2 text-[12px] sm:text-[13px]"
          >
            <span className="sm:hidden">Export</span>
            <span className="hidden sm:inline">Export Pack</span>
          </PillBtn>

          <PillBtn
            tone="soft"
            icon={<Sparkles />}
            onClick={onMethodology}
            className="hidden sm:inline-flex lg:hidden xl:inline-flex px-3.5 py-1.5 sm:px-4 sm:py-2 text-[12.5px] sm:text-[13px]"
          >
            Methodology
          </PillBtn>

          <RoundBtn
            icon={<Sparkles />}
            label="Methodology"
            tone="soft"
            size={36}
            onClick={onMethodology}
            className="sm:hidden lg:inline-flex xl:hidden"
          />

        </div>

        {/* Measured sliding-pill navigation */}
        <nav
          ref={wrap}
          aria-label="Workspace switcher"
          className="order-3 lg:order-2 relative flex w-full lg:w-auto items-center gap-0.5 overflow-x-auto no-scrollbar rounded-full bg-white/55 p-1 shadow-[0_1px_3px_rgba(22,24,28,0.05)] border border-[rgba(22,24,28,0.08)] max-w-full"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1 left-0 h-[calc(100%-8px)] rounded-full bg-white shadow-[0_2px_10px_-3px_rgba(22,24,28,0.22)]"
            style={{
              transform: `translate3d(${ind.x}px,0,0) scaleX(${ind.w / 100})`,
              transformOrigin: "left center",
              width: "100px",
              opacity: ind.ready ? 1 : 0,
              willChange: "transform",
              transition: "transform .45s cubic-bezier(.16,1,.3,1), opacity .3s linear",
            }}
          />
          {workspaces.map((w, idx) => {
            const isActive = active === w.id;
            return (
              <button
                key={w.id}
                ref={(el) => {
                  items.current[w.id] = el;
                }}
                type="button"
                onClick={() => onSelect(w.id)}
                className={cn(
                  "relative z-10 flex-1 lg:flex-initial inline-flex items-center justify-center rounded-full px-2.5 sm:px-3.5 py-1.5 text-[12px] sm:text-[13px] font-medium whitespace-nowrap transition-colors duration-300",
                  isActive ? "text-ink" : "text-ink-2 hover:text-ink",
                )}
              >
                <span className="mr-1.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[rgba(22,24,28,0.06)] text-[10px] font-bold">
                  {idx + 1}
                </span>
                <span className="sm:hidden">{w.shortLabel ?? w.label}</span>
                <span className="hidden sm:inline">{w.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
