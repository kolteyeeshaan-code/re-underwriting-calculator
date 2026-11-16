import { Slider } from './arc/slider/slider';
import { cn } from '../utils/cn';

/* =====================================================================
 * Eeshaan Koltey · shared slider
 *
 * Thin wrapper over the Arc single-thumb slider so every control in the
 * suite shares one animated implementation. The dual-thumb range form is
 * deliberately not exposed: `value` is a plain number, so Arc only ever
 * renders one thumb.
 *
 * Callers keep their own visible label, units and live value readout, so
 * Arc's built-in header is visually hidden (it stays in the accessibility
 * tree to name the thumb) and its readout is switched off.
 * ===================================================================== */

export interface EkSliderProps {
  /** Accessible name for the thumb. Callers still render their own visible label. */
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  /** Thicker 8px rail used by the Treasury and micro-field sliders. */
  thick?: boolean;
  className?: string;
}

export function EkSlider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
  thick,
  className,
}: EkSliderProps) {
  // Degenerate bounds would make Arc divide by a zero span.
  const safeMax = max > min ? max : min + 1;
  const safeValue = Number.isFinite(value) ? Math.min(Math.max(value, min), safeMax) : min;

  return (
    <Slider
      label={label}
      value={safeValue}
      min={min}
      max={safeMax}
      step={step > 0 ? step : 1}
      disabled={disabled}
      showValue={false}
      onValueChange={(next) => onChange(next)}
      className={cn('ek-slider', thick && 'ek-slider-thick', className)}
    />
  );
}

export default EkSlider;
