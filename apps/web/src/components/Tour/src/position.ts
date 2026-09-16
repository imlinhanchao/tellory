import type { CSSProperties } from "vue";
import type { TourPlacement } from "./types";

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface PositionResult {
  top: number;
  left: number;
  /** 实际采用的方向（可能因空间不足而翻转） */
  placement: TourPlacement;
  /** 箭头相对于气泡的偏移 */
  arrow: { left?: number; top?: number };
}

const ALL_PLACEMENTS: TourPlacement[] = ["top", "bottom", "left", "right"];

const OPPOSITE: Record<TourPlacement, TourPlacement> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

/** 视口尺寸（取 documentElement，避免滚动条干扰） */
export function getViewport(): Size {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

export function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function clampRect(rect: Rect): Rect {
  return {
    top: rect.top,
    left: rect.left,
    width: Math.max(rect.width, 0),
    height: Math.max(rect.height, 0),
  };
}

/** 目标元素四周可用空间 */
function availableSpace(rect: Rect, viewport: Size): Record<TourPlacement, number> {
  return {
    top: rect.top,
    bottom: viewport.height - (rect.top + rect.height),
    left: rect.left,
    right: viewport.width - (rect.left + rect.width),
  };
}

function neededSpace(size: Size, gap: number): Record<TourPlacement, number> {
  return {
    top: size.height + gap,
    bottom: size.height + gap,
    left: size.width + gap,
    right: size.width + gap,
  };
}

/**
 * 选择最终方向：优先使用期望方向，空间不够时翻转，仍不够时选剩余空间最多的一侧。
 */
export function resolvePlacement(
  preferred: TourPlacement,
  rect: Rect,
  size: Size,
  gap: number,
): TourPlacement {
  const viewport = getViewport();
  const space = availableSpace(rect, viewport);
  const needed = neededSpace(size, gap);

  if (space[preferred] >= needed[preferred]) return preferred;

  const candidates = [
    OPPOSITE[preferred],
    ...ALL_PLACEMENTS.filter((p) => p !== preferred && p !== OPPOSITE[preferred]),
  ];

  const fit = candidates.find((p) => space[p] >= needed[p]);
  if (fit) return fit;

  return candidates.reduce((best, current) =>
    space[current] - needed[current] > space[best] - needed[best] ? current : best,
  );
}

const ARROW_SIZE = 12;
/** 箭头中心距离气泡边缘的最小距离，保证圆角外不出现尖角 */
const ARROW_MARGIN = ARROW_SIZE + 6;

/** 计算气泡位置与箭头偏移 */
export function computePosition(
  rawRect: Rect,
  size: Size,
  placement: TourPlacement,
  gap: number,
  viewport: Size = getViewport(),
): PositionResult {
  const rect = clampRect(rawRect);
  const margin = 8;
  let top = 0;
  let left = 0;

  switch (placement) {
    case "top":
      top = rect.top - size.height - gap;
      left = rect.left + rect.width / 2 - size.width / 2;
      break;
    case "bottom":
      top = rect.top + rect.height + gap;
      left = rect.left + rect.width / 2 - size.width / 2;
      break;
    case "left":
      left = rect.left - size.width - gap;
      top = rect.top + rect.height / 2 - size.height / 2;
      break;
    case "right":
      left = rect.left + rect.width + gap;
      top = rect.top + rect.height / 2 - size.height / 2;
      break;
  }

  left = clamp(left, margin, viewport.width - size.width - margin);
  top = clamp(top, margin, viewport.height - size.height - margin);

  const arrow: { left?: number; top?: number } = {};
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  if (placement === "top" || placement === "bottom") {
    arrow.left = clamp(centerX - left, ARROW_MARGIN, size.width - ARROW_MARGIN);
  } else {
    arrow.top = clamp(centerY - top, ARROW_MARGIN, size.height - ARROW_MARGIN);
  }

  return { top: Math.round(top), left: Math.round(left), placement, arrow };
}

/** 箭头在气泡上的定位样式 */
export function arrowStyleOf(
  result: PositionResult,
): CSSProperties {
  const { placement, arrow } = result;
  if (placement === "top") {
    return { bottom: "-6px", left: `${arrow.left ?? 0}px` };
  }
  if (placement === "bottom") {
    return { top: "-6px", left: `${arrow.left ?? 0}px` };
  }
  if (placement === "left") {
    return { right: "-6px", top: `${arrow.top ?? 0}px` };
  }
  return { left: "-6px", top: `${arrow.top ?? 0}px` };
}

/** 箭头朝向目标时可见的两条边 */
export function arrowBorderClassOf(placement: TourPlacement) {
  switch (placement) {
    case "top":
      return "border-r border-b";
    case "bottom":
      return "border-l border-t";
    case "left":
      return "border-r border-t";
    case "right":
      return "border-l border-b";
  }
}

/** 遮罩被高亮的区域：用超大的 box-shadow 铺满视口 */
export function highlightStyleOf(
  rect: Rect,
  padding: number,
  color: string,
  radius: string,
): CSSProperties {
  return {
    top: `${rect.top - padding}px`,
    left: `${rect.left - padding}px`,
    width: `${rect.width + padding * 2}px`,
    height: `${rect.height + padding * 2}px`,
    borderRadius: radius,
    boxShadow: `0 0 0 9999px ${color}`,
  };
}

/** 目标区域之外、用于拦截鼠标交互的四个透明遮罩块 */
export function blockersOf(
  rect: Rect,
  padding: number,
  viewport: Size,
  includeTarget: boolean,
): CSSProperties[] {
  const top = Math.max(rect.top - padding, 0);
  const left = Math.max(rect.left - padding, 0);
  const right = Math.min(rect.left + rect.width + padding, viewport.width);
  const bottom = Math.min(rect.top + rect.height + padding, viewport.height);
  const width = Math.max(right - left, 0);
  const height = Math.max(bottom - top, 0);

  const blocks: CSSProperties[] = [
    { top: 0, left: 0, width: "100%", height: `${top}px` },
    { top: `${bottom}px`, left: 0, width: "100%", height: `${Math.max(viewport.height - bottom, 0)}px` },
    { top: `${top}px`, left: 0, width: `${left}px`, height: `${height}px` },
    {
      top: `${top}px`,
      left: `${right}px`,
      width: `${Math.max(viewport.width - right, 0)}px`,
      height: `${height}px`,
    },
  ];

  if (includeTarget) {
    blocks.push({ top: `${top}px`, left: `${left}px`, width: `${width}px`, height: `${height}px` });
  }

  return blocks.filter((block) => block.height !== "0px" && block.width !== "0px");
}
