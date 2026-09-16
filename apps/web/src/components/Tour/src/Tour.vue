<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import type { CSSProperties } from "vue";
import {
  arrowBorderClassOf,
  arrowStyleOf,
  blockersOf,
  computePosition,
  getViewport,
  highlightStyleOf,
  resolvePlacement,
} from "./position";
import type { Rect } from "./position";
import type {
  TourMaskOptions,
  TourPlacement,
  TourProps,
  TourSlotProps,
  TourStep,
  TourTarget,
} from "./types";

defineOptions({ name: "Tour" });

const DEFAULT_MASK_COLOR = "rgba(0, 0, 0, 0.55)";
const DEFAULT_MASK_PADDING = 6;
const DEFAULT_HIGHLIGHT_RADIUS = "8px";

const props = withDefaults(defineProps<TourProps>(), {
  modelValue: undefined,
  steps: () => [],
  current: undefined,
  placement: "bottom",
  gap: 12,
  width: 320,
  zIndex: 3000,
  mask: true,
  showArrow: true,
  showClose: true,
  showIndicators: true,
  indicatorPosition: "inline",
  scrollIntoView: true,
  closeOnPressEscape: true,
  closeOnClickOutside: false,
  blockInteraction: true,
  targetAreaClickable: true,
  appendTo: "body",
  focusTrap: true,
  nextText: "下一步",
  prevText: "上一步",
  finishText: "完成",
  popperClass: "",
});

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  "update:current": [value: number];
  change: [current: number, prev: number];
  close: [current: number];
  finish: [];
  maskClick: [event: MouseEvent];
}>();

/* ------------------------------- 状态 ------------------------------- */

const isVisible = ref(props.modelValue ?? false);
const index = ref(props.current ?? 0);

const popoverRef = ref<HTMLElement | null>(null);
const targetRect = ref<Rect | null>(null);
const popoverStyle = ref<CSSProperties>({});
const holeStyle = ref<CSSProperties | null>(null);
const arrowStyle = ref<CSSProperties>({});
const arrowClass = ref("");
const arrowPlacement = ref<TourPlacement | null>(null);
const blockers = ref<CSSProperties[]>([]);
/** 没有高亮区域时，用整屏半透明层充当遮罩 */
const screenMaskStyle = ref<CSSProperties | null>(null);

let prevActiveElement: HTMLElement | null = null;
let observedTarget: HTMLElement | null = null;
let resizeObserver: ResizeObserver | null = null;
let rafId = 0;

/* ------------------------------ 计算属性 ----------------------------- */

const total = computed(() => props.steps.length);
const currentStep = computed<TourStep | undefined>(() => props.steps[index.value]);
const isFirst = computed(() => index.value <= 0);
const isLast = computed(() => index.value >= total.value - 1);

const maskConfig = computed(() => {
  const raw = currentStep.value?.mask ?? props.mask;
  if (!raw) return { enabled: false, color: DEFAULT_MASK_COLOR, padding: DEFAULT_MASK_PADDING };
  if (raw === true) {
    return { enabled: true, color: DEFAULT_MASK_COLOR, padding: DEFAULT_MASK_PADDING };
  }
  const options = raw as TourMaskOptions;
  return {
    enabled: true,
    color: options.color ?? DEFAULT_MASK_COLOR,
    padding: options.padding ?? DEFAULT_MASK_PADDING,
  };
});

const showArrowEnabled = computed(() => currentStep.value?.showArrow ?? props.showArrow);
const showCloseEnabled = computed(() => currentStep.value?.showClose ?? props.showClose);
const nextTextEnabled = computed(() => currentStep.value?.nextText ?? props.nextText);
const prevTextEnabled = computed(() => currentStep.value?.prevText ?? props.prevText);
const finishTextEnabled = computed(() => currentStep.value?.finishText ?? props.finishText);
const canClickTarget = computed(
  () => currentStep.value?.targetAreaClickable ?? props.targetAreaClickable,
);

const slotProps = computed<TourSlotProps>(() => ({
  current: index.value,
  total: total.value,
  step: currentStep.value,
  isFirst: isFirst.value,
  isLast: isLast.value,
  next: () => void next(),
  prev: () => void prev(),
  close,
  goTo: (i: number) => void goTo(i),
}));

/* ------------------------------- 工具 ------------------------------- */

function clampIndex(value: number) {
  return Math.min(Math.max(value, 0), Math.max(total.value - 1, 0));
}

function setVisible(value: boolean) {
  isVisible.value = value;
  emit("update:modelValue", value);
}

function setIndex(value: number) {
  if (index.value === value) return;
  index.value = value;
  emit("update:current", value);
}

