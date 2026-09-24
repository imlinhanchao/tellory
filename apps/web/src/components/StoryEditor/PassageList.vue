<template>
  <div class="passage-list-panel flex flex-col h-full overflow-hidden select-none">
    <!-- 头部栏：标题、数量与新增按钮 -->
    <div class="mb-3 flex items-center justify-between px-1 shrink-0">
      <h2 class="text-base font-bold flex items-center gap-1.5 text-base-content">
        <Icon icon="mdi:book-open-outline" class="w-4 h-4 text-primary" />
        <span>段落列表</span>
        <span class="badge badge-sm badge-ghost text-base-content/60 font-normal">
          {{ filteredPassages.length }}
        </span>
      </h2>
      <button
        v-if="!readOnly"
        class="btn btn-sm btn-primary gap-1"
        type="button"
        @click="emit('add')"
      >
        <Icon icon="mdi:plus" class="w-4 h-4" />
        <span>新增</span>
      </button>
    </div>

    <!-- 搜索过滤栏 -->
    <div class="relative mb-2.5 shrink-0">
      <div class="relative flex items-center">
        <Icon
          icon="mdi:magnify"
          class="absolute left-2.5 w-4 h-4 text-base-content/40 pointer-events-none"
        />
        <input
          v-model="searchFilter"
          placeholder="搜索段落名或 tag..."
          class="input input-sm input-bordered w-full pl-8 pr-7 text-xs bg-base-100"
        />
        <button
          v-if="searchFilter"
          type="button"
          class="absolute right-2 text-base-content/40 hover:text-base-content"
          title="清空搜索"
          @click="searchFilter = ''"
        >
          <Icon icon="mdi:close-circle" class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- 段落列表滚动区 -->
    <div
      ref="listRef"
      class="passage-scroll-list space-y-1.5 flex-1 overflow-y-auto min-h-0 pr-1"
    >
      <div
        v-if="filteredPassages.length === 0"
        class="flex flex-col items-center justify-center p-8 text-center text-base-content/50 space-y-2"
      >
        <Icon icon="mdi:file-document-outline" class="w-8 h-8 opacity-30" />
        <p class="text-xs">
          {{ searchFilter ? "未找到匹配的段落" : "暂无段落" }}
        </p>
      </div>

      <div
        v-for="(passage, index) in filteredPassages"
        :key="passage.name"
        :data-passage-index="index"
        :draggable="canDrag"
        class="passage-item-row group relative flex items-center gap-1.5 rounded-xl border px-2 py-1.5 transition-all text-left"
        :class="[
          selectedPassage === passage.name
            ? 'border-primary bg-primary/10 text-primary font-medium shadow-xs'
            : 'border-base-300 bg-base-200/50 hover:bg-base-200 hover:border-primary/50 text-base-content',
          draggingIndex === index ? 'opacity-35 scale-[0.98] border-dashed border-primary' : '',
        ]"
        @click="onSelect(passage.name)"
        @dragstart="onDragStart($event, index)"
        @dragover="onDragOver($event, index)"
        @dragleave="onDragLeave($event, index)"
        @drop="onDrop($event, index)"
        @dragend="onDragEnd"
      >
        <!-- 拖拽高亮插入位置指示线 -->
        <div
          v-if="dragOverIndex === index && dropPosition === 'before'"
          class="absolute -top-1 left-1 right-1 h-0.5 bg-primary rounded-full z-20 pointer-events-none shadow-sm"
        ></div>
        <div
          v-if="dragOverIndex === index && dropPosition === 'after'"
          class="absolute -bottom-1 left-1 right-1 h-0.5 bg-primary rounded-full z-20 pointer-events-none shadow-sm"
        ></div>

        <!-- 拖拽手柄（PC鼠标抓取 / 移动端触控触摸） -->
        <div
          v-if="!readOnly"
          class="touch-none flex items-center justify-center p-0.5 text-base-content/30 group-hover:text-base-content/70 hover:!text-primary shrink-0 transition-colors"
          :class="[
            canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-30',
          ]"
          title="按住拖拽排序"
          @touchstart.stop="onTouchStart($event, index)"
        >
          <Icon icon="mdi:drag-vertical" class="w-4 h-4 shrink-0" />
        </div>

        <!-- 段落图标（区分起始段落与常规段落） -->
        <div class="flex items-center justify-center shrink-0">
          <Icon
            v-if="passage.name === startPassage"
            icon="mdi:flag-checkered"
            class="w-4 h-4 text-warning"
            title="起始段落"
          />
          <Icon
            v-else
            icon="mdi:file-document-outline"
            class="w-4 h-4 text-base-content/40 group-hover:text-base-content/70"
          />
        </div>

        <!-- 段落名称 -->
        <span class="truncate flex-1 text-sm font-medium tracking-tight">
          {{ passage.name }}
        </span>

        <!-- 标签气泡提示（如有） -->
        <span
          v-if="passage.tags?.length"
          class="badge badge-xs badge-ghost text-base-content/50 shrink-0 font-normal hidden sm:inline-flex"
          :title="passage.tags.join(', ')"
        >
          {{ passage.tags[0] }}{{ passage.tags.length > 1 ? ` +${passage.tags.length - 1}` : "" }}
        </span>

        <!-- 复制段落名操作按钮 -->
        <button
          type="button"
          class="btn btn-ghost btn-xs btn-square shrink-0 text-base-content/40 hover:text-base-content opacity-50 group-hover:opacity-100 transition-opacity"
          title="复制段落名"
          @click.stop="copyPassageName(passage.name)"
        >
          <Icon icon="mdi:content-copy" class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from "vue";
