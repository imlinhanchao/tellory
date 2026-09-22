<template>
  <div class="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
    <!-- 头部标题栏 -->
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-base-100 p-4 sm:p-5 rounded-2xl border border-base-200/80 shadow-2xs"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-xl bg-error/10 text-error flex items-center justify-center shrink-0"
        >
          <Icon icon="mdi:flag-outline" class="w-6 h-6" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-xl font-bold text-base-content tracking-tight">
              举报处理
            </h2>
            <span class="badge badge-primary badge-soft badge-xs">
              管理员
            </span>
          </div>
          <p class="text-xs text-base-content/60 mt-0.5">
            审核并处理用户提交的评论举报，维护社区秩序
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2 text-xs text-base-content/60 self-end sm:self-auto">
        <Icon icon="mdi:format-list-numbered" class="w-4 h-4 text-primary" />
        <span>
          共 <strong class="text-base-content font-semibold">{{ total }}</strong> 条记录
        </span>
      </div>
    </div>

    <!-- 状态筛选 Tab -->
    <div class="flex flex-wrap items-center gap-2">
      <button
        v-for="tab in statusTabs"
        :key="tab.value"
        type="button"
        class="btn btn-sm rounded-full transition-colors gap-1.5"
        :class="
          currentStatus === tab.value
            ? 'btn-primary'
            : 'btn-ghost text-base-content/70 hover:bg-base-200'
        "
        @click="switchStatus(tab.value)"
      >
        <Icon :icon="tab.icon" class="w-4 h-4" />
        <span>{{ tab.label }}</span>
        <span
          v-if="tab.value === 'pending' && pendingCount > 0"
          class="badge badge-xs badge-error"
        >
          {{ pendingCount }}
        </span>
      </button>

      <button
        type="button"
        class="btn btn-sm btn-ghost btn-circle ml-auto"
        :disabled="loading"
        title="刷新列表"
        @click="fetchReports"
      >
        <Icon
          icon="mdi:refresh"
          class="w-4 h-4"
          :class="{ 'animate-spin': loading }"
        />
      </button>
    </div>

    <!-- 骨架屏加载状态 -->
    <div v-if="loading && reports.length === 0" class="space-y-4">
      <div
        v-for="n in 3"
        :key="n"
        class="card bg-base-100 border border-base-200/80 p-5 rounded-2xl space-y-4"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="skeleton w-9 h-9 rounded-full"></div>
            <div class="space-y-1.5">
              <div class="skeleton h-4 w-28"></div>
              <div class="skeleton h-3 w-16"></div>
            </div>
          </div>
          <div class="skeleton h-6 w-20 rounded-full"></div>
        </div>
        <div class="skeleton h-4 w-1/3"></div>
        <div class="skeleton h-20 w-full rounded-xl"></div>
      </div>
    </div>

    <!-- 举报列表 -->
    <div v-else-if="reports.length > 0" class="space-y-4">
      <div
        v-for="item in reports"
        :key="item.id"
        class="card bg-base-100 border border-base-200/80 shadow-2xs rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-xs"
      >
        <div class="card-body p-4 sm:p-5 space-y-3.5">
          <!-- 卡片头部：举报人与状态 -->
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-2.5 min-w-0">
              <Avatar
                :user="item.reporter || { id: item.reporterId, username: '举报人', nickname: '举报人', avatar: '' }"
                size="36"
                link
                class="shrink-0"
              />
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-medium text-sm text-base-content truncate">
                    {{ item.reporter?.nickname || item.reporter?.username || "匿名用户" }}
                  </span>
                  <span class="text-xs text-base-content/40 font-mono">
                    举报于 {{ formatTime(item.createdAt) }}
                  </span>
                </div>
                <div class="text-xs text-base-content/50 truncate">
                  用户 ID: {{ item.reporterId }}
                </div>
              </div>
            </div>

            <!-- 状态 Badge -->
            <div class="shrink-0">
              <span
                v-if="item.status === 'pending'"
                class="badge badge-warning badge-sm gap-1 font-medium"
              >
                <Icon icon="mdi:clock-outline" class="w-3.5 h-3.5" />
                待处理
              </span>
              <span
                v-else-if="item.status === 'resolved'"
                class="badge badge-error badge-soft badge-sm gap-1 font-medium"
              >
                <Icon icon="mdi:shield-check" class="w-3.5 h-3.5" />
                已屏蔽处理
              </span>
              <span
                v-else-if="item.status === 'dismissed'"
                class="badge badge-neutral badge-soft badge-sm gap-1 font-medium"
              >
                <Icon icon="mdi:close-circle-outline" class="w-3.5 h-3.5" />
                已驳回/保留
              </span>
            </div>
          </div>

          <!-- 举报原因及描述 -->
          <div class="space-y-1.5">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs text-base-content/50">举报理由:</span>
              <span class="badge badge-error badge-outline badge-sm font-medium">
                {{ item.reason }}
              </span>
            </div>
            <div
              v-if="item.description"
              class="text-xs text-base-content/80 bg-base-200/40 rounded-lg px-3 py-2 border-l-3 border-error/50"
            >
              <span class="text-base-content/50">补充说明：</span>
              {{ item.description }}
            </div>
          </div>

          <!-- 被举报的评论内容预览卡片 -->
          <div class="bg-base-200/40 rounded-xl p-3.5 sm:p-4 border border-base-200/80 space-y-2.5">
            <!-- 评论原作者信息与标签 -->
            <div class="flex items-center justify-between gap-2 flex-wrap text-xs">
              <div class="flex items-center gap-2">
                <Avatar
                  :user="item.comment?.author || { id: item.comment?.userId || '', username: '作者', nickname: '作者', avatar: '' }"
                  size="24"
                  link
                  class="shrink-0"
                />
                <span class="font-medium text-base-content/90">
                  {{ item.comment?.author?.nickname || item.comment?.author?.username || "未知作者" }}
                </span>
                <span class="text-base-content/40 font-mono">
                  发布于 {{ formatTime(item.comment?.createdAt || 0) }}
                </span>
              </div>

              <!-- 评论属性标签 -->
              <div class="flex items-center gap-1.5 flex-wrap">
                <span
                  v-if="item.comment?.isSpoiler"
                  class="badge badge-warning badge-xs gap-1"
                >
                  <Icon icon="mdi:eye-off-outline" class="w-3 h-3" />
                  剧透
                </span>
                <span
                  v-if="item.comment?.position?.sceneName"
                  class="badge badge-info badge-soft badge-xs gap-1"
                >
                  <Icon icon="mdi:map-marker-outline" class="w-3 h-3" />
                  场景: {{ item.comment.position.sceneName }}
                </span>
                <span
                  v-if="item.comment?.isBlocked"
                  class="badge badge-error badge-xs gap-1"
                >
                  <Icon icon="mdi:cancel" class="w-3 h-3" />
                  已屏蔽
                </span>
                <span
                  v-if="item.comment?.isDeleted"
                  class="badge badge-ghost badge-xs gap-1"
                >
                  已删除
                </span>
              </div>
            </div>

            <!-- 划词评论原文引用（如有） -->
            <div
              v-if="item.comment?.position?.selectedText"
              class="border-l-2 border-primary/40 pl-2 text-xs text-base-content/60 italic"
            >
              引用文本: “{{ item.comment.position.selectedText }}”
            </div>

            <!-- 评论正文 -->
            <div class="text-sm text-base-content leading-relaxed whitespace-pre-wrap break-words bg-base-100/60 p-2.5 rounded-lg border border-base-200/50">
              <template v-if="item.comment">
                {{ item.comment.content }}
              </template>
              <template v-else>
                <span class="text-base-content/40 italic">评论已被彻底清理或不存在</span>
              </template>
            </div>

            <!-- 屏蔽原因提示 (如已有) -->
            <div
              v-if="item.comment?.isBlocked && item.comment?.blockReason"
              class="text-xs text-error/80 flex items-center gap-1"
            >
              <Icon icon="mdi:alert-circle-outline" class="w-3.5 h-3.5 shrink-0" />
              <span>屏蔽原因: {{ item.comment.blockReason }}</span>
            </div>
          </div>

          <!-- 已处理记录（如已解决或驳回） -->
          <div
            v-if="item.status !== 'pending'"
            class="bg-base-200/30 rounded-xl px-3 py-2 text-xs text-base-content/70 flex flex-wrap items-center justify-between gap-2 border border-base-200/50"
          >
            <div class="flex items-center gap-1.5">
              <Icon icon="mdi:check-decagram-outline" class="w-4 h-4 text-primary" />
              <span>
                处理结果:
                <strong class="text-base-content">
                  {{ item.status === 'resolved' ? '已屏蔽违规评论' : '已驳回举报' }}
                </strong>
              </span>
              <span v-if="item.handleNote" class="text-base-content/60">
                (备注: {{ item.handleNote }})
              </span>
            </div>
            <div class="text-base-content/40 font-mono">
              处理时间: {{ formatDateTime(item.resolvedAt) }}
            </div>
          </div>

          <!-- 卡片底部操作按钮 -->
          <div
            class="flex items-center justify-between gap-2 pt-2 border-t border-base-200/60 flex-wrap"
          >
            <!-- 查看故事上下文链接 -->
            <router-link
              :to="`/play/${item.storyId}`"
              target="_blank"
              class="btn btn-ghost btn-xs text-base-content/60 hover:text-primary gap-1"
            >
              <Icon icon="mdi:open-in-new" class="w-3.5 h-3.5" />
              <span>查看故事页面</span>
            </router-link>

            <!-- 操作按钮群 -->
            <div class="flex items-center gap-2">
              <!-- 待处理状态下的操作 -->
              <template v-if="item.status === 'pending'">
                <button
                  type="button"
                  class="btn btn-sm btn-error gap-1 shadow-xs"
                  @click="openResolveModal(item, 'block')"
                >
                  <Icon icon="mdi:shield-alert" class="w-4 h-4" />
                  <span>屏蔽并解决</span>
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-outline gap-1"
                  @click="openResolveModal(item, 'dismiss')"
                >
                  <Icon icon="mdi:close" class="w-4 h-4" />
                  <span>驳回举报</span>
                </button>
              </template>

              <!-- 已处理状态下的快捷操作 -->
              <template v-else-if="item.status === 'resolved' && item.comment?.isBlocked">
                <button
                  type="button"
                  class="btn btn-sm btn-ghost text-info hover:bg-info/10 gap-1"
                  @click="handleUnblockComment(item)"
                >
                  <Icon icon="mdi:lock-open-outline" class="w-4 h-4" />
                  <span>解除屏蔽</span>
                </button>
              </template>

              <template v-else-if="item.status === 'dismissed' && item.comment && !item.comment.isBlocked">
                <button
                  type="button"
                  class="btn btn-sm btn-ghost text-error hover:bg-error/10 gap-1"
                  @click="openResolveModal(item, 'block')"
                >
                  <Icon icon="mdi:shield-alert" class="w-4 h-4" />
                  <span>重新屏蔽</span>
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-else
      class="card bg-base-100 border border-base-200/80 p-12 text-center space-y-3 rounded-2xl"
    >
      <div
        class="w-16 h-16 rounded-full bg-base-200 flex items-center justify-center mx-auto text-base-content/40"
      >
        <Icon icon="mdi:check-all" class="w-8 h-8 text-success" />
      </div>
      <div class="space-y-1">
        <h4 class="font-semibold text-base text-base-content">
          暂无相关举报记录
        </h4>
        <p class="text-xs text-base-content/60">
          {{ currentStatus === 'pending' ? '当前没有等待审核的举报，社区运行良好！' : '没有符合筛选条件的举报记录' }}
        </p>
      </div>
    </div>

    <!-- 分页控制器 -->
    <div
      v-if="totalPages > 1"
      class="flex items-center justify-between gap-4 bg-base-100 p-3 sm:p-4 rounded-xl border border-base-200/80 text-xs"
    >
      <div class="text-base-content/60">
        第 <span class="font-medium text-base-content">{{ page }}</span> / {{ totalPages }} 页
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
        <button
          type="button"
          class="join-item btn btn-sm btn-active"
        >
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

    <!-- 举报处理确认弹窗 -->
    <dialog class="modal" :class="{ 'modal-open': isModalOpen }">
      <div class="modal-box max-w-lg p-5 sm:p-6 space-y-4 rounded-2xl">
        <div class="flex items-center justify-between pb-2 border-b border-base-200">
          <div class="flex items-center gap-2">
            <Icon
              :icon="modalAction === 'block' ? 'mdi:shield-alert' : 'mdi:close-circle-outline'"
              class="w-5 h-5"
              :class="modalAction === 'block' ? 'text-error' : 'text-primary'"
            />
            <h3 class="text-base font-bold text-base-content">
              {{ modalAction === 'block' ? '屏蔽违规评论并处理举报' : '驳回该评论举报' }}
            </h3>
          </div>
          <button
            type="button"
            class="btn btn-sm btn-ghost btn-circle"
            @click="closeModal"
          >
            ✕
          </button>
        </div>

        <div class="text-xs text-base-content/70 leading-relaxed">
          <p v-if="modalAction === 'block'">
            屏蔽后，该评论正文对普通读者将被替换为屏蔽提示，原作者无法被回复，举报将标记为已处理。
          </p>
          <p v-else>
            若经审核该评论并未违反社区规范，可驳回此举报，评论将保留正常展示。
          </p>
        </div>

        <!-- 被处理的目标评论简要信息 -->
        <div
          v-if="currentReport"
          class="bg-base-200/50 p-3 rounded-xl text-xs space-y-1.5 border border-base-200"
        >
          <div class="flex items-center justify-between text-base-content/60">
            <span>举报理由: <strong class="text-error">{{ currentReport.reason }}</strong></span>
            <span>评论作者: {{ currentReport.comment?.author?.nickname || currentReport.comment?.author?.username || '用户' }}</span>
          </div>
          <div class="text-base-content/90 line-clamp-2 italic bg-base-100/70 p-2 rounded">
            “{{ currentReport.comment?.content || '评论内容' }}”
          </div>
        </div>

        <!-- 审核处理备注 -->
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-base-content flex items-center justify-between">
            <span>处理备注说明 (可选)</span>
            <span class="text-base-content/40 text-[11px]">便于后续回溯记录</span>
          </label>
          <textarea
            v-model="modalNote"
            rows="3"
            class="textarea textarea-bordered w-full text-xs"
            :placeholder="modalAction === 'block' ? '如：经核实存在人身攻击/广告违规，予以屏蔽处理' : '如：经审核内容合规，未见违规现象'"
          ></textarea>
        </div>

        <!-- 弹窗底部按钮 -->
        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            class="btn btn-sm btn-ghost"
            :disabled="submitting"
            @click="closeModal"
          >
            取消
          </button>
          <button
            type="button"
            class="btn btn-sm gap-1"
            :class="modalAction === 'block' ? 'btn-error' : 'btn-primary'"
            :disabled="submitting"
            @click="submitResolve"
          >
            <span v-if="submitting" class="loading loading-spinner loading-xs"></span>
            <Icon
              v-else
              :icon="modalAction === 'block' ? 'mdi:shield-alert' : 'mdi:check'"
              class="w-4 h-4"
            />
            <span>{{ modalAction === 'block' ? '确认屏蔽并解决' : '确认驳回举报' }}</span>
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="button" @click="closeModal">close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { Icon } from "@iconify/vue";
import Message from "@/components/msg";
import msgbox from "@/components/msgbox";
import {
  getAdminReports,
  resolveAdminReport,
  unblockComment,
  type CommentReportItem,
} from "@/api/comments";

