<template>
  <dialog
    ref="dialogRef"
    class="modal"
    @cancel="close"
    @close="onDialogClose"
  >
    <div
      class="modal-box w-11/12 max-w-5xl max-h-[90vh] flex flex-col p-4 sm:p-6 bg-base-100 text-base-content rounded-2xl shadow-xl overflow-hidden"
    >
      <!-- 弹窗顶栏 -->
      <div class="flex items-center justify-between pb-3 border-b border-base-200 shrink-0">
        <div class="flex items-center gap-2.5">
          <div
            class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"
          >
            <Icon icon="mdi:history" class="w-5 h-5" />
          </div>
          <div>
            <h3 class="font-bold text-base sm:text-lg text-base-content flex items-center gap-2">
              <span>历史版本与比对</span>
              <span v-if="storyTitle" class="badge badge-ghost badge-sm font-normal">
                {{ storyTitle }}
              </span>
            </h3>
            <p class="text-xs text-base-content/60">
              查看故事已发布快照及历次历史归档，可任意比对版本间属性与段落差异。
            </p>
          </div>
        </div>

        <button
          type="button"
          class="btn btn-sm btn-circle btn-ghost"
          @click="close"
        >
          ✕
        </button>
      </div>

      <!-- 弹窗主体 -->
      <div class="flex-1 overflow-y-auto py-4 space-y-5">
        <!-- 1. 当前已发布版本卡片 -->
        <div class="card bg-base-200/40 border border-base-200 rounded-xl overflow-hidden">
          <div class="card-body p-4 space-y-3">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="badge badge-success badge-sm font-semibold">
                  已发布版本（线上快照）
                </span>
                <span v-if="approvedLoading" class="loading loading-spinner loading-xs text-primary"></span>
              </div>

              <!-- 快捷与当前版本比对按钮 -->
              <button
                v-if="approvedSnapshot"
                type="button"
                class="btn btn-xs sm:btn-sm btn-primary gap-1.5 shadow-2xs"
                @click="compareCurrentWithApproved"
              >
                <Icon icon="mdi:compare" class="w-4 h-4" />
                <span>比对当前版本与已发布版本</span>
              </button>
            </div>

            <!-- 已发布详情 -->
            <div
              v-if="approvedSnapshot"
              class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs bg-base-100 p-3 rounded-lg border border-base-200"
            >
              <div>
                <span class="text-base-content/50">审核通过时间：</span>
                <span class="font-medium text-base-content">
                  {{ formatTime(approvedSnapshot.approvedAt) }}
                </span>
              </div>
              <div>
                <span class="text-base-content/50">包含段落数：</span>
                <span class="font-medium text-base-content">
                  {{ approvedSnapshot.passageSize ?? 0 }} 章
                </span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-base-content/50">快照操作：</span>
                <button
                  type="button"
                  class="link link-primary text-xs"
                  @click="viewSnapshotContent(approvedSnapshot.content || '', '已发布版本源码')"
                >
                  查看源码
                </button>
              </div>
            </div>

            <div
              v-else-if="!approvedLoading"
              class="text-xs text-base-content/50 py-2"
            >
              该故事尚未发布或暂无已发布快照。发布审核通过后将在此生成首个线上版本快照。
            </div>
          </div>
        </div>

        <!-- 2. 多选比对工具条 -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-base-100 p-3 rounded-xl border border-base-200">
          <div class="text-xs text-base-content/60 flex items-center gap-2">
            <Icon icon="mdi:information-outline" class="w-4 h-4 text-primary shrink-0" />
            <span>勾选列表中任意两个版本，即可开启多版本结构化差异比对</span>
            <span class="badge badge-ghost badge-sm shrink-0">已选 {{ selectedKeys.length }}/2</span>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <button
              type="button"
              class="btn btn-xs btn-ghost"
              :disabled="selectedKeys.length === 0"
              @click="clearSelection"
            >
              清空选择
            </button>
            <button
              type="button"
              class="btn btn-xs btn-primary gap-1"
              :disabled="selectedKeys.length !== 2"
              @click="compareSelected"
            >
              <Icon icon="mdi:compare" class="w-3.5 h-3.5" />
              <span>比对选中 ({{ selectedKeys.length }}/2)</span>
            </button>
          </div>
        </div>

        <!-- 3. 版本列表表格 -->
        <div class="card bg-base-100 border border-base-200 rounded-xl overflow-hidden">
          <div class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th class="w-10"></th>
                  <th>版本说明</th>
                  <th>时间信息</th>
                  <th>段落数</th>
                  <th>审核人</th>
                  <th class="text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                <!-- 当前编辑中的最新版本行 -->
                <tr class="hover:bg-base-200/30">
                  <td>
                    <input
                      type="checkbox"
                      class="checkbox checkbox-xs checkbox-primary"
                      :checked="selectedKeys.includes(KEY_CURRENT)"
                      :disabled="!selectedKeys.includes(KEY_CURRENT) && selectedKeys.length >= 2"
                      @change="toggleSelect(KEY_CURRENT)"
                    />
                  </td>
                  <td>
                    <div class="flex items-center gap-2">
                      <span class="badge badge-info badge-soft badge-xs font-semibold">
                        当前编辑版本
                      </span>
                    </div>
                  </td>
                  <td class="text-xs text-base-content/60">
                    当前编辑器内容
                  </td>
                  <td class="text-xs">
                    {{ currentPassageCount }} 章
                  </td>
                  <td class="text-xs text-base-content/50">
                    -
                  </td>
                  <td class="text-right">
                    <button
                      v-if="approvedSnapshot"
                      type="button"
                      class="btn btn-ghost btn-xs text-primary"
                      @click="compareCurrentWithApproved"
                    >
                      与已发布比对
                    </button>
                  </td>
                </tr>

                <!-- 已发布版本行 -->
                <tr v-if="approvedSnapshot" class="hover:bg-base-200/30">
                  <td>
                    <input
                      type="checkbox"
                      class="checkbox checkbox-xs checkbox-primary"
                      :checked="selectedKeys.includes(KEY_APPROVED)"
                      :disabled="!selectedKeys.includes(KEY_APPROVED) && selectedKeys.length >= 2"
                      @change="toggleSelect(KEY_APPROVED)"
                    />
                  </td>
                  <td>
                    <span class="badge badge-success badge-soft badge-xs font-semibold">
                      已发布线上版本
                    </span>
                  </td>
                  <td class="text-xs text-base-content/60">
                    通过于 {{ formatTime(approvedSnapshot.approvedAt) }}
                  </td>
                  <td class="text-xs">
                    {{ approvedSnapshot.passageSize ?? 0 }} 章
                  </td>
                  <td class="text-xs text-base-content/60">
                    {{ approvedApproverName || "管理员" }}
                  </td>
                  <td class="text-right space-x-1">
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs"
                      @click="viewSnapshotContent(approvedSnapshot.content || '', '已发布版本源码')"
                    >
                      源码
                    </button>
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs text-primary"
                      @click="compareCurrentWithApproved"
                    >
                      与当前比对
                    </button>
                  </td>
                </tr>

                <!-- 历史归档列表行 -->
                <tr
                  v-for="row in historyList"
                  :key="row.id"
                  class="hover:bg-base-200/30"
                >
                  <td>
                    <input
                      type="checkbox"
                      class="checkbox checkbox-xs checkbox-primary"
                      :checked="selectedKeys.includes(row.id)"
                      :disabled="!selectedKeys.includes(row.id) && selectedKeys.length >= 2"
                      @change="toggleSelect(row.id)"
                    />
                  </td>
                  <td>
                    <div class="flex items-center gap-1.5">
                      <span class="badge badge-ghost badge-xs">
                        历史归档
                      </span>
                      <span class="text-xs font-medium truncate max-w-[120px]">
                        {{ row.title }}
                      </span>
                    </div>
                  </td>
                  <td class="text-xs text-base-content/60">
                    <div>通过于 {{ formatTime(row.approvedAt) }}</div>
                    <div class="text-[10px] text-base-content/40">归档于 {{ formatTime(row.archivedAt) }}</div>
                  </td>
                  <td class="text-xs">
                    {{ row.passageSize ?? 0 }} 章
                  </td>
                  <td class="text-xs text-base-content/60">
                    {{ row.approvedByUser?.nickname || row.approvedByUser?.username || "管理员" }}
                  </td>
                  <td class="text-right space-x-1">
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs"
                      @click="openHistorySource(row)"
                    >
                      源码
                    </button>
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs text-primary"
                      @click="compareWithHistory(row)"
                    >
                      与当前比对
                    </button>
                  </td>
                </tr>

                <!-- 空历史数据 -->
                <tr v-if="!historyLoading && historyList.length === 0">
                  <td colspan="6" class="text-center py-6 text-xs text-base-content/50">
                    暂无历史归档版本
                  </td>
                </tr>

                <!-- 加载中 -->
                <tr v-if="historyLoading">
                  <td colspan="6" class="text-center py-6">
                    <span class="loading loading-spinner loading-sm text-primary"></span>
                    <span class="text-xs text-base-content/60 ml-2">正在加载历史版本…</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 分页 -->
          <div
            v-if="historyTotalPages > 1"
            class="flex items-center justify-between p-3 border-t border-base-200 text-xs"
          >
            <div class="text-base-content/60">
              共 {{ historyTotal }} 个历史归档版本
            </div>
            <div class="join">
              <button
                type="button"
                class="join-item btn btn-xs"
                :disabled="historyPage <= 1"
                @click="changeHistoryPage(historyPage - 1)"
              >
                «
              </button>
              <button type="button" class="join-item btn btn-xs btn-active">
                {{ historyPage }} / {{ historyTotalPages }}
              </button>
              <button
                type="button"
                class="join-item btn btn-xs"
                :disabled="historyPage >= historyTotalPages"
                @click="changeHistoryPage(historyPage + 1)"
              >
                »
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部关闭按钮 -->
      <div class="pt-3 border-t border-base-200 flex items-center justify-end shrink-0">
        <button type="button" class="btn btn-sm btn-ghost" @click="close">
          关闭
        </button>
      </div>
    </div>

    <!-- 遮罩 -->
    <form method="dialog" class="modal-backdrop">
      <button type="button" @click="close">close</button>
    </form>
  </dialog>

  <!-- 源码查看模态窗 -->
  <dialog ref="sourceDialogRef" class="modal">
    <div class="modal-box w-11/12 max-w-3xl flex flex-col max-h-[85vh] p-4 bg-base-100 rounded-2xl shadow-xl">
      <div class="flex items-center justify-between pb-2 border-b border-base-200 shrink-0">
        <h3 class="font-bold text-base text-base-content">{{ sourceViewTitle }}</h3>
        <button type="button" class="btn btn-xs btn-circle btn-ghost" @click="sourceDialogRef?.close()">✕</button>
      </div>
      <div class="flex-1 overflow-y-auto py-3">
        <pre class="bg-base-200/60 border border-base-200 rounded-xl p-3 text-xs overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">{{ sourceViewContent }}</pre>
      </div>
      <div class="pt-2 border-t border-base-200 flex justify-end shrink-0">
        <button type="button" class="btn btn-sm btn-ghost" @click="sourceDialogRef?.close()">关闭</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button type="button" @click="sourceDialogRef?.close()">close</button>
    </form>
  </dialog>

  <!-- 结构化差异比对弹窗 -->
  <StoryDiffModal ref="storyDiffModalRef" />
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { Icon } from "@iconify/vue";
import { parseStorySource } from "tellory";
import {
  getApprovedStorySnapshot,
  getStoryHistoryDetail,
  listStoryHistory,
  type IApprovedStorySnapshot,
  type IStoryHistoryItem,
} from "@/api/stories";
import Message from "@/components/msg";
import StoryDiffModal from "@/components/StoryDiff/StoryDiffModal.vue";

