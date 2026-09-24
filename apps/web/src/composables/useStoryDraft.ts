import { ref, type Ref } from "vue";
import msgbox from "@/components/msgbox";
import type { StoryData } from "@/lib/storyEngine";
import type { IStory } from "@/api/stories";

const LOCAL_DRAFT_PREFIX = "haide-story-draft:";
const LOCAL_DRAFT_NO_ID_KEY = `${LOCAL_DRAFT_PREFIX}no-id`;
const LOCAL_DRAFT_LEGACY_KEY = "haide-story-draft";

export type LocalStoryDraft = {
  storyId: string | null;
  savedAt?: number;
  story: StoryData & Partial<Pick<IStory, "shortname" | "status">>;
};

export function normalizePassageTags(passages: any[]) {
  if (!passages) return [];
  for (const p of passages) {
    if (p.tags == null) {
      p.tags = [];
    } else if (!Array.isArray(p.tags)) {
      p.tags = String(p.tags)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return passages;
}

export const normalizeStoryTags = (tags: unknown): string[] => {
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean);
  if (typeof tags === "string")
    return tags.replaceAll("，", ",").split(",").map((s) => s.trim()).filter(Boolean);
  return [];
};

export const cloneStoryForDraft = (input: Partial<IStory> | StoryData) => {
  const passages = Array.isArray((input as any)?.passages)
    ? (input as any).passages.map((p: any) => ({
        name: String(p?.name || "Untitled"),
        tags: Array.isArray(p?.tags)
          ? p.tags.map((t: any) => String(t).trim()).filter(Boolean)
          : [],
        content: String(p?.content || ""),
      }))
    : [];

  return {
    title: String((input as any)?.title || "未命名故事"),
    startPassage: String(
      (input as any)?.startPassage || passages[0]?.name || "Start",
    ),
    description: String((input as any)?.description || ""),
    shortname:
      typeof (input as any)?.shortname === "string"
        ? (input as any).shortname.trim() || undefined
        : (input as any)?.shortname,
    status: (input as any)?.status,
    tags: normalizeStoryTags((input as any)?.tags),
    passages: normalizePassageTags(passages),
  } as StoryData & Partial<Pick<IStory, "shortname" | "status">>;
};

export const storyFingerprint = (
  input: Partial<IStory> | StoryData | null | undefined,
) => {
  if (!input) return "";
  const normalized = cloneStoryForDraft(input as any);
  delete normalized.status;
  return JSON.stringify(normalized);
};

const parseLocalDraft = (raw: string | null): LocalStoryDraft | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.story) {
      return {
        storyId:
          typeof (parsed as any).storyId === "string"
            ? (parsed as any).storyId
            : null,
        savedAt:
          typeof (parsed as any).savedAt === "number"
            ? (parsed as any).savedAt
            : undefined,
        story: cloneStoryForDraft(parsed.story as StoryData),
      };
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as any).passages)
    ) {
      return {
        storyId: null,
        savedAt: undefined,
        story: cloneStoryForDraft(parsed as StoryData),
      };
    }
  } catch {
    return null;
  }
  return null;
};

const getDraftByKey = (key: string): LocalStoryDraft | null => {
  try {
    const raw = localStorage.getItem(key);
    return parseLocalDraft(raw);
  } catch {
    return null;
  }
};

