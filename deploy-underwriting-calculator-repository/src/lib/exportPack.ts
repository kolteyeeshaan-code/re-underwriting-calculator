/* =====================================================================
 * Investment Committee Pack export engine.
 * Produces three production assets with no external dependencies:
 *   1. underwriting_executive_summary.pdf   (numbers and diagrams, native PDF 1.4)
 *   2. treasury_ledger_snapshot.xlsx        (OOXML workbook, multi-sheet)
 *   3. pitch_deck_ai_blueprint.md           (data-only Markdown companion)
 *
 * The PDF carries figures, tables and vector diagrams only: no thesis, no
 * narrative and no marketing copy. The SPV CFO workspace is untouched and
 * remains the live micro-planning surface for burn and capital-clock testing.
 *
 * The PDF is a six-page landscape A4 partner report using native vector
 * primitives. The workbook and live planning workspaces remain separate.
 * ===================================================================== */

import { REPORT_SECTION_TITLES, type ReportDisclosure, type WaterfallRung } from './reportDisclosures';
import type { MilestoneRow, SankeyData } from '../engine/treasuryEngine';
import { INITIAL_TEAM_MEMBERS, type TeamMember } from '../components/TeamWorkspace';

/** Factual closing note retained in the workbook/markdown assets. */
const MODEL_FOOTNOTE =
  'Illustrative management model. Not legal, tax, financial or investment advice.';

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

/* Landscape A4 with a consistent 42pt reporting grid. */
const PW = 842;
const PH = 595;
const ML = 42;
const MR = 800;
const CW = MR - ML;

type Rgb = readonly [number, number, number];

/** Charcoal, amber and neutral tints only. */
const PC = {
  ink: [0.086, 0.094, 0.110],
  ink2: [0.33, 0.34, 0.36],
  muted: [0.48, 0.49, 0.51],
  hair: [0.87, 0.87, 0.86],
  soft: [0.94, 0.94, 0.93],
  warm: [0.985, 0.977, 0.95],
  track: [0.80, 0.80, 0.79],
  paper: [1, 1, 1],
  amber: [0.957, 0.780, 0.294],
  amberDeep: [0.69, 0.45, 0.12],
} as const satisfies Record<string, Rgb>;

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const fixed = (v: number): string => (Number.isFinite(v) ? String(Math.round(v * 100) / 100) : '0');
const colorNum = (v: number): string => String(Math.round(v * 1000) / 1000);
const fillOp = (c: Rgb): string => `${colorNum(c[0])} ${colorNum(c[1])} ${colorNum(c[2])} rg`;
const strokeOp = (c: Rgb): string => `${colorNum(c[0])} ${colorNum(c[1])} ${colorNum(c[2])} RG`;
const fnum = (v: number, d = 2): string =>
  num(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const aedM = (v: number): string => `AED ${fnum(num(v) / 1_000_000, 2)}M`;
const pct = (v: number, d = 1): string => `${fnum(v, d)}%`;
/** Compact millions for tight diagram annotations. */
const shortM = (v: number): string => `${fnum(num(v) / 1_000_000, 1)}M`;

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
type PdfColumn = { label: string; width: number; align?: Align };

/** The export reads the Team CRUD snapshot without changing its storage contract. */
function loadTeamMembers(): TeamMember[] {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem('alfarren_team_members_v1');
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is TeamMember => Boolean(item)
          && typeof item.name === 'string'
          && typeof item.role === 'string'
          && Array.isArray(item.assignedStages)
          && Array.isArray(item.responsibilities));
      }
    }
  } catch {
    // An unavailable or malformed register falls back to the existing seed.
  }
  return INITIAL_TEAM_MEMBERS;
}

class PdfDoc {
  private readonly data: ExportInputs;
  private readonly reportDate: Date;
  private ops: string[] = [];
  private pages: string[] = [];
  private heading = '';
  private sectionNo = '';
  y = 0;

  constructor(data: ExportInputs) {
    this.data = data;
    const parsed = data.reportDate ? new Date(data.reportDate) : new Date();
    this.reportDate = Number.isFinite(parsed.getTime()) ? parsed : new Date();
  }