import Icon from "@/components/Icon/src/Icon.vue";
import msg from "@/components/msg";

export interface PassageItem {
  name: string;
  tags?: string[];
  content?: string;
  [key: string]: any;
}

const props = withDefaults(
  defineProps<{
    startPassage?: string;
    readOnly?: boolean;
  }>(),
  {
    startPassage: "",
    readOnly: false,
  },
);

const passages = defineModel<PassageItem[]>("passages", { default: () => [] });
const selectedPassage = defineModel<string>("selectedPassage", { default: "" });

const emit = defineEmits<{
  (e: "add"): void;
  (e: "select", name: string): void;
  (e: "reorder", list: PassageItem[]): void;
}>();

// 搜索筛选状态
const searchFilter = ref("");
const listRef = ref<HTMLElement | null>(null);

// 过滤后的段落
const filteredPassages = computed(() => {
  const q = (searchFilter.value || "").trim().toLowerCase();
  if (!q) return passages.value;
  return passages.value.filter((p) => {
    if (p.name.toLowerCase().includes(q)) return true;
    for (const t of p.tags || []) {
      if (t.toLowerCase().includes(q)) return true;
    }
    return false;
  });
});

// 是否允许拖拽
const canDrag = computed(() => !props.readOnly && passages.value.length > 1);

// 选中段落
const onSelect = (name: string) => {
  selectedPassage.value = name;
  emit("select", name);
};

// 复制段落名称
const copyPassageName = async (name: string) => {
  if (!name) return;
  try {
    await navigator.clipboard.writeText(name);
    msg.success("已复制段落名");
  } catch {
    window.prompt("请复制段落名：", name);
  }
};

// ----------------------------------------------------
// 拖拽排序逻辑 (PC HTML5 Drag & Drop + 移动端 Touch 事件)
// ----------------------------------------------------
const draggingIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);
const dropPosition = ref<"before" | "after" | null>(null);
const isTouchDragging = ref(false);

/** 执行数组重排 */
const executeReorder = (
  fromFilteredIdx: number,
  toFilteredIdx: number,
  position: "before" | "after",
) => {
  const fromItem = filteredPassages.value[fromFilteredIdx];
  const toItem = filteredPassages.value[toFilteredIdx];
  if (!fromItem || !toItem || fromItem.name === toItem.name) return;

  const currentList = [...passages.value];
  const fullFromIdx = currentList.findIndex((p) => p.name === fromItem.name);
  const fullToIdx = currentList.findIndex((p) => p.name === toItem.name);
  if (fullFromIdx === -1 || fullToIdx === -1) return;

  const [moved] = currentList.splice(fullFromIdx, 1);
  let insertIdx = currentList.findIndex((p) => p.name === toItem.name);
  if (position === "after") {
    insertIdx += 1;
  }
  currentList.splice(insertIdx, 0, moved);

  passages.value = currentList;
  emit("reorder", currentList);
};

// --- PC 端 HTML5 拖拽事件 ---
const onDragStart = (e: DragEvent, index: number) => {
  if (!canDrag.value) return;
  draggingIndex.value = index;
  dragOverIndex.value = index;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", filteredPassages.value[index]?.name || "");
  }
};

