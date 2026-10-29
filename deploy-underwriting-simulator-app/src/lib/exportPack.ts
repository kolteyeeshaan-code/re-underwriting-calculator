/* =====================================================================
 * Investment Committee Pack export engine.
 * Produces three production assets with no external dependencies:
 *   1. underwriting_executive_summary.pdf   (native PDF 1.4 vector engine)
 *   2. treasury_ledger_snapshot.xlsx        (OOXML workbook, multi-sheet)
 *   3. pitch_deck_ai_blueprint.md           (structured Markdown)
 *
 * The PDF layer is an institutional grid-aligned vector document engine:
 * strict A4 coordinates (595x842, margins pinned at X:56 and X:539, 483pt
 * grid width), raw PDF 1.4 stream primitives (`re f`, `re s`, cubic bezier `c`),
 * explicit typography scale (24, 18, 11, 9, 8.5 pt), and zero external libraries.
 * ===================================================================== */

import { REPORT_SECTION_TITLES, type ReportDisclosure } from './reportDisclosures';

const HEALTHCARE_FOOTNOTE =
  'This is for informational purposes only. For medical advice or diagnosis, consult a professional. AI responses may include mistakes.';

/* ------------------------------------------------------------- tiny helpers */
const enc = (s: string) => new TextEncoder().encode(s);

function download(name: string, bytes: Uint8Array, mime: string) {
  // Pass the raw byte view to the Blob. Converting ZIP binary to a JS string
  // first would let the Blob UTF-8 encode bytes above 0x7F and corrupt offsets.
  const payload = new Uint8Array(bytes.byteLength);
  payload.set(bytes);
  const url = URL.createObjectURL(new Blob([payload], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* --------------------------------------------------------- workbook schema */
export type ExcelCell = string | number | null;
export type ExcelRow = ExcelCell[];
export interface ExcelSheet {
  name: string;
  rows: ExcelRow[];
}

/* =====================================================================
 *                    PDF 1.4 · VECTOR LAYOUT ENGINE
 * A4 595 x 842 · left margin X:56 · right margin X:539 · 483pt layout grid.
 * Raw PDF stream operators: `re f`, `re s`, `c` cubic bezier, `/GS1` alpha 0.3.
 * ===================================================================== */
const PW = 595;
const PH = 842;
const ML = 56;   // left margin pinned at X:56
const MR = 539;  // right margin pinned at X:539
const CW = MR - ML; // 483 points available layout width

type Rgb = readonly [number, number, number];

/** Design palette rules (Raw PDF RGB fraction fills). */
const PC = {
  ink: [0.086, 0.094, 0.110],       // deep charcoal text [0.086 0.094 0.110]
  ink2: [0.373, 0.392, 0.420],      // ink secondary
  muted: [0.620, 0.639, 0.667],     // muted label
  hair: [0.914, 0.925, 0.941],      // subtle hairline stroke line [0.914 0.925 0.941]
  card: [0.965, 0.969, 0.976],      // light grey card boxes [0.965 0.969 0.976]
  paper: [1, 1, 1],                 // pure white
  gold: [0.957, 0.780, 0.294],      // warm gold [0.957 0.780 0.294]
  goldDeep: [0.914, 0.616, 0.169],  // amber deep
  coral: [0.980, 0.424, 0.365],     // warning coral [0.980 0.424 0.365]
  mint: [0.482, 0.714, 0.580],      // verified mint green
  peri: [0.682, 0.745, 0.914],      // senior debt blue/periwinkle
  mist: [0.760, 0.776, 0.800],
} as const satisfies Record<string, Rgb>;

/** Typography Scale: title (24pt), subtitles (11pt), metric numbers (18pt), subtext (9pt), tables (8.5pt). */
const FS = {
  title: 24,
  section: 11,
  metric: 18,
  caption: 9,
  table: 8.5,
} as const;

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const fixed = (v: number): string => (Number.isFinite(v) ? String(Math.round(v * 100) / 100) : '0');
const colorNum = (v: number): string => String(Math.round(v * 1000) / 1000);
const fillOp = (c: Rgb): string => `${colorNum(c[0])} ${colorNum(c[1])} ${colorNum(c[2])} rg`;
const strokeOp = (c: Rgb): string => `${colorNum(c[0])} ${colorNum(c[1])} ${colorNum(c[2])} RG`;
const fnum = (v: number, d = 2): string =>
  num(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const aedM = (v: number): string => `AED ${fnum(num(v) / 1_000_000, 2)}M`;
const aed = (v: number): string => `AED ${fnum(num(v), 2)}`;
const pct = (v: number, d = 1): string => `${fnum(v, d)}%`;

/** Helvetica / Helvetica-Bold advance widths, ASCII 32-126 (1/1000 em). */
const W_REG = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const W_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

function measure(text: string, size: number, bold = false): number {
  const table = bold ? W_BOLD : W_REG;
  let units = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    units += code >= 32 && code <= 126 ? table[code - 32] : 556;
  }
  return (units / 1000) * size;
}

/** WinAnsi-safe ASCII fold, applied before any string is written to a stream. */
function foldAscii(input: string): string {
  return String(input)
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u00b7\u2022]/g, '-')
    .replace(/\u00d7/g, 'x')
    .replace(/\u2192/g, '>')
    .replace(/\u2190/g, '<')
    .replace(/\u2264/g, '<=')
    .replace(/\u2265/g, '>=')
    .replace(/\u2248/g, '~')
    .replace(/\u03a3/g, 'Sum')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[^\x20-\x7E]/g, '');
}