function resolveTarget(target: TourTarget): HTMLElement | null {
  if (!target) return null;
  if (typeof target === "string") {
    try {
      return document.querySelector<HTMLElement>(target);
    } catch {
      return null;
    }
  }
  if (typeof target === "function") return target() ?? null;
  return target instanceof HTMLElement ? target : null;
}

async function runHook(hook?: () => unknown | Promise<unknown>) {
  if (!hook) return true;
  try {
    return (await hook()) !== false;
  } catch (error) {
    console.error("[Tour] 步骤钩子执行失败", error);
    return true;
  }
}

function isEditableTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  return /^(input|textarea|select)$/i.test(el.tagName) || el.isContentEditable;
}

/* ------------------------------ 定位逻辑 ------------------------------ */

function scheduleUpdate() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    void updatePosition();
  });
}

function observeTarget(el: HTMLElement | null) {
  if (observedTarget === el) return;
  if (typeof ResizeObserver === "undefined") return;
  if (!resizeObserver) resizeObserver = new ResizeObserver(scheduleUpdate);
  if (observedTarget) resizeObserver.unobserve(observedTarget);
  observedTarget = el;
  if (el) resizeObserver.observe(el);
}

async function updatePosition() {
  if (!isVisible.value) return;

  const step = currentStep.value;
  const el = resolveTarget(step?.target);
  observeTarget(el);
  targetRect.value = el ? el.getBoundingClientRect() : null;

  await nextTick();

  const popover = popoverRef.value;
  if (!popover) return;

  const size = { width: popover.offsetWidth, height: popover.offsetHeight };
  const viewport = getViewport();
  const { enabled: maskEnabled, color, padding } = maskConfig.value;

  if (!el || !targetRect.value || step?.placement === "center") {
    // 无目标元素：气泡居中，遮罩铺满全屏
    holeStyle.value = null;
    screenMaskStyle.value = maskEnabled
      ? { background: color, pointerEvents: props.blockInteraction ? "auto" : "none" }
      : null;
    arrowPlacement.value = null;
    arrowStyle.value = { display: "none" };
    blockers.value = [];
    popoverStyle.value = {
      top: `${Math.max(Math.round((viewport.height - size.height) / 2), 8)}px`,
      left: `${Math.max(Math.round((viewport.width - size.width) / 2), 8)}px`,
      width: toCssWidth(step?.width ?? props.width),
    };
    return;
  }

  const rect = targetRect.value;
  const gap = step?.gap ?? props.gap;
  const preferred = (step?.placement ?? props.placement) as TourPlacement;
  const placement = resolvePlacement(preferred, rect, size, gap);
  const result = computePosition(rect, size, placement, gap, viewport);

  popoverStyle.value = {
    top: `${result.top}px`,
    left: `${result.left}px`,
    width: toCssWidth(step?.width ?? props.width),
  };

  if (showArrowEnabled.value) {
    arrowPlacement.value = placement;
    arrowClass.value = arrowBorderClassOf(placement);
    arrowStyle.value = arrowStyleOf(result);
  } else {
    arrowPlacement.value = null;
    arrowStyle.value = { display: "none" };
  }

  screenMaskStyle.value = null;

  if (maskEnabled) {
    holeStyle.value = highlightStyleOf(
      rect,
      padding,
      color,
      getComputedStyle(el).borderRadius || DEFAULT_HIGHLIGHT_RADIUS,
    );
    blockers.value = props.blockInteraction
      ? blockersOf(rect, padding, viewport, !canClickTarget.value)
      : [];
  } else {
    holeStyle.value = null;
    blockers.value = [];
  }
}

function toCssWidth(width: number | string) {
  return typeof width === "number" ? `${width}px` : width;
}

/** 指示点 hover / 聚焦时显示的提示：该步骤的标题 */
function dotTitle(stepIndex: number) {
  const title = props.steps[stepIndex]?.title?.trim();
  return title || `第 ${stepIndex + 1} 步`;
}

/* ------------------------------ 步骤切换 ------------------------------ */

async function applyStep(i: number) {
  const step = props.steps[i];
  const el = resolveTarget(step?.target);

  if ((step?.scrollIntoView ?? props.scrollIntoView) && el) {
    const rect = el.getBoundingClientRect();
    const outside =
      rect.top < 0 ||
      rect.left < 0 ||
      rect.bottom > window.innerHeight ||
      rect.right > window.innerWidth;
    if (outside) el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }

  await nextTick();
  await updatePosition();

  const popover = popoverRef.value;
  if (popover && !popover.contains(document.activeElement)) {
    popover.focus({ preventScroll: true });
  }
}

