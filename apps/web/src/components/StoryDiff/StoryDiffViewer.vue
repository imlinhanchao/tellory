<template>
  <div class="space-y-4">
    <!-- 顶部概览与控制栏 -->
    <div
      class="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-base-200/50 p-3 sm:p-4 rounded-xl border border-base-200"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"
        >
          <Icon icon="mdi:compare" class="w-6 h-6" />
        </div>
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-bold text-sm sm:text-base text-base-content">
              {{ oldLabel || "旧版本" }}
            </span>
            <Icon icon="mdi:arrow-right" class="w-4 h-4 text-base-content/40" />
            <span class="font-bold text-sm sm:text-base text-primary">
              {{ newLabel || "新版本" }}
            </span>
          </div>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-base-content/60 mt-0.5">
            <span v-if="oldMeta">{{ oldMeta }}</span>
            <span v-if="oldMeta && newMeta">·</span>
            <span v-if="newMeta">{{ newMeta }}</span>
          </div>
        </div>
      </div>

      <!-- 比对设置与过滤 -->
      <div class="flex flex-wrap items-center gap-2">
        <select
          v-model="diffLayout"
          class="select select-bordered select-xs"
          title="对比布局"
        >
          <option value="side-by-side">并排对比</option>
          <option value="line-by-line">逐行对比</option>
        </select>
        <select
          v-model="diffStyle"
          class="select select-bordered select-xs"
          title="对比粒度"
        >
          <option value="word">按词对比</option>
          <option value="char">按字符对比</option>
        </select>
        <select
          v-model="passageFilter"
          class="select select-bordered select-xs"
          title="段落过滤"
        >
          <option value="diff">仅有差异段落 ({{ diffPassageCount }})</option>
          <option value="modified">仅修改段落 ({{ modifiedCount }})</option>
          <option value="added">仅新增段落 ({{ addedCount }})</option>
          <option value="deleted">仅删除段落 ({{ deletedCount }})</option>
          <option value="all">全部段落 ({{ allPassageCount }})</option>
        </select>
        <div class="join">
          <button
            type="button"
            class="btn btn-ghost btn-xs join-item"
            title="全部展开"
            @click="expandAllPassages"
          >
            <Icon icon="mdi:unfold-more-horizontal" class="w-4 h-4" />
            展开
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-xs join-item"
            title="全部折叠"
            @click="collapseAllPassages"
          >
            <Icon icon="mdi:unfold-less-horizontal" class="w-4 h-4" />
            折叠
          </button>
        </div>
      </div>
    </div>

    <!-- 差异统计条 -->
    <div
      v-if="hasAnyDiff"
      class="flex flex-wrap items-center gap-2 text-xs text-base-content/70 px-1"
    >
      <span class="font-medium">变更汇总：</span>
      <span
        v-if="hasPropertyDiff"
        class="badge badge-sm badge-info badge-soft gap-1"
      >
        <Icon icon="mdi:tune" class="w-3 h-3" />
        属性变更 {{ propertyDiffCount }} 项
      </span>
      <span
        v-if="modifiedCount > 0"
        class="badge badge-sm badge-warning badge-soft gap-1"
      >
        <Icon icon="mdi:pencil-outline" class="w-3 h-3" />
        修改段落 {{ modifiedCount }}
      </span>
      <span
        v-if="addedCount > 0"
        class="badge badge-sm badge-success badge-soft gap-1"
      >
        <Icon icon="mdi:plus-circle-outline" class="w-3 h-3" />
        新增段落 {{ addedCount }}
      </span>
      <span
        v-if="deletedCount > 0"
        class="badge badge-sm badge-error badge-soft gap-1"
      >
        <Icon icon="mdi:minus-circle-outline" class="w-3 h-3" />
        删除段落 {{ deletedCount }}
      </span>
      <span
        v-if="unchangedCount > 0"
        class="badge badge-sm badge-ghost gap-1"
      >
        未修改段落 {{ unchangedCount }}
      </span>
    </div>

    <!-- 无任何差异提示 -->
    <div
      v-if="!hasAnyDiff"
      class="rounded-2xl border border-dashed border-base-300 py-12 px-4 text-center bg-base-100"
    >
      <div
        class="w-12 h-12 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto mb-3"
      >
        <Icon icon="mdi:check-circle-outline" class="w-7 h-7" />
      </div>
      <h3 class="font-bold text-base text-base-content">
        两个版本完全一致
      </h3>
      <p class="text-xs text-base-content/60 mt-1 max-w-sm mx-auto">
        标题、标签、描述、起始章节以及所有段落源码均相同，未发现任何差异。
      </p>
    </div>

    <!-- 1. 属性差异比对区（仅当对应属性有差异时展示） -->
    <div v-if="hasPropertyDiff" class="space-y-3">
      <div class="flex items-center gap-2 font-bold text-sm text-base-content">
        <Icon icon="mdi:tune" class="w-4 h-4 text-primary" />
        <span>故事属性差异</span>
      </div>

      <div class="grid grid-cols-1 gap-3">
        <!-- 标题差异 -->
        <div
          v-if="isTitleDiff"
          class="card bg-base-100 border border-base-200 shadow-2xs rounded-xl overflow-hidden"
        >
          <div class="card-body p-3.5 sm:p-4 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-base-content/70 flex items-center gap-1.5">
                <Icon icon="mdi:format-title" class="w-4 h-4 text-primary" />
                故事标题
              </span>
              <span class="badge badge-warning badge-soft badge-xs">已修改</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div class="bg-error/5 border border-error/20 p-2.5 rounded-lg text-error">
                <div class="text-[10px] text-error/60 mb-0.5">原标题</div>
                <div class="font-medium line-through">{{ oldStory.title || "（无标题）" }}</div>
              </div>
              <div class="bg-success/5 border border-success/20 p-2.5 rounded-lg text-success">
                <div class="text-[10px] text-success/60 mb-0.5">新标题</div>
                <div class="font-medium">{{ newStory.title || "（无标题）" }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 标签差异 -->
        <div
          v-if="isTagsDiff"
          class="card bg-base-100 border border-base-200 shadow-2xs rounded-xl overflow-hidden"
        >
          <div class="card-body p-3.5 sm:p-4 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-base-content/70 flex items-center gap-1.5">
                <Icon icon="mdi:tag-multiple-outline" class="w-4 h-4 text-primary" />
                故事标签
              </span>
              <span class="badge badge-warning badge-soft badge-xs">已修改</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div class="bg-error/5 border border-error/20 p-2.5 rounded-lg space-y-1.5">
                <div class="text-[10px] text-error/60">原标签</div>
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="t in oldStory.tags || []"
                    :key="t"
                    class="badge badge-xs badge-error badge-soft"
                  >
                    {{ t }}
                  </span>
                  <span
                    v-if="!(oldStory.tags && oldStory.tags.length)"
                    class="text-base-content/40 text-[11px]"
                  >
                    无标签
                  </span>
                </div>
              </div>
              <div class="bg-success/5 border border-success/20 p-2.5 rounded-lg space-y-1.5">
                <div class="text-[10px] text-success/60">新标签</div>
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="t in newStory.tags || []"
                    :key="t"
                    class="badge badge-xs badge-success badge-soft"
                  >
                    {{ t }}
                  </span>
                  <span
                    v-if="!(newStory.tags && newStory.tags.length)"
                    class="text-base-content/40 text-[11px]"
                  >
                    无标签
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 起始章节差异 -->
        <div
          v-if="isStartPassageDiff"
          class="card bg-base-100 border border-base-200 shadow-2xs rounded-xl overflow-hidden"
        >
          <div class="card-body p-3.5 sm:p-4 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-base-content/70 flex items-center gap-1.5">
                <Icon icon="mdi:flag-outline" class="w-4 h-4 text-primary" />
                起始章节
              </span>
              <span class="badge badge-warning badge-soft badge-xs">已修改</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div class="bg-error/5 border border-error/20 p-2.5 rounded-lg text-error">
                <div class="text-[10px] text-error/60 mb-0.5">原起始章节</div>
                <div class="font-mono font-medium line-through">{{ oldStory.startPassage }}</div>
              </div>
              <div class="bg-success/5 border border-success/20 p-2.5 rounded-lg text-success">
                <div class="text-[10px] text-success/60 mb-0.5">新起始章节</div>
                <div class="font-mono font-medium">{{ newStory.startPassage }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 描述差异 -->
        <div
          v-if="isDescDiff"
          class="card bg-base-100 border border-base-200 shadow-2xs rounded-xl overflow-hidden"
        >
          <div class="card-body p-3.5 sm:p-4 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-base-content/70 flex items-center gap-1.5">
                <Icon icon="mdi:text" class="w-4 h-4 text-primary" />
                故事描述
              </span>
              <span class="badge badge-warning badge-soft badge-xs">已修改</span>
            </div>
            <div class="overflow-x-auto rounded-lg border border-base-200">
              <CodeDiff
                :old-string="oldStory.description || ''"
                :new-string="newStory.description || ''"
                language="plaintext"
                :output-format="diffLayout"
                :diff-style="diffStyle"
                :theme="isDark ? 'dark' : 'light'"
                filename="故事描述"
                max-height="240px"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. 段落列表差异比对区（每个段落单独的差异比对界面） -->
    <div v-if="filteredPassages.length > 0" class="space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 font-bold text-sm text-base-content">
          <Icon icon="mdi:book-open-page-variant-outline" class="w-4 h-4 text-primary" />
          <span>段落差异比对 ({{ filteredPassages.length }})</span>
        </div>
        <span class="text-xs text-base-content/50">
          点击段落标题栏可收起或展开
        </span>
      </div>

      <div class="space-y-3">
        <div
          v-for="p in filteredPassages"
          :key="p.name"
          class="card bg-base-100 border border-base-200 shadow-2xs rounded-xl overflow-hidden"
        >
          <!-- 段落标题卡片头（可折叠） -->
          <div
            class="flex items-center justify-between gap-3 p-3 sm:p-3.5 cursor-pointer select-none transition-colors hover:bg-base-200/40"
            @click="togglePassageCollapse(p.name)"
          >
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <button
                type="button"
                class="btn btn-ghost btn-xs btn-circle shrink-0"
                tabindex="-1"
              >
                <Icon
                  :icon="isPassageCollapsed(p.name) ? 'mdi:chevron-right' : 'mdi:chevron-down'"
                  class="w-4 h-4 text-base-content/60"
                />
              </button>
              <span class="font-mono font-bold text-sm text-base-content truncate">
                {{ p.name }}
              </span>
              <span
                class="badge badge-xs sm:badge-sm shrink-0 font-medium"
                :class="statusBadgeClass(p.status)"
              >
                {{ statusLabel(p.status) }}
              </span>
              <span
                v-if="p.tagsChanged"
                class="badge badge-xs badge-info badge-soft shrink-0"
              >
                标签变动
              </span>
            </div>

            <div class="flex items-center gap-2 text-xs text-base-content/50 shrink-0">
              <span v-if="p.status === 'unchanged'" class="text-[11px]">无修改</span>
              <Icon
                :icon="isPassageCollapsed(p.name) ? 'mdi:eye-off-outline' : 'mdi:eye-outline'"
                class="w-4 h-4 text-base-content/40"
              />
            </div>
          </div>

          <!-- 段落展开内容体 -->
          <div
            v-if="!isPassageCollapsed(p.name)"
            class="border-t border-base-200 p-3 sm:p-4 space-y-3 bg-base-100"
          >
            <!-- 段落标签变动提示 -->
            <div
              v-if="p.tagsChanged"
              class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-base-200/40 p-2.5 rounded-lg border border-base-200"
            >
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-error/70 text-[10px] shrink-0 font-medium">原标签：</span>
                <span
                  v-for="t in p.oldTags"
                  :key="t"
                  class="badge badge-xs badge-error badge-soft"
                >
                  {{ t }}
                </span>
                <span v-if="!p.oldTags.length" class="text-base-content/40 text-[11px]">无</span>
              </div>
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-success/70 text-[10px] shrink-0 font-medium">新标签：</span>
                <span
                  v-for="t in p.newTags"
                  :key="t"
                  class="badge badge-xs badge-success badge-soft"
                >
                  {{ t }}
                </span>
                <span v-if="!p.newTags.length" class="text-base-content/40 text-[11px]">无</span>
              </div>
            </div>

            <!-- 段落源码内容独立比对 -->
            <div class="overflow-x-auto rounded-lg border border-base-200">
              <CodeDiff
                :old-string="p.oldPassage?.content || ''"
                :new-string="p.newPassage?.content || ''"
                language="plaintext"
                :output-format="diffLayout"
                :diff-style="diffStyle"
                :theme="isDark ? 'dark' : 'light'"
                :filename="p.name"
                max-height="460px"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 筛选后无符合条件的段落 -->
    <div
      v-else-if="hasAnyDiff && filteredPassages.length === 0"
      class="rounded-xl border border-dashed border-base-200 py-8 text-center text-xs text-base-content/50"
    >
      当前筛选条件下无段落（可切换筛选条件查看）
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Icon } from "@iconify/vue";
import { CodeDiff } from "v-code-diff/vue3";
import { parseStorySource, type StoryData, type StoryPassage } from "tellory";
import { useAppStore } from "@/stores/modules/app";

export type PassageDiffStatus = "modified" | "added" | "deleted" | "unchanged";

export interface PassageDiffItem {
  name: string;
  status: PassageDiffStatus;
  oldPassage?: StoryPassage;
  newPassage?: StoryPassage;
  contentChanged: boolean;
  tagsChanged: boolean;
  oldTags: string[];
  newTags: string[];
}

const props = withDefaults(
  defineProps<{
    oldContent?: string;
    newContent?: string;
    oldLabel?: string;
    newLabel?: string;
    oldMeta?: string;
    newMeta?: string;
  }>(),
  {
    oldContent: "",
    newContent: "",
    oldLabel: "旧版本",
    newLabel: "新版本",
    oldMeta: "",
    newMeta: "",
  },
);

const appStore = useAppStore();
const isDark = computed(() => appStore.getTheme === "dark");

const diffLayout = ref<"side-by-side" | "line-by-line">("side-by-side");
const diffStyle = ref<"word" | "char">("word");
const passageFilter = ref<"diff" | "modified" | "added" | "deleted" | "all">(
  "diff",
);

/** 折叠状态集合：记录被折叠的段落名 */
const collapsedPassages = ref<Set<string>>(new Set());

/** 安全解析 StoryData */
const parseSafe = (source: string): StoryData => {
  try {
    return parseStorySource(source || "");
  } catch (e) {
    console.error("[StoryDiffViewer] parseStorySource failed", e);
    return {
      title: "解析失败",
      startPassage: "Start",
      passages: [],
    };
  }
};

const oldStory = computed(() => parseSafe(props.oldContent));
const newStory = computed(() => parseSafe(props.newContent));

// --- 属性差异比对 ---
const isTitleDiff = computed(() => {
  return (oldStory.value.title || "").trim() !== (newStory.value.title || "").trim();
});

const isTagsDiff = computed(() => {
  const oldTags = (oldStory.value.tags || []).map((t) => t.trim()).filter(Boolean);
  const newTags = (newStory.value.tags || []).map((t) => t.trim()).filter(Boolean);
  return oldTags.join(",") !== newTags.join(",");
});

const isStartPassageDiff = computed(() => {
  return (
    (oldStory.value.startPassage || "").trim() !==
    (newStory.value.startPassage || "").trim()
  );
});

const isDescDiff = computed(() => {
  return (
    (oldStory.value.description || "").trim() !==
    (newStory.value.description || "").trim()
  );
});

const propertyDiffCount = computed(() => {
  let count = 0;
  if (isTitleDiff.value) count++;
  if (isTagsDiff.value) count++;
  if (isStartPassageDiff.value) count++;
  if (isDescDiff.value) count++;
  return count;
});

const hasPropertyDiff = computed(() => propertyDiffCount.value > 0);

// --- 段落差异比对 ---
const passageDiffList = computed<PassageDiffItem[]>(() => {
  const oldPassages = oldStory.value.passages || [];
  const newPassages = newStory.value.passages || [];

  const oldMap = new Map<string, StoryPassage>(
    oldPassages.map((p) => [p.name, p]),
  );
  const newMap = new Map<string, StoryPassage>(
    newPassages.map((p) => [p.name, p]),
  );

  // 保持按出现顺序遍历：先保留旧版的顺序，后面追加新版新增的段落
  const allNames = Array.from(
    new Set([
      ...oldPassages.map((p) => p.name),
      ...newPassages.map((p) => p.name),
    ]),
  );

  return allNames.map((name): PassageDiffItem => {
    const oldP = oldMap.get(name);
    const newP = newMap.get(name);

    const oldTags = (oldP?.tags || []).map((t) => t.trim()).filter(Boolean);
    const newTags = (newP?.tags || []).map((t) => t.trim()).filter(Boolean);
    const tagsChanged = oldTags.join(",") !== newTags.join(",");

    if (!oldP && newP) {
      return {
        name,
        status: "added",
        oldPassage: undefined,
        newPassage: newP,
        contentChanged: true,
        tagsChanged: newTags.length > 0,
        oldTags: [],
        newTags,
      };
    }

    if (oldP && !newP) {
      return {
        name,
        status: "deleted",
        oldPassage: oldP,
        newPassage: undefined,
        contentChanged: true,
        tagsChanged: oldTags.length > 0,
        oldTags,
        newTags: [],
      };
    }

    const contentChanged = (oldP?.content ?? "") !== (newP?.content ?? "");
    const status: PassageDiffStatus =
      contentChanged || tagsChanged ? "modified" : "unchanged";

    return {
      name,
      status,
      oldPassage: oldP,
      newPassage: newP,
      contentChanged,
      tagsChanged,
      oldTags,
      newTags,
    };
  });
});

const allPassageCount = computed(() => passageDiffList.value.length);
const modifiedCount = computed(
  () => passageDiffList.value.filter((p) => p.status === "modified").length,
);
const addedCount = computed(
  () => passageDiffList.value.filter((p) => p.status === "added").length,
);
const deletedCount = computed(
  () => passageDiffList.value.filter((p) => p.status === "deleted").length,
);
const unchangedCount = computed(
  () => passageDiffList.value.filter((p) => p.status === "unchanged").length,
);
const diffPassageCount = computed(
  () => modifiedCount.value + addedCount.value + deletedCount.value,
);

const hasAnyDiff = computed(
  () => hasPropertyDiff.value || diffPassageCount.value > 0,
);

const filteredPassages = computed(() => {
  switch (passageFilter.value) {
    case "modified":
      return passageDiffList.value.filter((p) => p.status === "modified");
    case "added":
      return passageDiffList.value.filter((p) => p.status === "added");
    case "deleted":
      return passageDiffList.value.filter((p) => p.status === "deleted");
    case "all":
      return passageDiffList.value;
    case "diff":
    default:
      return passageDiffList.value.filter((p) => p.status !== "unchanged");
  }
});

// 折叠状态控制
const isPassageCollapsed = (name: string) => {
  return collapsedPassages.value.has(name);
};

const togglePassageCollapse = (name: string) => {
  if (collapsedPassages.value.has(name)) {
    collapsedPassages.value.delete(name);
  } else {
    collapsedPassages.value.add(name);
  }
};

const expandAllPassages = () => {
  collapsedPassages.value.clear();
};

const collapseAllPassages = () => {
  collapsedPassages.value = new Set(passageDiffList.value.map((p) => p.name));
};

// 状态样式
const statusLabel = (status: PassageDiffStatus) => {
  switch (status) {
    case "modified":
      return "修改";
    case "added":
      return "新增";
    case "deleted":
      return "删除";
    case "unchanged":
      return "未修改";
  }
};

const statusBadgeClass = (status: PassageDiffStatus) => {
  switch (status) {
    case "modified":
      return "badge-warning badge-soft";
    case "added":
      return "badge-success badge-soft";
    case "deleted":
      return "badge-error badge-soft";
    case "unchanged":
      return "badge-ghost opacity-60";
  }
};

// 当内容变动时，默认展开所有有变动的段落，折叠未变动的段落
watch(
  () => [props.oldContent, props.newContent],
  () => {
    collapsedPassages.value = new Set(
      passageDiffList.value
        .filter((p) => p.status === "unchanged")
        .map((p) => p.name),
    );
  },
  { immediate: true },
);
</script>
