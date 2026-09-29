<template>
  <div
    ref="containerRef"
    class="relative flex flex-col w-full overflow-hidden select-none bg-base-100 text-base-content border border-base-200/80 rounded-2xl shadow-sm"
    :class="{ 'fixed inset-0 z-50 rounded-none border-none': isFullscreen }"
    :style="{ height: isFullscreen ? '100vh' : cssHeight }"
  >
    <!-- 顶栏：标题、状态徽章与操作 -->
    <div
      class="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b border-base-200 bg-base-100/90 backdrop-blur z-10 shrink-0"
    >
      <div class="flex items-center gap-2 min-w-0">
        <div class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon icon="mdi:map-marker-path" class="w-5 h-5" />
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-1.5 flex-wrap">
            <h3 class="font-bold text-sm sm:text-base text-base-content truncate">
              {{ story?.title || "探索动线" }}
            </h3>
            <!-- 成就与结局达成状态徽章 -->
            <span
              v-if="hasCompletedAll"
              class="badge badge-warning badge-soft badge-xs gap-1 font-medium"
              title="已获得故事的所有成就与结局，未探索场景位置已解锁"
            >
              <Icon icon="mdi:trophy" class="w-3 h-3 text-warning" />
              全达成·彩蛋已解锁
            </span>
            <span
              v-else
              class="badge badge-soft badge-xs gap-1"
              :title="`探索模式：仅展示已走过的场景 (成就 ${userPointsCount}/${pointSize || 0}，结局 ${userEndingsCount}/${endSize || 0})`"
            >
              <Icon icon="mdi:compass-outline" class="w-3 h-3" />
              探索模式 ({{ userPointsCount }}/{{ pointSize || 0 }} 成就 · {{ userEndingsCount }}/{{ endSize || 0 }} 结局)
            </span>
          </div>
          <p class="text-[11px] text-base-content/50 truncate">
            {{ hasCompletedAll ? "未探索场景以 ???? 标识其场景树位置" : "达成全部成就与结局后，可解锁查看未探索场景位置" }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-1 sm:gap-2 shrink-0">
        <!-- 画布缩放工具组 -->
        <div class="join bg-base-200/60 rounded-lg p-0.5">
          <button
            class="btn btn-ghost btn-xs join-item"
            type="button"
            title="缩小"
            @click="zoomBy(1 / 1.25)"
          >
            <Icon icon="mdi:magnify-minus-outline" class="w-4 h-4" />
          </button>
          <button
            class="btn btn-ghost btn-xs join-item"
            type="button"
            title="放大"
            @click="zoomBy(1.25)"
          >
            <Icon icon="mdi:magnify-plus-outline" class="w-4 h-4" />
          </button>
          <button
            class="btn btn-ghost btn-xs join-item"
            type="button"
            title="适应画布"
            @click="fit()"
          >
            <Icon icon="mdi:fit-to-screen-outline" class="w-4 h-4" />
          </button>
        </div>

        <!-- 全屏切换 -->
        <button
          type="button"
          class="btn btn-ghost btn-xs sm:btn-sm btn-circle"
          :title="isFullscreen ? '退出全屏' : '全屏显示'"
          @click="toggleFullscreen"
        >
          <Icon :icon="isFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'" class="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        <!-- 关闭按钮（仅在全屏或有关闭监听时） -->
        <button
          v-if="isFullscreen || showCloseButton"
          type="button"
          class="btn btn-ghost btn-xs sm:btn-sm btn-circle"
          title="关闭"
          @click="handleClose"
        >
          <Icon icon="mdi:close" class="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>
    </div>

    <!-- 主画布区域 -->
    <div
      ref="hostRef"
      class="relative grow touch-none overflow-hidden bg-base-200/20 cursor-grab active:cursor-grabbing"
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
          <!-- 箭头定义 -->
          <marker
            :id="`${uid}-arrow-normal`"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" class="fill-base-content/30" />
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
            <path d="M0,0 L10,5 L0,10 z" class="fill-primary" />
          </marker>
          <marker
            :id="`${uid}-arrow-back`"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" class="fill-warning" />
          </marker>
        </defs>

        <g :transform="transform">
          <!-- 边 (Edges) -->
          <g
            v-for="edge in layout.edges"
            :key="edge.id"
            class="sg-edge-group cursor-pointer"
            :class="{ 'sg-edge-selected': selectedEdgeId === edge.id }"
            @click.stop="toggleEdgeSelection(edge)"
          >
            <!-- 扩大点击热区的透明粗线（方便鼠标与触屏点击） -->
            <path
              fill="none"
              stroke="transparent"
              stroke-width="24"
              stroke-linecap="round"
              :d="edge.path"
              class="cursor-pointer"
            />

            <!-- 实际可见的连线 -->
            <path
              fill="none"
              class="sg-edge fill-none transition-all duration-300 pointer-events-none"
              :class="getEdgeClass(edge)"
              :d="edge.path"
              :marker-end="getEdgeMarker(edge)"
            />

            <!-- 选中点亮后：在连接线上显示所作的操作 -->
            <g
              v-if="selectedEdgeId === edge.id"
              class="sg-edge-badge select-none pointer-events-none transition-all duration-300"
              :transform="`translate(${edge.labelX}, ${edge.labelY})`"
            >
              <!-- 胶囊光晕外框 -->
              <rect
                :x="-getBadgeWidth(edge) / 2 - 3"
                :y="-15"
                :width="getBadgeWidth(edge) + 6"
                :height="30"
                rx="15"
                ry="15"
                class="animate-pulse"
                :class="getBadgeHaloClass(edge)"
              />
              <!-- 胶囊主体 -->
              <rect
                :x="-getBadgeWidth(edge) / 2"
                :y="-13"
                :width="getBadgeWidth(edge)"
                :height="26"
                rx="13"
                ry="13"
                :class="getBadgeRectClass(edge)"
              />
              <!-- 操作说明文字 -->
              <text
                x="0"
                y="0"
                text-anchor="middle"
                dominant-baseline="central"
                class="text-[11px] font-bold"
                :class="getBadgeTextClass(edge)"
              >
                {{ getEdgeOperationInfo(edge).text }}
              </text>
            </g>
          </g>

          <!-- 节点 (Nodes) -->
          <g
            v-for="node in layout.nodes"
            :key="node.id"
            class="transition-all duration-300"
            :class="getNodeClass(node)"
            :transform="`translate(${node.x} ${node.y})`"
            role="button"
            tabindex="0"
            @click.stop="onNodeClick(node)"
          >
            <!-- 选中连接线点亮场景的高亮外框/光晕动画 -->
            <rect
              v-if="isNodeConnectedToSelectedEdge(node.id)"
              class="animate-pulse fill-primary/15 stroke-primary"
              :x="-4"
              :y="-4"
              :width="node.width + 8"
              :height="node.height + 8"
              rx="16"
              ry="16"
              stroke-width="2.5"
            />

            <!-- 节点矩形底框 -->
            <rect
              class="transition-colors duration-200"
              :class="getNodeRectClass(node)"
              :width="node.width"
              :height="node.height"
              rx="12"
              ry="12"
            />

            <!-- 起始节点圆点 -->
            <circle
              v-if="node.isStart"
              class="fill-primary"
              cx="13"
              cy="13"
              r="3.5"
            />

            <!-- 选中连接线时标识来源与走向的指示角标 -->
            <g
              v-if="selectedEdge && selectedEdge.source === node.id"
              :transform="`translate(6, -9)`"
              class="select-none pointer-events-none"
            >
              <rect
                width="36"
                height="17"
                rx="8.5"
                class="fill-info stroke-base-100"
                stroke-width="1.5"
              />
              <text
                x="18"
                y="9.5"
                text-anchor="middle"
                dominant-baseline="central"
                class="fill-info-content text-[9px] font-bold"
              >
                来源
              </text>
            </g>
            <g
              v-else-if="selectedEdge && selectedEdge.target === node.id"
              :transform="`translate(6, -9)`"
              class="select-none pointer-events-none"
            >
              <rect
                width="36"
                height="17"
                rx="8.5"
                class="fill-primary stroke-base-100"
                stroke-width="1.5"
              />
              <text
                x="18"
                y="9.5"
                text-anchor="middle"
                dominant-baseline="central"
                class="fill-primary-content text-[9px] font-bold"
              >
                目标
              </text>
            </g>

            <!-- 当前位置闪烁外环 -->
            <rect
              v-if="isCurrentPassage(node.id)"
              class="animate-ping opacity-40 fill-none stroke-primary"
              :width="node.width"
              :height="node.height"
              rx="12"
              ry="12"
              stroke-width="3"
            />

            <!-- 节点文本 -->
            <text
              class="font-semibold text-xs transition-colors pointer-events-none select-none"
              :class="getNodeTextClass(node)"
              :x="node.width / 2"
              :y="node.height / 2"
              text-anchor="middle"
              dominant-baseline="central"
            >
              {{ getNodeLabel(node) }}
            </text>

            <!-- 当前位置角标 -->
            <g
              v-if="isCurrentPassage(node.id)"
              :transform="`translate(${node.width - 24}, -8)`"
            >
              <rect
                width="32"
                height="16"
                rx="8"
                class="fill-primary"
              />
              <text
                x="16"
                y="9"
                text-anchor="middle"
                dominant-baseline="central"
                class="fill-primary-content text-[9px] font-bold"
              >
                当前
              </text>
            </g>

            <!-- 掩码未知场景小锁或问号角标 -->
            <g
              v-else-if="isNodeMasked(node.id)"
              :transform="`translate(${node.width - 18}, 4)`"
            >
              <circle cx="8" cy="8" r="7" class="fill-base-content/10" />
              <text
                x="8"
                y="9"
                text-anchor="middle"
                dominant-baseline="central"
                class="fill-base-content/40 text-[9px] font-bold"
              >?</text>
            </g>
          </g>
        </g>
      </svg>

      <!-- 空状态 -->
      <div
        v-if="layout.nodes.length === 0"
        class="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-base-content/50"
      >
        <Icon icon="mdi:map-marker-question-outline" class="w-12 h-12 mb-2 text-base-content/30" />
        <p class="text-sm font-medium">暂无可绘制的探索场景</p>
        <p class="text-xs text-base-content/40 mt-1">开始游玩后将自动在此记录您的探索路线</p>
      </div>

      <!-- 左下角图例 -->
      <div
        v-if="layout.nodes.length > 0"
        class="absolute bottom-20 sm:bottom-22 left-3 sm:left-4 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-base-200 bg-base-100/90 px-2.5 py-1.5 text-[10px] text-base-content/60 backdrop-blur shadow-sm pointer-events-none"
      >
        <span class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-primary/30"></span>当前位置
        </span>
        <span class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded border border-primary bg-primary/10"></span>已到达场景
        </span>
        <span v-if="hasCompletedAll" class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded border border-dashed border-base-content/40 bg-base-200/40"></span>未探索 (????)
        </span>
        <span v-if="rollbackCount > 0" class="flex items-center gap-1.5 text-warning font-medium">
          <span class="w-2.5 h-0.5 bg-warning"></span>撤回回退
        </span>
      </div>

      <!-- 选中连接线时的悬浮提示横幅 -->
      <div
        v-if="selectedEdge"
        class="absolute top-3 left-3 sm:left-4 z-20 flex items-center gap-2 bg-base-100/95 border border-primary/50 shadow-xl px-3.5 py-1.5 rounded-full text-xs backdrop-blur transition-all duration-200"
      >
        <span
          class="w-2.5 h-2.5 rounded-full animate-ping shrink-0"
          :class="getEdgeOperationInfo(selectedEdge).isBack ? 'bg-warning' : 'bg-primary'"
        ></span>
        <div class="flex items-center gap-1.5 font-mono text-base-content/80 text-[11px] truncate">
          <span class="font-bold text-info">{{ selectedEdge.source }}</span>
          <Icon
            :icon="getEdgeOperationInfo(selectedEdge).isBack ? 'mdi:arrow-left' : 'mdi:arrow-right'"
            class="w-3.5 h-3.5 shrink-0"
            :class="getEdgeOperationInfo(selectedEdge).isBack ? 'text-warning' : 'text-primary'"
          />
          <span class="font-bold text-primary">{{ selectedEdge.target }}</span>
        </div>
        <span class="text-base-content/30">|</span>
        <span
          class="font-semibold text-xs"
          :class="getEdgeOperationInfo(selectedEdge).isBack ? 'text-warning' : 'text-primary'"
        >
          操作：{{ getEdgeOperationInfo(selectedEdge).text }}
        </span>
        <span v-if="getEdgeOperationInfo(selectedEdge).detail" class="text-[10px] text-base-content/50 hidden md:inline">
          ({{ getEdgeOperationInfo(selectedEdge).detail }})
        </span>
        <button
          type="button"
          class="btn btn-ghost btn-xs btn-circle ml-0.5 h-5 w-5 min-h-0 text-base-content/60 hover:text-base-content"
          title="取消点亮"
          @click="selectedEdgeId = null"
        >✕</button>
      </div>

      <!-- 右上角当前步骤浮动详情卡片 -->
      <div
        v-if="activeStep"
        class="absolute top-3 right-3 sm:right-4 z-10 max-w-[280px] sm:max-w-xs rounded-xl border border-base-200 bg-base-100/95 p-2.5 sm:p-3 shadow-md backdrop-blur text-xs space-y-1.5 transition-all duration-200"
      >
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 font-bold">
            <span
              class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0"
              :class="
                activeStep.type === 'back' || activeStep.action === 'back'
                  ? 'bg-warning text-warning-content font-bold'
                  : 'bg-primary text-primary-content'
              "
            >
              {{ currentStepIndex + 1 }}
            </span>
            <span class="text-xs">第 {{ currentStepIndex + 1 }} / {{ validTrace.length }} 步</span>
          </div>
          <span
            v-if="activeStep.type === 'back' || activeStep.action === 'back'"
            class="badge badge-warning badge-xs badge-soft gap-1"
          >
            <Icon icon="mdi:undo-variant" class="w-3 h-3" />
            撤回回退
          </span>
          <span
            v-else-if="activeStep.type === 'start' || activeStep.action === 'start'"
            class="badge badge-info badge-xs badge-soft"
          >
            起点
          </span>
          <span v-else class="badge badge-primary badge-xs badge-soft">
            前进探索
          </span>
        </div>

        <div class="flex items-center gap-1.5 font-mono text-[11px] text-base-content/80 flex-wrap">
          <span v-if="activeStep.from" class="truncate max-w-28">{{ activeStep.from }}</span>
          <Icon
            :icon="activeStep.type === 'back' || activeStep.action === 'back' ? 'mdi:arrow-left' : 'mdi:arrow-right'"
            class="w-3.5 h-3.5 shrink-0"
            :class="activeStep.type === 'back' || activeStep.action === 'back' ? 'text-warning' : 'text-primary'"
          />
          <span class="font-bold truncate max-w-32" :class="activeStep.type === 'back' || activeStep.action === 'back' ? 'text-warning' : 'text-primary'">
            {{ activeStep.to }}
          </span>
        </div>

        <div
          v-if="activeStep.action && activeStep.action !== 'start' && activeStep.action !== 'back'"
          class="text-[11px] text-base-content/70 truncate bg-base-200/50 px-2 py-0.5 rounded"
        >
          交互：{{ activeStep.action }}
        </div>

        <div class="flex items-center justify-between text-[10px] text-base-content/40 pt-0.5">
          <span>{{ formatTime(activeStep.at) }}</span>
          <span v-if="currentStepIndex === validTrace.length - 1" class="text-primary font-medium">最新探索点</span>
        </div>
      </div>
    </div>

    <!-- 底部浮动播放与控制栏 -->
    <div
      v-if="validTrace.length > 0"
      class="absolute bottom-3 inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-20 max-w-xl w-full"
    >
      <div
        class="bg-base-100/95 border border-base-200/90 rounded-2xl shadow-xl backdrop-blur p-2 sm:p-2.5 space-y-2"
      >
        <!-- 进度拖动条与步数显示 -->
        <div class="flex items-center gap-3 px-1">
          <span class="text-[11px] font-mono text-base-content/60 shrink-0">
            第 <strong class="text-base-content">{{ currentStepIndex + 1 }}</strong> / {{ validTrace.length }} 步
          </span>
          <input
            v-model.number="currentStepIndex"
            type="range"
            :min="0"
            :max="validTrace.length - 1"
            class="range range-xs range-primary flex-1"
            @input="onScrub"
          />
          <div class="dropdown dropdown-top dropdown-end shrink-0">
            <button
              tabindex="0"
              type="button"
              class="btn btn-ghost btn-xs font-mono text-[10px] px-1.5 h-6 min-h-0"
            >
              {{ playSpeed }}x
            </button>
            <ul tabindex="0" class="dropdown-content menu p-1 shadow-lg bg-base-100 rounded-box w-20 text-xs z-30">
              <li v-for="speed in [1, 1.5, 2]" :key="speed">
                <a
                  :class="{ 'active': playSpeed === speed }"
                  @click="playSpeed = speed"
                >{{ speed }}x</a>
              </li>
            </ul>
          </div>
        </div>

        <!-- 播放控制按键组 -->
        <div class="flex items-center justify-between gap-1 pt-0.5">
          <div class="flex items-center gap-1">
            <button
              type="button"
              class="btn btn-ghost btn-xs btn-circle"
              title="从头重新播放"
              @click="restartPlay"
            >
              <Icon icon="mdi:replay" class="w-4 h-4" />
            </button>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              class="btn btn-ghost btn-sm btn-circle"
              :disabled="currentStepIndex <= 0"
              title="上一步"
              @click="prevStep"
            >
              <Icon icon="mdi:step-backward" class="w-5 h-5" />
            </button>

            <button
              type="button"
              class="btn btn-primary btn-sm btn-circle shadow-md"
              :title="isPlaying ? '暂停' : '播放动线'"
              @click="togglePlay"
            >
              <Icon :icon="isPlaying ? 'mdi:pause' : 'mdi:play'" class="w-5 h-5" />
            </button>

            <button
              type="button"
              class="btn btn-ghost btn-sm btn-circle"
              :disabled="currentStepIndex >= validTrace.length - 1"
              title="下一步"
              @click="nextStep"
            >
              <Icon icon="mdi:step-forward" class="w-5 h-5" />
            </button>
          </div>

          <div class="flex items-center gap-1">
            <button
              type="button"
              class="btn btn-ghost btn-xs text-[11px] gap-1 px-2"
              @click="jumpToEnd"
            >
              最新
              <Icon icon="mdi:skip-forward" class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Icon } from "@iconify/vue";
