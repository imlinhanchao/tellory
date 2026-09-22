import request from "@/utils/http";

export interface CommentUser {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
}

export interface CommentPosition {
  sceneName: string;
  start: number;
  end: number;
  variableSnapshot?: Record<string, any>;
  selectedText?: string;
}

export interface CommentItem {
  id: string;
  storyId: string;
  userId: string;
  content: string;
  parentId?: string | null;
  replyToId?: string | null;
  replyToUserId?: string | null;
  isSpoiler: boolean;
  position?: CommentPosition | null;
  isDeleted: boolean;
  isBlocked: boolean;
  blockReason?: string;
  createdAt: number;
  updatedAt: number;
  author?: CommentUser;
  replyToUser?: CommentUser | null;
  replies?: CommentItem[];
  replyCount?: number;
}

export interface CreateCommentPayload {
  storyId: string;
  content: string;
  parentId?: string;
  replyToId?: string;
  replyToUserId?: string;
  isSpoiler?: boolean;
  position?: CommentPosition;
}

export interface QueryCommentsParams {
  storyId: string;
  sceneName?: string;
  currentSceneName?: string;
  parentId?: string;
  hasPosition?: boolean;
  tree?: boolean;
  includeSpoilers?: boolean;
  limit?: number;
  page?: number;
  createdAt?: number;
  variables?: string | Record<string, any>;
}

export function matchVariableSnapshot(
  snapshot?: Record<string, any> | string | null,
  currentVariables?: Record<string, any> | string | null,
): boolean {
  let parsedSnapshot = snapshot;
  if (typeof parsedSnapshot === "string") {
    try {
      parsedSnapshot = JSON.parse(parsedSnapshot);
    } catch {
      return false;
    }
  }
  if (
    !parsedSnapshot ||
    typeof parsedSnapshot !== "object" ||
    Object.keys(parsedSnapshot).length === 0
  ) {
    return true;
  }
  let parsedVars = currentVariables;
  if (typeof parsedVars === "string") {
    try {
      parsedVars = JSON.parse(parsedVars);
    } catch {
      return false;
    }
  }
  if (!parsedVars || typeof parsedVars !== "object") {
    return false;
  }
  for (const [key, expectedVal] of Object.entries(parsedSnapshot)) {
    const actualVal =
      parsedVars[key] !== undefined ? parsedVars[key] : 0;
    const normExpected = expectedVal !== undefined ? expectedVal : 0;
    if (JSON.stringify(actualVal) !== JSON.stringify(normExpected)) {
      return false;
    }
  }
  return true;
}

export function getComments(params: QueryCommentsParams) {
  const cleanParams: Record<string, any> = {};
  for (const [key, value] of Object.entries(params)) {
    if (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      value !== "undefined"
    ) {
      if (key === "variables" && typeof value === "object") {
        cleanParams[key] = JSON.stringify(value);
      } else {
        cleanParams[key] = value;
      }
    }
  }
  return request.get<{
    data: CommentItem[];
    total: number;
    page: number;
    limit: number;
  }>({
    url: "/comments",
    params: cleanParams,
  });
}

export function createComment(data: CreateCommentPayload) {
  return request.post<CommentItem>({
    url: "/comments",
    data,
  });
}

export function deleteComment(id: string) {
  return request.delete<{ success: boolean; softDeleted: boolean }>({
    url: `/comments/${id}`,
  });
}

export function reportComment(
  id: string,
  data: { reason: string; description?: string },
) {
  return request.post({
    url: `/comments/${id}/report`,
    data,
  });
}

export function blockComment(id: string, reason?: string) {
  return request.post({
    url: `/comments/${id}/block`,
    data: { reason },
  });
}

export function unblockComment(id: string) {
  return request.post({
    url: `/comments/${id}/unblock`,
  });
}

export interface CommentReportItem {
  id: string;
  commentId: string;
  storyId: string;
  reporterId: string;
  reason: string;
  description?: string;
  status: "pending" | "resolved" | "dismissed";
  resolvedBy?: string;
  resolvedAt?: number;
  handleNote?: string;
  createdAt: number;
  reporter?: CommentUser | null;
  comment?: CommentItem | null;
}

export interface QueryReportsParams {
  status?: "pending" | "resolved" | "dismissed" | "all";
  storyId?: string;
  page?: number;
  limit?: number;
}

export interface ResolveReportPayload {
  action: "block" | "dismiss";
  note?: string;
}

export function getAdminReports(params: QueryReportsParams) {
  const cleanParams: Record<string, any> = {};
  for (const [key, value] of Object.entries(params)) {
    if (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      value !== "undefined"
    ) {
      cleanParams[key] = value;
    }
  }
  return request.get<{
    data: CommentReportItem[];
    total: number;
    page: number;
    limit: number;
  }>({
    url: "/comments/admin/reports",
    params: cleanParams,
  });
}

export function resolveAdminReport(id: string, data: ResolveReportPayload) {
  return request.post<CommentReportItem>({
    url: `/comments/admin/reports/${id}/resolve`,
    data,
  });
}