const onDragOver = (e: DragEvent, index: number) => {
  if (draggingIndex.value === null || !canDrag.value) return;
  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = "move";
  }

  const target = e.currentTarget as HTMLElement | null;
  if (target) {
    const rect = target.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    dragOverIndex.value = index;
    dropPosition.value = e.clientY < midY ? "before" : "after";
  }
};

const onDragLeave = (e: DragEvent, index: number) => {
  const related = e.relatedTarget as HTMLElement | null;
  const current = e.currentTarget as HTMLElement | null;
  if (current && related && current.contains(related)) {
    return;
  }
  if (dragOverIndex.value === index) {
    dragOverIndex.value = null;
    dropPosition.value = null;
  }
};

const onDrop = (e: DragEvent, index: number) => {
  e.preventDefault();
  if (
    draggingIndex.value !== null &&
    (draggingIndex.value !== index || dropPosition.value !== null)
  ) {
    executeReorder(draggingIndex.value, index, dropPosition.value || "after");
  }
  draggingIndex.value = null;
  dragOverIndex.value = null;
  dropPosition.value = null;
};

const onDragEnd = () => {
  draggingIndex.value = null;
  dragOverIndex.value = null;
  dropPosition.value = null;
};

// --- 移动端触控 Touch 拖拽事件 ---
const onTouchStart = (e: TouchEvent, index: number) => {
  if (!canDrag.value) return;
  const touch = e.touches[0];
  if (!touch) return;

  isTouchDragging.value = true;
  draggingIndex.value = index;
  dragOverIndex.value = index;
  dropPosition.value = null;

  window.addEventListener("touchmove", onWindowTouchMove, { passive: false });
  window.addEventListener("touchend", onWindowTouchEnd);
  window.addEventListener("touchcancel", onWindowTouchCancel);
};

const onWindowTouchMove = (e: TouchEvent) => {
  if (!isTouchDragging.value || draggingIndex.value === null) return;
  e.preventDefault(); // 阻止手机端拖动手柄时默认页面滚动
  const touch = e.touches[0];
  if (!touch) return;

  const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
  const itemEl = targetEl?.closest("[data-passage-index]") as HTMLElement | null;
  if (itemEl && itemEl.dataset.passageIndex !== undefined) {
    const overIdx = parseInt(itemEl.dataset.passageIndex, 10);
    if (!isNaN(overIdx)) {
      const rect = itemEl.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      dragOverIndex.value = overIdx;
      dropPosition.value = touch.clientY < midY ? "before" : "after";
    }
  }

  // 接近顶部或底部时自动滚动容器
  if (listRef.value) {
    const rect = listRef.value.getBoundingClientRect();
    if (touch.clientY < rect.top + 35) {
      listRef.value.scrollTop -= 8;
    } else if (touch.clientY > rect.bottom - 35) {
      listRef.value.scrollTop += 8;
    }
  }
};

const onWindowTouchEnd = () => {
  cleanUpTouchListeners();
  if (
    isTouchDragging.value &&
    draggingIndex.value !== null &&
    dragOverIndex.value !== null &&
    (draggingIndex.value !== dragOverIndex.value || dropPosition.value !== null)
  ) {
    executeReorder(
      draggingIndex.value,
      dragOverIndex.value,
      dropPosition.value || "after",
    );
  }
  isTouchDragging.value = false;
  draggingIndex.value = null;
  dragOverIndex.value = null;
  dropPosition.value = null;
};

const onWindowTouchCancel = () => {
  cleanUpTouchListeners();
  isTouchDragging.value = false;
  draggingIndex.value = null;
  dragOverIndex.value = null;
  dropPosition.value = null;
};

const cleanUpTouchListeners = () => {
  window.removeEventListener("touchmove", onWindowTouchMove);
  window.removeEventListener("touchend", onWindowTouchEnd);
  window.removeEventListener("touchcancel", onWindowTouchCancel);
};

onBeforeUnmount(() => {
  cleanUpTouchListeners();
});
</script>

<style scoped>
.passage-scroll-list::-webkit-scrollbar {
  width: 4px;
}
.passage-scroll-list::-webkit-scrollbar-thumb {
  background-color: rgba(150, 150, 150, 0.25);
  border-radius: 9999px;
}
.passage-scroll-list::-webkit-scrollbar-thumb:hover {
  background-color: rgba(150, 150, 150, 0.45);
}
</style>