async function goTo(target: number, depth = 0) {
  const nextIndex = clampIndex(target);
  const prev = index.value;

  if (nextIndex === prev) {
    if (isVisible.value) await applyStep(prev);
    return;
  }

  if (!(await runHook(props.steps[prev]?.beforeLeave))) return;

  if (!(await runHook(props.steps[nextIndex]?.beforeEnter))) {
    // 该步骤被跳过：沿原方向继续查找下一个未跳过的步骤
    if (depth + 1 >= total.value) return;
    const direction = nextIndex > prev ? 1 : -1;
    if (clampIndex(nextIndex + direction) === nextIndex) return;
    await goTo(nextIndex + direction, depth + 1);
    return;
  }

  setIndex(nextIndex);
  emit("change", nextIndex, prev);

  // 受控模式下 index 由父组件同步，这里直接按目标下标渲染
  await applyStep(nextIndex);
}

async function next() {
  if (isLast.value) {
    await finish();
    return;
  }
  await goTo(index.value + 1);
}

async function prev() {
  if (isFirst.value) return;
  await goTo(index.value - 1);
}

function close() {
  if (!isVisible.value) return;
  setVisible(false);
  emit("close", index.value);
}

async function finish() {
  emit("finish");
  close();
}

/** 打开引导，可指定起始步骤 */
async function open(targetIndex = 0) {
  if (!total.value) {
    console.warn("[Tour] steps 为空，无法开始引导");
    return;
  }
  const wasVisible = isVisible.value;
  const i = clampIndex(targetIndex);
  if (i !== index.value) {
    index.value = i;
    emit("update:current", i);
  }
  setVisible(true);
  // 已经是打开状态时（受控模式下 watch 不会再次触发）手动重新定位
  if (wasVisible) await applyStep(i);
}

/* ------------------------------ 事件监听 ------------------------------ */

function onKeydown(event: KeyboardEvent) {
  if (!isVisible.value) return;

  if (event.key === "Escape" && props.closeOnPressEscape) {
    event.preventDefault();
    event.stopPropagation();
    close();
    return;
  }

  const popover = popoverRef.value;
  const focusInside = !!popover && popover.contains(document.activeElement);
  if (!focusInside && isEditableTarget(event.target)) return;

  if (event.key === "ArrowRight") {
    if (!focusInside && !props.blockInteraction) return;
    event.preventDefault();
    void next();
  } else if (event.key === "ArrowLeft") {
    if (!focusInside && !props.blockInteraction) return;
    event.preventDefault();
    void prev();
  } else if (event.key === "Tab" && props.focusTrap) {
    trapFocus(event);
  }
}

