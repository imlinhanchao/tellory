import request from "../utils/http";

export interface UserProfile {
  id: string;
  username: string;
  nickname?: string;
  avatar?: string;
  isAdmin: boolean;
  /** 是否已完成编辑器引导 */
  isToured?: boolean;
  points: number;
  createdAt: string;
}

/**
 * Get current user profile
 */
export function getUserProfile() {
  return request.get<UserProfile>({ url: "/users/profile" });
}

/**
 * 记录当前用户是否已经走过编辑器引导
 */
export function completeTour(isToured = true) {
  return request.post<UserProfile>({ url: "/users/tour", data: { isToured } });
}

/**
 * Get user profile by username
 */
export function getUser(username: string) {
  return request.get<UserProfile>({ url: `/users/${username}` });
}