const KEY_CURRENT = "__CURRENT__";
const KEY_APPROVED = "__APPROVED__";

const props = defineProps<{
  storyId: string;
  storyTitle?: string;
  currentContent?: string;
}>();

const emit = defineEmits(["close"]);

const dialogRef = ref<HTMLDialogElement | null>(null);
const sourceDialogRef = ref<HTMLDialogElement | null>(null);
const storyDiffModalRef = ref<InstanceType<typeof StoryDiffModal> | null>(null);

const approvedLoading = ref(false);
const approvedSnapshot = ref<IApprovedStorySnapshot | null>(null);

const historyLoading = ref(false);
const historyList = ref<IStoryHistoryItem[]>([]);
const historyTotal = ref(0);
const historyPage = ref(1);
const historyLimit = 10;
const historyTotalPages = ref(1);

const selectedKeys = ref<string[]>([]);

const sourceViewTitle = ref("");
const sourceViewContent = ref("");

/** 历史版本详情缓存（避免重复拉取 content） */
const contentCache = new Map<string, string>();

const formatTime = (ts?: number) => {
  if (!ts) return "-";
  return new Date(Number(ts)).toLocaleString();
};

const currentPassageCount = computed(() => {
  if (!props.currentContent) return 0;
  try {
    return parseStorySource(props.currentContent).passages.length;
  } catch {
    return 0;
  }
});

