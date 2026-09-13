<template>
  <div
    class="card gap-0 overflow-hidden border border-base-300 bg-base-100/60"
    :style="{ height: cssHeight }"
  >
    <!-- 顶部：统计与视图控制 -->
    <div
      class="flex flex-none flex-wrap items-center gap-1 border-b border-base-300 bg-base-200/60 px-2 py-1.5"
    >
      <Icon icon="mdi:graph-outline" :size="15" class="text-base-content/60" />
      <span class="mr-1 text-xs font-semibold text-base-content/70">关系图</span>

      <span class="badge badge-xs badge-soft">{{ stats.passageCount }} 段落</span>
      <span class="badge badge-xs badge-soft">{{ stats.edgeCount }} 连接</span>

      <span
        v-if="stats.danglingCount > 0"
        class="badge badge-error badge-xs badge-soft"
        :title="`有 ${stats.danglingCount} 条链接指向不存在的段落`"
      >
        {{ stats.danglingCount }} 死链
      </span>
      <span
        v-if="stats.orphanCount > 0"
        class="badge badge-warning badge-xs badge-soft"
        :title="`有 ${stats.orphanCount} 个段落没有被任何链接引用`"
      >
        {{ stats.orphanCount }} 孤立
      </span>
      <span
        v-if="stats.unreachableCount > 0"
        class="badge badge-xs badge-soft"
        :title="`有 ${stats.unreachableCount} 个段落无法从起始段落到达`"
      >
        {{ stats.unreachableCount }} 不可达
      </span>
      <span
        v-if="stats.startMissing"
        class="badge badge-error badge-xs badge-soft"
        title="起始段落不存在"
      >
        起始段落缺失
      </span>

      <span class="grow"></span>

      <div class="join">
        <div class="tooltip tooltip-bottom" data-tip="缩小">
          <button
            class="btn btn-ghost btn-xs join-item"
            type="button"
            aria-label="缩小"
            @click="zoomBy(1 / 1.25)"
          >
            <Icon icon="mdi:magnify-minus-outline" :size="15" />
          </button>
        </div>
        <div class="tooltip tooltip-bottom" data-tip="放大">
          <button
            class="btn btn-ghost btn-xs join-item"
            type="button"
            aria-label="放大"
            @click="zoomBy(1.25)"
          >
            <Icon icon="mdi:magnify-plus-outline" :size="15" />
          </button>
        </div>
        <div class="tooltip tooltip-bottom" data-tip="适应画布">
          <button
            class="btn btn-ghost btn-xs join-item"
            type="button"
            aria-label="适应画布"
            @click="fit()"
          >
            <Icon icon="mdi:fit-to-screen-outline" :size="15" />
          </button>
        </div>
      </div>
    </div>

    <!-- 画布 -->
    <div
      ref="hostRef"
      class="sg-canvas relative grow touch-none overflow-hidden"
      :class="{ 'sg-canvas-interactive': interactive, 'sg-canvas-dragging': dragging }"
      @wheel.prevent="onWheel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerleave="onPointerLeave"
    >
      <svg
        v-if="layout.nodes.length > 0"
        class="absolute inset-0 h-full w-full select-none"
      >
        <defs>
          <marker
            :id="`${uid}-arrow-link`"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" class="sg-arrow sg-arrow-link" />
          </marker>
          <marker
            :id="`${uid}-arrow-display`"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" class="sg-arrow sg-arrow-display" />
          </marker>
          <marker
            :id="`${uid}-arrow-dangling`"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" class="sg-arrow sg-arrow-dangling" />
          </marker>
          <marker
            :id="`${uid}-arrow-active`"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" class="sg-arrow sg-arrow-active" />
          </marker>
        </defs>

        <g :transform="transform">
          <!-- 边 -->
          <template v-for="edge in layout.edges" :key="edge.id">
            <path
              class="sg-edge"
              :class="edgeClass(edge)"
              :d="edge.path"
              :marker-end="markerFor(edge)"
            />
          </template>

          <!-- 多重连接的次数标签 -->
          <g
            v-for="edge in multiEdges"
            :key="`${edge.id}-count`"
            class="sg-edge-count"
          >
            <rect
              :x="edge.labelX - 9"
              :y="edge.labelY - 8"
              width="18"
              height="16"
              rx="8"
              ry="8"
            />
            <text
              :x="edge.labelX"
              :y="edge.labelY"
              text-anchor="middle"
              dominant-baseline="central"
            >
              {{ edge.count }}
            </text>
          </g>

          <!-- 节点 -->
          <g
            v-for="node in layout.nodes"
            :key="node.id"
            class="sg-node"
            :class="nodeClass(node)"
            :transform="`translate(${node.x} ${node.y})`"
            role="button"
            tabindex="0"
            :aria-label="nodeTooltip(node)"
            @click="onNodeClick(node)"
            @keydown.enter.prevent="onNodeClick(node)"
            @keydown.space.prevent="onNodeClick(node)"
            @pointerenter="hoveredId = node.id"
            @pointerleave="hoveredId = ''"
            @focus="hoveredId = node.id"
            @blur="hoveredId = ''"
          >
            <title>{{ nodeTooltip(node) }}</title>
            <rect
              class="sg-node-rect"
              :width="node.width"
              :height="node.height"
              rx="10"
              ry="10"
            />
            <circle
              v-if="node.isStart"
              class="sg-node-dot"
              cx="13"
              cy="13"
              r="3.2"
            />
            <text
              class="sg-node-label"
              :x="node.width / 2"
              :y="node.height / 2"
              text-anchor="middle"
              dominant-baseline="central"
            >
              {{ node.label }}
            </text>
          </g>
        </g>
      </svg>

      <!-- 空状态 -->
      <div
        v-if="layout.nodes.length === 0"
        class="absolute inset-0 grid place-items-center px-4 text-center text-xs text-base-content/50"
      >
        还没有可绘制的段落
      </div>

      <!-- 图例 -->
      <div
        v-if="showLegend && layout.nodes.length > 0"
        class="absolute bottom-2 left-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-box border border-base-300 bg-base-100/85 px-2 py-1 text-[10px] text-base-content/60 backdrop-blur"
      >
        <span class="flex items-center gap-1">
          <span class="sg-legend-line sg-legend-link"></span>跳转
        </span>
        <span v-if="showDisplayEdges" class="flex items-center gap-1">
          <span class="sg-legend-line sg-legend-display"></span>包含
        </span>
        <span class="flex items-center gap-1">
          <span class="sg-legend-box sg-legend-start"></span>起始
        </span>
        <span v-if="stats.orphanCount > 0" class="flex items-center gap-1">
          <span class="sg-legend-box sg-legend-orphan"></span>孤立
        </span>
        <span v-if="stats.danglingCount > 0" class="flex items-center gap-1">
          <span class="sg-legend-box sg-legend-dangling"></span>死链
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Icon from "@/components/Icon/src/Icon.vue";
import type { StoryData } from "@/lib/storyEngine";
import {
  buildStoryGraph,
  layoutStoryGraph,
  type LaidOutEdge,
  type LaidOutNode,
} from "@/lib/storyGraph";

