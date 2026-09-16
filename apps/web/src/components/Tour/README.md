# Tour 漫游式引导

参考 Element Plus `Tour` 实现的通用分步引导组件：用遮罩高亮目标元素，气泡跟随目标展示说明并驱动步骤流转。

## 两种用法

### 1. 声明式（组件已在 `components/index.ts` 中按文件夹名全局注册为 `Tour`）

```vue
<script setup lang="ts">
import { ref } from "vue";

const open = ref(false);
const current = ref(0);

const steps = [
  { target: "#logo", title: "回到首页", description: "点击左上角 Logo 可以随时返回。" },
  { target: "#editor-toolbar", title: "工具栏", description: "这里集中了常用的编辑操作。" },
  { title: "开始创作", description: "一切就绪，动手写第一个故事吧。" },
];
</script>

<template>
  <button class="btn" @click="open = true">新手引导</button>

  <Tour
    v-model="open"
    v-model:current="current"
    :steps="steps"
    placement="bottom"
    @finish="console.log('走完了')"
    @close="(i) => console.log('在第', i, '步关闭')"
  />
</template>
```

### 2. 命令式（`useTour`）

```ts
import { useTour } from "@/components/Tour";

const tour = useTour({ placement: "bottom" });

const result = await tour.start([
  { target: "#logo", title: "回到首页" },
  { target: "#help", title: "需要帮助？", description: "随时查看使用说明" },
]);
// result: "finish" | "close"
```

## 属性

| 属性 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `modelValue` | 是否展示，支持 `v-model` | `boolean` | `false` |
| `steps` | 步骤列表 | `TourStep[]` | `[]` |
| `current` | 当前步骤下标，支持 `v-model:current` | `number` | `0` |
| `placement` | 气泡位置 | `top \| bottom \| left \| right` | `bottom` |
| `gap` | 气泡与目标的间距（px） | `number` | `12` |
| `width` | 气泡宽度，数字按 px | `number \| string` | `320` |
| `zIndex` | 层级 | `number` | `3000` |
| `mask` | 遮罩开关，或 `{ color, padding }` | `boolean \| TourMaskOptions` | `true` |
| `showArrow` | 是否显示箭头 | `boolean` | `true` |
| `showClose` | 是否显示关闭按钮 | `boolean` | `true` |
| `showIndicators` | 是否显示步骤指示点 | `boolean` | `true` |
| `indicatorPosition` | 指示点位置：与按钮同行 / 单独一行 | `inline \| bottom` | `inline` |
| `scrollIntoView` | 步骤切换时把目标滚动到可视区域 | `boolean` | `true` |
| `closeOnPressEscape` | 按 Esc 关闭 | `boolean` | `true` |
| `closeOnClickOutside` | 点击遮罩关闭 | `boolean` | `false` |
| `blockInteraction` | 遮罩是否拦截页面其它区域的鼠标交互 | `boolean` | `true` |
| `targetAreaClickable` | 高亮区域内的目标元素是否可点击 | `boolean` | `true` |
| `appendTo` | Teleport 目标 | `string \| HTMLElement` | `body` |
| `focusTrap` | 把焦点限制在气泡内 | `boolean` | `true` |
| `nextText` / `prevText` / `finishText` | 按钮文案 | `string` | 下一步 / 上一步 / 完成 |
| `popperClass` | 追加到气泡的类名 | `string` | `""` |

## 步骤配置 `TourStep`

| 字段 | 说明 |
| --- | --- |
| `target` | CSS 选择器、DOM 元素，或返回它们的函数；留空则气泡居中展示 |
| `title` / `description` | 标题与描述 |
| `slot` | 用同名具名插槽自定义该步骤内容 |
| `placement` | `top \| bottom \| left \| right \| center`，`center` 表示居中且不显示高亮 |
| `gap` / `width` / `mask` / `showArrow` / `showClose` | 覆盖同名全局属性 |
| `scrollIntoView` / `targetAreaClickable` | 覆盖同名全局属性 |
| `nextText` / `prevText` / `finishText` | 覆盖按钮文案 |
| `popperClass` | 追加类名 |
| `data` | 透传给插槽的任意数据 |
| `beforeEnter` | 进入该步骤前调用，返回 `false` 则跳过该步骤 |
| `beforeLeave` | 离开该步骤前调用，返回 `false` 则阻止离开 |

## 事件

| 事件 | 说明 |
| --- | --- |
| `update:modelValue` | 展示状态变化 |
| `update:current` | 当前步骤变化 |
| `change` | 步骤切换：`(current, prev)` |
| `close` | 关闭：`(current)` |
| `finish` | 走完最后一步 |
| `maskClick` | 点击遮罩区域：`(MouseEvent)` |

## 插槽

| 插槽 | 作用域 | 说明 |
| --- | --- | --- |
| `default` | `{ current, total, step, isFirst, isLast, next, prev, close, goTo }` | 气泡内容 |
| `indicators` | 同上 | 自定义步骤指示点 |
| `prev-button` / `next-button` | 同上 | 自定义底部按钮 |

## 行为说明

- 空间不足时气泡会自动翻转到对侧（`bottom → top` 等），并保证不超出视口。
- 遮罩用「目标区域 + 超大 box-shadow」实现，高亮圆角取自目标元素自身的 `border-radius`；滚动或窗口缩放时会实时跟随（监听 `scroll`/`resize`/`ResizeObserver`）。
- 遮罩的点击拦截由四块透明区域完成，因此高亮区域内的目标元素依旧可以点击（可用 `targetAreaClickable` 关闭）。
- 步骤指示点 hover（或键盘聚焦）时用 tooltip 显示该步骤标题，便于直接跳到想看的某一步。
- 键盘操作：`Esc` 关闭、`←/→` 上一步/下一步、`Tab` 在气泡内循环（`focusTrap` 开启时）；步骤切换后焦点会落在气泡上，关闭时归还给触发元素。

## 文件

- `src/Tour.vue`：组件实现
- `src/position.ts`：方向决策、位置与遮罩计算（纯函数，便于单测）
- `src/types.ts`：类型定义
- `useTour.ts`：命令式 API