// 状态标签
const statusTabs = [
  { label: "待处理", value: "pending", icon: "mdi:clock-outline" },
  { label: "已屏蔽", value: "resolved", icon: "mdi:shield-check" },
  { label: "已驳回", value: "dismissed", icon: "mdi:close-circle-outline" },
  { label: "全部", value: "all", icon: "mdi:format-list-bulleted" },
] as const;

type StatusType = (typeof statusTabs)[number]["value"];

const currentStatus = ref<StatusType>("pending");
const reports = ref<CommentReportItem[]>([]);
const total = ref<number>(0);
const page = ref<number>(1);
const limit = 15;
const loading = ref<boolean>(false);
const pendingCount = ref<number>(0);

const totalPages = computed(() => Math.ceil(total.value / limit) || 1);

// 模态弹窗状态
const isModalOpen = ref(false);
const modalAction = ref<"block" | "dismiss">("block");
const modalNote = ref("");
const currentReport = ref<CommentReportItem | null>(null);
const submitting = ref(false);

// 加载举报列表
async function fetchReports() {
  loading.value = true;
  try {
    const res = await getAdminReports({
      status: currentStatus.value,
      page: page.value,
      limit,
    });
    reports.value = res.data || [];
    total.value = res.total || 0;

    // 如果当前在待处理 tab，则顺便更新待处理计数
    if (currentStatus.value === "pending") {
      pendingCount.value = res.total || 0;
    }
  } catch (err: any) {
    Message.error(err?.message || "获取举报列表失败");
  } finally {
    loading.value = false;
  }
}

