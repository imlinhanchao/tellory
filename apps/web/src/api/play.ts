import request from "@/utils/http";
import { User } from "./auth";

export async function getReleaseStory(storyId: string) {
  return request.get({ url: `/play/story/${storyId}` });
}

export async function createPlay(storyId: string, body: any = {}) {
  return request.post({ url: `/play/${storyId}`, data: body });
}

export async function getPlay(storyId: string) {
  return request.get({ url: `/play/${storyId}` });
}

export interface IEndingUnlock {
  name: string;
  description: string;
}

export interface IUpdatePlayResponse {
  id?: string;
  html?: string;
  end?: IEndingUnlock | null;
  [key: string]: any;
}

export async function updatePlay(
  storyId: string,
  body: { target?: string; action?: string; display?: string; back?: boolean },
) {
  return request.put<IUpdatePlayResponse>({
    url: `/play/${storyId}`,
    data: body,
  });
}

export async function resetPlay(storyId: string) {
  return request.post({ url: `/play/reset/${storyId}` });
}

export interface IUnlock {
  name: string;
  description: string;
}

export interface IUserStoryProgress {
  id: string;
  storyId: string;
  shortname?: string | null;
  status: string;
  title: string;
  description: string;
  points: IUnlock[];
  end: IUnlock[];
  isPlaying: boolean;
  pointSize?: number | null;
  endSize?: number | null;
}

export const getUserUnlocks = (userId: string) => {
  return request.get<IUserStoryProgress[]>({ url: `/play/unlocks/${userId}` });
};

export const getReaders = (storyId: string) => {
  return request.get<User[]>({
    url: `/play/reader/${storyId}`,
  });
};

export interface IAdminPlayRow {
  id: string;
  storyId: string;
  userId?: string;
  currentPassage: string;
  html: string;
  variables: Record<string, any>;
  dataset?: string;
  history: Array<{
    from: string;
    to: string;
    action: string;
    at: number;
    variables?: Record<string, any>;
  }>;
  isEnding: boolean;
  createdAt: number;
  updatedAt: number;
  story?: {
    id: string;
    title?: string;
    shortname?: string | null;
    authorId?: string;
    status?: string;
  } | null;
  user?: {
    id: string;
    username: string;
    nickname: string;
    avatar: string;
    from: string;
  } | null;
}

export interface IAdminPlayDetail extends IAdminPlayRow {
  decodedDataset?: Record<string, any> | null;
}

export const adminListPlays = (params: {
  limit?: number;
  createdAt?: number;
  storyId?: string;
  userId?: string;
} = {}) => {
  return request.get<{ data: IAdminPlayRow[]; total: number }>({
    url: '/play/admin/list',
    params,
  });
};

export const adminGetPlayDetail = (playId: string) => {
  return request.get<IAdminPlayDetail>({
    url: `/play/admin/${playId}`,
  });
};
