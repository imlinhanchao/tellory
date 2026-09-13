/**
 * Story graph utilities.
 *
 * Builds the passage-level relationship graph of a {@link StoryData} value:
 * every passage is a node, and the references found in its body become directed
 * edges (`[[...]]` / `(goto:)` = navigation, `(display:)` = inclusion).
 *
 * The reference scanning mirrors the SDK syntax checker (`packages/sdk/src/parser.ts`)
 * so the graph agrees with "死链 / 孤立段落" diagnostics, and it ignores
 * `<style>` blocks, fenced code blocks and `(fn:)` bodies.
 *
 * `layoutStoryGraph` then places the nodes with a deterministic layered layout
 * (BFS depth = column, barycenter ordering to reduce crossings) so the graph can
 * be rendered without pulling in a visualisation dependency.
 */
import type { StoryData, StoryPassage } from "@/lib/storyEngine";

/** Direction semantics of an edge between two passages. */
export type StoryGraphEdgeKind = "link" | "display";

/** A passage reference discovered inside a passage body. */
export interface StoryLink {
  /** Referenced passage name. */
  target: string;
  /** `link` navigates to the target, `display` includes its content inline. */
  kind: StoryGraphEdgeKind;
  /** Character index of the reference inside the passage content. */
  index: number;
}

/** A passage node of the story graph. */
export interface StoryGraphNode {
  /** Passage name (unique per graph). */
  id: string;
  /** Passage name as written in the story source. */
  name: string;
  /** Tags declared in the passage header. */
  tags: string[];
  /** Whether this passage is the story entry point. */
  isStart: boolean;
  /** Referenced by no other passage and not the start passage. */
  isOrphan: boolean;
  /** Not reachable from the start passage by following references. */
  isUnreachable: boolean;
  /** Referenced but never defined — rendered as a ghost node. */
  isDangling: boolean;
  /** Zero-based layout column (compacted BFS depth). */
  depth: number;
  /** Zero-based position inside its column. */
  index: number;
  /** Original declaration order in the story source. */
  order: number;
  /** Number of distinct incoming edges. */
  incoming: number;
  /** Number of distinct outgoing edges. */
  outgoing: number;
}

/** A deduplicated directed edge between two passages. */
export interface StoryGraphEdge {
  /** Stable identifier: `source -> target #kind`. */
  id: string;
  /** Source passage name. */
  source: string;
  /** Target passage name. */
  target: string;
  /** Edge semantics. */
  kind: StoryGraphEdgeKind;
  /** How many references of this kind exist between the two passages. */
  count: number;
  /** Target passage does not exist in the story. */
  dangling: boolean;
  /** Source and target are the same passage. */
  selfLoop: boolean;
}

/** Aggregate counters used by the graph header. */
export interface StoryGraphStats {
  /** Number of distinct passages declared in the story. */
  passageCount: number;
  /** Number of drawn nodes (passages + ghost nodes). */
  nodeCount: number;
  /** Number of distinct edges. */
  edgeCount: number;
  /** Number of navigation references (including duplicates). */
  linkCount: number;
  /** Number of inclusion references (including duplicates). */
  displayCount: number;
  /** Number of edges pointing at undefined passages. */
  danglingCount: number;
  /** Number of passages nobody references. */
  orphanCount: number;
  /** Number of passages unreachable from the start passage. */
  unreachableCount: number;
  /** Number of passages that link to themselves. */
  selfLoopCount: number;
  /** Number of duplicate passage declarations. */
  duplicateCount: number;
  /** Number of layout columns. */
  columnCount: number;
  /** Whether `story.startPassage` resolves to a defined passage. */
  startMissing: boolean;
}

/** The complete relationship graph of a story. */
export interface StoryGraph {
  nodes: StoryGraphNode[];
  edges: StoryGraphEdge[];
  /** Nodes grouped by column, index = column. */
  layers: StoryGraphNode[][];
  nodeMap: Map<string, StoryGraphNode>;
  stats: StoryGraphStats;
}

/** Options for {@link buildStoryGraph}. */
export interface StoryGraphOptions {
  /** Render references to undefined passages as ghost nodes. Default `true`. */
  includeDangling?: boolean;
  /** Include `(display:)` inclusion edges. Default `true`. */
  includeDisplayEdges?: boolean;
}