let uidSeq = 0;

const props = withDefaults(
  defineProps<{
    /** 要绘制的故事数据。 */
    story?: StoryData | null;
    /** 当前所在段落，会以强调色高亮。 */
    activePassage?: string;
    /** 是否把指向不存在段落的引用画成幽灵节点。 */
    showMissing?: boolean;
    /** 是否绘制 `(display:)` 包含关系。 */
    showDisplayEdges?: boolean;
    /** 是否显示左下角图例。 */
    showLegend?: boolean;
    /** 画布高度，数字按像素处理。 */
    height?: string | number;
    /** 是否允许缩放与拖拽。 */
    interactive?: boolean;
  }>(),
  {
    story: null,
    activePassage: "",
    showMissing: true,
    showDisplayEdges: true,
    showLegend: true,
    height: "28rem",
    interactive: true,
  },
);

const emit = defineEmits<{
  (e: "select-passage", name: string): void;
}>();

const uid = `story-graph-${(uidSeq += 1)}`;

const cssHeight = computed(() =>
  typeof props.height === "number" ? `${props.height}px` : props.height,
);

const graph = computed(() =>
  buildStoryGraph(props.story, {
    includeDangling: props.showMissing,
    includeDisplayEdges: props.showDisplayEdges,
  }),
);
const layout = computed(() => layoutStoryGraph(graph.value));
const stats = computed(() => graph.value.stats);
const multiEdges = computed(() =>
  layout.value.edges.filter((edge) => edge.count > 1),
);

// ---- 视口（平移 / 缩放） ----------------------------------------------

const hostRef = ref<HTMLElement | null>(null);
const hostWidth = ref(0);
const hostHeight = ref(0);
let resizeObserver: ResizeObserver | null = null;

/** 记录画布尺寸，用于缩放/居中计算。 */
function measure() {
  const element = hostRef.value;
  if (!element) return;
  hostWidth.value = element.clientWidth;
  hostHeight.value = element.clientHeight;
}

const scale = ref(1);
const pan = ref({ x: 0, y: 0 });
const dragging = ref(false);
const hoveredId = ref("");
const suppressClick = ref(false);

const transform = computed(
  () => `translate(${pan.value.x} ${pan.value.y}) scale(${scale.value})`,
);

