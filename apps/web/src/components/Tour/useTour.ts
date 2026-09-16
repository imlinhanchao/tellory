import { createApp, h, reactive, ref, type App } from "vue";
import Tour from "./src/Tour.vue";
import type { TourOptions, TourStep } from "./src/types";

/** 命令式引导的结束方式 */
export type TourResult = "finish" | "close";

/** 组件对外暴露的方法 */
interface TourExposed {
  open: (index?: number) => Promise<void>;
  close: () => void;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  finish: () => Promise<void>;
  goTo: (index: number) => Promise<void>;
  updatePosition: () => Promise<void>;
}

export interface TourController {
  /** 当前步骤下标 */
  readonly current: number;
  /** 是否正在展示引导 */
  readonly visible: boolean;
  /** 开始引导，返回的 Promise 在完成或关闭时 resolve */
  start: (steps?: TourStep[]) => Promise<TourResult>;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  close: () => void;
  finish: () => void;
  /** 运行时替换步骤列表 */
  setSteps: (steps: TourStep[]) => void;
  /** 卸载命令式实例并移除容器 */
  destroy: () => void;
}

/**
 * 命令式调用引导，适合在事件回调里直接使用：
 *
 * ```ts
 * const tour = useTour({ placement: "bottom" });
 * const result = await tour.start([
 *   { target: "#logo", title: "这里是首页", description: "点击返回首页" },
 *   { target: "#help", title: "需要帮助？", description: "随时查看使用说明" },
 * ]);
 * if (result === "finish") tips();
 * ```
 */
export function useTour(options: TourOptions = {}): TourController {
  const state = reactive<{ visible: boolean; current: number; steps: TourStep[] }>({
    visible: false,
    current: 0,
    steps: [...(options.steps ?? [])],
  });

  const { onFinish, onClose, ...rest } = options;

  let app: App | null = null;
  let container: HTMLElement | null = null;
  let resolveResult: ((result: TourResult) => void) | null = null;
  const compRef = ref<TourExposed | null>(null);

  function settle(result: TourResult) {
    const resolve = resolveResult;
    resolveResult = null;
    resolve?.(result);
  }

  function ensureMounted() {
    if (app) return;
    container = document.createElement("div");
    container.className = "tour-container";
    document.body.appendChild(container);

    app = createApp({
      name: "TourProvider",
      render: () =>
        h(Tour, {
          ...rest,
          ref: (el: unknown) => {
            compRef.value = (el as TourExposed) ?? null;
          },
          modelValue: state.visible,
          current: state.current,
          steps: state.steps,
          "onUpdate:modelValue": (value: boolean) => {
            state.visible = value;
          },
          "onUpdate:current": (value: number) => {
            state.current = value;
          },
          onFinish: () => {
            onFinish?.();
            settle("finish");
          },
          onClose: (current: number) => {
            onClose?.(current);
            settle("close");
          },
        }),
    });
    app.mount(container);
  }

  function start(steps?: TourStep[]) {
    if (steps) state.steps = [...steps];
    if (!state.steps.length) {
      console.warn("[Tour] steps 为空，无法开始引导");
      return Promise.resolve<TourResult>("close");
    }
    ensureMounted();
    state.current = 0;
    state.visible = true;
    return new Promise<TourResult>((resolve) => {
      // 上一次开始但还没结束的引导，先按关闭结算，避免 Promise 悬挂
      settle("close");
      resolveResult = resolve;
    });
  }

  function destroy() {
    app?.unmount();
    app = null;
    container?.remove();
    container = null;
    compRef.value = null;
    resolveResult = null;
  }

  return {
    get current() {
      return state.current;
    },
    get visible() {
      return state.visible;
    },
    start,
    next: () => void compRef.value?.next(),
    prev: () => void compRef.value?.prev(),
    goTo: (index: number) => void compRef.value?.goTo(index),
    close: () => void compRef.value?.close(),
    finish: () => void compRef.value?.finish(),
    setSteps: (steps: TourStep[]) => {
      state.steps = [...steps];
    },
    destroy,
  };
}