/** Reads a `(...)`, `[...]` or `{...}` block starting at `startIndex`. */
function readBalancedBlock(
  source: string,
  startIndex: number,
  open: string,
  close: string,
): { content: string; endIndex: number } | null {
  if (source[startIndex] !== open) return null;

  let depth = 0;
  let quote: string | null = null;

  for (let i = startIndex; i < source.length; i += 1) {
    const char = source[i];

    if (quote) {
      if (char === "\\") {
        i += 1;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === open) {
      depth += 1;
    } else if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return { content: source.slice(startIndex + 1, i), endIndex: i + 1 };
      }
    }
  }

  return null;
}

/** Extracts the target passage name from a `(goto: ...)` body. */
function parseGotoTarget(body: string): string | undefined {
  const match = body.match(/goto:\s*(?:["']([^"']+)["']|([^\]\)]+))/i);
  const target = (match?.[1] ?? match?.[2] ?? "").trim();
  return target || undefined;
}

/**
 * Collects regions that must not be scanned for references: `<style>` blocks,
 * fenced code blocks and `(fn:"name")[code]` definitions.
 */
function collectIgnoredRanges(content: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];

  for (const match of content.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)) {
    const start = match.index ?? 0;
    ranges.push([start, start + match[0].length]);
  }

  for (const match of content.matchAll(/```[\s\S]*?```/g)) {
    const start = match.index ?? 0;
    ranges.push([start, start + match[0].length]);
  }

  const fnPattern = /\(fn:/gi;
  let fnMatch: RegExpExecArray | null;
  while ((fnMatch = fnPattern.exec(content))) {
    const signature = readBalancedBlock(content, fnMatch.index, "(", ")");
    if (!signature) {
      fnPattern.lastIndex = fnMatch.index + 4;
      continue;
    }
    let cursor = signature.endIndex;
    while (cursor < content.length && /\s/.test(content[cursor])) cursor += 1;
    const body = readBalancedBlock(content, cursor, "[", "]");
    if (!body) {
      fnPattern.lastIndex = signature.endIndex;
      continue;
    }
    ranges.push([fnMatch.index, body.endIndex]);
    fnPattern.lastIndex = body.endIndex;
  }

  return ranges;
}

/**
 * Collects every passage reference inside a passage body:
 * `[[label|target]]` / `[[target]]`, `(goto:"Target")` and `(display:"Target")`.
 */
export function extractStoryLinks(content: string): StoryLink[] {
  const links: StoryLink[] = [];
  if (!content) return links;

  const ignored = collectIgnoredRanges(content);
  const isIgnored = (index: number) =>
    ignored.some(([start, end]) => index >= start && index < end);

  for (const match of content.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)) {
    const index = match.index ?? 0;
    if (isIgnored(index)) continue;
    const target = (match[2] ?? match[1] ?? "").trim();
    if (target) links.push({ target, kind: "link", index });
  }

  const gotoPattern = /\(goto:/gi;
  let gotoMatch: RegExpExecArray | null;
  while ((gotoMatch = gotoPattern.exec(content))) {
    const block = readBalancedBlock(content, gotoMatch.index, "(", ")");
    if (!block) {
      gotoPattern.lastIndex = gotoMatch.index + 6;
      continue;
    }
    gotoPattern.lastIndex = block.endIndex;
    if (isIgnored(gotoMatch.index)) continue;
    const target = parseGotoTarget(block.content);
    if (target) links.push({ target, kind: "link", index: gotoMatch.index });
  }

  for (const match of content.matchAll(
    /\(display:\s*["']([^"']+)["']\s*\)/gi,
  )) {
    const index = match.index ?? 0;
    if (isIgnored(index)) continue;
    const target = match[1].trim();
    if (target) links.push({ target, kind: "display", index });
  }

  return links;
}

/**
 * Builds the passage relationship graph of a story.
 *
 * Duplicate passage declarations are merged (their contents are scanned
 * together) and counted in {@link StoryGraphStats.duplicateCount}.
 */