// 快速刷新待处理数量
async function fetchPendingCount() {
  try {
    const res = await getAdminReports({
      status: "pending",
      page: 1,
      limit: 1,
    });
    pendingCount.value = res.total || 0;
  } catch (e) {
    // ignore
  }
}

// 切换状态 Tab
function switchStatus(status: StatusType) {
  if (currentStatus.value === status) return;
  currentStatus.value = status;
  page.value = 1;
  fetchReports();
}

// 翻页
function changePage(newPage: number) {
  if (newPage < 1 || newPage > totalPages.value) return;
  page.value = newPage;
  fetchReports();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// 打开处理弹窗
function openResolveModal(report: CommentReportItem, action: "block" | "dismiss") {
  currentReport.value = report;
  modalAction.value = action;
  modalNote.value =
    action === "block"
      ? `经核实该评论存在${report.reason}行为，予以屏蔽处理`
      : "经核实该评论未违反社区规范，予以保留";
  isModalOpen.value = true;
}

function closeModal() {
  isModalOpen.value = false;
  currentReport.value = null;
  modalNote.value = "";
}

// 提交处理
async function submitResolve() {
  if (!currentReport.value) return;
  submitting.value = true;
  try {
    await resolveAdminReport(currentReport.value.id, {
      action: modalAction.value,
      note: modalNote.value.trim() || undefined,
    });
    Message.success(
      modalAction.value === "block" ? "已屏蔽评论并标记处理" : "已驳回该举报",
    );
    closeModal();
    await fetchReports();
    await fetchPendingCount();
  } catch (err: any) {
    Message.error(err?.message || "处理失败");
  } finally {
    submitting.value = false;
  }
}

// 解除评论屏蔽
async function handleUnblockComment(report: CommentReportItem) {
  if (!report.commentId) return;
  const confirmed = await msgbox.confirm(
    "确定要解除对该评论的屏蔽吗？解除后所有用户将可重新阅读此评论。",
    "解除屏蔽确认",
  );
  if (!confirmed) return;

  try {
    await unblockComment(report.commentId);
    Message.success("已解除对该评论的屏蔽");
    await fetchReports();
  } catch (err: any) {
    Message.error(err?.message || "解除屏蔽失败");
  }
}

// 格式化相对时间
function formatTime(timestamp: number) {
  if (!timestamp) return "";
  const diff = Date.now() - Number(timestamp);
  if (diff < 60 * 1000) return "刚刚";
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))} 分钟前`;
  if (diff < 24 * 60 * 60 * 1000)
    return `${Math.floor(diff / (60 * 60 * 1000))} 小时前`;
  if (diff < 30 * 24 * 60 * 60 * 1000)
    return `${Math.floor(diff / (24 * 60 * 60 * 1000))} 天前`;
  return new Date(Number(timestamp)).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// 格式化完整时间
function formatDateTime(timestamp?: number) {
  if (!timestamp) return "-";
  return new Date(Number(timestamp)).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

onMounted(() => {
  fetchReports();
  fetchPendingCount();
});
</script>