import type { StoryData } from "@/lib/storyEngine";
import {
  buildStoryGraph,
  layoutStoryGraph,
  type LaidOutEdge,
  type LaidOutNode,
} from "@/lib/storyGraph";
import type { IPlayTrace } from "@/api/play";

let uidSeq = 0;

const props = withDefaults(
  defineProps<{
    /** 要绘制的故事数据 (包含 passages, title, startPassage) */
    story?: StoryData | null;
    /** 探索动线列表 */
    trace?: IPlayTrace[];
    /** 用户已解锁成就列表 */
    userPoints?: Array<{ name: string; description?: string }>;
    /** 用户已解锁结局列表 */
    userEndings?: Array<{ name: string; description?: string }>;
    /** 故事总成就数 */
    pointSize?: number | null;
    /** 故事总结局数 */
    endSize?: number | null;
    /** 是否已抵达结局 */
    isEnding?: boolean;
    /** 画布高度，如 '100%', '70vh' 等 */
    height?: string | number;
    /** 是否展示右上角关闭按钮 */
    showCloseButton?: boolean;
  }>(),
  {
    story: null,
    trace: () => [],
    userPoints: () => [],
    userEndings: () => [],
    pointSize: 0,
    endSize: 0,
    isEnding: false,
    height: "100%",
    showCloseButton: false,
  },
);

