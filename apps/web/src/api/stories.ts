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