export function buildStoryGraph(
  story: StoryData | null | undefined,
  options: StoryGraphOptions = {},
): StoryGraph {
  const includeDangling = options.includeDangling ?? true;
  const includeDisplayEdges = options.includeDisplayEdges ?? true;
  const passages: StoryPassage[] = Array.isArray(story?.passages)
    ? story!.passages
    : [];

  const nodes: StoryGraphNode[] = [];
  const nodeMap = new Map<string, StoryGraphNode>();
  const bodies: string[] = [];
  let duplicateCount = 0;

  for (const passage of passages) {
    const name = (passage?.name ?? "").trim();
    if (!name) continue;

    const existing = nodeMap.get(name);
    if (existing) {
      duplicateCount += 1;
      bodies[existing.order] += `\n${passage?.content ?? ""}`;
      continue;
    }

    const node: StoryGraphNode = {
      id: name,
      name,
      tags: [...(passage?.tags ?? [])],
      isStart: false,
      isOrphan: false,
      isUnreachable: false,
      isDangling: false,
      depth: 0,
      index: nodes.length,
      order: nodes.length,
      incoming: 0,
      outgoing: 0,
    };
    nodeMap.set(name, node);
    nodes.push(node);
    bodies.push(passage?.content ?? "");
  }

  const startId = (story?.startPassage ?? "").trim();
  const startExists = nodeMap.has(startId);
  nodes.forEach((node) => {
    node.isStart = node.id === startId;
  });

  // Collect and deduplicate edges.
  const edgeMap = new Map<string, StoryGraphEdge>();
  let linkCount = 0;
  let displayCount = 0;

  nodes.forEach((node, order) => {
    for (const link of extractStoryLinks(bodies[order])) {
      if (link.kind === "display") {
        if (!includeDisplayEdges) continue;
        displayCount += 1;
      } else {
        linkCount += 1;
      }

      const selfLoop = link.target === node.id;
      const id = `${node.id}\u0000${link.target}\u0000${link.kind}`;
      const existing = edgeMap.get(id);
      if (existing) {
        existing.count += 1;
        continue;
      }
      edgeMap.set(id, {
        id,
        source: node.id,
        target: link.target,
        kind: link.kind,
        count: 1,
        dangling: !nodeMap.has(link.target),
        selfLoop,
      });
    }
  });

  let edges = [...edgeMap.values()];

  // Ghost nodes for references to undefined passages.
  if (includeDangling) {
    for (const edge of [...edges].sort((a, b) =>
      a.target.localeCompare(b.target),
    )) {
      if (!edge.dangling || nodeMap.has(edge.target)) continue;
      const ghost: StoryGraphNode = {
        id: edge.target,
        name: edge.target,
        tags: [],
        isStart: false,
        isOrphan: false,
        isUnreachable: false,
        isDangling: true,
        depth: 0,
        index: nodes.length,
        order: nodes.length,
        incoming: 0,
        outgoing: 0,
      };
      nodeMap.set(ghost.id, ghost);
      nodes.push(ghost);
    }
  } else {
    edges = edges.filter((edge) => !edge.dangling);
  }

  const outgoing = new Map<string, StoryGraphEdge[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.source);
    if (list) list.push(edge);
    else outgoing.set(edge.source, [edge]);

    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (source) source.outgoing += 1;
    if (target) target.incoming += 1;
  }

  // BFS layering: the start passage is column 0, each reference adds a column.
  const depthOf = new Map<string, number>();
  const walk = (seed: string, base: number): number => {
    depthOf.set(seed, base);
    let frontier = [seed];
    let level = base;
    while (frontier.length > 0) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const edge of outgoing.get(id) ?? []) {
          if (edge.selfLoop || depthOf.has(edge.target)) continue;
          depthOf.set(edge.target, level + 1);
          next.push(edge.target);
        }
      }
      if (next.length === 0) break;
      level += 1;
      frontier = next;
    }
    return level;
  };

  let maxDepth = -1;
  if (startExists) maxDepth = walk(startId, 0);
  const reachable = new Set(depthOf.keys());

  let base = startExists ? maxDepth + 1 : 0;
  for (const node of nodes) {
    if (depthOf.has(node.id)) continue;
    const componentMax = walk(node.id, base);
    base = componentMax + 2;
  }

  const depths = [...new Set(nodes.map((node) => depthOf.get(node.id) ?? 0))].sort(
    (a, b) => a - b,
  );
  const columnOf = new Map(depths.map((depth, index) => [depth, index]));

  const layers: StoryGraphNode[][] = [];
  for (const node of nodes) {
    node.depth = columnOf.get(depthOf.get(node.id) ?? 0) ?? 0;
    node.isUnreachable = startExists && !reachable.has(node.id);
    (layers[node.depth] ??= []).push(node);
  }
  layers.forEach((layer) => {
    layer.forEach((node, index) => {
      node.index = index;
    });
  });

  const referenced = new Set(edges.map((edge) => edge.target));
  for (const node of nodes) {
    node.isOrphan = !node.isDangling && !node.isStart && !referenced.has(node.id);
  }

  const stats: StoryGraphStats = {
    passageCount: nodes.filter((node) => !node.isDangling).length,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    linkCount,
    displayCount,
    danglingCount: edges.filter((edge) => edge.dangling).length,
    orphanCount: nodes.filter((node) => node.isOrphan).length,
    unreachableCount: nodes.filter((node) => node.isUnreachable).length,
    selfLoopCount: edges.filter((edge) => edge.selfLoop).length,
    duplicateCount,
    columnCount: layers.length,
    startMissing: !startExists,
  };

  return { nodes, edges, layers, nodeMap, stats };
}