const emit = defineEmits<{
  (e: "close"): void;
  (e: "select-passage", passageName: string): void;
}>();

const uid = `trace-graph-${(uidSeq += 1)}`;
const containerRef = ref<HTMLElement | null>(null);
const hostRef = ref<HTMLElement | null>(null);
const isFullscreen = ref(false);

const cssHeight = computed(() =>
  typeof props.height === "number" ? `${props.height}px` : props.height,
);

// 统计成就与结局是否已全部获得
const userPointsCount = computed(() => props.userPoints?.length || 0);
const userEndingsCount = computed(() => props.userEndings?.length || 0);

const hasCompletedAll = computed(() => {
  const pts = props.pointSize ?? 0;
  const ends = props.endSize ?? 0;
  const uPts = userPointsCount.value;
  const uEnds = userEndingsCount.value;

  if (pts > 0 || ends > 0) {
    const ptsOk = pts === 0 || uPts >= pts;
    const endsOk = ends === 0 || uEnds >= ends;
    return ptsOk && endsOk;
  }
  return props.isEnding ?? false;
});

// 提取当前有效的 trace
const validTrace = computed<IPlayTrace[]>(() => {
  if (Array.isArray(props.trace) && props.trace.length > 0) {
    return props.trace;
  }
  return [];
});