function trapFocus(event: KeyboardEvent) {
  const popover = popoverRef.value;
  if (!popover) return;
  const focusable = Array.from(
    popover.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => el.getClientRects().length > 0);

  if (!focusable.length) {
    event.preventDefault();
    popover.focus({ preventScroll: true });
    return;
  }

  const first = focusable[0] as HTMLElement;
  const last = focusable[focusable.length - 1] as HTMLElement;
  const active = document.activeElement;

  if (event.shiftKey && (active === first || !popover.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !popover.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}

function onMaskClick(event: MouseEvent) {
  emit("maskClick", event);
  if (props.closeOnClickOutside) close();
}

function bindListeners() {
  window.addEventListener("resize", scheduleUpdate, true);
  window.addEventListener("scroll", scheduleUpdate, true);
  document.addEventListener("keydown", onKeydown, true);
}

function unbindListeners() {
  window.removeEventListener("resize", scheduleUpdate, true);
  window.removeEventListener("scroll", scheduleUpdate, true);
  document.removeEventListener("keydown", onKeydown, true);
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  observeTarget(null);
}

async function onOpen() {
  if (!isVisible.value) return;
  if (!total.value) {
    console.warn("[Tour] steps 为空，无法开始引导");
    setVisible(false);
    return;
  }
  index.value = clampIndex(index.value);
  prevActiveElement = document.activeElement as HTMLElement | null;
  bindListeners();
  await applyStep(index.value);
}

function onClose() {
  unbindListeners();
  if (
    props.focusTrap &&
    prevActiveElement &&
    document.contains(prevActiveElement) &&
    typeof prevActiveElement.focus === "function"
  ) {
    prevActiveElement.focus({ preventScroll: true });
  }
  prevActiveElement = null;
}

/* ------------------------------ 生命周期 ------------------------------ */

watch(
  () => props.modelValue,
  (value) => {
    if (value !== undefined && value !== isVisible.value) isVisible.value = value;
  },
);

watch(
  () => props.current,
  (value) => {
    if (value !== undefined && value !== index.value) index.value = value;
  },
);

watch(isVisible, (value) => {
  if (value) void onOpen();
  else onClose();
});

watch(index, (value) => {
  if (isVisible.value) void applyStep(value);
});

watch(
  () => props.steps,
  () => {
    if (!isVisible.value) return;
    if (!total.value) {
      close();
      return;
    }
    if (index.value > total.value - 1) setIndex(total.value - 1);
    void applyStep(index.value);
  },
);

onBeforeUnmount(() => {
  unbindListeners();
});

defineExpose({ open, close, next, prev, finish, goTo, updatePosition });
</script>

<template>
  <Teleport :to="appendTo">
    <Transition name="tour-fade">
      <div
        v-if="isVisible && total > 0"
        class="pointer-events-none fixed inset-0"
        :style="{ zIndex }"
      >
        <!-- 遮罩与高亮 -->
        <template v-if="maskConfig.enabled">
          <div
            v-if="screenMaskStyle"
            class="fixed inset-0"
            :style="screenMaskStyle"
            @click="onMaskClick"
          />
          <div
            v-if="holeStyle"
            class="fixed transition-all duration-300 ease-out"
            :style="holeStyle"
          />
          <div
            v-for="(style, i) in blockers"
            :key="i"
            class="pointer-events-auto fixed"
            :style="style"
            @click="onMaskClick"
          />
        </template>

        <!-- 气泡 -->
        <div
          ref="popoverRef"
          role="dialog"
          aria-modal="true"
          :aria-label="currentStep?.title || '操作引导'"
          tabindex="-1"
          class="pointer-events-auto fixed rounded-box border border-base-300 bg-base-100 text-base-content shadow-xl outline-none"
          :class="[popperClass, currentStep?.popperClass]"
          :style="popoverStyle"
        >
          <div
            v-if="arrowPlacement"
            class="absolute h-3 w-3 rotate-45 border-base-300 bg-base-100"
            :class="arrowClass"
            :style="arrowStyle"
          />

          <div class="card-body gap-3 p-4">
            <div
              v-if="currentStep?.title || showCloseEnabled"
              class="flex items-start justify-between gap-3"
            >
              <div class="text-base font-semibold leading-6">
                {{ currentStep?.title }}
              </div>
              <button
                v-if="showCloseEnabled"
                type="button"
                class="btn btn-xs btn-circle btn-ghost shrink-0"
                aria-label="关闭引导"
                @click="close"
              >
                ✕
              </button>
            </div>

            <div class="text-sm leading-6 text-base-content/70">
              <slot v-if="currentStep?.slot" :name="currentStep.slot" v-bind="slotProps" />
              <slot v-else v-bind="slotProps">
                <p v-if="currentStep?.description">{{ currentStep.description }}</p>
              </slot>
            </div>

            <slot
              v-if="showIndicators && total > 1 && indicatorPosition === 'bottom'"
              name="indicators"
              v-bind="slotProps"
            >
              <div class="flex items-center gap-1">
                <button
                  v-for="n in total"
                  :key="n"
                  type="button"
                  class="tooltip tooltip-top h-2 w-2 rounded-full transition-all duration-200"
                  :class="n - 1 === index ? 'w-4 bg-primary' : 'bg-base-300 hover:bg-base-content/40'"
                  :data-tip="dotTitle(n - 1)"
                  :aria-label="`第 ${n} 步：${dotTitle(n - 1)}`"
                  :aria-current="n - 1 === index"
                  @click="goTo(n - 1)"
                />
              </div>
            </slot>

            <div class="flex flex-wrap items-center justify-between gap-3">
              <slot
                v-if="showIndicators && total > 1 && indicatorPosition === 'inline'"
                name="indicators"
                v-bind="slotProps"
              >
                <div class="flex items-center gap-1">
                  <button
                    v-for="n in total"
                    :key="n"
                    type="button"
                    class="tooltip tooltip-top h-2 w-2 rounded-full transition-all duration-200"
                    :class="
                      n - 1 === index ? 'w-4 bg-primary' : 'bg-base-300 hover:bg-base-content/40'
                    "
                    :data-tip="dotTitle(n - 1)"
                    :aria-label="`第 ${n} 步：${dotTitle(n - 1)}`"
                    :aria-current="n - 1 === index"
                    @click="goTo(n - 1)"
                  />
                </div>
              </slot>
              <span v-else-if="!showIndicators && total > 1" class="text-xs text-base-content/50">
                {{ index + 1 }} / {{ total }}
              </span>

              <div class="ml-auto flex items-center gap-2">
                <slot name="prev-button" v-bind="slotProps">
                  <button v-if="!isFirst" type="button" class="btn btn-sm" @click="prev">
                    {{ prevTextEnabled }}
                  </button>
                </slot>
                <slot name="next-button" v-bind="slotProps">
                  <button
                    type="button"
                    class="btn btn-sm btn-primary"
                    @click="isLast ? finish() : next()"
                  >
                    {{ isLast ? finishTextEnabled : nextTextEnabled }}
                  </button>
                </slot>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.tour-fade-enter-active,
.tour-fade-leave-active {
  transition: opacity 0.22s ease;
}
.tour-fade-enter-from,
.tour-fade-leave-to {
  opacity: 0;
}
</style>