const MIN_SCALE = 0.15;
const MAX_SCALE = 3;

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

function zoomAt(factor: number, originX: number, originY: number) {
  const next = clampScale(scale.value * factor);
  const ratio = next / scale.value;
  pan.value = {
    x: originX - (originX - pan.value.x) * ratio,
    y: originY - (originY - pan.value.y) * ratio,
  };
  scale.value = next;
}

function zoomBy(factor: number) {
  zoomAt(factor, hostWidth.value / 2, hostHeight.value / 2);
}

/** 缩放到刚好容纳整张图并居中。 */
function fit() {
  const width = hostWidth.value;
  const height = hostHeight.value;
  const drawing = layout.value;
  if (!width || !height || drawing.width <= 0 || drawing.height <= 0) return;

  const next = clampScale(
    Math.min((width - 16) / drawing.width, (height - 16) / drawing.height, 1.2),
  );
  scale.value = next;
  pan.value = {
    x: (width - drawing.width * next) / 2,
    y: (height - drawing.height * next) / 2,
  };
}

watch([() => layout.value, hostWidth, hostHeight], () => fit(), {
  flush: "post",
});

// ---- 指针交互 ----------------------------------------------------------

let dragState: { x: number; y: number; moved: boolean } | null = null;

function onWheel(event: WheelEvent) {
  if (!props.interactive) return;
  const rect = hostRef.value?.getBoundingClientRect();
  if (!rect) return;
  zoomAt(
    Math.exp(-event.deltaY * 0.0012),
    event.clientX - rect.left,
    event.clientY - rect.top,
  );
}

function onPointerDown(event: PointerEvent) {
  if (!props.interactive || event.button !== 0) return;
  const target = event.target as Element | null;
  if (target?.closest?.(".sg-node")) return;

  suppressClick.value = false;
  dragState = { x: event.clientX, y: event.clientY, moved: false };
  dragging.value = true;
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
}

function onPointerMove(event: PointerEvent) {
  if (!dragState) return;
  const dx = event.clientX - dragState.x;
  const dy = event.clientY - dragState.y;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragState.moved = true;
  pan.value = { x: pan.value.x + dx, y: pan.value.y + dy };
  dragState.x = event.clientX;
  dragState.y = event.clientY;
}

function onPointerUp(event: PointerEvent) {
  if (!dragState) return;
  suppressClick.value = dragState.moved;
  dragState = null;
  dragging.value = false;
  (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
}

function onPointerLeave() {
  // 拖拽中由 pointer capture 继续接管，避免中途丢失拖拽状态
  if (dragging.value) return;
  dragState = null;
}

function onNodeClick(node: LaidOutNode) {
  if (suppressClick.value) {
    suppressClick.value = false;
    return;
  }
  emit("select-passage", node.name);
}

// ---- 渲染辅助 ----------------------------------------------------------

const activeId = computed(
  () => hoveredId.value || props.activePassage || "",
);

function isEdgeActive(edge: LaidOutEdge): boolean {
  const active = activeId.value;
  return !!active && (edge.source === active || edge.target === active);
}

function edgeClass(edge: LaidOutEdge) {
  const active = isEdgeActive(edge);
  return [
    `sg-edge-${edge.kind}`,
    {
      "sg-edge-dangling": edge.dangling,
      "sg-edge-active": active,
      "sg-edge-dim": !!activeId.value && !active,
    },
  ];
}

function markerFor(edge: LaidOutEdge): string {
  if (isEdgeActive(edge)) return `url(#${uid}-arrow-active)`;
  if (edge.dangling) return `url(#${uid}-arrow-dangling)`;
  if (edge.kind === "display") return `url(#${uid}-arrow-display)`;
  return `url(#${uid}-arrow-link)`;
}

function nodeClass(node: LaidOutNode) {
  return {
    "sg-node-start": node.isStart,
    "sg-node-active": node.id === props.activePassage,
    "sg-node-hovered": node.id === hoveredId.value,
    "sg-node-dangling": node.isDangling,
    "sg-node-orphan": node.isOrphan,
    "sg-node-unreachable": node.isUnreachable,
  };
}

function nodeTooltip(node: LaidOutNode): string {
  const lines = [node.name];
  if (node.isStart) lines.push("起始段落");
  if (node.isDangling) lines.push("引用了不存在的段落");
  if (node.isOrphan) lines.push("没有被任何段落引用");
  if (node.isUnreachable) lines.push("无法从起始段落到达");
  if (node.tags.length > 0) lines.push(`标签：${node.tags.join("、")}`);
  lines.push(`入 ${node.incoming} / 出 ${node.outgoing}`);
  return lines.join("\n");
}

onMounted(() => {
  measure();
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(measure);
    if (hostRef.value) resizeObserver.observe(hostRef.value);
  }
  window.addEventListener("resize", measure);
  fit();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  window.removeEventListener("resize", measure);
  dragState = null;
});
</script>