// 统计撤回次数
const rollbackCount = computed(() =>
  validTrace.value.filter((t) => t.type === "back" || t.action === "back").length,
);

// 解析起始段落名称，多重回退兜底（兼容从 Play dataset 直接注入的数据）
const effectiveStartPassage = computed(() => {
  return (
    props.story?.startPassage ||
    (props.story as any)?.variables?.passage ||
    validTrace.value[0]?.to ||
    props.story?.passages?.[0]?.name ||
    ""
  );
});

// 提取用户实际探索过的所有段落名称集合
const allExploredPassages = computed(() => {
  const set = new Set<string>();
  for (const t of validTrace.value) {
    if (t.from) set.add(t.from);
    if (t.to) set.add(t.to);
  }
  if (effectiveStartPassage.value) {
    set.add(effectiveStartPassage.value);
  }
  return set;
});

// 根据“是否全成就与结局达成”，构建对应的图数据：
// 若全成就结局达成：保留全量段落，未探索段落保留位置但名称标记为掩码
// 若未达成：仅保留探索过的子图，完全隐藏未探索段落
const effectiveStory = computed<StoryData | null>(() => {
  if (!props.story || !Array.isArray(props.story.passages) || props.story.passages.length === 0) {
    return null;
  }

  if (hasCompletedAll.value) {
    return {
      title: props.story.title || "未命名故事",
      startPassage: effectiveStartPassage.value,
      passages: props.story.passages,
    };
  }

  const exploredList = props.story.passages.filter((p) =>
    allExploredPassages.value.has(p.name),
  );

  return {
    title: props.story.title || "未命名故事",
    startPassage: effectiveStartPassage.value,
    passages: exploredList,
  };
});