/** A node with resolved pixel geometry. */
export interface LaidOutNode extends StoryGraphNode {
  /** Truncated label that fits inside the node. */
  label: string;
  /** Left edge in graph coordinates. */
  x: number;
  /** Top edge in graph coordinates. */
  y: number;
  /** Node width in pixels. */
  width: number;
  /** Node height in pixels. */
  height: number;
  /** Zero-based column index (equals {@link StoryGraphNode.depth}). */
  column: number;
  /** Zero-based row index inside the column. */
  row: number;
}

/** An edge with a resolved SVG path. */
export interface LaidOutEdge extends StoryGraphEdge {
  /** SVG `d` attribute. */
  path: string;
  /** X coordinate of the midpoint, for the multiplicity label. */
  labelX: number;
  /** Y coordinate of the midpoint, for the multiplicity label. */
  labelY: number;
}

/** The laid out graph, ready to be drawn into an SVG viewport. */
export interface StoryGraphLayout {
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
  /** Width of the drawing in graph coordinates. */
  width: number;
  /** Height of the drawing in graph coordinates. */
  height: number;
  /** Number of columns. */
  columnCount: number;
  /** Maximum number of nodes in a single column. */
  rowCount: number;
}

/** Metrics used by {@link layoutStoryGraph}. */
export interface StoryGraphLayoutOptions {
  /** Node width in pixels. Default `176`. */
  nodeWidth?: number;
  /** Node height in pixels. Default `44`. */
  nodeHeight?: number;
  /** Horizontal gap between columns. Default `92`. */
  columnGap?: number;
  /** Vertical gap between nodes of a column. Default `18`. */
  rowGap?: number;
  /** Padding around the drawing. Default `26`. */
  padding?: number;
}

/** @returns Whether a code point renders as a full-width glyph. */
function isWideChar(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6)
  );
}

/** Approximates the rendered width of a label at 13px. */
function measureLabel(text: string): number {
  let width = 0;
  for (const char of text) width += isWideChar(char) ? 13 : 7.1;
  return width;
}

/** Truncates a label with an ellipsis so it fits into `maxWidth` pixels. */
export function truncateLabel(text: string, maxWidth: number): string {
  if (measureLabel(text) <= maxWidth) return text;

  const budget = Math.max(0, maxWidth - 13);
  let out = "";
  let width = 0;
  for (const char of text) {
    const charWidth = isWideChar(char) ? 13 : 7.1;
    if (width + charWidth > budget) break;
    out += char;
    width += charWidth;
  }
  return `${out}…`;
}

