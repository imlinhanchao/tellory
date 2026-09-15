/**
 * 故事在路由/链接中的标识解析。
 *
 * 服务端 `StoriesService.findById` 会先按 id 再按 shortname 匹配，因此链接里
 * 有短名时优先用短名（更短、更好分享），没有短名时退回 id。
 */

export interface StoryRouteIdentity {
  /** 故事主键（Story.id） */
  id?: string | null;
  /** 短名，可选 */
  shortname?: string | null;
  /** 已上架快照里的原始故事 id */
  sourceStoryId?: string | null;
}

/**
 * 返回可用于 `/play/:storyId`、`/test/:storyId`、`/story-editor/:storyId` 的标识。
 * 有 shortname 用 shortname，否则用 id；都没有则返回空串。
 */
export function storyRouteKey(story?: StoryRouteIdentity | null): string {
  if (!story) return "";
  const shortname = (story.shortname || "").trim();
  if (shortname) return shortname;
  return (story.sourceStoryId || story.id || "").trim();
}