// 构建场景关系图与布局
const rawGraph = computed(() =>
  buildStoryGraph(effectiveStory.value, {
    includeDangling: false,
    includeDisplayEdges: false,
  }),
);

const layout = computed(() =>
  layoutStoryGraph(rawGraph.value, {
    nodeWidth: 160,
    nodeHeight: 42,
    columnGap: 80,
    rowGap: 20,
    padding: 30,
  }),
);

// ---- 播放控制状态 -----------------------------------------------------

const currentStepIndex = ref(0);
const isPlaying = ref(false);
const playSpeed = ref(1);
let playTimer: ReturnType<typeof setTimeout> | null = null;

const activeStep = computed<IPlayTrace | null>(() => {
  if (validTrace.value.length === 0) return null;
  const idx = Math.min(Math.max(0, currentStepIndex.value), validTrace.value.length - 1);
  return validTrace.value[idx];
});

const currentPassage = computed(() => {
  if (activeStep.value) {
    return activeStep.value.to;
  }
  return effectiveStartPassage.value || "";
});

// 截至当前步数已到达的所有段落集合
const visitedInPlayback = computed(() => {
  const set = new Set<string>();
  if (effectiveStartPassage.value) {
    set.add(effectiveStartPassage.value);
  }
  const slice = validTrace.value.slice(0, currentStepIndex.value + 1);
  for (const step of slice) {
    if (step.to) set.add(step.to);
  }
  return set;
});

// 截至当前步数已经走过的边集合
const traversedEdges = computed(() => {
  const set = new Set<string>();
  const slice = validTrace.value.slice(0, currentStepIndex.value + 1);
  for (const step of slice) {
    if (step.from && step.to) {
      set.add(`${step.from} -> ${step.to}`);
    }
  }
  return set;
});

// 节点是否为掩码场景（????）
const isNodeMasked = (nodeId: string) => {
  return hasCompletedAll.value && !allExploredPassages.value.has(nodeId);
};

const isCurrentPassage = (nodeId: string) => {
  return nodeId === currentPassage.value;
};

