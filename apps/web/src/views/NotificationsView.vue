<template>
  <div class="container mx-auto px-4 py-6 max-w-4xl min-h-[calc(100vh-12rem)]">
    <!-- 顶部标题与操作栏 -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-bold tracking-tight">消息通知</h1>
        <span
          v-if="notificationStore.unreadCount > 0"
          class="badge badge-primary badge-sm"
        >
          {{ notificationStore.unreadCount }} 条未读
        </span>
      </div>

      <div class="flex items-center gap-2">
        <button
          v-if="notificationStore.unreadCount > 0"
          class="btn btn-sm btn-outline btn-primary gap-1"
          :disabled="loading"
          @click="handleMarkAllAsRead"
        >
          <Icon icon="mdi:check-all" class="size-4" />
          <span>全部标为已读</span>
        </button>
        <button
          class="btn btn-sm btn-ghost btn-circle"
          :class="{ 'animate-spin': loading }"
          title="刷新通知"
          @click="loadNotifications(currentPage)"
        >
          <Icon icon="mdi:refresh" class="size-4" />
        </button>
      </div>
    </div>

    <!-- 分类筛选标签 -->
    <div class="tabs tabs-box bg-base-200/60 p-1 rounded-xl mb-6">
      <button
        v-for="tab in filterTabs"
        :key="tab.key"
        class="tab text-sm font-medium transition-all"
        :class="{ 'tab-active bg-base-100 shadow-xs': activeTab === tab.key }"
        @click="switchTab(tab.key)"
      >
        <Icon :icon="tab.icon" class="size-4 mr-1.5" />
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <!-- 通知列表 -->
    <div v-if="loading && items.length === 0" class="flex justify-center py-20">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <div
      v-else-if="items.length === 0"
      class="card bg-base-100 shadow-xs border border-base-200 py-16 text-center"
    >
      <div class="flex flex-col items-center justify-center text-base-content/50">
        <Icon icon="mdi:bell-off-outline" class="size-16 mb-3 stroke-1" />
        <p class="text-base font-medium">暂无相关通知</p>
        <p class="text-xs text-base-content/40 mt-1">当有新评论、回复或故事更新时会在这里提醒你</p>
      </div>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="item in items"
        :key="item.id"
        class="card bg-base-100 shadow-xs border border-base-200 hover:border-primary/30 hover:shadow-sm transition-all duration-200 cursor-pointer overflow-hidden group"
        :class="{ 'bg-primary/3 border-primary/20': !item.isRead }"
        @click="handleClickNotification(item)"
      >
        <div class="card-body p-4 sm:p-5">
          <div class="flex items-start gap-3.5">
            <!-- 类型图标 -->
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5"
              :class="getTypeIconClass(item.type)"
            >
              <Icon :icon="getTypeIcon(item.type)" class="size-5" />
            </div>

            <!-- 通知核心内容 -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-2 mb-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="text-sm font-semibold text-base-content line-clamp-1">
                    {{ item.title }}
                  </h3>
                  <!-- 未读红点标识 -->
                  <span
                    v-if="!item.isRead"
                    class="badge badge-error badge-xs badge-dot"
                    title="未读"
                  ></span>
                  <!-- 类型标签 -->
                  <span
                    class="badge badge-xs badge-soft font-normal"
                    :class="getTypeBadgeClass(item.type)"
                  >
                    {{ getTypeLabel(item.type) }}
                  </span>
                </div>
                <span class="text-xs text-base-content/40 shrink-0">
                  {{ formatTime(item.createdAt) }}
                </span>
              </div>

              <!-- 发送者与内容详情 -->
              <div class="text-sm text-base-content/80 leading-relaxed mb-2">
                <span v-if="item.sender" class="font-medium text-base-content mr-1">
                  {{ item.sender.nickname || item.sender.username }}:
                </span>
                <span>{{ item.content }}</span>
              </div>

              <!-- 关联故事小标签 -->
              <div
                v-if="item.extra?.storyTitle || item.storyId"
                class="flex items-center gap-1.5 text-xs text-primary/80 group-hover:text-primary font-medium"
              >
                <Icon icon="mdi:book-open-outline" class="size-3.5" />
                <span class="truncate">
                  《{{ item.extra?.storyTitle || "故事" }}》
                </span>
                <Icon icon="mdi:chevron-right" class="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>

            <!-- 操作按钮 -->
            <div
              class="flex items-center gap-1 shrink-0 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity"
              @click.stop
            >
              <button
                v-if="!item.isRead"
                class="btn btn-ghost btn-circle btn-xs text-base-content/60 hover:text-primary"
                title="标为已读"
                @click.stop="handleMarkAsRead(item)"
              >
                <Icon icon="mdi:check" class="size-4" />
              </button>
              <button
                class="btn btn-ghost btn-circle btn-xs text-base-content/60 hover:text-error"
                title="删除通知"
                @click.stop="handleDelete(item)"
              >
                <Icon icon="mdi:trash-can-outline" class="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="totalPages > 1" class="flex justify-center mt-8">
      <div class="join shadow-xs">
        <button
          class="join-item btn btn-sm"
          :disabled="currentPage <= 1 || loading"
          @click="changePage(currentPage - 1)"
        >
          <Icon icon="mdi:chevron-left" class="size-4" />
          <span>上一页</span>
        </button>
        <button class="join-item btn btn-sm pointer-events-none">
          第 {{ currentPage }} / {{ totalPages }} 页
        </button>
        <button
          class="join-item btn btn-sm"
          :disabled="currentPage >= totalPages || loading"
          @click="changePage(currentPage + 1)"
        >
          <span>下一页</span>
          <Icon icon="mdi:chevron-right" class="size-4" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { Icon } from "@iconify/vue";
