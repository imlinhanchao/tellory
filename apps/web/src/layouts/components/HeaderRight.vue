<template>
  <div class="flex items-center gap-1.5 sm:gap-2">
    <!--
      桌面端：创作 / 主题切换 直接展示在导航栏。
      移动端已登录时它们被收纳进头像下拉框，因此这里隐藏；
      移动端未登录时没有下拉框可用，则保持直接展示。
    -->
    <div
      v-if="!isMobile || !isAuthenticated"
      class="flex items-center gap-1.5 sm:gap-2"
    >
      <template v-if="isAuthenticated">
        <router-link
          v-if="userInfo && (userInfo.isVerified || !userInfo.from)"
          to="/story-editor"
          class="btn btn-primary btn-xs sm:btn-sm gap-1 font-medium shadow-xs"
          title="创建故事"
        >
          <Icon icon="mdi:plus" class="w-4 h-4" />
          <span class="hidden sm:inline">创作故事</span>
        </router-link>
        <button
          v-else
          class="btn btn-primary btn-xs sm:btn-sm gap-1 font-medium shadow-xs opacity-60 cursor-not-allowed tooltip tooltip-bottom"
          data-tip="账号未激活，请前往个人主页激活"
          @click.prevent="router.push(profileUrl)"
        >
          <Icon icon="mdi:plus" class="w-4 h-4" />
          <span class="hidden sm:inline">创作故事</span>
        </button>
      </template>

      <label
        class="toggle"
        :class="{
          'text-[#3c3f44]': isDark,
          'text-[#c2c2c4] bg-[#8e96aa24]': !isDark,
        }"
        :title="isDark ? '切换到亮色主题' : '切换到暗色主题'"
      >
        <input
          :checked="isDark"
          class="theme-controller toggle toggle-sm hidden"
          type="checkbox"
          value="dark"
          @change="appStore.toggleTheme()"
        />
        <Icon
          aria-label="enabled"
          icon="twemoji:sun"
          size="1.2em"
          color="#fbb247"
          class="bg-white rounded-full shadow"
        />
        <Icon
          aria-label="disabled"
          icon="akar-icons:moon-fill"
          size="1.2em"
          color="#f5ec39"
          class="fill-black rounded-full"
        />
      </label>
      <div class="divider divider-horizontal my-2 mx-1"></div>
    </div>

    <!-- 站内通知铃铛与快捷面板 -->
    <div v-if="isAuthenticated" class="dropdown dropdown-end">
      <div
        tabindex="0"
        role="button"
        class="btn btn-ghost btn-circle btn-xs sm:btn-sm relative"
        title="站内消息通知"
        @click="handleOpenNotificationMenu"
        @focus="handleOpenNotificationMenu"
        @mouseenter="handlePrefetchNotifications"
      >
        <div class="indicator">
          <Icon icon="mdi:bell-outline" class="size-5" />
          <span
            v-if="notificationStore.unreadCount > 0"
            class="indicator-item badge badge-primary badge-xs text-[10px] min-w-4 h-4 px-1 flex items-center justify-center font-bold"
          >
            {{ notificationStore.unreadCount > 99 ? '99+' : notificationStore.unreadCount }}
          </span>
        </div>
      </div>

      <!-- 下拉通知气泡菜单 -->
      <div
        tabindex="0"
        class="dropdown-content z-50 card card-compact w-80 sm:w-96 p-0 shadow-lg bg-base-100 rounded-2xl border border-base-200 mt-2"
        @focusin="handleOpenNotificationMenu"
      >
        <!-- 头部 -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-base-200">
          <div class="flex items-center gap-2">
            <span class="font-bold text-sm sm:text-base">站内通知</span>
            <span
              v-if="notificationStore.unreadCount > 0"
              class="badge badge-primary badge-xs"
            >
              {{ notificationStore.unreadCount }} 未读
            </span>
          </div>
          <button
            v-if="notificationStore.unreadCount > 0"
            class="text-xs text-primary hover:underline font-medium cursor-pointer"
            @click.stop="notificationStore.markAllAsRead()"
          >
            全部已读
          </button>
        </div>

        <!-- 列表内容区 -->
        <div class="max-h-80 overflow-y-auto divide-y divide-base-200/60">
          <div
            v-if="notificationStore.loading && notificationStore.recentNotifications.length === 0"
            class="flex justify-center py-8"
          >
            <span class="loading loading-spinner loading-sm text-primary"></span>
          </div>

          <div
            v-else-if="notificationStore.recentNotifications.length === 0"
            class="py-10 text-center text-base-content/40 text-sm"
          >
            <Icon icon="mdi:bell-off-outline" class="size-8 mx-auto mb-2 opacity-50" />
            暂无消息通知
          </div>

          <div
            v-for="n in notificationStore.recentNotifications"
            :key="n.id"
            class="px-4 py-3 hover:bg-base-200/50 cursor-pointer transition-colors flex gap-3 text-left"
            :class="{ 'bg-primary/4': !n.isRead }"
            @click="handleNotificationClick(n)"
          >
            <!-- 小图标 -->
            <div
              class="size-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
              :class="getNotifIconClass(n.type)"
            >
              <Icon :icon="getNotifIcon(n.type)" class="size-4" />
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-1 mb-0.5">
                <span class="text-xs font-semibold line-clamp-1 text-base-content">
                  {{ n.title }}
                </span>
                <span class="text-[11px] text-base-content/40 shrink-0">
                  {{ formatNotifTime(n.createdAt) }}
                </span>
              </div>
              <p class="text-xs text-base-content/70 line-clamp-2 leading-relaxed">
                {{ n.content }}
              </p>
            </div>

            <!-- 未读蓝点 -->
            <div v-if="!n.isRead" class="shrink-0 self-center">
              <span class="size-2 rounded-full bg-primary block"></span>
            </div>
          </div>
        </div>

        <!-- 底部跳转完整通知中心 -->
        <div class="p-2 border-t border-base-200 text-center">
          <router-link
            to="/notifications"
            class="btn btn-ghost btn-xs w-full text-primary font-medium"
            @click="closeActiveDropdown"
          >
            查看所有通知
            <Icon icon="mdi:chevron-right" class="size-4" />
          </router-link>
        </div>
      </div>
    </div>

    <!-- 用户头像下拉框 -->
    <div
      v-if="isAuthenticated && authStore.getUser"
      class="dropdown dropdown-end"
    >
      <label tabindex="0" class="avatar">
        <Avatar :user="userInfo" size="36" />
      </label>
      <ul
        tabindex="0"
        class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-60"
      >
        <!-- 仅移动端展示：创作故事 + 主题切换 -->
        <li class="md:hidden">
          <template v-if="userInfo && userInfo.isVerified">
            <router-link to="/story-editor">
              <Icon icon="mdi:plus" class="w-4 h-4" />
              创作故事
            </router-link>
          </template>
          <template v-else>
            <a @click.prevent="router.push(profileUrl)" class="opacity-60 cursor-not-allowed tooltip tooltip-end" data-tip="账号未激活，请前往个人主页激活">
              <Icon icon="mdi:plus" class="w-4 h-4" />
              创作故事
            </a>
          </template>
        </li>
        <li class="md:hidden">
          <a @click.prevent="appStore.toggleTheme()">
            <Icon
              :icon="isDark ? 'twemoji:sun' : 'akar-icons:moon-fill'"
              class="w-4 h-4"
            />
            {{ isDark ? "切换到亮色主题" : "切换到暗色主题" }}
          </a>
        </li>
        <li class="md:hidden">
          <span class="divider my-0"></span>
        </li>
        <li>
          <router-link to="/notifications" class="flex items-center justify-between">
            <span class="flex items-center gap-2">
              <Icon icon="mdi:bell-outline" class="w-4 h-4" />
              消息通知
            </span>
            <span
              v-if="notificationStore.unreadCount > 0"
              class="badge badge-primary badge-xs"
            >
              {{ notificationStore.unreadCount }}
            </span>
          </router-link>
        </li>
        <li :class="{ 'md:hidden': !appStore.customHeaderTitle }">
          <router-link :to="{ path: '/my-stories' }">
            <Icon icon="mdi:book-open-outline" class="w-4 h-4" />
            我的故事
          </router-link>
        </li>
        <li>
          <router-link :to="{ path: profileUrl }">
            <Icon icon="mdi:account-circle-outline" class="w-4 h-4" />
            个人中心
          </router-link>
        </li>
        <li v-if="authStore.isAdmin">
          <router-link to="/admin/reviews">
            <Icon icon="mdi:shield-check-outline" class="w-4 h-4" />
            审核中心
          </router-link>
        </li>
        <li v-if="authStore.isAdmin">
          <router-link to="/admin/stories">
            <Icon icon="mdi:book-multiple-outline" class="w-4 h-4" />
            所有故事
          </router-link>
        </li>
        <li v-if="authStore.isAdmin">
          <router-link to="/admin/reports">
            <Icon icon="mdi:flag-outline" class="w-4 h-4" />
            举报处理
          </router-link>
        </li>
        <span class="divider my-0"></span>
        <li>
          <a class="text-error" @click.prevent="handleLogout">
            <Icon icon="mdi:logout" class="w-4 h-4" />
            退出登录
          </a>
        </li>
      </ul>
    </div>
    <div v-else>
      <router-link to="/login" class="btn btn-ghost btn-xs sm:btn-sm gap-1">
        <Icon icon="basil:login-solid" class="w-4 h-4" />
        <span>登录</span>
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "@/stores/modules/app";
import { useAuthStore } from "@/stores/modules/auth";
import { useNotificationStore } from "@/stores/modules/notification";
import type { NotificationItem, NotificationType } from "@/api/notifications";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { Icon } from "@iconify/vue";