  private get gdv(): number { return Math.max(0, num(this.data.gdv)); }
  private get land(): number {
    // Treasury capitalization is authoritative when viability and treasury differ.
    const implied = num(this.data.totalDevelopmentCost) - num(this.data.externalDebtRequired) - num(this.data.totalFinancingCost);
    return Math.max(0, Number.isFinite(implied) ? implied : num(this.data.landEquity));
  }
  private get drawn(): number { return num(this.data.totalDrawnPrincipal ?? this.data.externalDebtRequired); }
  private get committed(): number { return num(this.data.totalDebtFacility ?? this.data.externalDebtRequired); }
  private get undrawn(): number { return num(this.data.totalUndrawnCapacity ?? Math.max(0, this.committed - this.drawn)); }
  private get interest(): number { return num(this.data.interestOnDrawn ?? this.data.totalFinancingCost); }
  private get nsa(): number {
    return num(this.data.nsa) || num(this.data.plotArea) * num(this.data.permissibleFar) * num(this.data.efficiencyPct) / 100;
  }
  private get firstCollection(): string {
    const first = this.data.milestones?.find((milestone) => num(milestone.collection) > 0);
    return first ? `M${fnum(first.month, 0)}` : 'Not scheduled';
  }
  private get programmeMonths(): number {
    return num(this.data.milestones?.at(-1)?.month)
      || Math.round(num(this.data.totalProjectDays) / 365 * 12);
  }
  private get id(): string {
    const day = this.reportDate.toISOString().slice(0, 10).replace(/-/g, '');
    return `DC-${day}-${Math.round(this.gdv / 1_000_000)}`;
  }
  private get dateText(): string {
    return this.reportDate.toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
    });
  }

  private rect(x: number, y: number, w: number, h: number, color: Rgb): void {
    this.ops.push(`q ${fillOp(color)} ${fixed(x)} ${fixed(PH - y - h)} ${fixed(w)} ${fixed(h)} re f Q`);
  }
  private rule(x1: number, y1: number, x2: number, y2: number, color: Rgb = PC.hair, weight = 0.7): void {
    this.ops.push(`q ${strokeOp(color)} ${fixed(weight)} w ${fixed(x1)} ${fixed(PH - y1)} m ${fixed(x2)} ${fixed(PH - y2)} l S Q`);
  }
  private box(x: number, y: number, w: number, h: number, fill: Rgb = PC.paper): void {
    this.rect(x, y, w, h, fill);
    this.ops.push(`q ${strokeOp(PC.hair)} 0.6 w ${fixed(x)} ${fixed(PH - y - h)} ${fixed(w)} ${fixed(h)} re S Q`);
  }
  private text(value: string, x: number, baseline: number, size: number, bold = false, color: Rgb = PC.ink, align: Align = 'left'): void {
    const safe = foldAscii(value);
    const offset = align === 'right' ? measure(safe, size, bold) : align === 'center' ? measure(safe, size, bold) / 2 : 0;
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${fixed(size)} Tf ${fillOp(color)} 1 0 0 1 ${fixed(x - offset)} ${fixed(PH - baseline)} Tm (${pdfString(safe)}) Tj ET`);
  }
  private wrap(value: string, width: number, size: number): string[] {
    const words = foldAscii(value).split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    const result: string[] = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate, size) <= width) { line = candidate; continue; }
      if (line) result.push(line);
      line = word;
      while (measure(line, size) > width && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && measure(line.slice(0, cut), size) > width) cut--;
        result.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    if (line) result.push(line);
    return result;
  }
  private start(title: string, section: string): void {
    if (this.ops.length) this.pages.push(this.ops.join('\n'));
    this.ops = [];
    this.heading = title;
    this.sectionNo = section;
    this.rect(0, 0, PW, PH, PC.paper);
    this.rect(ML, 25, 28, 2, PC.amber);
    this.text('DEVELOPMENT CONSORTIUM', ML + 36, 29, 9, true);
    this.text(`${this.id}  /  ${this.dateText}`, MR, 29, 8, false, PC.ink2, 'right');
    this.rule(ML, 42, MR, 42);
    this.text(section, ML, 78, 10, true, PC.amberDeep);
    this.text(title.toUpperCase(), ML + 35, 79, 21, true);
    this.rule(ML, 90, MR, 90, PC.ink, 0.9);
    this.rule(ML, PH - 34, MR, PH - 34);
    this.text('Development Consortium  /  AED', ML, PH - 20, 7.5, false, PC.muted);
    this.text('@@PAGE@@ / @@TOTAL@@', MR, PH - 20, 8, true, PC.ink2, 'right');
    this.y = 101;
  }
  private ensure(height: number): boolean {
    if (this.y + height <= PH - 43) return false;
    this.start(`${this.heading} (continued)`, this.sectionNo);
    return true;
  }
  private label(label: string, y: number, right?: string): void {
    this.text(label.toUpperCase(), ML, y, 9, true);
    if (right) this.text(right, MR, y, 8, false, PC.muted, 'right');
    this.rule(ML, y + 7, MR, y + 7);
  }
  private table(columns: PdfColumn[], rows: string[][], y: number, font = 8, minRow = 22): number {
    const xs = columns.reduce<number[]>((acc) => {
      acc.push(acc.length ? acc[acc.length - 1] + columns[acc.length - 1].width : ML);
      return acc;
    }, []);
    const drawHead = () => {
      this.rect(ML, this.y, CW, 21, PC.ink);
      columns.forEach((column, index) => {
        const align = column.align ?? 'left';
        const x = align === 'right' ? xs[index] + column.width - 8 : xs[index] + 8;
        this.text(column.label.toUpperCase(), x, this.y + 13, 7.2, true, PC.paper, align);
      });
      this.y += 21;
    };
    this.y = y;
    this.ensure(46);
    drawHead();
    rows.forEach((row, index) => {
      const lines = columns.map((column, columnIndex) => this.wrap(row[columnIndex] ?? '', column.width - 16, font));
      const rowHeight = Math.max(minRow, Math.max(...lines.map((group) => group.length)) * (font + 2.4) + 8);
      if (this.ensure(rowHeight + 2)) drawHead();
      if (index % 2 === 1) this.rect(ML, this.y, CW, rowHeight, PC.warm);
      columns.forEach((column, columnIndex) => {
        const align = column.align ?? 'left';
        const x = align === 'right' ? xs[columnIndex] + column.width - 8 : xs[columnIndex] + 8;
        lines[columnIndex].forEach((line, lineIndex) => {
          this.text(line, x, this.y + 13 + lineIndex * (font + 2.4), font, columnIndex === 0, columnIndex === 0 ? PC.ink : PC.ink2, align);
        });
      });
      this.y += rowHeight;
      this.rule(ML, this.y, MR, this.y, PC.hair, 0.45);
    });
    return this.y;
  }
  private metric(x: number, width: number, y: number, label: string, value: string, note = '', big = false): void {
    this.rect(x, y, 23, 2, PC.amber);
    this.text(label.toUpperCase(), x, y + 18, big ? 8.5 : 7.5, true, PC.ink2);
    this.text(value, x, y + (big ? 47 : 40), big ? 21.5 : 16.2, true);
    if (note) this.wrap(note, width - 3, 7.4).slice(0, 1).forEach((line) => this.text(line, x, y + (big ? 65 : 56), 7.4, false, PC.muted));
  }

  snapshot(): void {
    this.start('Snapshot', '01');
    const margin = this.gdv > 0 ? num(this.data.totalProjectSurplus) / this.gdv * 100 : 0;
    const width = (CW - 3 * 12) / 4;
    const headline = [
      ['Gross development value', aedM(this.gdv), 'Buyer contracts / NSA'],
      ['Total development cost', aedM(this.data.totalDevelopmentCost), 'Land + project costs + capital cost'],
      ['Developer surplus', aedM(this.data.totalProjectSurplus), 'Unallocated'],
      ['Margin', pct(margin), 'Surplus / GDV'],
    ];
    headline.forEach(([label, value, note], index) => this.metric(ML + index * (width + 12), width, 106, label, value, note, true));
    this.rule(ML, 187, MR, 187);

    const smaller = [
      ['Land Partner equity', aedM(this.land), 'In-kind contribution'],
      ['Finance Partner drawn', aedM(this.drawn), `${aedM(this.committed)} committed capital`],
      ['Still invested (B)', aedM(this.undrawn), `Not advanced · +${aedM(num(this.data.walletBYield))} yield`],
      ['Preferred return', aedM(this.interest), 'Hurdle on drawn balances'],
      ['Interest avoided', aedM(this.data.interestSaved ?? 0), 'Versus full draw'],
    ];
    const narrow = (CW - 4 * 11) / 5;
    smaller.forEach(([label, value, note], index) => this.metric(ML + index * (narrow + 11), narrow, 202, label, value, note));
    if (this.undrawn < 1 && num(this.data.interestSaved) < 1) {
      this.text('Base case assumes full advance of every draw right.', ML, 273, 7.8, false, PC.ink2);
    }
    this.rule(ML, 283, MR, 283);
    this.label('Securitised entitlements per NSA sf', 297, `${fnum(this.nsa, 0)} sf NSA`);
    const entitlements = [
      ['Land Partner', this.nsa > 0 ? this.land / this.nsa : 0],
      ['Finance Partner', this.nsa > 0 ? (this.drawn + num(this.data.totalFinancingCost)) / this.nsa : 0],
      ['Developer', this.nsa > 0 ? num(this.data.totalProjectSurplus) / this.nsa : 0],
    ] as const;
    const entitlementWidth = CW / 3;
    entitlements.forEach(([label, value], index) => {
      const x = ML + index * entitlementWidth;
      if (index > 0) this.rule(x - 14, 310, x - 14, 352);
      this.text(label.toUpperCase(), x, 322, 7.5, true, PC.muted);
      this.text(`AED ${fnum(value, 2)}`, x, 347, 17, true);
    });

    this.box(ML, 370, CW, 162, PC.warm);
    this.rect(ML, 370, 3, 162, PC.amber);
    this.text('PARTNERSHIP ASK', ML + 17, 388, 9, true);
    this.text(`${this.programmeMonths} months programme  /  First buyer collection ${this.firstCollection}`, MR - 16, 388, 8, false, PC.ink2, 'right');
    this.rule(ML + 17, 397, MR - 17, 397);
    this.rule(421, 407, 421, 522);
    this.text('FINANCE PARTNER', ML + 17, 414, 8, true, PC.amberDeep);
    this.text('LAND PARTNER', 441, 414, 8, true, PC.amberDeep);
    const rank3 = this.data.terminalWaterfall?.find((rung) => rung.rank === 3);
    const financeAsk = `Commit ${aedM(this.committed)} and advance it on the staged draw schedule, relying on waterfall ranks 01-02 and the statutory escrow retention and defects lock.`;
    const landAsk = `Contribute ${aedM(this.land)} land equity in kind, relying on the rank 03 core return and the same statutory escrow retention and defects lock.`;
    this.wrap(financeAsk, 312, 8.4).slice(0, 3).forEach((line, i) => this.text(line, ML + 17, 429 + i * 11, 8.4, true));
    this.wrap(landAsk, 318, 8.4).slice(0, 3).forEach((line, i) => this.text(line, 441, 429 + i * 11, 8.4, true));
    this.rule(ML + 17, 458, MR - 17, 458);
    const protection = `Retention ${aedM(this.data.retentionPool)} / defects ${aedM(this.data.defectsPool)} locked 12 months`;
    const partnerRows: [string, string, string][] = [
      ['CONTRIBUTION', `${aedM(this.committed)} committed / ${aedM(this.drawn)} drawn`, `Land equity ${aedM(this.land)} in kind`],
      ['RETURN', `Rank 01 capital; rank 02 preferred return ${aedM(this.interest)}`, `Rank 03 core return ${aedM(rank3?.obligation ?? this.land)}`],
      ['PROTECTION', protection, protection],
    ];
    partnerRows.forEach(([tag, finance, land], index) => {
      const y = 474 + index * 18;
      this.text(tag, ML + 17, y, 7, true, PC.muted);
      this.text(finance, ML + 95, y, 8, false);
      this.text(tag, 441, y, 7, true, PC.muted);
      this.text(land, 441 + 78, y, 8, false);
    });
  }

  private flowNode(x: number, y: number, label: string, value: string, secondary = '', tone: 'amber' | 'grey' = 'amber', big = false): void {
    this.rect(x, y, big ? 4 : 2.5, 25, tone === 'grey' ? PC.track : PC.amber);
    this.text(label, x + 9, y + 10, 8, true, tone === 'grey' ? PC.ink2 : PC.ink);
    this.text(value, x + 9, y + 23, big ? 11.5 : 9.5, true, tone === 'grey' ? PC.ink2 : PC.ink);
    if (secondary) this.text(secondary, x + 9, y + 33, 7, false, PC.muted);
  }
  flows(): void {
    this.start('Capital Flows', '02');
    this.label('Finance Partner capital / allocation', 108, `Committed capital ${aedM(this.committed)}`);
    const rows = ['predev', 'A', 'B', 'C', 'D', 'E'];
    const titles: Record<string, string> = {
      predev: 'PRE-DEVELOPMENT', A: 'A / 20% GROUND', B: 'B / 40% CORE',
      C: 'C / 60% MEP', D: 'D / 80% FIT-OUT', E: 'E / HANDOVER',
    };
    const tranches = rows.map((id) => this.data.trancheSchedule?.find((item) => item.id === id));
    const maxCapacity = Math.max(0, ...tranches.map((item) => num(item?.capacity)));
    const walletA = num(this.data.walletALock ?? Math.max(0, num(this.data.externalDebtRequired)) * 0.2);
    const walletATreatment = this.data.walletATreatment === 'bg_fd' ? 'BG + FD' : 'Cash escrow';
    const bridgeLink = (target: string, source: string): number =>
      num(this.data.underwritingSankey?.links.find((link) => link.source === source && link.target === target)?.value);
    const walletC = num(this.data.walletCApplied ?? Math.max(0, num(this.data.externalDebtRequired) - this.drawn));
    this.text('SOURCES', 53, 128, 7.5, true, PC.muted);
    this.text('DRAW RIGHTS / DRAWN', 237, 128, 7.5, true, PC.muted);
    this.rect(345, 121, 7, 7, PC.amber);
    this.text('Drawn', 356, 128, 7.2, false, PC.ink2);
    this.rect(388, 121, 7, 7, PC.track);
    this.text('Still invested', 399, 128, 7.2, false, PC.ink2);
    this.text('CAPITAL APPLIED', 466, 128, 7.5, true, PC.muted);
    this.text('PROJECT USES', 653, 128, 7.5, true, PC.muted);

    const useTargets = ['u_site', 'u_logistics', 'u_consultants', 'u_fta'] as const;
    const useValue = (target: string): number => num(this.data.underwritingSankey?.links.find((link) => link.source === 'drawnCash' && link.target === target)?.value);
    const uses = [
      ['Construction / site', useValue('u_site')],
      ['Working capital', useValue('u_logistics')],
      ['Design / approvals', useValue('u_consultants')],
      ['VAT bridge', useValue('u_fta')],
    ] as const;
    const useSplit = (target: string): string => {
      const parts = [
        `C ${shortM(bridgeLink(target, 'walletC'))}`,
        `A ${shortM(bridgeLink(target, 'walletA'))}`,
        `B ${shortM(useValue(target))}`,
      ];
      return parts.join(' · ');
    };
    this.rule(188, 177, 208, 177, PC.amber, 1.1);
    this.rule(208, 149, 208, 275, PC.amber, 1.1);
    this.rule(439, 149, 439, 275);
    this.rule(439, 177, 464, 177);
    this.rule(590, 178, 624, 178, PC.amber, 1.1);
    this.rule(624, 151, 624, 229, PC.amber, 1.1);
    rows.forEach((id, index) => {
      const y = 142 + index * 25;
      this.rule(208, y + 9, 230, y + 9);
      this.rule(407, y + 9, 439, y + 9);
      const item = tranches[index];
      const capacity = num(item?.capacity);
      const drawnAmount = num(item?.drawn);
      const barWidth = maxCapacity > 0 ? 78 * capacity / maxCapacity : 0;
      this.rect(231, y, 2, 20, PC.amber);
      this.text(titles[id], 239, y + 8, 7.2, true);
      this.rect(239, y + 12, barWidth, 4, PC.track);
      this.rect(239, y + 12, capacity > 0 ? barWidth * drawnAmount / capacity : 0, 4, PC.amber);
      this.text(aedM(item?.drawn ?? 0), 401, y + 9, 8, true, PC.ink, 'right');
      this.text(`of ${aedM(item?.capacity ?? 0)} / M${fnum(item?.drawMonth ?? 0, 0)} · +${aedM(item?.yieldEarned ?? 0)} yield`, 401, y + 19, 6.2, false, PC.muted, 'right');
    });
    uses.forEach(([label, value], index) => {
      const y = 141 + index * 26;
      this.rule(624, y + 10, 649, y + 10);
      this.rect(651, y, 2, 22, PC.ink);
      this.text(label, 660, y + 10, 7.5, false);
      this.text(aedM(value), 794, y + 10, 8.2, true, PC.ink, 'right');
      this.text(useSplit(useTargets[index]), 794, y + 21, 6.4, false, PC.muted, 'right');
    });
    const committedBase = Math.max(this.committed, this.drawn + this.undrawn, 1);
    this.flowNode(50, 150, 'FINANCE PARTNER', aedM(this.committed), 'committed capital');
    this.flowNode(50, 196, 'WALLET A · RERA LOCK', aedM(walletA), walletATreatment);
    this.flowNode(50, 242, 'WALLET C · BUYER INFLOWS', aedM(walletC), 'first source for payments');
    this.flowNode(464, 155, 'DRAWN CAPITAL (B)', aedM(this.drawn), `${pct(this.drawn / committedBase * 100)} of committed`, 'amber', true);
    this.rect(464, 196, 126, 6, PC.track);
    this.rect(464, 196, 126 * Math.min(1, this.drawn / committedBase), 6, PC.amber);
    this.flowNode(464, 214, 'STILL INVESTED (B)', aedM(this.undrawn), `${pct(this.undrawn / committedBase * 100)} of committed · +${aedM(num(this.data.walletBYield))} yield`, 'grey');
    this.text(`Wallet C applied ${aedM(walletC)} · first source before Wallet B`, 464, 266, 7.4, false, PC.ink2);
    this.rule(188, 305, 649, 305);
    this.flowNode(50, 287, 'LAND PARTNER EQUITY', aedM(this.land));
    this.flowNode(651, 287, 'LAND IN KIND', aedM(this.land));

    this.rule(ML, 331, MR, 331);
    this.label('Buyer escrow / settlement', 348, `Collections ${aedM(this.gdv)}`);
    this.text('SOURCE', 53, 367, 7.5, true, PC.muted);
    this.text('STATUTORY SPLIT', 277, 367, 7.5, true, PC.muted);
    this.text('SETTLEMENT / RESTRICTED', 602, 367, 7.5, true, PC.muted);

    const settlementValue = (target: string) => num(this.data.escrowSankey?.links.find((link) => link.source === 'unlocked' && link.target === target)?.value);
    const settlement = [
      ['Finance Partner capital', settlementValue('use_principal')],
      ['Finance Partner preferred return', settlementValue('use_interest')],
      ['Land Partner return', settlementValue('use_land')],
      ['Developer surplus', settlementValue('use_surplus')],
      ['Retention held', num(this.data.retentionPool)],
      ['Defects locked', num(this.data.defectsPool)],
    ] as const;
    this.rule(190, 424, 245, 424, PC.amber, 1.1);
    this.rule(245, 392, 245, 480, PC.amber, 1.1);
    this.rule(525, 395, 562, 395);
    this.rule(562, 391, 562, 469);
    [382, 418, 454].forEach((y) => this.rule(245, y + 10, 273, y + 10));
    settlement.forEach(([label, value], index) => {
      const y = 378 + index * 26;
      if (index < 4) this.rule(562, y + 10, 598, y + 10);
      this.rect(600, y, 3, 22, index < 4 ? PC.amber : index === 4 ? PC.amberDeep : PC.ink);
      this.text(label, 608, y + 14, 7.8, index === 3);
      this.text(aedM(value), 794, y + 14, 8.2, true, PC.ink, 'right');
    });
    this.flowNode(50, 405, 'BUYER COLLECTIONS', aedM(this.gdv));
    const split = [
      ['UNLOCKED', num(this.data.unlockedPool)],
      ['RETENTION', num(this.data.retentionPool)],
      ['DEFECTS', num(this.data.defectsPool)],
    ] as const;
    const splitTone = [PC.amber, PC.amberDeep, PC.ink] as const;
    split.forEach(([label, value], index) => {
      const y = 382 + index * 36;
      const share = this.gdv > 0 ? value / this.gdv : 0;
      this.rect(274, y, index === 0 ? 4 : 3, 27, splitTone[index]);
      this.text(label, 283, y + 10, 8, true);
      this.text(aedM(value), 283, y + 24, 9.2, true);
      this.rect(345, y + 9, 150, 6, PC.soft);
      this.rect(345, y + 9, 150 * Math.min(1, share), 6, splitTone[index]);
      this.text(pct(share * 100), 501, y + 15, 7.8, true, PC.ink2);
    });
  }

  timing(): void {
    this.start('Timing', '03');
    this.label('Buyer collection gates', 109, '% of GDV / amount / month');
    const milestones = this.data.milestones ?? [];
    this.table([
      { label: 'Progress gate', width: 310 }, { label: 'Collection %', width: 127, align: 'right' },
      { label: 'Collection (AED)', width: 195, align: 'right' }, { label: 'Month', width: 126, align: 'right' },
    ], milestones.length ? milestones.map((m) => [
      m.pct >= 100 ? 'Handover' : `${m.pct}% / ${m.phase}`,
      pct(m.collectionPct, 0), aedM(m.collection), `M${fnum(m.month, 0)}`,
    ]) : [['Not populated', '-', '-', '-']], 119, 8, 22);

    const rights = this.data.trancheSchedule ?? [];
    const labelY = this.y + 22;
    this.label('Finance Partner draw schedule', labelY, 'Pre-Development / 20 / 40 / 60 / 80 / Handover');
    const drawY = labelY + 10;
    this.table([
      { label: 'Draw right', width: 178 }, { label: 'Capacity', width: 128, align: 'right' },
      { label: 'Drawn %', width: 88, align: 'right' }, { label: 'Month', width: 66, align: 'right' },
      { label: 'Cost of capital on drawn', width: 150, align: 'right' },
      { label: 'Still invested + yield', width: 148, align: 'right' },
    ], rights.length ? rights.map((t) => [
      t.id === 'predev' ? 'Pre-Development' : t.id === 'E' ? 'E / Handover' : `${t.id} / ${t.gate.replace(/.*?(20|40|60|80)%/, '$1%')}`,
      aedM(t.capacity), pct(t.drawPct, 0), `M${fnum(t.drawMonth, 0)}`, aedM(t.interest),
      `${aedM(num(t.stillInvested ?? Math.max(0, num(t.capacity) - num(t.drawn))))} + ${aedM(num(t.yieldEarned))}`,
    ]) : [['Not populated', '-', '-', '-', '-', '-']], drawY, 8, 21);
    const carryYield = num(this.data.walletBYield);
    const carryHurdle = num(this.data.interestOnDrawn);
    const carryFees = Math.max(0, num(this.data.totalFinancingCost) - carryHurdle + carryYield);
    const netCarry = num(this.data.walletBNetCarry ?? (carryYield - carryHurdle - carryFees));
    this.text(
      `Net carry ${aedM(netCarry)} = yield ${aedM(carryYield)} - hurdle ${aedM(carryHurdle)} - fees ${aedM(carryFees)}. Drawing B early raises hurdle and forgoes yield; leaving B invested protects surplus.`,
      ML, this.y + 12, 7.6, false, PC.ink2,
    );
    this.y += 18;

    this.label('Stage sequence', 468, `Programme ${this.programmeMonths} months / DLP 12 months`);
    if (milestones.length >= 5) {
      const labels = ['Ground', 'Core', 'MEP / Facade', 'Fit-out', 'Handover', 'DLP'];
      const gates = [0, ...milestones.slice(0, 5).map((m) => num(m.month)), this.programmeMonths + 12];
      const duration = Math.max(1, gates.at(-1) ?? 1);
      labels.forEach((name, index) => {
        const start = gates[index];
        const end = Math.max(start, gates[index + 1]);
        const x = ML + (start / duration) * CW;
        const width = ((end - start) / duration) * CW;
        this.text(name.toUpperCase(), x + 4, 500, 7.4, true);
        this.rect(x + 4, 510, Math.max(2, width - 8), 5, index === 5 ? PC.ink : PC.amber);
        this.text(`M${fnum(start, 0)} - M${fnum(end, 0)}`, x + 4, 530, 7.2, false, PC.muted);
      });
    } else {
      this.text('Stage dates not populated', ML, 514, 8, false, PC.muted);
    }
  }

  teamRisk(): void {
    this.start('Team / De-Risking', '04');
    this.label('Team', 110, 'Name / role / stages / responsibilities');
    const team = this.data.teamMembers ?? loadTeamMembers();
    this.table([
      { label: 'Name', width: 133 }, { label: 'Role', width: 171 },
      { label: 'Stages', width: 72 }, { label: 'Responsibilities', width: 382 },
    ], team.length ? team.map((member) => [
      member.name, member.role, member.assignedStages.length ? member.assignedStages.map((s) => `S${s}`).join(', ') : '-',
      member.responsibilities.join('; '),
    ]) : [['Not populated', '-', '-', '-']], 120, 7.6, 21);

    const predev = this.data.trancheSchedule?.find((t) => t.id === 'predev');
    const risks: [string, string][] = [
      ['Funding before buyer collections', `Pre-Development draw ${aedM(predev?.capacity ?? 0)} at M${fnum(predev?.drawMonth ?? 0, 0)}; first buyer collection ${this.firstCollection}`],
      ['Construction gate release', 'Draws and buyer collections on the same 20 / 40 / 60 / 80% and Handover gates'],
      ['Cost variance', 'Escalation and contingency allowances carried in project costs'],
      ['Escrow retention', `${aedM(this.data.retentionPool)} held until certified completion`],
      ['Post-handover defects', `${aedM(this.data.defectsPool)} locked for 12 months after handover`],
    ];
    const riskTitleY = this.y + 18;
    this.label('De-Risking', riskTitleY, 'Risk / mitigation');
    this.table([
      { label: 'Risk factor', width: 304 }, { label: 'Mitigation', width: 454 },
    ], risks, riskTitleY + 10, 8, 21);
  }

  settlementStress(): void {
    this.start('Settlement / Stress', '05');
    this.label('Settlement', 110, 'Capital rank / preferred return / land equity / surplus');
    const waterfall = this.data.terminalWaterfall ?? [];
    const claimLabel = (index: number, fallback: string): string => {
      const raw = String(waterfall[index]?.label ?? fallback);
      return raw
        .replace(/Financier Debt Principal/i, 'Finance Partner Capital')
        .replace(/Financier Compounded Interest/i, 'Finance Partner Preferred Return')
        .replace(/Land Partner Asset Core Equity Return/i, 'Land Partner Return')
        .replace(/Residual Unallocated Developer Surplus/i, 'Developer Surplus');
    };
    const claims = [
      claimLabel(0, 'Finance Partner capital + project uses'),
      claimLabel(1, 'Finance Partner preferred return'),
      claimLabel(2, 'Land Partner equity return'),
      claimLabel(3, 'Defects reserve'),
      claimLabel(4, 'Developer surplus'),
    ];
    let remaining = this.gdv;
    const rows = claims.map((label, index) => {
      const obligation = num(waterfall[index]?.obligation ?? [this.data.externalDebtRequired, this.data.totalFinancingCost, this.land, this.data.defectsPool, this.data.totalProjectSurplus][index]);
      const funded = waterfall[index] ? num(waterfall[index].funded) : Math.min(remaining, Math.max(0, obligation));
      remaining = Math.max(0, remaining - funded);
      const recovered = obligation > 0 ? funded / obligation * 100 : 100;
      return [`0${index + 1}`, label, aedM(obligation), pct(this.gdv > 0 ? obligation / this.gdv * 100 : 0), `${pct(recovered)} / ${aedM(funded)}`];
    });
    this.table([
      { label: 'Rank', width: 57 }, { label: 'Claim', width: 268 },
      { label: 'Obligation', width: 155, align: 'right' }, { label: 'GDV share', width: 103, align: 'right' },
      { label: 'Recovery / funded', width: 175, align: 'right' },
    ], rows, 120, 8, 24);
    const bridge = Math.max(0, num(this.data.externalDebtRequired) - this.drawn);
    this.text(`Rank 01: ${aedM(this.drawn)} Finance Partner drawn + ${aedM(bridge)} project uses funded from unlocked escrow.`, ML, this.y + 16, 8, false, PC.ink2);
    this.text(`Total surplus ${aedM(this.data.totalProjectSurplus)} - defects lock ${aedM(this.data.defectsPool)} = ${aedM(num(waterfall[4]?.obligation) || num(this.data.totalProjectSurplus) - num(this.data.defectsPool))} available at rank 05.`, ML, this.y + 29, 8, false, PC.ink2);

    const stressY = this.y + 48;
    this.label('Stress / Viability basis', stressY,
      this.data.viabilityCostBasis === undefined ? 'Separate from Treasury cost' : `Viability cost ${aedM(this.data.viabilityCostBasis)}`);
    const sensitivity = this.data.sensitivity ?? [];
    this.table([
      { label: 'Tier', width: 241 }, { label: 'Price / NSA sf', width: 144, align: 'right' },
      { label: 'GDV', width: 147, align: 'right' }, { label: 'Leakage', width: 102, align: 'right' },
      { label: 'Margin', width: 124, align: 'right' },
    ], sensitivity.length ? sensitivity.slice(0, 4).map((tier) => [
      tier.label, `AED ${fnum(tier.price, 0)}`, aedM(tier.gdv), pct(tier.dynamicLeakagePercent, 0), pct(tier.grossMarginPercent),
    ]) : [['Not populated', '-', '-', '-', '-']], stressY + 10, 8, 24);
    this.text('Stress margins use Viability assumptions; Snapshot uses the separate Treasury capitalization.', ML, this.y + 17, 7.8, false, PC.muted);
  }

  auditBasis(): void {
    this.start('Audit Summary / Basis', '06');
    this.label('Material disclosures', 110, 'Full register retained in the XLSX workbook');
    const material = ['EX-04', 'EX-05', 'EX-07', 'EX-08', 'EX-09', 'ES-01', 'ES-02', 'WF-06', 'WF-07'];
    const labels: Record<string, string> = {
      'EX-04': 'Gross development value', 'EX-05': 'Total development cost',
      'EX-07': 'Developer surplus / margin', 'EX-08': 'Capital-flow reconciliation',
      'EX-09': 'Escrow conservation', 'ES-01': 'Active retention',
      'ES-02': 'Defects reserve', 'WF-06': 'Settlement conservation',
      'WF-07': 'Balance verification',
    };
    const register = this.data.reportDisclosures ?? [];
    const rows = material.flatMap((code) => {
      const entry = register.find((item) => item.code === code);
      if (!entry) return [];
      const amount = code === 'EX-05' ? aedM(this.data.totalDevelopmentCost) : entry.value;
      return [[code, labels[code], amount, entry.status.toUpperCase()]];
    });
    this.table([
      { label: 'Code', width: 76 }, { label: 'Disclosure', width: 235 },
      { label: 'Value', width: 341 }, { label: 'Status', width: 106, align: 'right' },
    ], rows.length ? rows : [['-', 'Not populated', '-', '-']], 120, 7.4, 21);

    const basisY = this.y + 20;
    this.label('Basis', basisY, 'Factual assumptions');
    const notes = [
      ['Currency', 'AED; amounts in millions unless noted.'],
      ['Cost of capital', 'Hurdle rate on drawn Wallet B balances over drawn months / 12; yield on still-invested balances. Actual/365 applies in the separate CFO ledger.'],
      ['Buyer escrow', `Retention ${aedM(this.data.retentionPool)} until certification; defects ${aedM(this.data.defectsPool)} locked 12 months. Buyer-first: Wallet C, then Wallet A, then Wallet B.`],
      ['Security', 'Escrow protection is statutory; partner security terms require executed documents.'],
    ];
    notes.forEach(([label, value], index) => {
      const y = basisY + 22 + index * 17;
      this.text(label.toUpperCase(), ML, y, 7.6, true, PC.muted);
      this.text(value, ML + 126, y, 8, false, PC.ink2);
    });
    const signY = basisY + 106;
    this.box(ML, signY, CW, 55, PC.warm);
    this.rect(ML, signY, 3, 55, PC.amber);
    const sign = [
      ['PREPARED FOR', 'Finance Partner / Land Partner'],
      ['ENTITY', 'Development Consortium'],
      ['DATE / REVIEW', `${this.dateText} / __________________`],
    ];
    sign.forEach(([label, value], index) => {
      const x = ML + 18 + index * 245;
      if (index > 0) this.rule(x - 12, signY + 10, x - 12, signY + 44);
      this.text(label, x, signY + 18, 7.4, true, PC.muted);
      this.text(value, x, signY + 37, 9, true);
    });
    this.text('NOTE', ML, signY + 76, 7.4, true, PC.muted);
    this.text(MODEL_FOOTNOTE, ML + 36, signY + 76, 8, false, PC.ink2);
  }

  finish(): Uint8Array {
    if (this.ops.length) this.pages.push(this.ops.join('\n'));
    const total = this.pages.length;
    const streams = this.pages.map((page, index) => page
      .replace(/@@PAGE@@/g, String(index + 1).padStart(2, '0'))
      .replace(/@@TOTAL@@/g, String(total).padStart(2, '0')));

    const objects: string[] = [];
    objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[1] = '<< /Type /Pages /Kids [] /Count 0 >>';
    objects[2] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    const pageIds = streams.map((_, index) => 5 + index * 2);
    objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${total} >>`;
    streams.forEach((stream, index) => {
      const pageId = pageIds[index];
      const contentId = pageId + 1;
      objects[pageId - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
      objects[contentId - 1] = `<< /Length ${enc(stream).length} >>\nstream\n${stream}\nendstream`;
    });
    const infoId = objects.length + 1;
    objects.push('<< /Title (Development Consortium - Partner Underwriting) /Author (Development Consortium) /Subject (Capital and settlement figures) /Creator (Vector PDF 1.4) >>');

    let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offsets: number[] = [];
    objects.forEach((body, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xrefStart = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
    return Uint8Array.from(pdf, (character) => character.charCodeAt(0) & 0xff);
  }
}

/** PDF entry point: exactly six decision-order pages for the normal roster. */
export function buildPdfReport(data: ExportInputs): Uint8Array {
  const document = new PdfDoc(data);
  document.snapshot();
  document.flows();
  document.timing();
  document.teamRisk();
  document.settlementStress();
  document.auditBasis();
  return document.finish();
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
/**
 * Markdown companion to the PDF. Data only: no thesis, no narrative and no
 * deck-building instructions. Every row mirrors a figure in the PDF pack.
 */
function buildMarkdown(disclosures: ReportDisclosure[]): string {
  const cell = (text: string) => String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const disclosureRows = disclosures.length
    ? disclosures
        .map((d) => `| ${cell(d.code)} | ${d.section} | ${cell(d.label)} | ${cell(d.value)} | ${cell(d.basis)} | ${d.status.toUpperCase()} |`)
        .join('\n')
    : '| - | - | Not populated | - | - | - |';

  return `# Underwriting Report - Development Consortium

Numbers and diagrams only. Currency AED.

## 1. Key Metrics

| Metric | Basis |
|---|---|
| Gross development value | GDV at the blended selling rate |
| Total development cost | Land + committed capital + carry net of yield |
| Unallocated surplus | GDV - total development cost |
| Margin | Surplus / GDV |
| Land equity | Land partner contribution |
| Finance Partner drawn capital | Elected tranche draws |
| Still invested (Wallet B) | Committed - drawn, earning yield |
| Preferred return on drawn | Hurdle on drawn balances |
| Cost avoided | Versus full draw of every right |
| Committed share | Committed capital / GDV |

## 2. Capital Flows

- Underwriting: Land Partner equity, Finance Partner capital into Wallet B reserve, Wallet A 20% lock, Wallet C buyer inflows -> Pre-Development draw + five progress-gated tranches -> drawn capital -> uses, buyer-first.
- Escrow: buyer collections -> unlocked / retention / defects -> settlement claims. Unlocked escrow funds construction first; Wallet B is the backstop.
- Diagrams with node and link values are printed in the PDF pack.

## 3. Milestones & Capital Timing

Buyer gates: 20% Ground & Foundation, 40% Structural Core, 60% MEP & Facade, 80% Fit-out, Handover.
Draw rights: Pre-Development at financial close, then one draw per progress gate.

## 4. Team

Printed from the Team register; not repeated here to avoid divergence.

## 5. De-Risking

Risk factor to mitigation table is printed in the PDF pack.

## 6. Settlement Waterfall

Rank, claim, obligation, share and recovery status are printed in the PDF pack.

## 7. Stress Matrix

Four tiers: price per NSA sf, effective GDV, leakage and margin.

## 8. Audit Disclosures

| code | section | disclosure | value | basis | status |
|---|---|---|---|---|---|
${disclosureRows}

## 9. Basis of Preparation

- Currency AED; millions shown to two decimal places.
- Hurdle rate on drawn Wallet B balances from each planned draw month to handover; simple yield on still-invested balances.
- Active retention is withheld until certified completion; the defects pool is fixed at 5% for 12 months.
- ${MODEL_FOOTNOTE}
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

/** Stage-linked debt draw right as printed in the report. */
export interface ExportTrancheRow {
  id: string;
  label: string;
  gate: string;
  capacity: number;
  drawn: number;
  drawPct: number;
  drawMonth: number;
  interest: number;
  /** Share of capacity still invested in Wallet B. */
  stillInvested?: number;
  /** Simple yield earned on the still-invested balance. */
  yieldEarned?: number;
  /** Internal hurdle cost on the drawn balance. */
  hurdleCost?: number;
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
  /** Report date (ISO). Defaults to the generation date. */
  reportDate?: string;
  /** Viability engine's independent cost basis for the four-tier stress margins. */
  viabilityCostBasis?: number;
  /** Stage-linked capital totals and draw rights (treasury engine). */
  totalDrawnPrincipal?: number;
  totalUndrawnCapacity?: number;
  interestOnDrawn?: number;
  interestSaved?: number;
  totalDebtFacility?: number;
  trancheSchedule?: ExportTrancheRow[];
  /** Three-wallet treasury policy (treasury engine). */
  walletATreatment?: string;
  walletALock?: number;
  walletARelease?: number;
  walletARestricted?: number;
  walletCApplied?: number;
  walletBPool?: number;
  walletBInvested?: number;
  walletBYield?: number;
  walletBHurdle?: number;
  walletBNetCarry?: number;
  /** Buyer collection gates (treasury engine). */
  milestones?: MilestoneRow[];
  /** Live Sankey data from the treasury engine, printed as vector diagrams. */
  underwritingSankey?: SankeyData;
  escrowSankey?: SankeyData;
  /** Terminal settlement waterfall (report disclosures). */
  terminalWaterfall?: WaterfallRung[];
  /** Team CRUD snapshot; loaded from the persisted register when omitted. */
  teamMembers?: TeamMember[];
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
      ['Unallocated Margin', data.gdv > 0 ? (data.totalProjectSurplus / data.gdv) * 100 : 0, '% of GDV'],
      ['Finance Partner Drawn Capital', data.totalDrawnPrincipal ?? data.externalDebtRequired, 'AED'],
      ['Still Invested (Wallet B)', data.totalUndrawnCapacity ?? 0, 'AED'],
      ['Preferred Return on Drawn (Hurdle)', data.interestOnDrawn ?? data.totalFinancingCost, 'AED'],
      ['Yield on Still-Invested Balances', data.walletBYield ?? 0, 'AED'],
      ['Net Carry (Yield - Hurdle - Fees)', data.walletBNetCarry ?? 0, 'AED'],
      ['Cost Avoided vs Full Draw', data.interestSaved ?? 0, 'AED'],
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
      ['Finance Partner Committed Capital', data.externalDebtRequired],
      ['Accrued Preferred Return', data.totalFinancingCost],
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
      ['CFS', 'Financing - partner capital drawn', data.cfoDebtDrawn, 'Partner capital drawn'],
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
      ['Balance Sheet', 'Finance Partner drawn capital', data.cfoDebtPrincipal, 'Outstanding partner capital'],
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
      ['Disclosure', MODEL_FOOTNOTE],
    ],
  };

  const trancheSheet: ExcelSheet = {
    name: 'Partner Draw Schedule',
    rows: [
      ['Draw right', 'Progress gate', 'Capacity (AED)', 'Draw election (%)', 'Drawn (AED)', 'Draw month', 'Hurdle Cost (AED)', 'Still Invested (AED)', 'Yield Earned (AED)'],
      ...(data.trancheSchedule ?? []).map((tranche) => [
        tranche.label,
        tranche.gate,
        tranche.capacity,
        tranche.drawPct,
        tranche.drawn,
        tranche.drawMonth,
        tranche.interest,
        tranche.stillInvested ?? Math.max(0, tranche.capacity - tranche.drawn),
        tranche.yieldEarned ?? 0,
      ]),
      [],
      ['Total', '', data.totalDebtFacility ?? data.externalDebtRequired, '', data.totalDrawnPrincipal ?? data.externalDebtRequired, '', data.interestOnDrawn ?? data.totalFinancingCost, data.totalUndrawnCapacity ?? 0, data.walletBYield ?? 0],
      ['Still invested (Wallet B)', '', data.totalUndrawnCapacity ?? 0],
      ['Net carry (yield - hurdle - fees)', '', data.walletBNetCarry ?? 0],
      ['Cost avoided vs full draw', '', data.interestSaved ?? 0],
      [],
      ['Wallet A treatment', data.walletATreatment === 'bg_fd' ? 'Bank guarantee + fixed deposit' : 'Restricted cash escrow'],
      ['Wallet A lock (20%)', '', data.walletALock ?? 0],
      ['Wallet A released', '', data.walletARelease ?? 0],
      ['Wallet C applied (buyer-first)', '', data.walletCApplied ?? 0],
    ],
  };

  const milestoneSheet: ExcelSheet = {
    name: 'Buyer Milestone Gates',
    rows: [
      ['Progress gate', 'Phase', '% of GDV', 'Collection (AED)', 'Month'],
      ...(data.milestones ?? []).map((milestone) => [
        `${milestone.pct}%`,
        milestone.phase,
        milestone.collectionPct,
        milestone.collection,
        milestone.month,
      ]),
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
      ['Note', 'Certified S-curve staging keeps drawn principal lower than a Day-1 full advance.'],
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
      ['Disclosure', MODEL_FOOTNOTE],
    ],
  };

  const sheets: ExcelSheet[] = [feasibilitySheet, escrowSheet, cfoStatementSheet, drawdownSheet, reportSheet,
    trancheSheet,
    milestoneSheet,
  ];

  download('treasury_ledger_snapshot.xlsx', buildXlsx(sheets), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  download('pitch_deck_ai_blueprint.md', enc(buildMarkdown(data.reportDisclosures ?? [])), 'text/markdown;charset=utf-8');
}
