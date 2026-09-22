import request from "@/utils/http";

export type NotificationType =
  | "comment_story"
  | "comment_reply"
  | "story_update"
  | "story_approved";

export interface NotificationSender {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  senderId?: string;
  storyId?: string;
  commentId?: string;
  extra?: {
    storyTitle?: string;
    shortname?: string;
    commentContent?: string;
    replyContent?: string;
    isInline?: boolean;
    isInlineReply?: boolean;
    rootCommentId?: string;
    sceneName?: string;
    selectedText?: string;
    [key: string]: any;
  };
  isRead: boolean;
  createdAt: number;
  updatedAt: number;
  sender?: NotificationSender;
}

export interface QueryNotificationsParams {
  isRead?: boolean;
  type?: NotificationType | string;
  page?: number;
  limit?: number;
}

export interface NotificationListResponse {
  data: NotificationItem[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
}

/**
 * 分页获取通知列表
 */
export function getNotifications(
  params?: QueryNotificationsParams,
): Promise<NotificationListResponse> {
  const cleanParams: Record<string, any> = {};
  if (params?.isRead !== undefined) cleanParams.isRead = params.isRead;
  if (params?.type) cleanParams.type = params.type;
  if (params?.page) cleanParams.page = params.page;
  if (params?.limit) cleanParams.limit = params.limit;

  return request.get<NotificationListResponse>({
    url: "/notifications",
    params: cleanParams,
  });
}

/**
 * 获取未读通知总数
 */
export function getUnreadNotificationCount(): Promise<{ count: number }> {
  return request.get<{ count: number }>({
    url: "/notifications/unread-count",
  });
}

/**
 * 标记单条通知为已读
 */
export function markNotificationAsRead(
  id: string,
): Promise<{ success: boolean }> {
  return request.put<{ success: boolean }>({
    url: `/notifications/${id}/read`,
  });
}

/**
 * 标记所有未读通知为已读
 */
export function markAllNotificationsAsRead(): Promise<{
  success: boolean;
}> {
  return request.put<{ success: boolean }>({
    url: "/notifications/read-all",
  });
}

/**
 * 删除单条通知
 */
export function deleteNotification(
  id: string,
): Promise<{ success: boolean }> {
  return request.delete<{ success: boolean }>({
    url: `/notifications/${id}`,
  });
}