/** @returns The point at `t` on a cubic bezier curve. */
function bezierPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number,
) {
  const inv = 1 - t;
  const a = inv * inv * inv;
  const b = 3 * inv * inv * t;
  const c = 3 * inv * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

/** Builds the SVG path and midpoint of a single edge. */
function buildEdgeGeometry(
  source: LaidOutNode,
  target: LaidOutNode,
  laneY: number,
) {
  // Self reference: a small loop on the right edge of the node.
  if (source === target) {
    const x = source.x + source.width;
    const startY = source.y + source.height * 0.3;
    const endY = source.y + source.height * 0.78;
    const bulge = x + 38;
    return {
      path: `M ${x} ${startY} C ${bulge} ${startY - 8}, ${bulge} ${endY + 8}, ${x} ${endY}`,
      labelX: bulge - 4,
      labelY: (startY + endY) / 2,
    };
  }

  const start = { x: source.x + source.width, y: source.y + source.height / 2 };
  const end = { x: target.x, y: target.y + target.height / 2 };

  // Forward edge: a plain S-curve between the two facing sides.
  if (target.x > source.x) {
    const offset = Math.max(36, (end.x - start.x) * 0.45);
    const p1 = { x: start.x + offset, y: start.y };
    const p2 = { x: end.x - offset, y: end.y };
    const mid = bezierPoint(start, p1, p2, end, 0.5);
    return {
      path: `M ${start.x} ${start.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${end.x} ${end.y}`,
      labelX: mid.x,
      labelY: mid.y - 6,
    };
  }

  // Backward (or same-column) edge: leave to the right, run along a lane
  // below the whole drawing, then return into the left edge of the target.
  const exit = start.x + 34;
  const entry = end.x - 40;
  return {
    path:
      `M ${start.x} ${start.y} ` +
      `C ${exit} ${start.y}, ${exit} ${laneY}, ${exit + 30} ${laneY} ` +
      `L ${entry - 30} ${laneY} ` +
      `C ${entry} ${laneY}, ${entry} ${end.y}, ${end.x} ${end.y}`,
    labelX: (start.x + end.x) / 2,
    labelY: laneY - 9,
  };
}

/**
 * Places a graph on a layered grid.
 *
 * Columns follow the BFS depth, nodes are vertically centred per column, and a
 * single barycenter pass reorders each column to reduce edge crossings.
 */
export function layoutStoryGraph(
  graph: StoryGraph,
  options: StoryGraphLayoutOptions = {},
): StoryGraphLayout {
  const nodeWidth = options.nodeWidth ?? 176;
  const nodeHeight = options.nodeHeight ?? 44;
  const columnGap = options.columnGap ?? 92;
  const rowGap = options.rowGap ?? 18;
  const padding = options.padding ?? 26;

  const layers = graph.layers.map((layer) => [...layer]);

  // Barycenter pass: sort each column by the average row of its sources.
  const incoming = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.selfLoop) continue;
    const list = incoming.get(edge.target);
    if (list) list.push(edge.source);
    else incoming.set(edge.target, [edge.source]);
  }

  for (let column = 1; column < layers.length; column += 1) {
    const previousRows = new Map(
      layers[column - 1].map((node, row) => [node.id, row]),
    );
    const scored = layers[column].map((node, row) => {
      const rows = (incoming.get(node.id) ?? [])
        .map((source) => previousRows.get(source))
        .filter((value): value is number => value !== undefined);
      const score =
        rows.length > 0
          ? rows.reduce((sum, value) => sum + value, 0) / rows.length
          : Number.POSITIVE_INFINITY;
      return { node, row, score };
    });
    scored.sort((a, b) => a.score - b.score || a.row - b.row);
    layers[column] = scored.map((entry) => entry.node);
  }

  const columnHeights = layers.map(
    (layer) => layer.length * nodeHeight + Math.max(0, layer.length - 1) * rowGap,
  );
  const maxColumnHeight = Math.max(0, ...columnHeights);

  // Backward edges share horizontal "lanes" below the drawing; this keeps them
  // out of the node area instead of cutting across it.
  const laneOf = new Map<string, number>();
  const depthOf = (id: string) => graph.nodeMap.get(id)?.depth ?? 0;
  let laneCount = 0;
  for (const edge of graph.edges) {
    if (edge.selfLoop) continue;
    if (depthOf(edge.target) <= depthOf(edge.source)) {
      laneOf.set(edge.id, laneCount);
      laneCount += 1;
    }
  }

  const hasSelfLoop = graph.edges.some((edge) => edge.selfLoop);
  const padLeft = padding + (laneCount > 0 ? 72 : 0);
  const padRight = padding + (hasSelfLoop ? 44 : 0);
  const padBottom = padding + (laneCount > 0 ? laneCount * 16 + 22 : 0);

  const nodes: LaidOutNode[] = [];
  const laidOutMap = new Map<string, LaidOutNode>();

  layers.forEach((layer, column) => {
    const offset = (maxColumnHeight - columnHeights[column]) / 2;
    layer.forEach((node, row) => {
      const laidOut: LaidOutNode = {
        ...node,
        label: truncateLabel(node.name, nodeWidth - 26),
        x: padLeft + column * (nodeWidth + columnGap),
        y: padding + offset + row * (nodeHeight + rowGap),
        width: nodeWidth,
        height: nodeHeight,
        column,
        row,
      };
      nodes.push(laidOut);
      laidOutMap.set(node.id, laidOut);
    });
  });

  const laneBase = padding + maxColumnHeight + 22;
  const edges: LaidOutEdge[] = [];
  for (const edge of graph.edges) {
    const source = laidOutMap.get(edge.source);
    const target = laidOutMap.get(edge.target);
    if (!source || !target) continue;
    const lane = laneOf.get(edge.id);
    const geometry = buildEdgeGeometry(
      source,
      target,
      laneBase + (lane ?? 0) * 16,
    );
    edges.push({ ...edge, ...geometry });
  }

  return {
    nodes,
    edges,
    width:
      padLeft +
      layers.length * nodeWidth +
      Math.max(0, layers.length - 1) * columnGap +
      padRight,
    height: padding + maxColumnHeight + padBottom,
    columnCount: layers.length,
    rowCount: layers.reduce((max, layer) => Math.max(max, layer.length), 0),
  };
}
