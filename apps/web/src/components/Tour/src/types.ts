/**
 * 通用漫游式引导（Tour）类型定义。
 *
 * 参考 Element Plus 的 Tour 设计：以「步骤 + 目标元素」描述一次引导，
 * 通过遮罩高亮目标元素，并让气泡跟随目标展示说明与操作。
 */

/** 气泡相对于目标元素的位置 */
export type TourPlacement = "top" | "bottom" | "left" | "right";

/** 目标元素：CSS 选择器、DOM 元素，或返回它们的函数 */
export type TourTarget =
  | string
  | HTMLElement
  | (() => HTMLElement | null | undefined)
  | null
  | undefined;

/** 遮罩配置 */
export interface TourMaskOptions {
  /** 遮罩颜色，默认 rgba(0, 0, 0, 0.55) */
  color?: string;
  /** 高亮区域在目标元素四周额外扩大的像素，默认 6 */
  padding?: number;
}

/** 单个引导步骤 */
export interface TourStep {
  /** 目标元素；留空则该步骤居中展示 */
  target?: TourTarget;
  /** 标题 */
  title?: string;
  /** 描述文本，也可以用默认插槽自定义内容 */
  description?: string;
  /** 用同名的具名插槽渲染该步骤内容（插槽作用域同默认插槽） */
  slot?: string;
  /** 气泡位置，center 表示居中展示且不显示高亮与箭头 */
  placement?: TourPlacement | "center";
  /** 气泡与目标元素的间距，覆盖全局 gap */
  gap?: number;
  /** 气泡宽度，数字按 px 处理，覆盖全局 width */
  width?: number | string;
  /** 是否显示箭头，覆盖全局 showArrow */
  showArrow?: boolean;
  /** 是否显示关闭按钮，覆盖全局 showClose */
  showClose?: boolean;
  /** 是否显示遮罩，覆盖全局 mask */
  mask?: boolean | TourMaskOptions;
  /** 是否允许点击目标区域（未设置时使用全局 targetAreaClickable） */
  targetAreaClickable?: boolean;
  /** 是否把目标滚动到可视区域，覆盖全局 scrollIntoView */
  scrollIntoView?: boolean;
  /** 按钮文案覆盖 */
  nextText?: string;
  prevText?: string;
  finishText?: string;
  /** 追加到气泡上的类名 */
  popperClass?: string;
  /** 透传给插槽的任意数据 */
  data?: unknown;
  /** 进入该步骤前调用，返回 false 则跳过该步骤 */
  beforeEnter?: () => unknown | Promise<unknown>;
  /** 离开该步骤前调用，返回 false 则阻止离开 */
  beforeLeave?: () => unknown | Promise<unknown>;
}

/** 组件 props */
export interface TourProps {
  /** 是否展示引导，配合 v-model 使用 */
  modelValue?: boolean;
  /** 步骤列表 */
  steps?: TourStep[];
  /** 当前步骤下标，配合 v-model:current 使用 */
  current?: number;
  /** 默认气泡位置 */
  placement?: TourPlacement;
  /** 气泡与目标元素的默认间距 */
  gap?: number;
  /** 气泡默认宽度 */
  width?: number | string;
  /** 层级 */
  zIndex?: number;
  /** 是否显示遮罩，可传入颜色与内边距 */
  mask?: boolean | TourMaskOptions;
  /** 是否显示气泡箭头 */
  showArrow?: boolean;
  /** 是否显示关闭按钮 */
  showClose?: boolean;
  /** 是否显示步骤指示点 */
  showIndicators?: boolean;
  /** 指示点位置：与按钮同一行，或单独一行 */
  indicatorPosition?: "inline" | "bottom";
  /** 进入步骤时自动把目标滚动到可视区域 */
  scrollIntoView?: boolean;
  /** 按 Esc 关闭 */
  closeOnPressEscape?: boolean;
  /** 点击遮罩关闭 */
  closeOnClickOutside?: boolean;
  /** 遮罩是否拦截鼠标交互（false 时页面依旧可以操作） */
  blockInteraction?: boolean;
  /** 高亮区域内的目标元素是否可点击 */
  targetAreaClickable?: boolean;
  /** Teleport 目标 */
  appendTo?: string | HTMLElement;
  /** 是否把焦点限制在气泡内 */
  focusTrap?: boolean;
  /** 默认按钮文案 */
  nextText?: string;
  prevText?: string;
  finishText?: string;
  /** 追加到气泡上的类名 */
  popperClass?: string;
}

/** 插槽作用域参数 */
export interface TourSlotProps {
  /** 当前步骤下标 */
  current: number;
  /** 步骤总数 */
  total: number;
  /** 当前步骤配置 */
  step?: TourStep;
  isFirst: boolean;
  isLast: boolean;
  next: () => void;
  prev: () => void;
  close: () => void;
  goTo: (index: number) => void;
}

/** 命令式调用的配置 */
export interface TourOptions extends Omit<TourProps, "modelValue" | "current"> {
  /** 结束（走完最后一步）时回调 */
  onFinish?: () => void;
  /** 关闭时回调 */
  onClose?: (current: number) => void;
}