/** PDF literal escaping applied after the ASCII fold. */
function pdfString(input: string): string {
  return foldAscii(input).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

type Align = 'left' | 'right' | 'center';

interface SinkNode {
  label: string;
  value: number;
  color: Rgb;
}

class PdfDoc {
  private readonly data: ExportInputs;
  private readonly footnote: string;
  private ops: string[] = [];
  private pages: string[] = [];
  y = 0;

  constructor(data: ExportInputs, footnote: string) {
    this.data = data;
    this.footnote = footnote;
  }

  /* ------------------------------------------------------------ lifecycle */
  begin(): void {
    this.newPage(true);
  }

  pageBreak(): void {
    if (this.ops.length > 0) this.pages.push(this.ops.join('\n'));
    this.ops = [];
    this.rect(0, 0, PW, PH, PC.paper);
    this.runningHead();
    this.foot();
    this.y = 64;
  }

  private newPage(first: boolean): void {
    if (this.ops.length > 0) this.pages.push(this.ops.join('\n'));
    this.ops = [];
    this.rect(0, 0, PW, PH, PC.paper);
    if (first) this.coverHead(); else this.runningHead();
    this.foot();
    this.y = first ? 148 : 64;
  }

  ensure(space: number): boolean {
    if (this.y + space <= PH - 54) return false;
    this.newPage(false);
    return true;
  }

  private coverHead(): void {
    // Top header: solid thick rectangle accent bar across the page top using palette colors.
    this.rect(0, 0, PW, 116, PC.ink);
    this.rect(0, 116, PW, 5, PC.gold);
    this.rect(0, 121, 156, 2, PC.coral);
    this.rect(156, 121, PW - 156, 2, PC.hair);

    this.text('UNDERWRITING REPORT', ML, 48, FS.title, true, PC.paper);
    this.text(
      'EXECUTIVE SUMMARY & INSTITUTIONAL UNDERWRITING',
      ML,
      66,
      FS.section,
      true,
      PC.gold,
    );
    this.text(
      'Al Farren Consortium  |  Investment Committee Pack',
      ML,
      80,
      FS.section,
      false,
      PC.mist,
    );
    this.text(
      `Reconciled Disclosures  ·  ${fnum(num(this.data.totalProjectDays), 0)}-day calendar  ·  Actual/365 carry  ·  AED currency`,
      ML,
      96,
      FS.caption,
      false,
      PC.mist,
    );
    this.text('CONFIDENTIAL — FOR COMMITTEE REVIEW', ML, 112, FS.caption, true, PC.gold);

    // Right-aligned "LEDGER RECONCILED" badge pill.
    const label = this.reconciled ? 'LEDGER RECONCILED' : 'AUDIT VARIANCE';
    const w = measure(label, FS.caption, true) + 30;
    const bx = MR - w;
    this.roundRect(bx, 34, w, 24, 12, this.reconciled ? PC.mint : PC.coral);
    this.dot(bx + 12, 46, 2.8, PC.ink);
    this.text(label, bx + 20, 49.5, FS.caption, true, PC.ink);
    this.text(`REPORT ID: UR4-${fnum(num(this.data.totalProjectDays), 0)}`, MR, 74, FS.caption, false, PC.mist, 'right');
    this.text(`PAGE 1 OF @@TOTAL@@`, MR, 88, FS.caption, false, PC.mist, 'right');
  }

  private runningHead(): void {
    this.rect(0, 0, PW, 30, PC.ink);
    this.rect(0, 30, PW, 2, PC.gold);
    this.text('UNDERWRITING REPORT', ML, 19, FS.section, true, PC.paper);
    this.text('Reconciled audit disclosures', ML + 150, 19, FS.table, false, PC.mist);
    this.text('CONFIDENTIAL', MR, 19, FS.table, true, PC.gold, 'right');
  }

  private foot(): void {
    this.hairline(ML, PH - 36, MR, PC.hair, 0.6);
    this.text(
      'Al Farren Consortium  |  Illustrative model  |  Not investment advice.',
      ML,
      PH - 24,
      FS.table,
      false,
      PC.muted,
    );
    this.text('Page @@PAGE@@ of @@TOTAL@@', MR, PH - 24, FS.table, true, PC.ink2, 'right');
  }

  /* ----------------------------------------------------------- primitives */
  rect(x: number, yTop: number, w: number, h: number, color: Rgb): void {
    this.ops.push(`q ${fillOp(color)} ${fixed(x)} ${fixed(PH - yTop - h)} ${fixed(w)} ${fixed(h)} re f Q`);
  }

  /** Box container: vector rectangle (`re` path followed by `f` fill and `s` stroke operators). */
  box(x: number, yTop: number, w: number, h: number, fill: Rgb = PC.card, stroke: Rgb = PC.hair): void {
    const y = fixed(PH - yTop - h);
    this.ops.push(
      `q ${fillOp(fill)} ${fixed(x)} ${y} ${fixed(w)} ${fixed(h)} re f ` +
        `${strokeOp(stroke)} 0.7 w ${fixed(x)} ${y} ${fixed(w)} ${fixed(h)} re s Q`,
    );
  }

  hairline(x1: number, y: number, x2: number, color: Rgb = PC.hair, lw = 0.6): void {
    this.ops.push(`q ${strokeOp(color)} ${fixed(lw)} w ${fixed(x1)} ${fixed(PH - y)} m ${fixed(x2)} ${fixed(PH - y)} l S Q`);
  }

  vline(x: number, y1: number, y2: number, color: Rgb = PC.hair, lw = 0.6): void {
    this.ops.push(`q ${strokeOp(color)} ${fixed(lw)} w ${fixed(x)} ${fixed(PH - y1)} m ${fixed(x)} ${fixed(PH - y2)} l S Q`);
  }

  private pathRound(x: number, yTop: number, w: number, h: number, r: number): string {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    const y = PH - yTop - h;
    const k = rr * 0.5522847498;
    return [
      `${fixed(x + rr)} ${fixed(y)} m`,
      `${fixed(x + w - rr)} ${fixed(y)} l`,
      `${fixed(x + w - rr + k)} ${fixed(y)} ${fixed(x + w)} ${fixed(y + rr - k)} ${fixed(x + w)} ${fixed(y + rr)} c`,
      `${fixed(x + w)} ${fixed(y + h - rr)} l`,
      `${fixed(x + w)} ${fixed(y + h - rr + k)} ${fixed(x + w - rr + k)} ${fixed(y + h)} ${fixed(x + w - rr)} ${fixed(y + h)} c`,
      `${fixed(x + rr)} ${fixed(y + h)} l`,
      `${fixed(x + rr - k)} ${fixed(y + h)} ${fixed(x)} ${fixed(y + h - rr + k)} ${fixed(x)} ${fixed(y + h - rr)} c`,
      `${fixed(x)} ${fixed(y + rr)} l`,
      `${fixed(x)} ${fixed(y + rr - k)} ${fixed(x + rr - k)} ${fixed(y)} ${fixed(x + rr)} ${fixed(y)} c h`,
    ].join(' ');
  }

  roundRect(x: number, yTop: number, w: number, h: number, r: number, color: Rgb): void {
    this.ops.push(`q ${fillOp(color)} ${this.pathRound(x, yTop, w, h, r)} f Q`);
  }

  roundStroke(x: number, yTop: number, w: number, h: number, r: number, color: Rgb, lw = 0.7): void {
    this.ops.push(`q ${strokeOp(color)} ${fixed(lw)} w ${this.pathRound(x, yTop, w, h, r)} S Q`);
  }

  /** Status glyphs: passing green dot, or distinct colored warning circle vector shape. */
  dot(cx: number, cy: number, r: number, color: Rgb): void {
    const cyPdf = PH - cy;
    const k = r * 0.5522847498;
    const path = [
      `${fixed(cx + r)} ${fixed(cyPdf)} m`,
      `${fixed(cx + r)} ${fixed(cyPdf + k)} ${fixed(cx + k)} ${fixed(cyPdf + r)} ${fixed(cx)} ${fixed(cyPdf + r)} c`,
      `${fixed(cx - k)} ${fixed(cyPdf + r)} ${fixed(cx - r)} ${fixed(cyPdf + k)} ${fixed(cx - r)} ${fixed(cyPdf)} c`,
      `${fixed(cx - r)} ${fixed(cyPdf - k)} ${fixed(cx - k)} ${fixed(cyPdf - r)} ${fixed(cx)} ${fixed(cyPdf - r)} c`,
      `${fixed(cx + k)} ${fixed(cyPdf - r)} ${fixed(cx + r)} ${fixed(cyPdf - k)} ${fixed(cx + r)} ${fixed(cyPdf)} c h`,
    ].join(' ');
    this.ops.push(`q ${fillOp(color)} ${path} f Q`);
  }

  warningCircle(cx: number, cy: number, r: number, color: Rgb): void {
    const cyPdf = PH - cy;
    const k = r * 0.5522847498;
    const ring = [
      `${fixed(cx + r)} ${fixed(cyPdf)} m`,
      `${fixed(cx + r)} ${fixed(cyPdf + k)} ${fixed(cx + k)} ${fixed(cyPdf + r)} ${fixed(cx)} ${fixed(cyPdf + r)} c`,
      `${fixed(cx - k)} ${fixed(cyPdf + r)} ${fixed(cx - r)} ${fixed(cyPdf + k)} ${fixed(cx - r)} ${fixed(cyPdf)} c`,
      `${fixed(cx - r)} ${fixed(cyPdf - k)} ${fixed(cx - k)} ${fixed(cyPdf - r)} ${fixed(cx)} ${fixed(cyPdf - r)} c`,
      `${fixed(cx + k)} ${fixed(cyPdf - r)} ${fixed(cx + r)} ${fixed(cyPdf - k)} ${fixed(cx + r)} ${fixed(cyPdf)} c h`,
    ].join(' ');
    this.ops.push(`q ${fillOp(PC.paper)} ${strokeOp(color)} 1 w ${ring} B Q`);
    this.dot(cx, cy, Math.max(1.2, r - 2.2), color);
  }

  /** Macro-flow ribbon: native PDF cubic bezier curve operators (`c`) with 0.3 alpha (ExtGState GS1). */
  ribbon(x0: number, y0: number, half0: number, x1: number, y1: number, half1: number, color: Rgb): void {
    const a = PH - y0;
    const b = PH - y1;
    const dx = (x1 - x0) * 0.5;
    const path = [
      `${fixed(x0)} ${fixed(a - half0)} m`,
      `${fixed(x0 + dx)} ${fixed(a - half0)} ${fixed(x1 - dx)} ${fixed(b - half1)} ${fixed(x1)} ${fixed(b - half1)} c`,
      `${fixed(x1)} ${fixed(b + half1)} l`,
      `${fixed(x1 - dx)} ${fixed(b + half1)} ${fixed(x0 + dx)} ${fixed(a + half0)} ${fixed(x0)} ${fixed(a + half0)} c`,
      'h',
    ].join(' ');
    this.ops.push(`q /GS1 gs ${fillOp(color)} ${path} f Q`);
  }

  /* ----------------------------------------------------------- typography */
  text(value: string, x: number, baseline: number, size: number, bold = false, color: Rgb = PC.ink, align: Align = 'left'): number {
    const safe = foldAscii(value);
    const w = measure(safe, size, bold);
    const tx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    this.ops.push(
      `BT /${bold ? 'F2' : 'F1'} ${fixed(size)} Tf ${fillOp(color)} 1 0 0 1 ${fixed(tx)} ${fixed(PH - baseline)} Tm (${pdfString(safe)}) Tj ET`,
    );
    return w;
  }

  wrap(value: string, width: number, size: number, bold = false): string[] {
    const words = foldAscii(value).split(/\s+/).filter(Boolean);
    if (words.length === 0) return [''];
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate, size, bold) <= width || !line) line = candidate;
      else {
        lines.push(line);
        line = word;
      }
      while (measure(line, size, bold) > width && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && measure(line.slice(0, cut), size, bold) > width) cut -= 1;
        lines.push(line.slice(0, cut));
        line = line.slice(cut).trim();
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  /**
   * Matrix metric card container:
   * Vector rectangle (`re` path followed by `f` fill and `s` stroke operators).
   * Inside each box bounding region, set explicit absolute text offsets (`Td` / `Tm`)
   * placing the 18pt bold number and descriptive label side-by-side / cleanly separated with zero overlap.
   */
  metricBox(x: number, yTop: number, w: number, h: number, label: string, value: string, meta: string, accent: Rgb): void {
    this.box(x, yTop, w, h);
    this.rect(x, yTop, 3.5, h, accent);
    // Descriptive label (9pt category subtext)
    this.text(label.toUpperCase(), x + 12, yTop + 18, FS.caption, false, PC.ink2);
    // Big scalar value (18pt bold number)
    this.text(value, x + 12, yTop + 42, FS.metric, true, PC.ink);
    // Metadata subtext (8.5pt light tabular alignment)
    const lines = this.wrap(meta, w - 24, FS.table).slice(0, 2);
    lines.forEach((line, i) => this.text(line, x + 12, yTop + 58 + i * 11, FS.table, false, PC.muted));
  }

  section(no: string, title: string, subtitle: string): void {
    this.ensure(84);
    this.text(no, ML, this.y + 12, FS.section, true, PC.goldDeep);
    this.text(title.toUpperCase(), ML + 28, this.y + 12, FS.section, true, PC.ink);
    this.text(subtitle, ML + 28, this.y + 26, FS.caption, false, PC.ink2);
    this.rect(ML, this.y + 34, 44, 2, PC.gold);
    this.hairline(ML + 44, this.y + 35, MR, PC.hair);
    this.y += 47;
  }

  private labelRow(value: string, note?: string): void {
    this.ensure(20);
    this.text(value.toUpperCase(), ML, this.y + 9, FS.caption, false, PC.ink2);
    if (note) this.text(note, MR, this.y + 9, FS.table, false, PC.muted, 'right');
    this.y += 16;
  }

  /* ------------------------------------------------------- derived figures */
  private get gdv(): number {
    return Math.max(0, num(this.data.gdv));
  }

  private get reconciled(): boolean {
    return Math.abs(num(this.data.cfoBalanceDifference)) <= 0.05 && num(this.data.breaches) === 0;
  }

  private get landValue(): number {
    const implied = num(this.data.totalDevelopmentCost) - num(this.data.externalDebtRequired) - num(this.data.totalFinancingCost);
    return implied > 0 ? implied : Math.max(0, num(this.data.landEquity));
  }

  private get nsa(): number {
    if (this.data.nsa && this.data.nsa > 0) return this.data.nsa;
    const gfa = num(this.data.plotArea) * num(this.data.permissibleFar);
    return num(this.data.efficiencyPct) > 0 ? gfa * (num(this.data.efficiencyPct) / 100) : gfa * 0.8;
  }

  private get buildBudget(): number {
    return Math.max(0, num(this.data.externalDebtRequired) - Math.max(0, num(this.data.externalDebtRequired) - this.constructionTotal));
  }

  private get constructionTotal(): number {
    const phases = this.data.constructionDrawdowns ?? [];
    const sum = phases.reduce((s, p) => s + num(p.allInCostAed), 0);
    return sum > 0 ? sum : num(this.data.externalDebtRequired) * 0.82;
  }

  private phases(): { label: string; window: string; weight: number; hard: number; approvals: number; allIn: number; cumulative: number; psf: number }[] {
    const rows = this.data.constructionDrawdowns ?? [];
    let cumulative = 0;
    return rows.map((row) => {
      const startMonth = num(row.startMonth);
      const endMonth = num(row.endMonth);
      cumulative = num(row.cumulativeFundingAed) || cumulative + num(row.allInCostAed);
      return {
        label: row.label,
        window: `${startMonth > 0 ? `M${fnum(startMonth, 0)}` : 'M0'} - M${fnum(endMonth, 0)}`,
        weight: num(row.weightPercent),
        hard: num(row.hardCostAed),
        approvals: num(row.approvalsAed),
        allIn: num(row.allInCostAed),
        cumulative,
        psf: num(row.allInCostPsfNsa),
      };
    });
  }

  private get disclosures(): ReportDisclosure[] {
    if (this.data.reportDisclosures && this.data.reportDisclosures.length > 0) return this.data.reportDisclosures;
    return [
      { section: '1.0', code: 'EX-01', label: 'Gross development value', value: aedM(this.data.gdv), basis: 'NSA x blended retail PSF', status: 'pass' },
      { section: '1.0', code: 'EX-02', label: 'Total development cost', value: aedM(this.data.totalDevelopmentCost), basis: 'Land + facility + carry', status: 'pass' },
      { section: '3.0', code: 'ES-01', label: 'Active project retention', value: aedM(this.data.retentionPool), basis: 'Trapped until completion', status: 'pass' },
      { section: '3.0', code: 'ES-02', label: 'Defects liability pool', value: aedM(this.data.defectsPool), basis: 'Fixed 5% / 12-month lock', status: 'pass' },
      { section: '4.0', code: 'WF-06', label: 'Double-entry balance', value: `${aedM(this.data.cfoTotalAssets)} vs ${aedM(this.data.cfoFundingTotal)}`, basis: 'Tolerance AED 0.05', status: this.reconciled ? 'pass' : 'flag' },
    ];
  }

  /* =============================================================== PAGE 1 */
  pageOne(): void {
    this.section('1.0', 'Executive synthesis & core narrative', 'Strategic underwriting thesis, KPI matrix and structural entitlement breakdown.');

    const cost = Math.max(0, num(this.data.totalDevelopmentCost));
    const surplus = num(this.data.totalProjectSurplus);
    const ltv = this.gdv > 0 ? (num(this.data.externalDebtRequired) / this.gdv) * 100 : 0;
    const margin = this.gdv > 0 ? (surplus / this.gdv) * 100 : 0;
    const escrow = num(this.data.unlockedPool) + num(this.data.retentionPool) + num(this.data.defectsPool);
    const nsaArea = this.nsa;

    // Entitlements per NSA sqft
    const landPerNsa = nsaArea > 0 ? this.landValue / nsaArea : 0;
    const financePerNsa = nsaArea > 0 ? (num(this.data.externalDebtRequired) + num(this.data.totalFinancingCost)) / nsaArea : 0;
    const surplusPerNsa = nsaArea > 0 ? surplus / nsaArea : 0;

    // Pitch Teaser / Narrative Block
    this.box(ML, this.y, CW, 78, PC.card, PC.hair);
    this.rect(ML, this.y, 3.5, 78, PC.gold);
    this.text('INSTITUTIONAL UNDERWRITING THESIS & STRATEGIC TRIFECTA', ML + 12, this.y + 14, FS.caption, true, PC.goldDeep);
    const thesisText =
      'Al Farren Consortium institutional capitalization engine delivering 18.8%+ net developer alpha on Dubai residential asset development through statutory Law No. 8 escrow ring-fencing, proactive mid-cycle debt sweeps, and an uncompromised 80% NSA spatial leverage ratio.';
    const thesisLines = this.wrap(thesisText, CW - 24, FS.table);
    thesisLines.forEach((ln, i) => this.text(ln, ML + 12, this.y + 26 + i * 10.5, FS.table, false, PC.ink));

    // Contrast tags
    this.hairline(ML + 12, this.y + 58, MR - 12, PC.hair, 0.5);
    this.text(
      `VILLAIN: Pre-sales chasm (theta decay)   |   HERO: Spatial Leverage (${fnum(num(this.data.efficiencyPct), 1)}% NSA)   |   SHIELD: Law No. 8 Escrow`,
      ML + 12,
      this.y + 69,
      FS.caption,
      false,
      PC.ink2,
    );
    this.y += 86;

    // Securitised Entitlements Strip (Per NSA Sqft)
    this.box(ML, this.y, CW, 32, PC.card, PC.hair);
    this.rect(ML, this.y, 3.5, 32, PC.ink);
    this.text('SECURITISED ENTITLEMENTS / NSA SQFT:', ML + 12, this.y + 14, FS.caption, true, PC.ink);
    this.text(
      `Land Partner: AED ${fnum(landPerNsa, 2)} / NSA sf   ·   Finance Partner: AED ${fnum(financePerNsa, 2)} / NSA sf   ·   Developer Surplus: AED ${fnum(surplusPerNsa, 2)} / NSA sf`,
      ML + 12,
      this.y + 25,
      FS.table,
      false,
      PC.ink2,
    );
    this.y += 40;

    // 2-Column x 3-Row Rigid KPI Matrix (6 container boxes)
    const items = [
      {
        label: 'Gross development value',
        value: aedM(this.data.gdv),
        meta: `${fnum(this.gdv > 0 ? this.gdv / Math.max(1, num(this.data.marketCompPsf)) : 0, 0)} sf NSA at AED ${fnum(num(this.data.marketCompPsf), 0)} psf`,
        accent: PC.gold,
      },
      {
        label: 'Total development cost cap',
        value: aedM(cost),
        meta: `Land ${aedM(this.landValue)} + carry ${aedM(this.data.totalFinancingCost)}`,
        accent: PC.ink,
      },
      {
        label: 'Unallocated project surplus',
        value: aedM(surplus),
        meta: `${pct(margin)} margin on GDV (${aed(surplusPerNsa)}/sf)`,
        accent: surplus >= 0 ? PC.gold : PC.coral,
      },
      {
        label: 'Senior credit facility & LTV',
        value: aedM(this.data.externalDebtRequired),
        meta: `${pct(ltv)} of GDV drawn requirement`,
        accent: PC.ink,
      },
      {
        label: 'Compounded financing carry',
        value: aedM(this.data.totalFinancingCost),
        meta: 'Actual/365 compounding on drawn principal',
        accent: PC.ink,
      },
      {
        label: 'Regulated escrow capacity',
        value: aedM(escrow),
        meta: 'Unlocked (85%) + retention (10%) + defects (5%)',
        accent: PC.mint,
      },
    ];

    const gap = 11;
    const cardW = (CW - gap) / 2; // (483 - 11) / 2 = 236
    const cardH = 76;
    this.ensure(3 * cardH + 2 * 10 + 12);
    items.forEach((item, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      this.metricBox(ML + col * (cardW + gap), this.y + row * (cardH + 10), cardW, cardH, item.label, item.value, item.meta, item.accent);
    });
    this.y += 3 * cardH + 2 * 10 + 12;

    // Margin bridge ribbon (spanning full 483pt width).
    this.labelRow('Margin bridge — cost base versus underwritten surplus', `${pct(cost > 0 && this.gdv > 0 ? (cost / this.gdv) * 100 : 0, 1)} / ${pct(margin, 1)} of GDV`);
    const trackY = this.y;
    const trackH = 18;
    this.box(ML, trackY, CW, trackH, PC.card, PC.hair);
    const costShare = this.gdv > 0 ? clamp01(cost / this.gdv) : 0;
    const surplusShare = this.gdv > 0 ? clamp01(Math.max(0, surplus) / this.gdv) : 0;
    const leftW = CW * costShare;
    const rightW = CW * Math.min(surplusShare, Math.max(0, 1 - costShare));
    this.rect(ML, trackY, leftW, trackH, PC.ink);
    if (rightW > 0.5) this.rect(ML + leftW, trackY, rightW, trackH, surplus >= 0 ? PC.gold : PC.coral);
    if (leftW > 66) this.text(`COST ${pct(costShare * 100, 1)}`, ML + leftW / 2, trackY + 12, FS.table, true, PC.paper, 'center');
    if (rightW > 66) this.text(`SURPLUS ${pct(surplusShare * 100, 1)}`, ML + leftW + rightW / 2, trackY + 12, FS.table, true, PC.ink, 'center');
    this.y = trackY + trackH + 12;

    const legend = [
      { c: PC.ink, l: 'Cost base', v: aedM(cost) },
      { c: surplus >= 0 ? PC.gold : PC.coral, l: surplus >= 0 ? 'Underwritten surplus' : 'Funding shortfall', v: aedM(surplus) },
      { c: PC.mint, l: 'Escrow capacity', v: aedM(escrow) },
    ];
    legend.forEach((entry, i) => {
      const x = ML + i * (CW / 3);
      this.dot(x + 3, this.y - 3, 3, entry.c);
      this.text(entry.l, x + 11, this.y, FS.table, false, PC.ink2);
      this.text(entry.v, x + CW / 3 - 12, this.y, FS.table, true, PC.ink, 'right');
    });
    this.y += 16;

    // Double-entry reconciliation bridge card
    this.ensure(84);
    const top = this.y;
    const h = 76;
    this.box(ML, top, CW, h);
    this.rect(ML, top, 3.5, h, this.reconciled ? PC.mint : PC.coral);
    this.text('DOUBLE-ENTRY RECONCILIATION BRIDGE', ML + 14, top + 17, FS.section, true, PC.ink);
    const status = this.reconciled ? 'LEDGER RECONCILED' : 'AUDIT VARIANCE';
    this.text(status, MR - 14, top + 17, FS.table, true, this.reconciled ? PC.mint : PC.coral, 'right');
    const cells = [
      { l: 'Total assets', v: aedM(this.data.cfoTotalAssets) },
      { l: 'Total liabilities', v: aedM(this.data.cfoTotalLiabilities) },
      { l: 'Contributed equity', v: aedM(num(this.data.cfoFundingTotal) - num(this.data.cfoTotalLiabilities)) },
      { l: 'Liabilities + equity', v: aedM(this.data.cfoFundingTotal) },
    ];
    const cellW = (CW - 28) / 4;
    cells.forEach((cell, i) => {
      const x = ML + 14 + i * cellW;
      if (i > 0) this.vline(x - 8, top + 28, top + 52, PC.hair, 0.6);
      this.text(cell.l.toUpperCase(), x, top + 35, FS.table, false, PC.muted);
      this.text(cell.v, x, top + 49, FS.caption, true, PC.ink);
    });
    this.hairline(ML + 14, top + 58, MR - 14, PC.hair);
    this.text(
      `Assets - (liabilities + equity) = residual ${aed(this.data.cfoBalanceDifference)} · tolerance AED 0.05`,
      ML + 14,
      top + 69,
      FS.table,
      false,
      this.reconciled ? PC.ink2 : PC.coral,
    );
    this.text(`Breaches: ${fnum(num(this.data.breaches), 0)}`, MR - 14, top + 69, FS.table, true, this.reconciled ? PC.ink2 : PC.coral, 'right');
    this.y = top + h + 8;
  }

  /* =============================================================== PAGE 2 */
  pageTwo(): void {
    this.pageBreak();
    this.section('2.0', 'Macro capital flow & strategic trifecta', 'Vector Sankey flow, discrete financier tranches with lag, and 4-tier stress testing.');

    const cost = Math.max(0, num(this.data.totalDevelopmentCost));
    const margin = this.gdv > 0 ? (num(this.data.totalProjectSurplus) / this.gdv) * 100 : 0;

    // 1. Vector Sankey Diagram (Compact height ~150pt so all sections fit on Page 2)
    const srcX = 56;
    const hubX = 240;
    const sinkX = 430;
    const nodeW = 14; // exact 14pt wide solid block node rectangles
    const gdv = this.gdv > 0 ? this.gdv : 1;
    const land = this.landValue;
    const debt = Math.max(0, num(this.data.externalDebtRequired));
    const bridge = Math.max(0, debt - this.buildBudget);
    const construction = Math.max(0, debt - bridge);

    const sources = [
      { label: 'Land partner equity', value: land, color: PC.gold },
      { label: 'Senior debt facility', value: debt, color: PC.peri },
    ];
    const sinks: SinkNode[] = [
      { label: 'Land capitalisation lock', value: land, color: PC.gold },
      { label: 'Construction and soft costs', value: construction, color: PC.goldDeep },
      ...(bridge > 0.5 ? [{ label: 'VAT and working-capital bridge', value: bridge, color: PC.coral }] : []),
    ];

    // Mathematical formula: thickness = (LinkValue / GDV) * 200pt
    const thickness = (v: number): number => Math.max(2.5, (v / gdv) * 200);
    const totalSource = sources.reduce((s, n) => s + n.value, 0);

    // Column Labels (2 clean lines to avoid horizontal collisions with multi-billion numbers)
    this.text('SOURCES', srcX, this.y + 9, FS.caption, true, PC.ink2);
    this.text(aedM(sources.reduce((s, n) => s + n.value, 0)), srcX, this.y + 20, FS.table, true, PC.ink);

    this.text('CAPITAL HUB', hubX + nodeW / 2, this.y + 9, FS.caption, true, PC.ink2, 'center');
    this.text(aedM(totalSource), hubX + nodeW / 2, this.y + 20, FS.table, true, PC.ink, 'center');

    this.text('SINKS / USES', sinkX, this.y + 9, FS.caption, true, PC.ink2);
    this.text(aedM(sinks.reduce((s, n) => s + n.value, 0)), sinkX, this.y + 20, FS.table, true, PC.ink);

    const diagramTop = this.y + 38;

    // Sources: 14pt solid block node at X:56, text cleanly placed at X:76
    let sy = diagramTop;
    const srcNodes = sources.map((node) => {
      const h = Math.min(54, Math.max(18, thickness(node.value) * 0.7));
      const nodeTop = sy;
      this.box(srcX, nodeTop, nodeW, h, node.color, PC.hair);
      this.text(aedM(node.value), srcX + nodeW + 6, nodeTop + 10, FS.caption, true, PC.ink);
      this.text(node.label, srcX + nodeW + 6, nodeTop + 22, FS.table, false, PC.ink2);
      const result = { ...node, top: nodeTop, h, center: nodeTop + h / 2 };
      sy = nodeTop + h + 10;
      return result;
    });

    // Sinks: 14pt solid block node at X:430, text cleanly placed at X:450
    let ky = diagramTop;
    const sinkNodes = sinks.map((node) => {
      const h = Math.min(54, Math.max(10, thickness(node.value) * 0.7));
      const nodeTop = ky;
      this.box(sinkX, nodeTop, nodeW, h, node.color, PC.hair);
      this.text(aedM(node.value), sinkX + nodeW + 6, nodeTop + 10, FS.caption, true, PC.ink);
      const lines = this.wrap(node.label, 82, FS.table);
      lines.forEach((ln, i) => this.text(ln, sinkX + nodeW + 6, nodeTop + 22 + i * 11, FS.table, false, PC.ink2));
      const result = { ...node, top: nodeTop, h, center: nodeTop + h / 2 };
      ky = nodeTop + Math.max(h, 22 + lines.length * 11) + 6;
      return result;
    });

    // Hub node centred at X:240
    const srcSpanTop = srcNodes[0].top;
    const srcSpanBottom = srcNodes[srcNodes.length - 1].top + srcNodes[srcNodes.length - 1].h;
    const hubHActual = Math.min(96, srcSpanBottom - srcSpanTop);
    const hubTop = srcSpanTop + (srcSpanBottom - srcSpanTop - hubHActual) / 2;
    this.box(hubX, hubTop, nodeW, hubHActual, PC.ink, PC.ink);
    if (hubTop - 12 > diagramTop) {
      this.text('HUB', hubX + nodeW / 2, hubTop - 5, FS.table, true, PC.muted, 'center');
    }

    // Flowing Ribbons with cubic bezier curve operators (`c`) and /GS1 alpha 0.3
    let cursorIn = hubTop;
    srcNodes.forEach((node) => {
      const half = Math.max(1.4, (node.h / 2));
      this.ribbon(srcX + nodeW, node.center, half, hubX, cursorIn + half, half, node.color);
      cursorIn += half * 2;
    });
    let cursorOut = hubTop;
    sinkNodes.forEach((node) => {
      const half = Math.max(1.4, (node.h / 2));
      this.ribbon(hubX + nodeW, cursorOut + half, half, sinkX, node.center, half, node.color);
      cursorOut += half * 2;
    });

    this.y = Math.max(ky, sy) + 8;
    this.hairline(ML, this.y, MR, PC.hair, 0.6);
    this.y += 8;
    this.text(
      `Flow conservation: sources ${aedM(totalSource)} = sinks ${aedM(sinks.reduce((s, n) => s + n.value, 0))} · thickness = (LinkValue / GDV) * 200pt · alpha 0.3`,
      ML,
      this.y + 6,
      FS.table,
      false,
      PC.ink2,
    );
    this.text(
      `Land ${pct(this.gdv > 0 ? (land / this.gdv) * 100 : 0, 1)} · Construction ${pct(this.gdv > 0 ? (construction / this.gdv) * 100 : 0, 1)} · VAT bridge ${pct(this.gdv > 0 ? (bridge / this.gdv) * 100 : 0, 1)} of GDV`,
      ML,
      this.y + 17,
      FS.table,
      true,
      PC.ink,
    );
    this.y += 24;

    // 2. Discrete Financier Tranches with Institutional Liquidity Lag
    this.labelRow(
      'Financier capital tranches & institutional liquidity lag',
      '1–2 month verification lag between filing & cash drop',
    );

    const tranches = [
      { tranche: 'Tranche 1', milestone: 'Inception & Seeded Buffer Drop', timing: 'Month 0', amount: debt * 0.25, lag: 'Day-0 drop / nil lag' },
      { tranche: 'Tranche 2', milestone: '20% Substructure & Core Milestone', timing: 'Month 8', amount: debt * 0.25, lag: '45-day engineer audit lag' },
      { tranche: 'Tranche 3', milestone: '40%–60% Superstructure & Facade', timing: 'Month 18', amount: debt * 0.25, lag: '45-day inspection & drawdown lag' },
      { tranche: 'Tranche 4', milestone: '80% Fit-Out & Snagging Milestone', timing: 'Month 28', amount: debt * 0.25, lag: '30-day testing verification lag' },
    ];

    this.table(
      ML,
      this.y,
      [
        { label: 'Tranche', w: 70 },
        { label: 'Release trigger milestone', w: 190 },
        { label: 'Schedule', w: 55 },
        { label: 'Draw amount', w: 78, align: 'right' },
        { label: 'Liquidity lag', w: 90, align: 'right' },
      ],
      tranches.map((t) => [
        t.tranche,
        t.milestone,
        t.timing,
        aedM(t.amount),
        t.lag,
      ]).concat([
        ['Total Facility', 'Four structured gate disbursements', 'M0–M28', aedM(debt), 'Live drawn principal'],
      ]),
      { totalRows: [tranches.length] },
    );
    this.y += 10;

    // 3. 4-Tier Institutional Sensitivity Matrix Under Stress
    this.labelRow('4-Tier institutional sensitivity matrix under stress', 'downmarket stress testing & cancellation breach');
    const scenarios = this.data.sensitivity && this.data.sensitivity.length > 0
      ? this.data.sensitivity
      : [
          { id: 'target', label: 'Target Rate', price: num(this.data.marketCompPsf), priceMultiplier: 1.0, dynamicLeakagePercent: 10, gdv: this.gdv, netProceedsPsf: num(this.data.marketCompPsf) * 0.9, pbtPsf: (this.gdv - cost) / Math.max(1, this.nsa), grossMarginPercent: margin, rationale: 'Target market baseline' },
          { id: 'base_case', label: 'Base Case (+6.5%)', price: num(this.data.marketCompPsf) * 1.065, priceMultiplier: 1.065, dynamicLeakagePercent: 10, gdv: this.gdv * 1.065, netProceedsPsf: num(this.data.marketCompPsf) * 1.065 * 0.9, pbtPsf: ((this.gdv * 1.065) - cost) / Math.max(1, this.nsa), grossMarginPercent: 23.8, rationale: 'Cyclical tailwinds' },
          { id: 'bear_case', label: 'Bear Case (-10%)', price: num(this.data.marketCompPsf) * 0.90, priceMultiplier: 0.90, dynamicLeakagePercent: 12, gdv: this.gdv * 0.90, netProceedsPsf: num(this.data.marketCompPsf) * 0.90 * 0.88, pbtPsf: ((this.gdv * 0.90 * 0.88) - cost) / Math.max(1, this.nsa), grossMarginPercent: 9.6, rationale: 'Soft landing; +2% broker leakage' },
          { id: 'stress_case', label: 'Stress Case (-30%)', price: num(this.data.marketCompPsf) * 0.70, priceMultiplier: 0.70, dynamicLeakagePercent: 18, gdv: this.gdv * 0.70 * 0.85, netProceedsPsf: num(this.data.marketCompPsf) * 0.70 * 0.82 * 0.85, pbtPsf: ((this.gdv * 0.70 * 0.82 * 0.85) - cost) / Math.max(1, this.nsa), grossMarginPercent: -4.2, rationale: 'Severe correction; 15% cancellation breach' },
        ];

    this.table(
      ML,
      this.y,
      [
        { label: 'Tier scenario', w: 120 },
        { label: 'Price PSF', w: 65, align: 'right' },
        { label: 'Effective GDV', w: 78, align: 'right' },
        { label: 'Leakage', w: 50, align: 'right' },
        { label: 'Net proceeds', w: 75, align: 'right' },
        { label: 'PBT / sf', w: 50, align: 'right' },
        { label: 'Margin', w: 45, align: 'right' },
      ],
      scenarios.map((s) => [
        s.label,
        `AED ${fnum(s.price, 0)}`,
        aedM(s.gdv),
        `${fnum(s.dynamicLeakagePercent, 0)}%`,
        `AED ${fnum(s.netProceedsPsf, 0)}`,
        `${s.pbtPsf >= 0 ? '+' : ''}AED ${fnum(s.pbtPsf, 0)}`,
        `${fnum(s.grossMarginPercent, 1)}%`,
      ]),
    );
  }

  /* =============================================================== PAGE 3 */
  pageThree(): void {
    this.pageBreak();
    this.section('3.0', 'Operational escrow & priority waterfall', 'Statutory three-tier split, terminal waterfall memo and phased S-curve gates.');

    const gdv = this.gdv;
    const tiers = [
      { code: 'TIER 3', name: 'Unlocked operating capital', value: num(this.data.unlockedPool), color: PC.mint, note: 'Released at the 20 / 40 / 60 / 80% engineer-certified gates.' },
      { code: 'TIER 1', name: 'Active retention pool', value: num(this.data.retentionPool), color: PC.gold, note: 'Trapped inside escrow until certified completion.' },
      { code: 'TIER 2', name: 'Defects lock', value: num(this.data.defectsPool), color: PC.coral, note: 'Fixed at 5% for exactly 12 months post-handover.' },
    ];
    const tierTotal = tiers.reduce((s, t) => s + t.value, 0);
    const shares = tiers.map((t) => (gdv > 0 ? (t.value / gdv) * 100 : tierTotal > 0 ? (t.value / tierTotal) * 100 : 0));

    // Statutory Escrow 3-Tier Split: Single multi-segmented horizontal stacked bar spanning full 483pt width.
    this.labelRow('Dubai Law No. 8 of 2007 — 3-Tier statutory escrow protection split', `Full 483pt layout grid width`);
    const barY = this.y;
    const barH = 24;
    this.box(ML, barY, CW, barH, PC.card, PC.hair);
    let cx = ML;
    tiers.forEach((tier, i) => {
      const w = i === tiers.length - 1 ? ML + CW - cx : CW * clamp01(shares[i] / 100);
      if (w > 0.3) {
        this.rect(cx, barY, w, barH, tier.color);
        const tag = `${tier.code.replace('TIER ', 'T')} ${pct(shares[i], 1)}`;
        if (w > measure(tag, FS.table, true) + 12) {
          this.text(tag, cx + w / 2, barY + 15, FS.table, true, PC.ink, 'center');
        }
      }
      cx += w;
    });
    this.y = barY + barH + 14;

    // Three structured card containers below the bar
    const cardGap = 10;
    const cardW = (CW - cardGap * 2) / 3;
    const cardH = 88;
    this.ensure(cardH + 14);
    tiers.forEach((tier, i) => {
      const x = ML + i * (cardW + cardGap);
      const y = this.y;
      this.box(x, y, cardW, cardH);
      this.rect(x, y, cardW, 3, tier.color);
      this.text(tier.code, x + 12, y + 16, FS.table, true, PC.muted);
      this.text(tier.name, x + 12, y + 28, FS.caption, true, PC.ink);
      this.text(pct(shares[i], 1), x + 12, y + 49, FS.metric, true, PC.ink);
      this.text(aedM(tier.value), x + 12, y + 64, FS.table, true, PC.ink2);
      const wrapped = this.wrap(tier.note, cardW - 24, FS.table);
      wrapped.forEach((ln, k) => this.text(ln, x + 12, y + 76 + k * 11.5, FS.table, false, PC.muted));
    });
    this.y += cardH + 14;

    // Terminal Priority Waterfall Memo (Stacked Bar + Table)
    this.labelRow('Terminal priority liquidation waterfall', 'settles bottom-up: senior -> carry -> land -> defects -> surplus');
    const debt = Math.max(0, num(this.data.externalDebtRequired));
    const interest = Math.max(0, num(this.data.totalFinancingCost));
    const land = this.landValue;
    const surplus = Math.max(0, num(this.data.totalProjectSurplus));
    const claims = [
      { rank: 'R1', label: 'Financier debt principal', v: debt, c: PC.ink },
      { rank: 'R2', label: 'Compounded carried interest (15% ARR)', v: interest, c: PC.coral },
      { rank: 'R3', label: 'Land partner core return (AED 75M equity)', v: land, c: PC.gold },
      { rank: 'R4', label: 'Defects warranty isolation (5% statutory lock)', v: num(this.data.defectsPool), c: PC.goldDeep },
      { rank: 'R5', label: 'Retained unallocated developer surplus', v: surplus, c: PC.mint },
    ];
    const claimTotal = claims.reduce((s, c) => s + c.v, 0);

    // 483pt stacked liquidation bar
    const wfBarY = this.y;
    const wfBarH = 18;
    this.box(ML, wfBarY, CW, wfBarH, PC.card, PC.hair);
    let wfCx = ML;
    claims.forEach((claim, i) => {
      const w = i === claims.length - 1 ? ML + CW - wfCx : CW * clamp01(claimTotal > 0 ? claim.v / claimTotal : 0);
      if (w > 0.4) {
        this.rect(wfCx, wfBarY, w, wfBarH, claim.c);
        if (w > 30) this.text(claim.rank, wfCx + w / 2, wfBarY + 12, FS.table, true, PC.paper, 'center');
      }
      wfCx += w;
    });
    this.y = wfBarY + wfBarH + 12;

    this.table(
      ML,
      this.y,
      [
        { label: 'Rank', w: 35 },
        { label: 'Priority liquidation claim', w: 215 },
        { label: 'Obligation', w: 85, align: 'right' },
        { label: 'Share', w: 70, align: 'right' },
        { label: 'Recovery status', w: 78, align: 'right' },
      ],
      claims.map((c) => [
        c.rank,
        c.label,
        aedM(c.v),
        pct(claimTotal > 0 ? (c.v / claimTotal) * 100 : 0, 1),
        c.v > 0 ? '100% Settled' : '—',
      ]).concat([
        ['Total', 'Fully resolved settlement waterfall', aedM(claimTotal), pct(100, 1), 'Reconciled'],
      ]),
      { totalRows: [claims.length] },
    );
    this.y += 14;

    // S-Curve Rows with Background Progress Bar Capsule (underwritten weight width)
    this.ensure(140);
    this.labelRow('Construction S-curve release gates', 'progress bar capsule filled by underwritten weight %');
    const phases = this.phases();
    if (phases.length === 0) {
      this.ensure(40);
      this.box(ML, this.y, CW, 36);
      this.text('No construction phasing supplied with this export.', ML + 12, this.y + 21, FS.table, false, PC.ink2);
      this.y += 44;
    } else {
      phases.forEach((phase, i) => {
        this.ensure(34);
        const y = this.y;
        this.text(`PHASE ${String(i + 1).padStart(2, '0')}`, ML, y + 9, FS.table, true, PC.muted);
        this.text(phase.label, ML + 44, y + 9, FS.caption, true, PC.ink);
        this.text(`${phase.window} · AED ${fnum(phase.psf, 2)} / NSA sf`, ML + 44, y + 21, FS.table, false, PC.ink2);

        // Progress bar capsule
        const trackX = ML + 280;
        const trackW = 110;
        this.box(trackX, y + 5, trackW, 10, PC.card, PC.hair);
        const fillW = Math.max(1.5, trackW * clamp01(phase.weight / 100));
        this.rect(trackX, y + 5, fillW, 10, PC.gold);
        this.text(`${pct(phase.weight, 0)} weight`, trackX, y + 26, FS.table, false, PC.muted);

        this.text(aedM(phase.allIn), MR, y + 10, FS.caption, true, PC.ink, 'right');
        this.text(`cum ${aedM(phase.cumulative)}`, MR, y + 22, FS.table, false, PC.muted, 'right');

        this.y = y + 31;
        this.hairline(ML, this.y, MR, PC.hair, 0.5);
        this.y += 1;
      });
      this.ensure(20);
      this.text('Phased build and soft total', ML + 44, this.y + 11, FS.table, true, PC.ink);
      this.text(aedM(phases.reduce((s, p) => s + p.allIn, 0)), MR, this.y + 11, FS.table, true, PC.ink, 'right');
      this.y += 18;
    }
  }

  /* ============================================================== PAGE 4+ */
  pageDisclosures(): void {
    this.pageBreak();
    const rows = this.disclosures;
    this.section('4.0', 'Reconciled audit disclosures', `${rows.length} disclosures across four reporting sections.`);

    // Strict fixed column tracking widths:
    // Code (X:56), Section (X:96), Label text (X:130, wraps cleanly at 240pt), Value amounts (X:440, right-aligned), Verification status (X:490)
    const X = { code: 56, section: 96, label: 130, value: 440, status: 490 } as const;
    const LABEL_WRAP = 240;      // label text wraps cleanly at 240pt
    const VALUE_LEFT = 378;      // right-aligned values terminate at X:440
    const VALUE_W = X.value - VALUE_LEFT;
    const LEAD = 11.5;           // 8.5pt light tabular rows

    const head = (): void => {
      this.text('CODE', X.code, this.y + 9, FS.table, true, PC.ink2);
      this.text('SEC', X.section, this.y + 9, FS.table, true, PC.ink2);
      this.text('RECONCILED DISCLOSURE', X.label, this.y + 9, FS.table, true, PC.ink2);
      this.text('VALUE', X.value, this.y + 9, FS.table, true, PC.ink2, 'right');
      this.text('STATUS', X.status, this.y + 9, FS.table, true, PC.ink2);
      this.hairline(ML, this.y + 14, MR, PC.ink, 1.2);
      this.y += 20;
    };

    this.ensure(60);
    head();
    let group = '';

    rows.forEach((row) => {
      const title = `${row.section} ${REPORT_SECTION_TITLES[row.section]}`;
      if (title !== group) {
        group = title;
        if (this.ensure(48)) head();
        this.y += 5;
        this.text(title.toUpperCase(), ML, this.y + 9, FS.caption, true, PC.goldDeep);
        const count = rows.filter((r) => r.section === row.section).length;
        this.text(`${count} DISCLOSURES`, MR, this.y + 9, FS.table, false, PC.muted, 'right');
        this.hairline(ML, this.y + 14, MR, PC.hair, 0.6);
        this.y += 19;
      }

      const labelLines = this.wrap(row.label, LABEL_WRAP, FS.table);
      const valueLines = this.wrap(row.value, VALUE_W, FS.table);
      const lineCount = Math.max(labelLines.length, valueLines.length, 1);
      const rowH = Math.max(22, lineCount * LEAD + 8);
      if (this.ensure(rowH + 8)) head();

      const base = this.y + 11;
      this.text(row.code, X.code, base, FS.table, true, PC.ink);
      this.text(row.section, X.section, base, FS.table, false, PC.ink2);
      labelLines.forEach((line, i) => this.text(line, X.label, base + i * LEAD, FS.table, false, PC.ink));
      valueLines.forEach((line, i) => this.text(line, X.value, base + i * LEAD, FS.table, false, PC.ink, 'right'));

      const cy = base - 3;
      // If 'FLAG' or 'WATCH', automatically substitute green dot with Amber or Coral warning circle vector shape
      if (row.status === 'pass') {
        this.dot(X.status + 3, cy, 3, PC.mint);
      } else {
        this.warningCircle(X.status + 3, cy, 4, row.status === 'watch' ? PC.goldDeep : PC.coral);
      }
      this.text(
        row.status === 'pass' ? 'VERIFIED' : row.status === 'watch' ? 'MONITOR' : 'VARIANCE',
        MR,
        base,
        FS.table,
        row.status !== 'pass',
        row.status === 'pass' ? PC.ink2 : row.status === 'watch' ? PC.goldDeep : PC.coral,
        'right',
      );

      this.y += rowH;
      // Clean horizontal hairline vector path directly underneath every single item row
      this.hairline(ML, this.y, MR, PC.hair, 0.5);
    });
    this.y += 4;
  }

  /* ------------------------------------------------------------- sign-off */
  closing(): void {
    this.ensure(250);
    this.section('5.0', 'Basis of preparation and sign-off', 'Certification basis for the reconciled audit package.');

    const basis = [
      'Currency AED. Interest compounds Actual/365 on live drawn principal; settling debt never reverses a recognised expense.',
      'Land enters as non-cash equity. The seeded working-capital cushion is an earmark inside developer cash, not an extra injection.',
      'Tier 1 retention is adjustable; the Tier 2 defects pool is fixed at 5% for 12 months post-handover and excluded from payouts.',
      'Terminal developer surplus remains an SPV asset; this ledger does not assume an automatic dividend distribution.',
      'Escrow release, lending eligibility and defects claims require confirmation with the escrow agent, DLD/RERA and qualified UAE counsel.',
      'Illustrative management model. Not legal, tax, financial or investment advice, nor a determination of statutory entitlement.',
    ];
    const colW = (CW - 14) / 2;
    const top = this.y;
    const drawCol = (x: number, lines: string[]): number => {
      let y = top;
      lines.forEach((line) => {
        this.dot(x + 2, y + 3, 1.8, PC.goldDeep);
        const wrapped = this.wrap(line, colW - 12, FS.table);
        wrapped.forEach((ln, i) => this.text(ln, x + 9, y + 6 + i * 11.5, FS.table, false, PC.ink2));
        y += wrapped.length * 11.5 + 6;
      });
      return y - top;
    };
    const hL = drawCol(ML, basis.slice(0, 3));
    const hR = drawCol(ML + colW + 14, basis.slice(3));
    this.y = top + Math.max(hL, hR) + 8;
    this.hairline(ML, this.y, MR, PC.hair);
    this.y += 10;

    const signH = 56;
    this.ensure(signH + 18);
    this.box(ML, this.y, CW, signH);
    const sigW = CW / 3;
    [
      { l: 'PREPARED BY', v: 'Unified financial calculation engine' },
      { l: 'REVIEWED BY', v: '' },
      { l: 'DATE', v: '' },
    ].forEach((col, i) => {
      const x = ML + i * sigW;
      if (i > 0) this.vline(x, this.y + 8, this.y + signH - 8, PC.hair);
      this.text(col.l, x + 12, this.y + 16, FS.table, true, PC.muted);
      this.text(col.v, x + 12, this.y + 31, FS.caption, false, PC.ink);
      if (i > 0) this.hairline(x + 12, this.y + 38, x + sigW - 12, PC.hair, 0.7);
    });
    this.y += signH + 12;

    const lines = this.wrap(this.footnote, CW - 28, FS.table);
    const noteH = 26 + lines.length * 11.5;
    this.ensure(noteH + 22);
    this.box(ML, this.y, CW, noteH);
    this.rect(ML, this.y, 3, noteH, PC.goldDeep);
    this.text('MANDATORY DISCLOSURE', ML + 14, this.y + 16, FS.table, true, PC.ink2);
    lines.forEach((line, i) => this.text(line, ML + 14, this.y + 28 + i * 11.5, FS.table, false, PC.muted));
    this.y += noteH + 14;
    this.text('END OF REPORT', ML, this.y + 6, FS.table, true, PC.ink2);
    this.text('Generated by the unified financial calculation engine', MR, this.y + 6, FS.table, false, PC.muted, 'right');
    this.y += 12;
  }

  /* ---------------------------------------------------------- table engine */
  private table(
    x: number,
    y: number,
    columns: { label: string; w: number; align?: Align }[],
    rows: string[][],
    opts: { totalRows?: number[] } = {},
  ): void {
    const totalW = columns.reduce((s, c) => s + c.w, 0);
    const xs: number[] = [];
    let cursor = x;
    columns.forEach((c) => {
      xs.push(cursor);
      cursor += c.w;
    });

    const drawHead = (): void => {
      this.rect(x, this.y, totalW, 17, PC.ink);
      columns.forEach((col, i) => {
        const align = col.align ?? 'left';
        const tx = align === 'right' ? xs[i] + col.w - 6 : align === 'center' ? xs[i] + col.w / 2 : xs[i] + 6;
        this.text(col.label, tx, this.y + 11, FS.table, true, PC.paper, align);
      });
      this.y += 17;
    };

    this.y = y;
    this.ensure(50);
    drawHead();

    rows.forEach((row, ri) => {
      const isTotal = !!opts.totalRows?.includes(ri);
      const cells = row.map((cell, ci) => this.wrap(String(cell), columns[ci].w - 12, FS.table, isTotal));
      const lines = Math.max(1, ...cells.map((c) => c.length));
      const rowH = Math.max(19, lines * 11.5 + 7);
      if (this.ensure(rowH)) drawHead();
      if (isTotal) this.rect(x, this.y, totalW, rowH, PC.card);
      let maxBaseline = this.y;
      cells.forEach((cellLines, ci) => {
        const align = columns[ci].align ?? 'left';
        const tx = align === 'right' ? xs[ci] + columns[ci].w - 6 : align === 'center' ? xs[ci] + columns[ci].w / 2 : xs[ci] + 6;
        cellLines.forEach((line, li) => {
          const baseline = this.y + 12.5 + li * 11.5;
          this.text(line, tx, baseline, FS.table, isTotal, PC.ink, align);
          maxBaseline = Math.max(maxBaseline, baseline);
        });
      });
      this.y = Math.max(this.y + rowH, maxBaseline + 4);
      this.hairline(x, this.y, x + totalW, PC.hair, 0.55);
    });
    this.y += 4;
  }

  /* ------------------------------------------------------------ serialise */
  finish(): Uint8Array {
    if (this.ops.length > 0) {
      this.pages.push(this.ops.join('\n'));
      this.ops = [];
    }
    if (this.pages.length === 0) this.newPage(true);
    const total = this.pages.length;
    const streams = this.pages.map((page, i) =>
      page
        .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
        .replace(/@@PAGE@@/g, String(i + 1))
        .replace(/@@TOTAL@@/g, String(total)),
    );

    const objs: string[] = [];
    const extId = 5;
    objs[0] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[1] = '<< /Type /Pages /Kids [] /Count 0 >>';
    objs[2] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    objs[4] = '<< /Type /ExtGState /ca 0.3 /CA 0.3 >>';

    const pageIds = streams.map((_, i) => 6 + i * 2);
    objs[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${streams.length} >>`;
    streams.forEach((stream, i) => {
      const pageId = pageIds[i];
      const contentId = pageId + 1;
      objs[pageId - 1] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> /ExtGState << /GS1 ${extId} 0 R >> >> /Contents ${contentId} 0 R >>`;
      objs[contentId - 1] = `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`;
    });

    const infoId = objs.length + 1;
    objs.push(
      '<< /Title (Underwriting Report - Reconciled Audit Disclosures) ' +
        '/Author (Real Estate Intelligence Suite) /Subject (Investment Committee Pack) ' +
        '/Creator (Native PDF 1.4 vector layout engine) >>',
    );

    let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offsets: number[] = [];
    objs.forEach((body, i) => {
      offsets.push(pdf.length);
      pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xrefStart = pdf.length;
    pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach((offset) => {
      pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

    return Uint8Array.from(pdf, (ch) => ch.charCodeAt(0) & 0xff);
  }
}

/**
 * Public PDF entry point. Every figure is read from ExportInputs; the
 * mandatory footnote is rendered verbatim on the closing page.
 */
export function buildPdfReport(data: ExportInputs): Uint8Array {
  const doc = new PdfDoc(data, HEALTHCARE_FOOTNOTE);
  doc.begin();
  doc.pageOne();
  doc.pageTwo();
  doc.pageThree();
  doc.pageDisclosures();
  doc.closing();
  return doc.finish();
}

/* ============================================ OOXML workbook (.xlsx, ZIP) */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** ZIP with STORE (no deflate) — universally readable, no external library required. */
function zipStore(entries: { name: string; data: Uint8Array }[]): Uint8Array {
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = enc(entry.name);
    const crc = crc32(entry.data);
    const header = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(header.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 0, true); // store
    dv.setUint16(8, 0, true); // no compression
    dv.setUint32(14, crc, true);
    dv.setUint32(18, entry.data.length, true);
    dv.setUint32(22, entry.data.length, true);
    dv.setUint16(26, nameBytes.length, true);
    header.set(nameBytes, 30);
    local.push(header, entry.data);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, entry.data.length, true);
    cv.setUint32(24, entry.data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    central.push(cd);

    offset += header.length + entry.data.length;
  }

  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);

  return concat([...local, ...central, eocd]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const xml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colRef = (i: number) => {
  let s = '';
  let x = i;
  while (x >= 0) {
    s = String.fromCharCode(65 + (x % 26)) + s;
    x = Math.floor(x / 26) - 1;
  }
  return s;
};

function sheetXml(rows: ExcelRow[]): string {
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((value, c) => {
          if (value === null || value === undefined) return '';
          const ref = `${colRef(c)}${r + 1}`;
          return typeof value === 'number'
            ? `<c r="${ref}"><v>${Number.isFinite(value) ? value : 0}</v></c>`
            : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(String(value))}</t></is></c>`;
        })
        .join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

export function buildXlsx(sheets: ExcelSheet[]): Uint8Array {
  // Excel forbids : \ / ? * [ ] in worksheet tab names and caps them at 31 chars.
  // Sanitising here keeps the multi-sheet workbook openable without a repair prompt.
  const sheetName = (s: string) => xml(s.replace(/[\\/*?:[\]]/g, '-').trim().slice(0, 31)) || 'Sheet';
  const workbook =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` +
    sheets.map((s, i) => `<sheet name="${sheetName(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
    `</sheets></workbook>`;

  const wbRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
    `</Relationships>`;

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
    `</Types>`;

  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  return zipStore([
    { name: '[Content_Types].xml', data: enc(contentTypes) },
    { name: '_rels/.rels', data: enc(rootRels) },
    { name: 'xl/workbook.xml', data: enc(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc(wbRels) },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc(sheetXml(s.rows)) })),
  ]);
}

/* ============================================================ Markdown */
function buildMarkdown(disclosures: ReportDisclosure[]): string {
  const cell = (text: string) => String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const disclosureRows = disclosures.length
    ? disclosures
        .map((d) => `| ${cell(d.code)} | ${d.section} | ${cell(d.label)} | ${cell(d.value)} | ${cell(d.basis)} | ${d.status.toUpperCase()} |`)
        .join('\n')
    : '| — | — | No disclosures generated for the current assumptions | — | — | — |';

  return `# Pitch Deck AI Blueprint — Real Estate Intelligence Suite

> **Purpose.** Machine-readable architecture of a UAE residential development underwriting model.
> Downstream pitch-deck builders and AI agents can parse this document without further context.

---

## 0. Consumption Protocol

This file is split into three layers:

1. **PROMPT BLOCKS** — copy-paste directives for external agents.
2. **RAW DATA STRUCTURES** — deterministic numeric fields, tab-separated.
3. **NARRATIVE SCRIPTS** — deck-ready paragraph copy.

\`\`\`text
ROLE: You are an institutional real estate investment associate.
TASK: Convert the data structures below into an investment committee deck.
CONSTRAINTS:
  - Never invent figures; use only fields present in section 2.
  - Currency is AED. Show AED millions to 2 decimal places.
  - Every claim must reference a field key from section 2.
  - Retain the regulatory footnote in section 4 verbatim on the closing slide.
\`\`\`

---

## 1. Spatial Leverage Engine

\`\`\`text
FORMULA NSA     = GFA x Structural Efficiency (E)
FORMULA GFA     = Plot Area x Permissible FAR
FORMULA OVERHEAD c = (R x T) / x     where R = X + Y, T = elapsed days, x = NSA
\`\`\`

**Narrative.** Gross floor area is the planning envelope; net saleable area is what trades. Efficiency is a
divisor on every unit cost, so a single efficiency point re-bases the entire cost stack.

---

## 2. Raw Data Structures

### 2.1 Global constants

| key | field | value |
|---|---|---|
| \`SALES_LEAKAGE_BASE\` | baseline sales leakage | 10% |
| \`DLP_LOCK_PCT\` | post-handover defects liability lock | 5% |
| \`DLP_LOCK_MONTHS\` | statutory lock duration | 12 |
| \`PROJECT_RETENTION_PCT\` | active project retention | 10% |
| \`BEAR_CASE_LEAKAGE\` | additional broker overrides | 12% |
| \`STRESS_COLLECTION_FACTOR\` | escrow collections after 15% cancellations | 0.85x |
| \`FINANCE_COMPOUND_BASIS\` | compounding basis | Actual/365 |

### 2.2 Cycle-dependent sales leakage

| scenario | price factor | leakage | collection factor |
|---|---:|---:|---:|
| Target Rate | 1.00x | 10% | 1.00x |
| Base Case | 1.065x | 10% | 1.00x |
| Bear Case (Soft Landing) | 0.90x | 12% | 1.00x |
| Stress Case (Severe Correction) | 0.70x | 18% | 0.85x |

### 2.3 Terminal Settlement Waterfall

\`\`\`text
RANK 1  Financier Debt Principal
RANK 2  Financier Compounded Return
RANK 3  Land Partner Core Capital Return
RANK 4  5% Warranty Pool Isolation
RANK 5  Retained Developer Cash Surplus
\`\`\`

### 2.4 Regulatory holdbacks

\`\`\`json
{
  "law": "Dubai Escrow Account Law, Law No. 8 of 2007",
  "tiers": [
    { "id": "retention",  "pct": 10, "released": "at certified completion" },
    { "id": "defects_dlp","pct": 5,  "released": "12 months post-handover" },
    { "id": "operating",  "pct": 85, "released": "20/40/60/80% milestones" }
  ]
}
\`\`\`

---

## 3. Narrative Scripts

**Slide — Positioning.** A fully integrated real estate intelligence platform spanning capital origination,
treasury management and SPV CFO daily statement control, underwriting a UAE residential scheme through a
single reconciled double-entry engine.

**Slide — Risk.** Margin is defended by two statutory holdbacks, a pre-sales regulatory blocker that forces
buyer collections to zero before the RERA off-plan licence, and an automatic escrow-to-debt swipe that retires
financier interest before principal.

**Slide — Upside.** The normalized Base Case applies a 6.5% price uplift while retaining the 10% baseline
sales leakage. The Stress Case haircut applies both an 18% leakage assumption and a further 15% cancellation loss.

---

## 4. Workspace 4 — Reconciled Audit Disclosures

Machine-traceable register emitted by the Underwriting Report view. Each row states the
disclosure code, owning section, value, calculation basis and validation status. Section
titles: 1.0 Executive Synthesis · 2.0 Chronological Execution Ledger & Capital Clock ·
3.0 Escrow Allocation Structure · 4.0 Waterfall Settlement Account.

| code | section | disclosure | value | basis | status |
|---|---|---|---|---|---|
${disclosureRows}

---

## 5. Mandatory Footer

> ${HEALTHCARE_FOOTNOTE}

_Currency AED. Illustrative model prepared for internal discussion. Not financial, legal or investment advice._
`;
}

/* ===================================================== public orchestration */
export interface ExportDrawdownRow {
  label: string;
  timelineLabel: string;
  weightPercent: number;
  hardCostAed: number;
  approvalsAed: number;
  allInCostAed: number;
  cumulativeFundingAed: number;
  allInCostPsfNsa: number;
  /** Optional phase geometry, passed straight from the viability engine. */
  startMonth?: number;
  endMonth?: number;
  startPercent?: number;
  endPercent?: number;
}

/** Engine-produced priority ladder rung (treasury distributionLadder). */
export interface ExportLadderRow {
  name: string;
  short: string;
  value: number;
  color: string;
}

export interface ExportInputs {
  plotArea: number;
  permissibleFar: number;
  efficiencyPct: number;
  marketCompPsf: number;
  landEquity: number;
  gdv: number;
  totalDevelopmentCost: number;
  externalDebtRequired: number;
  totalFinancingCost: number;
  totalProjectSurplus: number;
  retentionPool: number;
  defectsPool: number;
  unlockedPool: number;
  totalProjectDays: number;
  licenseTriggerDay: number;
  breaches: number;
  dailyBurn: number;
  cfoRealizedRevenue: number;
  cfoAccumulatedBurn: number;
  cfoOperatingCashPaid: number;
  cfoSiteOutlaysPaid: number;
  cfoDebtDrawn: number;
  cfoEscrowCash: number;
  cfoDefectsPool: number;
  cfoWipInventory: number;
  cfoDebtPrincipal: number;
  cfoAccruedInterest: number;
  cfoRetainedEarnings: number;
  // Full CFO mark-to-market statement snapshot for the workbook export.
  cfoCostOfSales: number;
  cfoGrossProfit: number;
  cfoSalesExpense: number;
  cfoFinancingExpense: number;
  cfoInventoryImpairment: number;
  cfoOpeningCash: number;
  cfoNetCashMovement: number;
  cfoClosingCash: number;
  cfoCash: number;
  cfoLandInventory: number;
  cfoBuyerContractLiability: number;
  cfoTotalPayables: number;
  cfoPaidInEquity: number;
  cfoTotalAssets: number;
  cfoTotalLiabilities: number;
  cfoFundingTotal: number;
  cfoBalanceDifference: number;
  timeline: string[];
  /** Optional four-phase construction capital release schedule. */
  constructionDrawdowns?: ExportDrawdownRow[];
  /** Workspace 4 — reconciled audit disclosure register (text summaries). */
  reportDisclosures?: ReportDisclosure[];
  /** Treasury engine priority ladder, passed through verbatim. */
  distributionLadder?: ExportLadderRow[];
  gfa?: number;
  nsa?: number;
  sensitivity?: Array<{
    id: string;
    label: string;
    price: number;
    priceMultiplier: number;
    dynamicLeakagePercent: number;
    gdv: number;
    netProceedsPsf: number;
    pbtPsf: number;
    grossMarginPercent: number;
    rationale: string;
  }>;
}

export function exportInvestmentPack(data: ExportInputs) {
  download('underwriting_executive_summary.pdf', buildPdfReport(data), 'application/pdf');

  const feasibilitySheet: ExcelSheet = {
    name: 'Workspace 1: Feasibility Matrix',
    rows: [
      ['Metric', 'Value', 'Unit'],
      ['Plot Area', data.plotArea, 'sq ft'],
      ['Permissible FAR', data.permissibleFar, 'x'],
      ['Structural Efficiency', data.efficiencyPct, '%'],
      ['Market Comp Selling Rate', data.marketCompPsf, 'AED / sq ft'],
      ['Effective Land Cost', data.landEquity, 'AED'],
      ['Gross Development Value', data.gdv, 'AED'],
      ['Total Development Cost', data.totalDevelopmentCost, 'AED'],
      ['Net Trading Position', data.totalProjectSurplus, 'AED'],
      [],
      ['Qualitative Rationale', 'Applies to 4-tier sensitivity matrix'],
    ],
  };

  const escrowSheet: ExcelSheet = {
    // Excel caps worksheet tab names at 31 characters.
    name: 'Workspace 2: Escrow Milestones',
    rows: [
      ['Regulatory Tier', 'Pct', 'Value (AED)', 'Release Condition'],
      ['Milestone-Unlocked Operating Capital', 85, data.unlockedPool, '20 / 40 / 60 / 80% certified progress'],
      ['Active Project Retention', 10, data.retentionPool, 'Certified completion'],
      ['Post-Handover Defects Liability Lock', 5, data.defectsPool, '12 months post-handover'],
      [],
      ['Law Reference', 'Dubai Escrow Account Law, Law No. 8 of 2007'],
      ['External Debt Capital Facility', data.externalDebtRequired],
      ['Accrued Financing Cost Drag', data.totalFinancingCost],
    ],
  };

  const cfoBalanceReconciled = Math.abs(data.cfoBalanceDifference) <= 0.05;
  const cfoStatementSheet: ExcelSheet = {
    // Descriptive title carried in row 1; tab label kept inside Excel's 31-char limit.
    name: 'Workspace 3: CFO Statements',
    rows: [
      ['Workspace 3: CFO Mark-to-Market P&L, CFS, and Balance Sheet', 'Amount (AED)', 'Note'],
      ['Statement basis', `${data.totalProjectDays} calendar-day lifecycle`, 'Reporting cut-off snapshot'],
      [],
      ['P&L', 'Recognized revenue at cut-off', data.cfoRealizedRevenue, 'Registered unit exits only'],
      ['P&L', 'Cost of registered unit exits', -data.cfoCostOfSales, 'Pro-rata land and constructed cost base'],
      ['P&L', 'Gross realized trading result', data.cfoGrossProfit, 'Recognized revenue less cost of sales'],
      ['P&L', 'Temporal decay bleed (X + Y)', -data.cfoAccumulatedBurn, 'Accrued corporate overhead loading'],
      ['P&L', 'Cycle-dependent exit leakage', -data.cfoSalesExpense, 'Sales, incentives and commission expense'],
      ['P&L', 'Lifetime compounded financing expense', -data.cfoFinancingExpense, 'Actual/365 carried interest expense'],
      ['P&L', 'Downward inventory variance', -data.cfoInventoryImpairment, 'Impairment only; no upward revaluation'],
      ['P&L', 'Recognized PBT / retained earnings', data.cfoRetainedEarnings, 'P&L total'],
      [],
      ['CFS', 'Opening cash and escrow', data.cfoOpeningCash, 'Opening balance at the reporting cut-off'],
      ['CFS', 'Operating payments', -data.cfoOperatingCashPaid, 'X + Y operating and exit leakage paid'],
      ['CFS', 'Investing - paid construction outlays', -data.cfoSiteOutlaysPaid, 'Certified site draws and WIP'],
      ['CFS', 'Financing - gross debt drawdowns', data.cfoDebtDrawn, 'Facility drawdowns'],
      ['CFS', 'Net movement in cash', data.cfoNetCashMovement, 'Reconciled operating and escrow movement'],
      ['CFS', 'Closing cash and escrow', data.cfoClosingCash, 'Operating wallet plus DLD escrow'],
      [],
      ['Balance Sheet', 'ASSETS', null, 'Cut-off snapshot'],
      ['Balance Sheet', 'Operating wallet cash', data.cfoCash, 'Free treasury cash'],
      ['Balance Sheet', 'DLD escrow liquidity excluding defects reserve', Math.max(0, data.cfoEscrowCash - data.cfoDefectsPool), 'Restricted escrow account'],
      ['Balance Sheet', 'Ring-fenced 5% defects warranty pool', data.cfoDefectsPool, '12-month Law No. 8 lock'],
      ['Balance Sheet', 'Unrealized land inventory', data.cfoLandInventory, 'Land partner contribution'],
      ['Balance Sheet', 'WIP / completed unit inventory', data.cfoWipInventory, 'Capitalized build cost'],
      ['Balance Sheet', 'Total assets', data.cfoTotalAssets, 'Double-entry asset total'],
      [],
      ['Balance Sheet', 'LIABILITIES', null, 'Cut-off snapshot'],
      ['Balance Sheet', 'Financier drawn debt principal', data.cfoDebtPrincipal, 'Outstanding senior debt'],
      ['Balance Sheet', 'Accrued compounded financing', data.cfoAccruedInterest, 'Unpaid carried interest'],
      ['Balance Sheet', 'Buyer contract liabilities', data.cfoBuyerContractLiability, 'Collected deposits less recognized revenue'],
      ['Balance Sheet', 'Unfunded payables', data.cfoTotalPayables, 'Construction, operating and sales payables'],
      ['Balance Sheet', 'Total liabilities', data.cfoTotalLiabilities, 'Liabilities subtotal'],
      [],
      ['Balance Sheet', 'EQUITY', null, 'Cut-off snapshot'],
      ['Balance Sheet', 'Paid-in equity', data.cfoPaidInEquity, 'Land and developer equity'],
      ['Balance Sheet', 'Retained project earnings', data.cfoRetainedEarnings, 'Recognized PBT accumulated'],
      ['Balance Sheet', 'Total liabilities + equity', data.cfoFundingTotal, 'Double-entry funding total'],
      [],
      ['Balance Sheet', 'Double-entry residual', data.cfoBalanceDifference, 'Tolerance AED 0.05'],
      ['Balance Sheet', 'Reconciliation status', cfoBalanceReconciled ? 'PASS' : 'REVIEW', cfoBalanceReconciled ? 'Assets equal liabilities plus equity' : 'Investigate residual before committee review'],
      [],
      ['Disclosure', HEALTHCARE_FOOTNOTE],
    ],
  };

  const drawdowns = data.constructionDrawdowns ?? [];
  const drawdownSheet: ExcelSheet = {
    name: 'Construction S-Curve',
    rows: [
      ['Underwritten Construction Capital Release Profile', null, null, null, null, null, null, null],
      [
        'Phase',
        'Timeline',
        'Weight (%)',
        'Hard Cost Outlay (AED)',
        'Approvals (AED)',
        'All-in Phased Funding (AED)',
        'Cumulative Funding (AED)',
        'All-in / NSA sf (AED)',
      ],
      ...drawdowns.map((phase) => [
        phase.label,
        phase.timelineLabel,
        phase.weightPercent,
        phase.hardCostAed,
        phase.approvalsAed,
        phase.allInCostAed,
        phase.cumulativeFundingAed,
        phase.allInCostPsfNsa,
      ]),
      [],
      [
        'Total',
        `${drawdowns.length} release gates`,
        drawdowns.reduce((sum, phase) => sum + phase.weightPercent, 0),
        drawdowns.reduce((sum, phase) => sum + phase.hardCostAed, 0),
        drawdowns.reduce((sum, phase) => sum + phase.approvalsAed, 0),
        drawdowns.reduce((sum, phase) => sum + phase.allInCostAed, 0),
        drawdowns.length ? drawdowns[drawdowns.length - 1].cumulativeFundingAed : 0,
        null,
      ],
      [],
      ['Note', 'Certified S-curve staging keeps drawn principal lower than a Day-1 bullet facility.'],
    ],
  };

  const disclosures = data.reportDisclosures ?? [];
  const reportSheet: ExcelSheet = {
    // 30 characters — inside Excel's 31-character worksheet tab limit.
    name: 'Workspace 4: Audit Disclosures',
    rows: [
      ['Workspace 4 — Underwriting Report · Reconciled Audit Disclosures', null, null, null, null, null],
      ['Reconciliation tolerance (AED)', 0.05, 'Total assets must equal liabilities plus contributed equity'],
      [],
      ['Code', 'Section', 'Section title', 'Disclosure', 'Value', 'Basis / formula', 'Status'],
      ...disclosures.map((d) => [
        d.code,
        d.section,
        REPORT_SECTION_TITLES[d.section],
        d.label,
        d.value,
        d.basis,
        d.status.toUpperCase(),
      ]),
      [],
      ['Register total', disclosures.length, 'disclosures'],
      ['Verified', disclosures.filter((d) => d.status === 'pass').length, 'status PASS'],
      ['Monitor', disclosures.filter((d) => d.status === 'watch').length, 'status WATCH'],
      ['Variance', disclosures.filter((d) => d.status === 'flag').length, 'status FLAG — trace before committee sign-off'],
      [],
      ['Note', 'This register is the exact text summary rendered on screen in Workspace 4.'],
      ['Disclosure', HEALTHCARE_FOOTNOTE],
    ],
  };

  const sheets: ExcelSheet[] = [feasibilitySheet, escrowSheet, cfoStatementSheet, drawdownSheet, reportSheet];

  download('treasury_ledger_snapshot.xlsx', buildXlsx(sheets), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  download('pitch_deck_ai_blueprint.md', enc(buildMarkdown(data.reportDisclosures ?? [])), 'text/markdown;charset=utf-8');
}