<style scoped>
.sg-canvas {
  background-color: var(--color-base-100);
  background-image: radial-gradient(
    color-mix(in oklab, var(--color-base-content) 14%, transparent) 1px,
    transparent 1px
  );
  background-size: 18px 18px;
}

.sg-canvas-interactive {
  cursor: grab;
}

.sg-canvas-dragging {
  cursor: grabbing;
}

/* 边 */
.sg-edge {
  fill: none;
  stroke: color-mix(in oklab, var(--color-base-content) 45%, transparent);
  stroke-width: 1.6;
  transition:
    stroke-width 0.15s ease,
    stroke 0.15s ease,
    opacity 0.15s ease;
}

.sg-edge-display {
  stroke: color-mix(in oklab, var(--color-accent) 80%, var(--color-base-content));
  stroke-width: 1.4;
  stroke-dasharray: 5 4;
}

.sg-edge-dangling {
  stroke: var(--color-error);
  stroke-dasharray: 3 3;
}

.sg-edge-active {
  stroke: var(--color-primary);
  stroke-width: 2.6;
  opacity: 1;
}

.sg-edge-dim {
  opacity: 0.16;
}

.sg-arrow {
  fill: color-mix(in oklab, var(--color-base-content) 55%, transparent);
}

.sg-arrow-display {
  fill: color-mix(in oklab, var(--color-accent) 85%, var(--color-base-content));
}

.sg-arrow-dangling {
  fill: var(--color-error);
}

.sg-arrow-active {
  fill: var(--color-primary);
}

/* 多重连接计数 */
.sg-edge-count rect {
  fill: var(--color-base-100);
  stroke: var(--color-base-300);
}

.sg-edge-count text {
  fill: var(--color-base-content);
  font-size: 10px;
  font-weight: 600;
}

/* 节点 */
.sg-node {
  cursor: pointer;
  outline: none;
}

.sg-node-rect {
  fill: var(--color-base-100);
  stroke: var(--color-base-300);
  stroke-width: 1.5;
  transition:
    fill 0.15s ease,
    stroke 0.15s ease;
}

.sg-node-label {
  fill: var(--color-base-content);
  font-size: 13px;
  font-weight: 600;
  pointer-events: none;
}

.sg-node-dot {
  fill: var(--color-primary);
}

.sg-node-start .sg-node-rect {
  stroke: var(--color-primary);
  stroke-width: 2;
  fill: color-mix(in oklab, var(--color-primary) 10%, var(--color-base-100));
}

.sg-node-orphan .sg-node-rect {
  stroke: var(--color-warning);
  stroke-dasharray: 6 3;
}

.sg-node-unreachable {
  opacity: 0.55;
}

.sg-node-dangling .sg-node-rect {
  stroke: var(--color-error);
  stroke-dasharray: 5 4;
  fill: color-mix(in oklab, var(--color-error) 12%, var(--color-base-100));
}

.sg-node-dangling .sg-node-label {
  fill: var(--color-error);
}

.sg-node-hovered .sg-node-rect {
  stroke: var(--color-primary);
}

.sg-node-active .sg-node-rect {
  fill: var(--color-primary);
  stroke: var(--color-primary);
}

.sg-node-active .sg-node-label {
  fill: var(--color-primary-content);
}

.sg-node-active .sg-node-dot {
  fill: var(--color-primary-content);
}

.sg-node:focus-visible .sg-node-rect {
  stroke: var(--color-secondary);
  stroke-width: 2.5;
}

/* 图例 */
.sg-legend-line {
  display: inline-block;
  width: 14px;
  border-top-width: 2px;
}

.sg-legend-link {
  border-top-style: solid;
  border-color: color-mix(in oklab, var(--color-base-content) 45%, transparent);
}

.sg-legend-display {
  border-top-style: dashed;
  border-color: color-mix(in oklab, var(--color-accent) 80%, var(--color-base-content));
}

.sg-legend-box {
  display: inline-block;
  width: 12px;
  height: 9px;
  border-radius: 3px;
  border: 1.5px solid var(--color-base-300);
  background: var(--color-base-100);
}

.sg-legend-start {
  border-color: var(--color-primary);
  background: color-mix(in oklab, var(--color-primary) 10%, var(--color-base-100));
}

.sg-legend-orphan {
  border-color: var(--color-warning);
  border-style: dashed;
}

.sg-legend-dangling {
  border-color: var(--color-error);
  border-style: dashed;
  background: color-mix(in oklab, var(--color-error) 12%, var(--color-base-100));
}
</style>