const getNodeLabel = (node: LaidOutNode) => {
  if (isNodeMasked(node.id)) {
    return "????";
  }
  return node.label;
};

// ---- 连线点击选中与点亮场景交互 ---------------------------------------

const selectedEdgeId = ref<string | null>(null);

const selectedEdge = computed(() => {
  if (!selectedEdgeId.value) return null;
  return layout.value.edges.find((e) => e.id === selectedEdgeId.value) || null;
});

const isNodeConnectedToSelectedEdge = (nodeId: string) => {
  if (!selectedEdge.value) return false;
  return selectedEdge.value.source === nodeId || selectedEdge.value.target === nodeId;
};

const toggleEdgeSelection = (edge: LaidOutEdge) => {
  if (selectedEdgeId.value === edge.id) {
    selectedEdgeId.value = null;
  } else {
    selectedEdgeId.value = edge.id;
  }
};

const getLinkTextFromPassage = (sourcePassageName: string, targetPassageName: string): string => {
  if (!props.story?.passages) return "";
  const passage = props.story.passages.find((p) => p.name === sourcePassageName);
  if (!passage?.content) return "";
  for (const match of passage.content.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)) {
    const label = match[1]?.trim() || "";
    const target = (match[2] ?? match[1])?.trim();
    if (target === targetPassageName) {
      return label;
    }
  }
  return "";
};

interface EdgeOperationInfo {
  text: string;
  detail?: string;
  isBack: boolean;
  hasTraversed: boolean;
  stepCount: number;
}

const getEdgeOperationInfo = (edge: LaidOutEdge): EdgeOperationInfo => {
  // 查找在玩家探索动线中经过该边的步骤（正向前进或逆向撤回）
  const steps: Array<{ action: string; type: string; at?: number; stepIndex: number }> = [];
  validTrace.value.forEach((step, idx) => {
    if (step.from === edge.source && step.to === edge.target) {
      steps.push({
        action: step.action || "",
        type: step.type === "back" || step.action === "back" ? "back" : "forward",
        at: step.at,
        stepIndex: idx + 1,
      });
    } else if (
      (step.type === "back" || step.action === "back") &&
      step.from === edge.target &&
      step.to === edge.source
    ) {
      steps.push({
        action: "撤回",
        type: "back",
        at: step.at,
        stepIndex: idx + 1,
      });
    }
  });

  const linkLabel = getLinkTextFromPassage(edge.source, edge.target);

  if (steps.length > 0) {
    const latest = steps[steps.length - 1];
    const isBack = latest.type === "back";
    let text = "";

    if (isBack) {
      text = "撤回选择";
    } else if (latest.action && latest.action !== "forward" && latest.action !== "start" && !latest.action.startsWith("goto:")) {
      text = latest.action.startsWith("display:") ? `展开: ${latest.action.slice(8)}` : latest.action;
    } else if (linkLabel) {
      text = linkLabel;
    } else {
      text = "探索前进";
    }

    let detail = `第 ${latest.stepIndex} 步`;
    if (steps.length > 1) {
      detail += ` (共经过 ${steps.length} 次)`;
    }
    if (latest.at) {
      detail += ` · ${formatTime(latest.at)}`;
    }

    return {
      text,
      detail,
      isBack,
      hasTraversed: true,
      stepCount: steps.length,
    };
  }

  // 未探索场景连线（如全成就全结局达成模式下显示的隐藏分支）
  if (isNodeMasked(edge.target)) {
    return {
      text: "???? (未探索)",
      detail: "尚未发现该操作分支",
      isBack: false,
      hasTraversed: false,
      stepCount: 0,
    };
  }

  return {
    text: linkLabel ? `选项: ${linkLabel}` : "分支跳转",
    detail: "尚未在游玩中选择该分支",
    isBack: false,
    hasTraversed: false,
    stepCount: 0,
  };
};

function measureTextWidth(text: string): number {
  let w = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    const isWide =
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6);
    w += isWide ? 12 : 7;
  }
  return w;
}

const getBadgeWidth = (edge: LaidOutEdge) => {
  const info = getEdgeOperationInfo(edge);
  return Math.max(68, measureTextWidth(info.text) + 26);
};

const getBadgeHaloClass = (edge: LaidOutEdge) => {
  const info = getEdgeOperationInfo(edge);
  if (info.isBack) return "fill-warning/25 stroke-warning/70";
  if (info.hasTraversed) return "fill-primary/25 stroke-primary/70";
  return "fill-base-content/15 stroke-base-content/30";
};

const getBadgeRectClass = (edge: LaidOutEdge) => {
  const info = getEdgeOperationInfo(edge);
  if (info.isBack) return "fill-warning stroke-warning-content/20 shadow-md";
  if (info.hasTraversed) return "fill-primary stroke-primary-content/20 shadow-md";
  return "fill-base-100 stroke-base-content/40 shadow-md";
};

const getBadgeTextClass = (edge: LaidOutEdge) => {
  const info = getEdgeOperationInfo(edge);
  if (info.isBack) return "fill-warning-content font-bold";
  if (info.hasTraversed) return "fill-primary-content font-bold";
  return "fill-base-content font-medium";
};