export default function useStoryDraft() {
  let storyRef: Ref<any> | null = null;
  let currentStoryIdRef: Ref<string | null> | null = null;
  let saveInProgressRef: Ref<boolean> | null = null;
  let readOnlyFlag: boolean | Ref<boolean> | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  // 保存最新已保存状态的快照
  const savedSnapshot = ref<string>("");

  const formatDraftTime = (savedAt?: number) => {
    if (!savedAt || !Number.isFinite(savedAt)) return "未知时间";
    try {
      return new Date(savedAt).toLocaleString("zh-CN", { hour12: false });
    } catch {
      return "未知时间";
    }
  };

  /** 更新已保存快照 */
  const updateSnapshot = (customStory?: any) => {
    const target = customStory ?? storyRef?.value;
    savedSnapshot.value = storyFingerprint(target);
  };

  /** 检查当前内容是否有未保存的更新 */
  const hasUnsavedChanges = (): boolean => {
    const readOnlyNow =
      typeof readOnlyFlag === "boolean"
        ? readOnlyFlag
        : (readOnlyFlag && (readOnlyFlag as Ref<boolean>).value) || false;
    if (readOnlyNow) return false;
    if (!storyRef?.value) return false;
    if (!savedSnapshot.value) return false;
    const currentFp = storyFingerprint(storyRef.value);
    return currentFp !== savedSnapshot.value;
  };

  /** 本地存档只针对无 id 的情况 */
  const saveLocalDraftNow = () => {
    try {
      const sRef = storyRef as Ref<any> | null;
      if (!sRef) return false;
      const storyVal = sRef.value;
      const payload: LocalStoryDraft = {
        storyId: null,
        savedAt: Date.now(),
        story: cloneStoryForDraft(storyVal),
      };
      localStorage.setItem(LOCAL_DRAFT_NO_ID_KEY, JSON.stringify(payload));
      updateSnapshot(storyVal);
      return true;
    } catch {
      return false;
    }
  };

  /** 清除本地草稿（创建成功或主动放弃后） */
  const clearLocalDraft = () => {
    try {
      localStorage.removeItem(LOCAL_DRAFT_NO_ID_KEY);
      localStorage.removeItem(LOCAL_DRAFT_LEGACY_KEY);
    } catch {}
  };

  /** 启动定时自动保存 */
  const startAutoSave = (
    sRef: Ref<any>,
    idRef: Ref<string | null>,
    options?: {
      intervalMs?: number;
      readOnly?: boolean | Ref<boolean>;
      saveInProgressRef?: Ref<boolean>;
      onSaveToServer?: () => Promise<boolean | void>;
    },
  ) => {
    storyRef = sRef;
    currentStoryIdRef = idRef;
    saveInProgressRef = options?.saveInProgressRef ?? null;
    readOnlyFlag = options?.readOnly ?? null;
    const intervalMs = options?.intervalMs ?? 30000;

    stopAutoSave();

    timer = setInterval(async () => {
      try {
        const readOnlyNow =
          typeof readOnlyFlag === "boolean"
            ? readOnlyFlag
            : (readOnlyFlag && (readOnlyFlag as Ref<boolean>).value) || false;
        if (readOnlyNow) return;
        if (saveInProgressRef && saveInProgressRef.value) return;

        // 每次存档保留快照以备检查是否有更新，有更新才触发自动保存
        if (!hasUnsavedChanges()) return;

        const sid = currentStoryIdRef?.value;
        if (!sid) {
          // 本地存档只针对无 id 的情况
          saveLocalDraftNow();
        } else {
          // 有 id 的直接定时存档
          if (options?.onSaveToServer) {
            await options.onSaveToServer();
          }
        }
      } catch (err) {
        console.error("[useStoryDraft] auto save error", err);
      }
    }, intervalMs);
  };

  /** 停止自动保存定时器 */
  const stopAutoSave = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  /** 针对无 id 故事尝试恢复本地草稿 */
  const tryRestoreNoIdDraft = async (args: {
    applyStory: (
      s: StoryData & Partial<Pick<IStory, "shortname" | "status">>,
    ) => void;
  }) => {
    const draft =
      getDraftByKey(LOCAL_DRAFT_NO_ID_KEY) ||
      getDraftByKey(LOCAL_DRAFT_LEGACY_KEY);
    if (!draft) return false;

    const timeText = formatDraftTime(draft.savedAt);
    const shouldLoad = await msgbox.confirm(
      `${timeText} 有一份本地存档，是否载入？`,
      "检测到本地存档",
    );
    if (!shouldLoad) {
      clearLocalDraft();
      return false;
    }
    args.applyStory(draft.story as any);
    updateSnapshot(draft.story);
    return true;
  };

  return {
    startAutoSave,
    stopAutoSave,
    saveLocalDraftNow,
    saveDraftNow: saveLocalDraftNow,
    clearLocalDraft,
    clearDraftAfterSave: clearLocalDraft,
    tryRestoreNoIdDraft,
    tryRestoreDraft: tryRestoreNoIdDraft,
    updateSnapshot,
    hasUnsavedChanges,
    savedSnapshot,
    storyFingerprint,
    cloneStoryForDraft,
    formatDraftTime,
  };
}
