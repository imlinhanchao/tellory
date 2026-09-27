<template>
  <div class="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
    <!-- 头部 -->
    <div
      class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-base-100 p-4 sm:p-5 rounded-2xl border border-base-200/80 shadow-2xs"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"
        >
          <Icon icon="mdi:history" class="w-6 h-6" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-xl font-bold text-base-content tracking-tight">
              故事历史版本
            </h2>
            <span class="badge badge-primary badge-soft badge-xs">管理员</span>
          </div>
          <p class="text-xs text-base-content/60 mt-0.5">
            {{ story?.title || "加载中…" }}
            <span v-if="story?.shortname" class="font-mono">（{{ story?.shortname }}）</span>
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <div class="text-xs text-base-content/60 mr-2">
          共 <strong class="text-base-content font-semibold">{{ total }}</strong> 个历史版本
        </div>
        <button type="button" class="btn btn-sm btn-ghost" @click="goBack">
          <Icon icon="mdi:arrow-left" class="w-4 h-4" />
          返回
        </button>
      </div>
    </div>

    <!-- 操作栏 -->
    <div class="card bg-base-100 border border-base-200/80 rounded-2xl">
      <div class="card-body p-4 sm:p-5">
        <div
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div class="text-xs text-base-content/60 flex items-center gap-2">
            <Icon icon="mdi:information-outline" class="w-4 h-4 text-primary shrink-0" />
            <span>勾选两个版本（可包含当前版本）后点击「比对选中版本」，将对比 content 字段差异</span>
            <span class="badge badge-ghost badge-sm shrink-0">已选 {{ selected.length }}/2</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button
              type="button"
              class="btn btn-sm btn-ghost"
              :disabled="selected.length === 0"
              @click="clearSelection"
            >
              清空选择
            </button>
            <button
              type="button"
              class="btn btn-sm btn-primary"
              :disabled="selected.length !== 2"
              @click="openCompare"
            >
              <Icon icon="mdi:compare" class="w-4 h-4" />
              比对选中版本
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 版本列表 -->
    <div v-if="loading && rows.length === 0 && !story" class="space-y-3">
      <div
        v-for="n in 4"
        :key="n"
        class="card bg-base-100 border border-base-200/80 p-4 rounded-xl"
      >
        <div class="skeleton h-5 w-1/3 mb-3"></div>
        <div class="skeleton h-4 w-full"></div>
      </div>
    </div>

    <div
      v-else
      class="card bg-base-100 border border-base-200/80 rounded-2xl overflow-hidden"
    >
      <div class="overflow-x-auto">
        <table class="table table-zebra table-sm sm:table-md">
          <thead>
            <tr>
              <th class="w-10"></th>
              <th>版本</th>
              <th>归档时间</th>
              <th>标题</th>
              <th>短名</th>
              <th>段落</th>
              <th>审核人</th>
              <th class="text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <!-- 当前版本 -->
            <tr v-if="story">
              <td>
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm checkbox-primary"
                  :checked="selected.includes(CURRENT_KEY)"
                  :disabled="
                    !selected.includes(CURRENT_KEY) && selected.length >= 2
                  "
                  @change="toggleSelect(CURRENT_KEY)"
                />
              </td>
              <td>
                <div class="flex flex-col">
                  <span class="badge badge-success badge-soft badge-sm w-fit">当前版本</span>
                  <span class="text-xs text-base-content/60 mt-1">
                    更新于 {{ formatTime(story.updatedAt) }}
                  </span>
                </div>
              </td>
              <td class="text-xs text-base-content/50">-</td>
              <td class="text-sm max-w-56 truncate" :title="story.title">
                {{ story.title || "-" }}
              </td>
              <td class="text-xs font-mono">{{ story.shortname || "-" }}</td>
              <td class="text-sm">{{ story.passageSize ?? "-" }}</td>
              <td class="text-sm">-</td>
              <td>
                <div class="flex justify-end">
                  <button
                    type="button"
                    class="btn btn-xs btn-primary"
                    @click="openContent(CURRENT_KEY)"
                  >
                    查看内容
                  </button>
                </div>
              </td>
            </tr>

            <!-- 历史版本 -->
            <tr v-for="item in rows" :key="item.id">
              <td>
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm checkbox-primary"
                  :checked="selected.includes(item.id)"
                  :disabled="!selected.includes(item.id) && selected.length >= 2"
                  @change="toggleSelect(item.id)"
                />
              </td>
              <td>
                <div class="flex flex-col">
                  <span class="text-sm">历史版本</span>
                  <span class="text-xs text-base-content/60 mt-0.5">
                    通过于 {{ formatTime(item.approvedAt) }}
                  </span>
                </div>
              </td>
              <td class="text-xs text-base-content/70 whitespace-nowrap">
                {{ formatTime(item.archivedAt) }}
              </td>
              <td class="text-sm max-w-56 truncate" :title="item.title">
                {{ item.title || "-" }}
              </td>
              <td class="text-xs font-mono">{{ item.shortname || "-" }}</td>
              <td class="text-sm">{{ item.passageSize ?? "-" }}</td>
              <td class="text-sm">
                {{
                  item.approvedByUser?.nickname ||
                  item.approvedByUser?.username ||
                  item.approvedBy ||
                  "-"
                }}
              </td>
              <td>
                <div class="flex justify-end">
                  <button
                    type="button"
                    class="btn btn-xs btn-primary"
                    @click="openContent(item.id)"
                  >
                    查看内容
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="!loading && rows.length === 0"
        class="p-8 text-center text-base-content/60 text-sm"
      >
        暂无历史版本（故事首次上架后，后续更新审核通过时才会产生历史版本）
      </div>
    </div>

    <!-- 分页 -->
    <div
      v-if="totalPages > 1"
      class="flex items-center justify-between gap-4 bg-base-100 p-3 sm:p-4 rounded-xl border border-base-200/80 text-xs"
    >
      <div class="text-base-content/60">
        第 <span class="font-medium text-base-content">{{ page }}</span> /
        {{ totalPages }} 页
      </div>
      <div class="join">
        <button
          type="button"
          class="join-item btn btn-sm"
          :disabled="page <= 1 || loading"
          @click="changePage(page - 1)"
        >
          上一页
        </button>
        <button type="button" class="join-item btn btn-sm btn-active" disabled>
          {{ page }}
        </button>
        <button
          type="button"
          class="join-item btn btn-sm"
          :disabled="page >= totalPages || loading"
          @click="changePage(page + 1)"
        >
          下一页
        </button>
      </div>
    </div>

    <!-- 内容查看弹窗 -->
    <dialog ref="contentDialogRef" class="modal">
      <div class="modal-box max-w-5xl p-0 overflow-hidden">
        <div
          class="px-5 py-4 border-b border-base-200 flex items-center justify-between gap-3"
        >
          <div class="flex items-center gap-2">
            <h3 class="font-bold text-base">版本内容</h3>
            <span v-if="contentView" class="badge badge-sm badge-ghost">
              {{ contentView.label }}
            </span>
          </div>
          <form method="dialog">
            <button class="btn btn-sm btn-circle btn-ghost">✕</button>
          </form>
        </div>

        <div v-if="contentLoading" class="p-10 text-center">
          <span class="loading loading-spinner loading-md text-primary"></span>
          <p class="text-xs text-base-content/60 mt-3">正在加载版本内容…</p>
        </div>

        <div
          v-else-if="contentView"
          class="p-5 space-y-3 max-h-[78vh] overflow-y-auto"
        >
          <div class="flex items-center justify-between gap-3">
            <span class="text-xs text-base-content/60">{{ contentView.meta }}</span>
            <button type="button" class="btn btn-xs btn-ghost" @click="copyContent">
              复制内容
            </button>
          </div>
          <pre
            class="bg-base-200/60 border border-base-200 rounded-xl p-3 text-xs overflow-x-auto leading-relaxed whitespace-pre-wrap"
          ><code>{{ contentView.content }}</code></pre>
        </div>

        <div v-else class="p-8 text-center text-base-content/60">未找到内容</div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>

    <!-- 差异比对弹窗 -->
    <dialog ref="compareDialogRef" class="modal">
      <div class="modal-box max-w-384 w-11/12 p-0 overflow-hidden">
        <div
          class="px-5 py-4 border-b border-base-200 flex items-center justify-between gap-3 flex-wrap"
        >
          <div class="flex items-center gap-2 flex-wrap">
            <h3 class="font-bold text-base">内容差异比对</h3>
            <template v-if="compareMeta">
              <span class="badge badge-sm badge-ghost">{{ compareMeta.oldLabel }}</span>
              <Icon icon="mdi:arrow-right" class="w-4 h-4 text-base-content/50" />
              <span class="badge badge-sm badge-ghost">{{ compareMeta.newLabel }}</span>
            </template>
          </div>
          <div class="flex items-center gap-2">
            <select
              v-model="diffLayout"
              class="select select-bordered select-xs"
              title="对比布局"
            >
              <option value="side-by-side">并排</option>
              <option value="line-by-line">行内</option>
            </select>
            <select
              v-model="diffStyle"
              class="select select-bordered select-xs"
              title="高亮粒度"
            >
              <option value="word">按词对比</option>
              <option value="char">按字符对比</option>
            </select>
            <form method="dialog">
              <button class="btn btn-sm btn-circle btn-ghost">✕</button>
            </form>
          </div>
        </div>

        <div class="p-4 max-h-[78vh] overflow-y-auto">
          <div v-if="compareLoading" class="p-10 text-center">
            <span class="loading loading-spinner loading-lg text-primary"></span>
            <p class="text-xs text-base-content/60 mt-3">正在加载版本内容…</p>
          </div>
          <CodeDiff
            v-else-if="compareReady"
            :old-string="compareOld"
            :new-string="compareNew"
            language="plaintext"
            :output-format="diffLayout"
            :diff-style="diffStyle"
            :theme="isDark ? 'dark' : 'light'"
            filename="content"
            max-height="62vh"
          />
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Icon } from "@iconify/vue";
import { CodeDiff } from "v-code-diff/vue3";
import Message from "@/components/msg";
import { useAppStore } from "@/stores/modules/app";
import {
  getStory,
  getStoryHistoryDetail,
  listStoryHistory,
  type IStoryHistoryItem,
} from "@/api/stories";