import {
  getNotifications,
  type NotificationItem,
  type NotificationType,
} from "@/api/notifications";
import { useNotificationStore } from "@/stores/modules/notification";

const router = useRouter();
const notificationStore = useNotificationStore();

const loading = ref(false);
const items = ref<NotificationItem[]>([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = 15;
const activeTab = ref<"all" | "unread" | "comments" | "stories">("all");

const filterTabs = [
  { key: "all" as const, label: "全部", icon: "mdi:bell-outline" },
  { key: "unread" as const, label: "未读", icon: "mdi:email-mark-as-unread" },
  { key: "comments" as const, label: "评论与回复", icon: "mdi:comment-text-multiple-outline" },
  { key: "stories" as const, label: "故事动态", icon: "mdi:book-sync-outline" },
];

const totalPages = computed(() => Math.ceil(total.value / pageSize) || 1);

async function loadNotifications(page = 1) {
  loading.value = true;
  currentPage.value = page;

  try {
    let isRead: boolean | undefined = undefined;
    let type: string | undefined = undefined;

    if (activeTab.value === "unread") {
      isRead = false;
    } else if (activeTab.value === "comments") {
      // 评论与回复
      type = "comment_story,comment_reply";
    } else if (activeTab.value === "stories") {
      // 故事动态
      type = "story_update,story_approved";
    }

    const res = await getNotifications({
      page,
      limit: pageSize,
      isRead,
      type: type && !type.includes(",") ? (type as NotificationType) : undefined,
    });

    // 如果筛选包含逗号多类型，前端再做二次匹配（兼容性）
    let list = res.data || [];
    if (activeTab.value === "comments") {
      list = list.filter((i) => i.type === "comment_story" || i.type === "comment_reply");
    } else if (activeTab.value === "stories") {
      list = list.filter((i) => i.type === "story_update" || i.type === "story_approved");
    }

    items.value = list;
    total.value = res.total || 0;
    notificationStore.unreadCount = res.unreadCount ?? 0;
  } catch (err) {
    console.error("获取通知列表失败:", err);
  } finally {
    loading.value = false;
  }
}

function switchTab(tabKey: "all" | "unread" | "comments" | "stories") {
  if (activeTab.value === tabKey) return;
  activeTab.value = tabKey;
  loadNotifications(1);
}

function changePage(page: number) {
  if (page < 1 || page > totalPages.value) return;
  loadNotifications(page);
}

async function handleMarkAsRead(item: NotificationItem) {
  if (item.isRead) return;
  await notificationStore.markAsRead(item.id);
  item.isRead = true;
  if (activeTab.value === "unread") {
    items.value = items.value.filter((i) => i.id !== item.id);
    total.value = Math.max(0, total.value - 1);
  }
}

async function handleMarkAllAsRead() {
  await notificationStore.markAllAsRead();
  items.value.forEach((i) => (i.isRead = true));
  if (activeTab.value === "unread") {
    items.value = [];
    total.value = 0;
  }
}

async function handleDelete(item: NotificationItem) {
  await notificationStore.deleteNotification(item.id);
  items.value = items.value.filter((i) => i.id !== item.id);
  total.value = Math.max(0, total.value - 1);
}

function handleClickNotification(item: NotificationItem) {
  handleMarkAsRead(item);

  const targetKey = item.extra?.shortname || item.storyId;
  if (targetKey) {
    const query: Record<string, any> = {};
    if (item.commentId) {
      query.commentId = item.commentId;
    }
    if (item.extra?.sceneName) {
      query.scene = item.extra.sceneName;
    }
    router.push({ path: `/play/${targetKey}`, query });
  }
}

function getTypeIcon(type: NotificationType) {
  switch (type) {
    case "comment_story":
      return "mdi:comment-text-outline";
    case "comment_reply":
      return "mdi:reply-outline";
    case "story_update":
      return "mdi:book-refresh-outline";
    case "story_approved":
      return "mdi:check-decagram-outline";
    default:
      return "mdi:bell-outline";
  }
}

function getTypeIconClass(type: NotificationType) {
  switch (type) {
    case "comment_story":
      return "bg-primary/10 text-primary";
    case "comment_reply":
      return "bg-info/10 text-info";
    case "story_update":
      return "bg-success/10 text-success";
    case "story_approved":
      return "bg-warning/10 text-warning";
    default:
      return "bg-base-200 text-base-content";
  }
}

function getTypeBadgeClass(type: NotificationType) {
  switch (type) {
    case "comment_story":
      return "badge-primary";
    case "comment_reply":
      return "badge-info";
    case "story_update":
      return "badge-success";
    case "story_approved":
      return "badge-warning";
    default:
      return "badge-ghost";
  }
}

function getTypeLabel(type: NotificationType) {
  switch (type) {
    case "comment_story":
      return "故事评论";
    case "comment_reply":
      return "评论回复";
    case "story_update":
      return "故事更新";
    case "story_approved":
      return "审核通过";
    default:
      return "系统通知";
  }
}

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

onMounted(() => {
  loadNotifications(1);
});
</script>
