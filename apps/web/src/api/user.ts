import request from "../utils/http";

export interface UserProfile {
  id: string;
  username: string;
  nickname?: string;
  email?: string;
  from?: string;
  avatar?: string;
  isAdmin: boolean;
  isVerified: boolean;
  /** 是否已完成编辑器引导 */
  isToured?: boolean;
  points?: number;
  createdAt?: string;
}

/**
 * Update current user profile (nickname, email)
 */
export function updateProfile(data: { nickname?: string; email?: string }) {
  return request.put<UserProfile>({ url: "/users/profile", data });
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
