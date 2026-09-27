import request from "@/utils/http";
import type { User } from "./auth";
import { StoryData } from "@/lib/storyEngine";

export interface StoryPayload {
  title: string;
  startPassage?: string;
  passageSize?: number;
  description?: string;
  /** 传 null/空串表示清除短名 */
  shortname?: string | null;
  tags?: string[];
}

export interface IStory extends StoryData {
  id?: string;
  title: string;
  startPassage: string;
  passageSize?: number;
  description?: string;
  shortname?: string | null;
  tags?: string[];
  authorId?: string;
  author?: User;
  authorName?: string;
  createdAt?: number;
  updatedAt?: number;
  status?: "draft" | "pending" | "published" | "rejected" | "unpublished";
  reviewReason?: string;
  /** 阅读数（去重玩家） */
  playCount?: number;
  /** 评论数 */
  commentCount?: number;
  /** 喜爱数 */
  likeCount?: number;
  /** 当前登录用户是否已喜爱 */
  liked?: boolean;
}

export async function listStories(
  params: {
    authorId?: string;
    search?: string;
    page?: number;
    limit?: number;
    createdAt?: number;
    private?: number;
  } = {},
) {
  return request.get<{ data: IStory[]; total: number }>({
    url: "/stories",
    params,
  });
}

export async function getStory(id: string) {
  return request.get({ url: `/stories/${id}` });
}

export async function createStory(payload: StoryPayload) {
  return request.post({ url: "/stories", data: payload });
}

export async function updateStory(id: string, payload: Partial<StoryPayload>) {
  return request.put({ url: `/stories/${id}`, data: payload });
}

export async function deleteStory(id: string) {
  return request.delete({ url: `/stories/${id}` });
}

export async function publishStory(id: string) {
  return request.put({ url: `/stories/${id}/publish` });
}

export async function adminPending(limit = 50) {
  return request.get<{ data: IStory[]; total: number }>({
    url: "/stories/admin/pending",
    params: { limit },
  });
}

export async function approveStory(id: string) {
  return request.post({ url: `/stories/${id}/approve` });
}

export async function rejectStory(id: string, reason?: string) {
  return request.post({ url: `/stories/${id}/reject`, data: { reason } });
}

export async function unpublishStory(id: string) {
  return request.post({ url: `/stories/${id}/unpublish` });
}

export async function republishStory(id: string) {
  return request.post({ url: `/stories/${id}/republish` });
}

/** 喜爱故事（不可撤回，重复请求幂等） */
export async function likeStory(id: string) {
  return request.post<{ liked: boolean; likeCount: number }>({
    url: `/stories/${id}/like`,
  });
}

/** 获取用户喜爱的作品列表（公开，仅返回在架故事） */
export async function getUserLikedStories(userId: string) {
  return request.get<{ data: IStory[]; total: number }>({
    url: "/stories/liked",
    params: { userId },
  });
}

export interface IStoryHistoryItem {
  id: string;
  storyId: string;
  title: string;
  shortname?: string | null;
  description?: string;
  passageSize?: number;
  pointSize?: number;
  endSize?: number;
  startPassage?: string;
  authorId?: string;
  tags?: string;
  approvedBy?: string;
  approvedAt: number;
  archivedAt: number;
  approvedByUser?: {
    id: string;
    username: string;
    nickname: string;
    avatar: string;
    from: string;
  } | null;
  /** 仅详情接口返回 */
  content?: string;
}

export async function listStoryHistory(
  storyId: string,
  params: { page?: number; limit?: number } = {},
) {
  return request.get<{
    data: IStoryHistoryItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    url: `/stories/admin/${storyId}/history`,
    params,
  });
}

export async function getStoryHistoryDetail(historyId: string) {
  return request.get<IStoryHistoryItem>({
    url: `/stories/admin/history/${historyId}`,
  });
}

export interface IApprovedStorySnapshot {
  id: string;
  sourceStoryId: string;
  title?: string;
  shortname?: string | null;
  description?: string;
  content?: string;
  passageSize?: number;
  pointSize?: number;
  endSize?: number;
  startPassage?: string;
  authorId?: string;
  tags?: string;
  approvedBy?: string;
  approvedAt?: number;
  isUnpublished?: boolean;
}

/** 管理员：获取某故事当前已发布快照（不存在时返回 null） */
export async function getApprovedStorySnapshot(storyId: string) {
  return request.get<IApprovedStorySnapshot | null>({
    url: `/stories/admin/${storyId}/approved`,
  });
}

/** 内测故事（内测者视角） */
export interface IBetaStory {
  id: string;
  title: string;
  description?: string;
  shortname?: string | null;
  tags?: string[];
  status?: "draft" | "pending" | "published" | "rejected" | "unpublished";
  passageSize?: number;
  updatedAt?: number;
  createdAt?: number;
  author?: User | null;
}

/** 获取当前用户获得内测资格的故事列表 */
export async function listMyBetaStories() {
  return request.get<{ data: IBetaStory[]; total: number }>({
    url: "/stories/beta",
  });
}

/** 内测用户（作者视角） */
export interface IStoryBetaTester {
  id: string;
  username: string;
  nickname?: string;
  avatar?: string;
  from?: string;
  addedAt?: number;
}

/** 作者/管理员：获取故事的内测用户列表 */
export async function listBetaTesters(storyId: string) {
  return request.get<IStoryBetaTester[]>({
    url: `/stories/${storyId}/beta-testers`,
  });
}

/** 作者：添加内测用户 */
export async function addBetaTester(storyId: string, userId: string) {
  return request.post({
    url: `/stories/${storyId}/beta-testers`,
    data: { userId },
  });
}

/** 作者：移除内测用户 */
export async function removeBetaTester(storyId: string, userId: string) {
  return request.delete({
    url: `/stories/${storyId}/beta-testers/${userId}`,
  });
}