const approvedApproverName = computed(() => {
  return "";
});

async function loadApproved() {
  if (!props.storyId) return;
  approvedLoading.value = true;
  try {
    approvedSnapshot.value = await getApprovedStorySnapshot(props.storyId);
  } catch (err: any) {
    console.error("[StoryHistoryModal] loadApproved error", err);
  } finally {
    approvedLoading.value = false;
  }
}

async function loadHistory(page = 1) {
  if (!props.storyId) return;
  historyLoading.value = true;
  try {
    const res = await listStoryHistory(props.storyId, {
      page,
      limit: historyLimit,
    });
    historyList.value = res?.data || [];
    historyTotal.value = res?.total || 0;
    historyPage.value = res?.page || page;
    historyTotalPages.value =
      res?.totalPages || Math.max(1, Math.ceil(historyTotal.value / historyLimit));
  } catch (err: any) {
    console.error("[StoryHistoryModal] loadHistory error", err);
  } finally {
    historyLoading.value = false;
  }
}

function changeHistoryPage(page: number) {
  historyPage.value = page;
  loadHistory(page);
}

function toggleSelect(key: string) {
  const idx = selectedKeys.value.indexOf(key);
  if (idx >= 0) {
    selectedKeys.value.splice(idx, 1);
  } else {
    if (selectedKeys.value.length >= 2) return;
    selectedKeys.value.push(key);
  }
}

