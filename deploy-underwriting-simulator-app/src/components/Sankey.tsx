import { useId, useMemo, useState } from 'react';
import type { SankeyData } from '../engine/treasuryEngine';

interface Props {
  data: SankeyData;
  uid?: string;
  height?: number;
  width?: number;
  marginLeft?: number;
  marginRight?: number;
  minWidth?: number;
  format: (value: number) => string;
  compact?: boolean;
  showInspector?: boolean;
  className?: string;
}

interface LayoutNode {
  id: string;
  label: string;
  color: string;
  note?: string;
  column: number;
  value: number;
  x: number;
  y: number;
  h: number;
  incoming: number;
  outgoing: number;
  lines: string[];
  labelHeight: number;
}

interface LayoutLink {
  source: LayoutNode;
  target: LayoutNode;
  value: number;
  thickness: number;
  y0: number;
  y1: number;
}

type ActiveFlow = { kind: 'node'; id: string } | { kind: 'link'; id: number } | null;
const NODE_W = 16;
const PAD = 24;
const TOP = 90;
const BOTTOM = 28;
const LABEL_GAP = 14;
const MIN_H = 8;

function wrapLabel(text: string, availableWidth: number, fontSize: number): string[] {
  const maxCharacters = Math.max(12, Math.floor(availableWidth / (fontSize * 0.54)));
  const lines: string[] = [];
  let line = '';
  for (const word of text.trim().split(/\s+/)) {
    if (line && `${line} ${word}`.length > maxCharacters) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function ribbonPath(link: LayoutLink): string {
  const x0 = link.source.x + NODE_W;
  const x1 = link.target.x;
  const dx = (x1 - x0) * 0.45;
  const half = link.thickness / 2;
  return [
    `M ${x0},${link.y0 - half}`,
    `C ${x0 + dx},${link.y0 - half} ${x1 - dx},${link.y1 - half} ${x1},${link.y1 - half}`,
    `L ${x1},${link.y1 + half}`,
    `C ${x1 - dx},${link.y1 + half} ${x0 + dx},${link.y0 + half} ${x0},${link.y0 + half}`,
    'Z',
  ].join(' ');
}

export default function Sankey({
  data,
  uid: seed = 'flow',
  width = 1600,
  height = 900,
  marginLeft = 300,
  marginRight = 300,
  minWidth = 0,
  format,
  compact = false,
  showInspector = true,
  className = '',
}: Props) {
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const uid = `${seed.replace(/[^a-zA-Z0-9_-]/g, '-')}-${instanceId}`;
  const [hovered, setHovered] = useState<ActiveFlow>(null);
  const [pinned, setPinned] = useState<ActiveFlow>(null);
  const active = hovered ?? pinned;
  const fontSize = compact ? 15.5 : 14;
  const lineHeight = fontSize * 1.28;

  const layout = useMemo(() => {
    const defs = new Map(data.nodes.map((node) => [node.id, node]));
    const validLinks = data.links.filter(
      (link) =>
        Number.isFinite(link.value) &&
        link.value > 0 &&
        defs.has(link.source) &&
        defs.has(link.target) &&
        defs.get(link.target)!.column > defs.get(link.source)!.column,
    );
    const used = new Set(validLinks.flatMap((link) => [link.source, link.target]));
    const maxColumn = Math.max(0, ...data.nodes.map((node) => node.column));
    const gap = (width - marginLeft - marginRight - NODE_W) / Math.max(1, maxColumn);

    const nodes: LayoutNode[] = data.nodes
      .filter((node) => used.has(node.id))
      .map((node) => {
        const incoming = validLinks.filter((link) => link.target === node.id).reduce((sum, link) => sum + link.value, 0);
        const outgoing = validLinks.filter((link) => link.source === node.id).reduce((sum, link) => sum + link.value, 0);
        const labelWidth =
          node.column === 0
            ? marginLeft - 28
            : node.column === maxColumn
              ? marginRight - 28
              : Math.max(100, gap - 32);
        const lines = wrapLabel(node.label, labelWidth, fontSize);
        return {
          ...node,
          incoming,
          outgoing,
          value: Math.max(incoming, outgoing, node.value ?? 0),
          x: marginLeft + node.column * gap,
          y: 0,
          h: 0,
          lines,
          labelHeight: (lines.length + 1) * lineHeight,
        };
      });

    const columns = Array.from({ length: maxColumn + 1 }, (_, column) =>
      nodes.filter((node) => node.column === column),
    );

    // Magnitude sorting on Column 0 and Column 4
    columns.forEach((column) => column.sort((a, b) => b.value - a.value || a.id.localeCompare(b.id)));

    const slotHeight = (node: LayoutNode, scale: number) => {
      const h = Math.max(MIN_H, node.value * scale);
      if (node.column === 1 && columns[1].length === 1) return h + 2 * (node.labelHeight + LABEL_GAP);
      return node.column > 0 && node.outgoing > 0 ? h + node.labelHeight + LABEL_GAP : Math.max(h, node.labelHeight);
    };

    const minimumBudget = Math.max(
      0,
      ...columns.map(
        (column) =>
          column.reduce((sum, node) => sum + slotHeight(node, 0), 0) + PAD * Math.max(0, column.length - 1),
      ),
    );
    const canvasHeight = Math.max(height, TOP + BOTTOM + minimumBudget);
    const availableHeight = canvasHeight - TOP - BOTTOM;
    const maximumValue = Math.max(1, ...nodes.map((node) => node.value));

    let lo = 0;
    let hi = availableHeight / maximumValue;
    for (let pass = 0; pass < 44; pass += 1) {
      const scale = (lo + hi) / 2;
      const fits = columns.every(
        (column) =>
          column.reduce((sum, node) => sum + slotHeight(node, scale), 0) +
            PAD * Math.max(0, column.length - 1) <=
          availableHeight,
      );
      if (fits) lo = scale;
      else hi = scale;
    }
    const scale = lo;
    nodes.forEach((node) => {
      node.h = Math.max(MIN_H, node.value * scale);
    });

    columns.forEach((column, index) => {
      const totalHeight =
        column.reduce((sum, node) => sum + slotHeight(node, scale), 0) + PAD * Math.max(0, column.length - 1);
      let cursor = TOP + (index === 0 ? 0 : (availableHeight - totalHeight) / 2);
      column.forEach((node) => {
        const slot = slotHeight(node, scale);
        node.y = cursor + (index > 0 && node.outgoing > 0 ? node.labelHeight + LABEL_GAP : (slot - node.h) / 2);
        cursor += slot + PAD;
      });

      // Strict centering on Column 1 (Central hub)
      if (index === 1 && column.length === 1) {
        column[0].y = (canvasHeight - column[0].h) / 2;
      }
    });

    const byId = new Map(nodes.map((node) => [node.id, node]));
    const links: LayoutLink[] = validLinks.map((link) => ({
      source: byId.get(link.source)!,
      target: byId.get(link.target)!,
      value: link.value,
      thickness: link.value * scale,
      y0: 0,
      y1: 0,
    }));

    nodes.forEach((node) => {
      const outs = links.filter((link) => link.source === node).sort((a, b) => a.target.y - b.target.y);
      const ins = links.filter((link) => link.target === node).sort((a, b) => a.source.y - b.source.y);
      let outCursor = node.y + (node.h - outs.reduce((sum, link) => sum + link.thickness, 0)) / 2;
      let inCursor = node.y + (node.h - ins.reduce((sum, link) => sum + link.thickness, 0)) / 2;
      outs.forEach((link) => {
        link.y0 = outCursor + link.thickness / 2;
        outCursor += link.thickness;
      });
      ins.forEach((link) => {
        link.y1 = inCursor + link.thickness / 2;
        inCursor += link.thickness;
      });
    });

    return { nodes, links, columns, canvasHeight };
  }, [data, width, height, marginLeft, marginRight, fontSize, lineHeight]);

  const currentLink = active?.kind === 'link' ? layout.links[active.id] : undefined;
  const currentNode = active?.kind === 'node' ? layout.nodes.find((node) => node.id === active.id) : undefined;
  const highlighted = (link: LayoutLink, index: number) =>
    active?.kind === 'link'
      ? active.id === index
      : active?.kind === 'node'
        ? link.source.id === active.id || link.target.id === active.id
        : false;

  const togglePinned = (next: NonNullable<ActiveFlow>) =>
    setPinned((prev) => (prev?.kind === next.kind && prev.id === next.id ? null : next));

  if (layout.nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-[13px] text-muted font-normal">
        No active capital flows for the current underwriting assumptions.
      </div>
    );
  }

  return (
    <div className={`flex min-h-0 min-w-0 flex-col ${className}`}>
      <div className={`min-h-0 min-w-0 flex-1 ${minWidth > 0 ? 'overflow-x-auto scroll-thin pb-1' : ''}`}>
        <svg
          viewBox={`0 0 ${width} ${layout.canvasHeight}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: '100%', minWidth }}
          role="group"
          aria-label={`${seed} capital flow`}
          className="block font-sans"
        >
          <defs>
            {layout.links.map((link, index) => (
              <linearGradient
                key={index}
                id={`${uid}-g-${index}`}
                gradientUnits="userSpaceOnUse"
                x1={link.source.x + NODE_W}
                x2={link.target.x}
                y1={link.y0}
                y2={link.y1}
              >
                <stop offset="0%" stopColor={link.source.color} />
                <stop offset="100%" stopColor={link.target.color} />
              </linearGradient>
            ))}
          </defs>

          {!compact && (
            <g aria-hidden="true">
              {layout.columns.map(
                (column, index) =>
                  column.length > 0 && (
                    <g key={index}>
                      <line
                        x1={column[0].x + NODE_W / 2}
                        x2={column[0].x + NODE_W / 2}
                        y1={50}
                        y2={layout.canvasHeight - 16}
                        stroke="rgba(22,24,28,0.06)"
                        strokeWidth="1"
                        strokeDasharray="3 4"
                      />
                      <text
                        x={column[0].x + NODE_W / 2}
                        y={28}
                        textAnchor="middle"
                        fontSize="11"
                        letterSpacing="1.2"
                        fill="#5F646B"
                        className="font-medium uppercase"
                      >
                        {['SOURCES', 'CAPITAL HUB', 'ALLOCATION', 'PROJECT USES', 'SETTLEMENT'][index] ?? `COLUMN ${index}`}
                      </text>
                    </g>
                  ),
              )}
            </g>
          )}

          {/* Ribbons */}
          <g>
            {layout.links.map((link, index) => {
              const selected = highlighted(link, index);
              const x0 = link.source.x + NODE_W;
              const x1 = link.target.x;
              const dx = (x1 - x0) * 0.45;
              return (
                <g
                  key={`${link.source.id}-${link.target.id}-${index}`}
                  onMouseEnter={() => setHovered({ kind: 'link', id: index })}
                  onMouseLeave={() => setHovered(null)}
                >
                  <path
                    d={ribbonPath(link)}
                    fill={`url(#${uid}-g-${index})`}
                    fillOpacity={selected ? 0.45 : active ? 0.08 : 0.28}
                    stroke={`url(#${uid}-g-${index})`}
                    strokeWidth="0.8"
                    strokeOpacity={selected ? 0.7 : 0.3}
                    className="transition-[fill-opacity,stroke-opacity] duration-200"
                    pointerEvents="none"
                  />
                  <path
                    d={`M${x0},${link.y0} C${x0 + dx},${link.y0} ${x1 - dx},${link.y1} ${x1},${link.y1}`}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={Math.max(10, link.thickness)}
                    tabIndex={0}
                    role="button"
                    aria-label={`${link.source.label} to ${link.target.label}: ${format(link.value)}`}
                    onFocus={() => setHovered({ kind: 'link', id: index })}
                    onBlur={() => setHovered(null)}
                    onClick={() => togglePinned({ kind: 'link', id: index })}
                    className="cursor-pointer outline-none"
                  >
                    <title>{`${link.source.label} → ${link.target.label}: ${format(link.value)}`}</title>
                  </path>
                </g>
              );
            })}
          </g>

          {/* Node Bars */}
          <g>
            {layout.nodes.map((node) => {
              const isSource = node.column === 0;
              const isSink = !isSource && node.outgoing === 0;
              const connected =
                !active ||
                currentNode?.id === node.id ||
                currentLink?.source.id === node.id ||
                currentLink?.target.id === node.id ||
                layout.links.some((l, idx) => highlighted(l, idx) && (l.source === node || l.target === node));

              return (
                <g
                  key={node.id}
                  opacity={connected ? 1 : 0.4}
                  onMouseEnter={() => setHovered({ kind: 'node', id: node.id })}
                  onMouseLeave={() => setHovered(null)}
                >
                  <rect
                    x={node.x - 4}
                    y={node.y - 3}
                    width={NODE_W + 8}
                    height={node.h + 6}
                    fill="transparent"
                    tabIndex={0}
                    role="button"
                    aria-label={`${node.label}: ${format(node.value)}`}
                    onFocus={() => setHovered({ kind: 'node', id: node.id })}
                    onBlur={() => setHovered(null)}
                    onClick={() => togglePinned({ kind: 'node', id: node.id })}
                    className="cursor-pointer outline-none"
                  />
                  <rect x={node.x} y={node.y} width={NODE_W} height={node.h} rx={3} fill={node.color} pointerEvents="none" />
                  {(isSource || isSink) && (
                    <line
                      x1={isSource ? node.x - LABEL_GAP + 4 : node.x + NODE_W + 4}
                      x2={isSource ? node.x - 3 : node.x + NODE_W + LABEL_GAP - 4}
                      y1={node.y + node.h / 2}
                      y2={node.y + node.h / 2}
                      stroke={node.color}
                      strokeOpacity="0.4"
                    />
                  )}
                </g>
              );
            })}
          </g>

          {/* Decoupled Outboard Typography Layer with 4px Crisp White Halo */}
          <g pointerEvents="none" stroke="#FFFFFF" strokeWidth="4" strokeLinejoin="round" paintOrder="stroke">
            {layout.nodes.map((node) => {
              const isSource = node.column === 0;
              const isSink = !isSource && node.outgoing === 0;
              const x = isSource ? node.x - 14 : isSink ? node.x + NODE_W + 14 : node.x + NODE_W / 2;
              const y =
                isSource || isSink
                  ? node.y + node.h / 2 - node.labelHeight / 2 + lineHeight * 0.75
                  : node.y - LABEL_GAP - node.labelHeight + lineHeight * 0.75;

              return (
                <text
                  key={node.id}
                  x={x}
                  y={y}
                  textAnchor={isSource ? 'end' : isSink ? 'start' : 'middle'}
                  fontSize={fontSize}
                  fill="#16181C"
                >
                  {node.lines.map((line, idx) => (
                    <tspan key={idx} x={x} dy={idx === 0 ? 0 : lineHeight} fontWeight="500">
                      {line}
                    </tspan>
                  ))}
                  <tspan x={x} dy={lineHeight} fontSize={fontSize} fontWeight="600" fill="#16181C">
                    {format(node.value)}
                  </tspan>
                </text>
              );
            })}
          </g>
        </svg>
      </div>

      {showInspector && (
        <div className="mt-2.5 min-h-[36px] border-t border-[rgba(22,24,28,0.06)] pt-2 text-[12px] sm:text-[12.5px] leading-relaxed text-[#5F646B] break-words">
          {currentLink ? (
            <span>
              <b className="text-ink">{currentLink.source.label}</b> → <b className="text-ink">{currentLink.target.label}</b>: <b className="text-ink font-semibold">{format(currentLink.value)}</b>
            </span>
          ) : currentNode ? (
            <span>
              <b className="text-ink">{currentNode.label}</b>: {format(currentNode.value)}{currentNode.note ? ` — ${currentNode.note}` : ''}
            </span>
          ) : (
            <span>Tap or hover any flow ribbon or node bar to inspect exact AED allocation.</span>
          )}
        </div>
      )}
    </div>
  );
}