const authStore = useAuthStore();
const appStore = useAppStore();
const notificationStore = useNotificationStore();
const router = useRouter();

const isDark = computed(() => appStore.getTheme === "dark");
const isAuthenticated = computed(() => authStore.isAuthenticated);
const isMobile = computed(() => appStore.isMobile);

watch(
  () => authStore.isAuthenticated,
  (authed) => {
    if (authed) {
      notificationStore.startPolling();
      notificationStore.fetchRecent();
    } else {
      notificationStore.stopPolling();
    }
  },
  { immediate: true },
);

onMounted(() => {
  if (authStore.isAuthenticated) {
    notificationStore.startPolling();
    notificationStore.fetchRecent();
  }
});

onBeforeUnmount(() => {
  notificationStore.stopPolling();
});

function handleOpenNotificationMenu() {
  notificationStore.fetchRecent();
}

function handlePrefetchNotifications() {
  if (notificationStore.recentNotifications.length === 0) {
    notificationStore.fetchRecent();
  }
}

function closeActiveDropdown() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

function handleNotificationClick(item: NotificationItem) {
  notificationStore.markAsRead(item.id);
  closeActiveDropdown();
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

function getNotifIcon(type: NotificationType) {
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

function getNotifIconClass(type: NotificationType) {
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

function formatNotifTime(timestamp: number) {
  if (!timestamp) return "";
  const diff = Date.now() - Number(timestamp);
  if (diff < 60 * 1000) return "刚刚";
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))} 分钟前`;
  if (diff < 24 * 60 * 60 * 1000)
    return `${Math.floor(diff / (60 * 60 * 1000))} 小时前`;
  if (diff < 30 * 24 * 60 * 60 * 1000)
    return `${Math.floor(diff / (24 * 60 * 60 * 1000))} 天前`;
  return new Date(Number(timestamp)).toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
}

function handleLogout() {
  notificationStore.stopPolling();
  authStore.logout();
  router.push({ path: "/" });
}

const userInfo = computed(() => authStore.getUser);
const profileUrl = computed(() =>
  userInfo.value.from
    ? `/${userInfo.value.from}/${userInfo.value.username}`
    : `/${userInfo.value.username}`,
);
</script>