function clearSelection() {
  selectedKeys.value = [];
}

/** 解析特定 key 的内容和展示信息 */
async function resolveVersion(key: string): Promise<{
  label: string;
  meta: string;
  content: string;
  time: number;
}> {
  if (key === KEY_CURRENT) {
    return {
      label: "当前编辑版本",
      meta: "当前编辑器内容",
      content: props.currentContent || "",
      time: Date.now(),
    };
  }
  if (key === KEY_APPROVED) {
    return {
      label: "已发布版本（线上快照）",
      meta: `通过于 ${formatTime(approvedSnapshot.value?.approvedAt)}`,
      content: approvedSnapshot.value?.content || "",
      time: Number(approvedSnapshot.value?.approvedAt || 0),
    };
  }
  // 历史版本
  const row = historyList.value.find((r) => r.id === key);
  let content = contentCache.get(key);
  if (content === undefined) {
    const detail = await getStoryHistoryDetail(key, props.storyId);
    content = detail?.content || "";
    contentCache.set(key, content);
  }
  const approver =
    row?.approvedByUser?.nickname ||
    row?.approvedByUser?.username ||
    row?.approvedBy ||
    "管理员";
  return {
    label: `历史归档 (${formatTime(row?.approvedAt)})`,
    meta: `通过于 ${formatTime(row?.approvedAt)} · 审核人：${approver}`,
    content,
    time: Number(row?.approvedAt || 0),
  };
}