interface IStoryLite {
  id?: string;
  title?: string;
  shortname?: string | null;
  content?: string;
  passageSize?: number;
  updatedAt?: number;
  status?: string;
}

interface IResolvedVersion {
  key: string;
  time: number;
  label: string;
  meta: string;
  content: string;
}

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const storyId = (route.params.id as string) || "";
const isDark = computed(() => appStore.getTheme === "dark");

/** 伪版本 key：故事的当前内容（不入历史表） */
const CURRENT_KEY = "__current__";

const story = ref<IStoryLite | null>(null);
const rows = ref<IStoryHistoryItem[]>([]);
const total = ref(0);
const page = ref(1);
const totalPages = ref(1);
const limit = 20;
const loading = ref(false);
const selected = ref<string[]>([]);

// 内容查看弹窗
const contentDialogRef = ref<HTMLDialogElement | null>(null);
const contentLoading = ref(false);
const contentView = ref<{ label: string; meta: string; content: string } | null>(
  null,
);

// 差异比对弹窗
const compareDialogRef = ref<HTMLDialogElement | null>(null);
const compareLoading = ref(false);
const compareReady = ref(false);
const compareOld = ref("");
const compareNew = ref("");
const compareMeta = ref<{ oldLabel: string; newLabel: string } | null>(null);
const diffLayout = ref<"side-by-side" | "line-by-line">("side-by-side");
const diffStyle = ref<"word" | "char">("word");

