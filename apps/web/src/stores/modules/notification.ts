import { defineStore } from "pinia";
import { ref } from "vue";
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead as apiMarkAsRead,
  markAllNotificationsAsRead as apiMarkAllAsRead,
  deleteNotification as apiDeleteNotification,
  type NotificationItem,
} from "@/api/notifications";
import { useAuthStore } from "./auth";

export const useNotificationStore = defineStore("notification", () => {
  const unreadCount = ref<number>(0);
  const recentNotifications = ref<NotificationItem[]>([]);
  const loading = ref<boolean>(false);
  let pollTimer: any = null;

  async function fetchUnreadCount() {
    const authStore = useAuthStore();
    if (!authStore.isAuthenticated) {
      unreadCount.value = 0;
      return;
    }
    try {
      const res = await getUnreadNotificationCount();
      unreadCount.value = res.count || 0;
    } catch {
      // 忽略未登录或临时网络错误
    }
  }

  async function fetchRecent() {
    const authStore = useAuthStore();
    if (!authStore.isAuthenticated) return;
    loading.value = true;
    try {
      const res = await getNotifications({ page: 1, limit: 10 });
      recentNotifications.value = res.data || [];
      unreadCount.value = res.unreadCount ?? 0;
    } catch (err) {
      console.error("fetchRecent notifications error:", err);
    } finally {
      loading.value = false;
    }
  }

  async function markAsRead(id: string) {
    try {
      await apiMarkAsRead(id);
      const item = recentNotifications.value.find((n) => n.id === id);
      if (item && !item.isRead) {
        item.isRead = true;
        unreadCount.value = Math.max(0, unreadCount.value - 1);
      }
    } catch {
      // 忽略错误
    }
  }

  async function markAllAsRead() {
    try {
      await apiMarkAllAsRead();
      for (const n of recentNotifications.value) {
        n.isRead = true;
      }
      unreadCount.value = 0;
    } catch {
      // 忽略错误
    }
  }

  async function deleteNotification(id: string) {
    try {
      await apiDeleteNotification(id);
      const index = recentNotifications.value.findIndex((n) => n.id === id);
      if (index !== -1) {
        const [removed] = recentNotifications.value.splice(index, 1);
        if (!removed.isRead) {
          unreadCount.value = Math.max(0, unreadCount.value - 1);
        }
      }
    } catch {
      // 忽略错误
    }
  }

  function startPolling(intervalMs = 60000) {
    stopPolling();
    fetchUnreadCount();
    fetchRecent();
    pollTimer = setInterval(() => {
      fetchUnreadCount();
    }, intervalMs);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  return {
    unreadCount,
    recentNotifications,
    loading,
    fetchUnreadCount,
    fetchRecent,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    startPolling,
    stopPolling,
  };
});
