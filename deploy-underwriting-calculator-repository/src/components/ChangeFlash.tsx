import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Marks a number that has just changed.
 *
 * Purpose: state indication. When an underwriter edits an input, several
 * figures move at once; a short amber wash shows which ones responded.
 *
 * Why it is built this way:
 * - Opacity only, run through the Web Animations API, so it stays on the
 *   compositor and never touches layout or re-renders React per frame.
 * - One persistent overlay that is restarted, not a keyed element that is
 *   re-mounted, so dragging a slider does not churn the DOM.
 * - Skips the first render: mounting a view is not a change.
 * - The figure itself never moves or fades, so it stays readable.
 */
export function ChangeFlash({
  value,
  children,
  className = '',
}: {
  value: string | number;
  children: ReactNode;
  className?: string;
}) {
  const overlay = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);
  const running = useRef<Animation | null>(null);

  useEffect(() => {
    if (Object.is(previous.current, value)) return;
    previous.current = value;
    const node = overlay.current;
    if (!node || typeof node.animate !== 'function') return;
    running.current?.cancel();
    running.current = node.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 600,
      easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
    });
  }, [value]);

  useEffect(() => () => running.current?.cancel(), []);

  return (
    <span className={`relative inline-block max-w-full ${className}`}>
      <span
        ref={overlay}
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-1.5 -inset-y-0.5 rounded-md bg-amber/25 opacity-0"
      />
      <span className="relative">{children}</span>
    </span>
  );
}