/** 历史版本内容缓存：避免重复请求 */
const contentCache = new Map<string, string>();

const formatTime = (ts?: number) => {
  if (!ts) return "-";
  return new Date(Number(ts)).toLocaleString();
};

const loadStory = async () => {
  try {
    story.value = (await getStory(storyId)) as IStoryLite;
  } catch {
    Message.error("加载故事信息失败");
  }
};

const loadList = async (targetPage = page.value) => {
  loading.value = true;
  try {
    const res = await listStoryHistory(storyId, { page: targetPage, limit });
    rows.value = res?.data || [];
    total.value = res?.total || 0;
    page.value = res?.page || targetPage;
    totalPages.value =
      res?.totalPages || Math.max(1, Math.ceil(total.value / limit));
  } catch (err: any) {
    Message.error(err?.message || "加载历史版本失败");
  } finally {
    loading.value = false;
  }
};

const changePage = async (nextPage: number) => {
  if (nextPage < 1 || nextPage > totalPages.value || nextPage === page.value) {
    return;
  }
  clearSelection();
  await loadList(nextPage);
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const toggleSelect = (key: string) => {
  const idx = selected.value.indexOf(key);
  if (idx >= 0) {
    selected.value.splice(idx, 1);
    return;
  }
  if (selected.value.length >= 2) return;
  selected.value.push(key);
};

const clearSelection = () => {
  selected.value = [];
};

/** 解析某个版本的内容：当前版本取故事最新内容，历史版本按需拉详情并缓存 */
const resolveVersion = async (key: string): Promise<IResolvedVersion> => {
  if (key === CURRENT_KEY) {
    return {
      key,
      time: story.value?.updatedAt || Date.now(),
      label: "当前版本",
      meta: `更新于 ${formatTime(story.value?.updatedAt)}`,
      content: story.value?.content || "",
    };
  }
  const row = rows.value.find((r) => r.id === key);
  let content = contentCache.get(key);
  if (content === undefined) {
    const detail = await getStoryHistoryDetail(key);
    content = detail?.content || "";
    contentCache.set(key, content);
  }
  const approver =
    row?.approvedByUser?.nickname ||
    row?.approvedByUser?.username ||
    row?.approvedBy;
  return {
    key,
    time: row?.approvedAt || 0,
    label: `历史版本 ${formatTime(row?.approvedAt)}`,
    meta: `通过于 ${formatTime(row?.approvedAt)} · 归档于 ${formatTime(row?.archivedAt)}${
      approver ? ` · 审核人：${approver}` : ""
    }`,
    content,
  };
};

const openContent = async (key: string) => {
  contentView.value = null;
  contentLoading.value = true;
  contentDialogRef.value?.showModal();
  try {
    const version = await resolveVersion(key);
    contentView.value = {
      label: version.label,
      meta: version.meta,
      content: version.content || "（该版本内容为空）",
    };
  } catch (err: any) {
    Message.error(err?.message || "加载版本内容失败");
    contentDialogRef.value?.close();
  } finally {
    contentLoading.value = false;
  }
};

const copyContent = async () => {
  try {
    await navigator.clipboard.writeText(contentView.value?.content || "");
    Message.success("已复制内容");
  } catch {
    Message.error("复制失败");
  }
};

const openCompare = async () => {
  if (selected.value.length !== 2) return;
  compareMeta.value = null;
  compareReady.value = false;
  compareLoading.value = true;
  compareDialogRef.value?.showModal();
  try {
    const versions = await Promise.all(
      selected.value.map((key) => resolveVersion(key)),
    );
    // 按版本时间升序：旧版本 → 新版本
    versions.sort((a, b) => a.time - b.time);
    compareOld.value = versions[0].content;
    compareNew.value = versions[1].content;
    compareMeta.value = {
      oldLabel: versions[0].label,
      newLabel: versions[1].label,
    };
    compareReady.value = true;
  } catch (err: any) {
    Message.error(err?.message || "加载版本内容失败");
    compareDialogRef.value?.close();
  } finally {
    compareLoading.value = false;
  }
};

const goBack = () => router.back();

onMounted(() => {
  loadStory();
  loadList();
});
</script>