/** 1. 快捷比对：当前版本 vs 已发布版本 */
async function compareCurrentWithApproved() {
  if (!approvedSnapshot.value?.content) {
    Message.warning("该故事暂无已发布版本，无法进行比对");
    return;
  }
  storyDiffModalRef.value?.showModal({
    title: "当前版本与已发布版本比对",
    subtitle: props.storyTitle ? `故事：《${props.storyTitle}》` : "",
    oldContent: approvedSnapshot.value.content,
    newContent: props.currentContent || "",
    oldLabel: "已发布版本（线上快照）",
    newLabel: "当前版本（最新编辑）",
    oldMeta: `审核通过于 ${formatTime(approvedSnapshot.value.approvedAt)}`,
    newMeta: "当前编辑内容",
  });
}

/** 2. 与历史版本比对 */
async function compareWithHistory(row: IStoryHistoryItem) {
  let content = contentCache.get(row.id);
  if (content === undefined) {
    try {
      const detail = await getStoryHistoryDetail(row.id, props.storyId);
      content = detail?.content || "";
      contentCache.set(row.id, content);
    } catch {
      Message.error("加载历史版本内容失败");
      return;
    }
  }

  storyDiffModalRef.value?.showModal({
    title: "当前版本与历史归档版本比对",
    subtitle: props.storyTitle ? `故事：《${props.storyTitle}》` : "",
    oldContent: content,
    newContent: props.currentContent || "",
    oldLabel: `历史归档 (${formatTime(row.approvedAt)})`,
    newLabel: "当前版本（最新编辑）",
    oldMeta: `审核通过于 ${formatTime(row.approvedAt)}`,
    newMeta: "当前编辑内容",
  });
}

/** 3. 勾选的两个版本比对 */
async function compareSelected() {
  if (selectedKeys.value.length !== 2) return;
  try {
    const versions = await Promise.all(
      selectedKeys.value.map((k) => resolveVersion(k)),
    );
    // 按时间升序排序：旧版本 -> 新版本
    versions.sort((a, b) => a.time - b.time);
    storyDiffModalRef.value?.showModal({
      title: "版本差异比对",
      subtitle: props.storyTitle ? `故事：《${props.storyTitle}》` : "",
      oldContent: versions[0].content,
      newContent: versions[1].content,
      oldLabel: versions[0].label,
      newLabel: versions[1].label,
      oldMeta: versions[0].meta,
      newMeta: versions[1].meta,
    });
  } catch (err: any) {
    Message.error(err?.message || "比对版本内容加载失败");
  }
}

function viewSnapshotContent(content: string, title = "快照源码") {
  sourceViewTitle.value = title;
  sourceViewContent.value = content;
  sourceDialogRef.value?.showModal();
}

async function openHistorySource(row: IStoryHistoryItem) {
  let content = contentCache.get(row.id);
  if (content === undefined) {
    try {
      const detail = await getStoryHistoryDetail(row.id, props.storyId);
      content = detail?.content || "";
      contentCache.set(row.id, content);
    } catch {
      Message.error("加载历史版本失败");
      return;
    }
  }
  viewSnapshotContent(content, `历史版本源码 (${formatTime(row.approvedAt)})`);
}

function showModal() {
  selectedKeys.value = [];
  loadApproved();
  loadHistory(1);
  if (dialogRef.value && !dialogRef.value.open) {
    dialogRef.value.showModal();
  }
}

function close() {
  if (dialogRef.value?.open) {
    dialogRef.value.close();
  }
}

function onDialogClose() {
  emit("close");
}

defineExpose({
  showModal,
  close,
  compareCurrentWithApproved,
});
</script>