const getNodeClass = (node: LaidOutNode) => {
  const isConnected = isNodeConnectedToSelectedEdge(node.id);
  const isDimmed = Boolean(selectedEdge.value && !isConnected);

  return {
    "sg-node-current": isCurrentPassage(node.id),
    "sg-node-visited": visitedInPlayback.value.has(node.id),
    "sg-node-future": allExploredPassages.value.has(node.id) && !visitedInPlayback.value.has(node.id),
    "sg-node-masked": isNodeMasked(node.id),
    "sg-node-connected": isConnected,
    "opacity-35 transition-opacity": isDimmed,
  };
};

const getNodeRectClass = (node: LaidOutNode) => {
  if (isNodeConnectedToSelectedEdge(node.id)) {
    return "fill-base-100 stroke-primary stroke-[2.5] shadow-xl";
  }
  if (isCurrentPassage(node.id)) {
    return "fill-primary stroke-primary text-primary-content shadow-lg";
  }
  if (isNodeMasked(node.id)) {
    return "fill-base-200/40 stroke-base-content/30 stroke-dash-2";
  }
  if (visitedInPlayback.value.has(node.id)) {
    return "fill-base-100 stroke-primary/70 hover:stroke-primary";
  }
  return "fill-base-100/50 stroke-base-200 opacity-40";
};

const getNodeTextClass = (node: LaidOutNode) => {
  if (isNodeConnectedToSelectedEdge(node.id)) {
    return "fill-primary font-bold";
  }
  if (isCurrentPassage(node.id)) {
    return "fill-primary-content font-bold";
  }
  if (isNodeMasked(node.id)) {
    return "fill-base-content/40 tracking-widest font-mono";
  }
  if (visitedInPlayback.value.has(node.id)) {
    return "fill-base-content";
  }
  return "fill-base-content/40";
};

const getEdgeClass = (edge: LaidOutEdge) => {
  const isSelected = selectedEdgeId.value === edge.id;
  const isAnySelected = Boolean(selectedEdgeId.value);
  const edgeKey = `${edge.source} -> ${edge.target}`;
  const isTraversed = traversedEdges.value.has(edgeKey);
  const isLatestEdge = activeStep.value?.from === edge.source && activeStep.value?.to === edge.target;
  const isRollback = activeStep.value?.type === "back" || activeStep.value?.action === "back";

  // 当前边被点击选中点亮
  if (isSelected) {
    const isBack = getEdgeOperationInfo(edge).isBack;
    if (isBack) {
      return "stroke-warning stroke-[3.5] [filter:drop-shadow(0_0_6px_rgba(234,179,8,0.85))] fill-none";
    }
    return "stroke-primary stroke-[3.5] [filter:drop-shadow(0_0_6px_rgba(var(--color-primary),0.85))] fill-none";
  }

  // 当有选中的边时，其他边淡化
  if (isAnySelected) {
    return "stroke-base-content/15 stroke-1 stroke-dash-2 opacity-25 fill-none";
  }

  if (isLatestEdge && isRollback) {
    return "stroke-warning stroke-2 stroke-dash-3 fill-none";
  }
  if (isLatestEdge) {
    return "stroke-primary stroke-2.5 fill-none";
  }
  if (isTraversed) {
    return "stroke-primary/70 stroke-1.5 fill-none";
  }
  return "stroke-base-content/25 stroke-1 stroke-dash-2 fill-none";
};

const getEdgeMarker = (edge: LaidOutEdge) => {
  const isSelected = selectedEdgeId.value === edge.id;
  const edgeKey = `${edge.source} -> ${edge.target}`;
  const isLatestEdge = activeStep.value?.from === edge.source && activeStep.value?.to === edge.target;
  const isRollback = activeStep.value?.type === "back" || activeStep.value?.action === "back";

  if (isSelected) {
    const isBack = getEdgeOperationInfo(edge).isBack;
    return isBack ? `url(#${uid}-arrow-back)` : `url(#${uid}-arrow-active)`;
  }
  if (isLatestEdge && isRollback) {
    return `url(#${uid}-arrow-back)`;
  }
  if (isLatestEdge || traversedEdges.value.has(edgeKey)) {
    return `url(#${uid}-arrow-active)`;
  }
  return `url(#${uid}-arrow-normal)`;
};

// 播放调度
const scheduleNextTick = () => {
  if (!isPlaying.value) return;
  const delay = Math.max(300, 1200 / playSpeed.value);
  playTimer = setTimeout(() => {
    if (!isPlaying.value) return;
    if (currentStepIndex.value < validTrace.value.length - 1) {
      currentStepIndex.value += 1;
      scheduleNextTick();
    } else {
      isPlaying.value = false;
    }
  }, delay);
};

const togglePlay = () => {
  if (isPlaying.value) {
    isPlaying.value = false;
    if (playTimer) clearTimeout(playTimer);
  } else {
    if (currentStepIndex.value >= validTrace.value.length - 1) {
      currentStepIndex.value = 0;
    }
    isPlaying.value = true;
    scheduleNextTick();
  }
};

const restartPlay = () => {
  isPlaying.value = false;
  if (playTimer) clearTimeout(playTimer);
  currentStepIndex.value = 0;
  togglePlay();
};

const prevStep = () => {
  isPlaying.value = false;
  if (playTimer) clearTimeout(playTimer);
  currentStepIndex.value = Math.max(0, currentStepIndex.value - 1);
};

const nextStep = () => {
  isPlaying.value = false;
  if (playTimer) clearTimeout(playTimer);
  currentStepIndex.value = Math.min(validTrace.value.length - 1, currentStepIndex.value + 1);
};

const jumpToEnd = () => {
  isPlaying.value = false;
  if (playTimer) clearTimeout(playTimer);
  currentStepIndex.value = Math.max(0, validTrace.value.length - 1);
};

const onScrub = () => {
  isPlaying.value = false;
  if (playTimer) clearTimeout(playTimer);
};

// ---- 视口缩放与平移 ---------------------------------------------------

const hostWidth = ref(0);
const hostHeight = ref(0);
const scale = ref(1);
const pan = ref({ x: 0, y: 0 });
const dragging = ref(false);

const transform = computed(
  () => `translate(${pan.value.x} ${pan.value.y}) scale(${scale.value})`,
);

function measure() {
  const el = hostRef.value;
  if (!el) return;
  hostWidth.value = el.clientWidth;
  hostHeight.value = el.clientHeight;
}

function clampScale(v: number) {
  return Math.min(3, Math.max(0.2, v));
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

function fit() {
  measure();
  const w = hostWidth.value;
  const h = hostHeight.value;
  const drawing = layout.value;
  if (w <= 0 || h <= 0 || drawing.width <= 0 || drawing.height <= 0) return;

  const targetScale = clampScale(Math.min((w - 40) / drawing.width, (h - 40) / drawing.height, 1.2));
  scale.value = targetScale;
  pan.value = {
    x: (w - drawing.width * targetScale) / 2,
    y: (h - drawing.height * targetScale) / 2,
  };
}

// 滚轮缩放
function onWheel(e: WheelEvent) {
  const rect = hostRef.value?.getBoundingClientRect();
  if (!rect) return;
  const originX = e.clientX - rect.left;
  const originY = e.clientY - rect.top;
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  zoomAt(factor, originX, originY);
}

// 指针拖拽平移
let dragState: { x: number; y: number; moved: boolean } | null = null;

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return;
  const target = e.target as Element | null;
  const onEdge = !!target?.closest?.(".sg-edge-group");
  const onNode = !!target?.closest?.("g[role='button']");
  const isTouchLike = e.pointerType === "touch" || e.pointerType === "pen";

  if ((onEdge || onNode) && !isTouchLike) {
    return;
  }

  dragState = { x: e.clientX, y: e.clientY, moved: false };
  dragging.value = true;
  (e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
  if (!dragState) return;
  const dx = e.clientX - dragState.x;
  const dy = e.clientY - dragState.y;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
    dragState.moved = true;
  }
  pan.value = {
    x: pan.value.x + dx,
    y: pan.value.y + dy,
  };
  dragState.x = e.clientX;
  dragState.y = e.clientY;
}

function onPointerUp(e: PointerEvent) {
  if (dragState) {
    if (!dragState.moved) {
      const target = e.target as Element | null;
      if (!target?.closest?.(".sg-edge-group") && !target?.closest?.("g[role='button']")) {
        selectedEdgeId.value = null;
      }
    }
    dragging.value = false;
    dragState = null;
  }
}

function onPointerLeave() {
  dragging.value = false;
  dragState = null;
}

const onNodeClick = (node: LaidOutNode) => {
  if (isNodeMasked(node.id)) return;
  emit("select-passage", node.id);
};

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value;
  setTimeout(fit, 100);
};

const handleClose = () => {
  if (isFullscreen.value) {
    isFullscreen.value = false;
    setTimeout(fit, 100);
  }
  emit("close");
};

const formatTime = (ts?: number) => {
  if (!ts) return "-";
  return new Date(Number(ts)).toLocaleTimeString();
};

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  measure();
  if (validTrace.value.length > 0) {
    currentStepIndex.value = validTrace.value.length - 1;
  }
  setTimeout(fit, 150);

  if (hostRef.value && typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => {
      measure();
    });
    resizeObserver.observe(hostRef.value);
  }
});

watch(
  () => validTrace.value.length,
  (len) => {
    if (len > 0) {
      currentStepIndex.value = len - 1;
    }
    setTimeout(fit, 100);
  },
);

onBeforeUnmount(() => {
  if (playTimer) clearTimeout(playTimer);
  resizeObserver?.disconnect();
});
</script>

<style scoped>
.sg-edge {
  fill: none !important;
}
.stroke-dash-2 {
  stroke-dasharray: 4 3;
}
.stroke-dash-3 {
  stroke-dasharray: 6 4;
}
.sg-edge-group:hover .sg-edge {
  stroke-width: 3px;
  stroke: var(--color-primary);
  opacity: 1;
}
</style>
