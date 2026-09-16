import { ref, type Ref } from "vue";
import msgbox from "@/components/msgbox";
import { parseStorySource } from "@/lib/storyEngine";
import type { StoryData } from "@/lib/storyEngine";
import type { IStory } from "@/api/stories";

const LOCAL_DRAFT_PREFIX = "haide-story-draft:";
const LOCAL_DRAFT_NO_ID_KEY = `${LOCAL_DRAFT_PREFIX}no-id`;
const LOCAL_DRAFT_LEGACY_KEY = "haide-story-draft";

type LocalStoryDraft = {
  storyId: string | null;
  savedAt?: number;
  story: StoryData & Partial<Pick<IStory, "shortname" | "status">>;
};

function normalizePassageTags(passages: any[]) {
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

const normalizeStoryTags = (tags: unknown): string[] => {
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean);
  if (typeof tags === "string")
    return tags.replaceAll("，", ",").split(",").map((s) => s.trim()).filter(Boolean);
  return [];
};

const cloneStoryForDraft = (input: Partial<IStory> | StoryData) => {
  const passages = Array.isArray((input as any)?.passages)
    ? (input as any).passages.map((p: any) => ({
        name: String(p?.name || "Untitled"),
        tags: Array.isArray(p?.tags) ? p.tags.map((t: any) => String(t).trim()).filter(Boolean) : [],
        content: String(p?.content || ""),
      }))
    : [];

  return {
    title: String((input as any)?.title || "未命名故事"),
    startPassage: String((input as any)?.startPassage || passages[0]?.name || "Start"),
    description: String((input as any)?.description || ""),
    shortname: typeof (input as any)?.shortname === "string" ? (input as any).shortname.trim() || undefined : (input as any)?.shortname,
    status: (input as any)?.status,
    tags: normalizeStoryTags((input as any)?.tags),
    passages: normalizePassageTags(passages),
  } as StoryData & Partial<Pick<IStory, "shortname" | "status">>;
};

const storyFingerprint = (input: Partial<IStory> | StoryData | null | undefined) => {
  if (!input) return "";
  const normalized = cloneStoryForDraft(input as any);
  return JSON.stringify(normalized);
};

const draftStorageKey = (storyId: string | null | undefined) => {
  const id = (storyId || "").trim();
  if (!id) return LOCAL_DRAFT_NO_ID_KEY;
  return `${LOCAL_DRAFT_PREFIX}${id}`;
};

const parseLocalDraft = (raw: string | null): LocalStoryDraft | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.story) {
      return {
        storyId: typeof (parsed as any).storyId === "string" ? (parsed as any).storyId : null,
        savedAt: typeof (parsed as any).savedAt === "number" ? (parsed as any).savedAt : undefined,
        story: cloneStoryForDraft(parsed.story as StoryData),
      };
    }
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as any).passages)) {
      return { storyId: null, savedAt: undefined, story: cloneStoryForDraft(parsed as StoryData) };
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
  let lastFp = "";

  const toTimestampMs = (value: unknown): number => {
    if (typeof value === "number" && Number.isFinite(value)) return value < 1_000_000_000_000 ? value * 1000 : value;
    if (typeof value === "string") {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) return toTimestampMs(numeric);
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const formatDraftTime = (savedAt?: number) => {
    if (!savedAt || !Number.isFinite(savedAt)) return "未知时间";
    try {
      return new Date(savedAt).toLocaleString("zh-CN", { hour12: false });
    } catch {
      return "未知时间";
    }
  };

  const saveDraftNow = (sid?: string | null) => {
    try {
      const sRef = storyRef as Ref<any> | null;
      if (!sRef) return false;
      const storyVal = sRef.value;
      const storyId = sid ?? (currentStoryIdRef ? currentStoryIdRef.value : null);
      const key = draftStorageKey(storyId);
      const payload: LocalStoryDraft = { storyId: storyId || null, savedAt: Date.now(), story: cloneStoryForDraft(storyVal) };
      localStorage.setItem(key, JSON.stringify(payload));
      if (storyId) {
        localStorage.removeItem(LOCAL_DRAFT_NO_ID_KEY);
        localStorage.removeItem(LOCAL_DRAFT_LEGACY_KEY);
      }
      lastFp = storyFingerprint(storyVal);
      return true;
    } catch {
      return false;
    }
  };

  const clearDraftAfterSave = (savedStoryId: string | null | undefined) => {
    try {
      localStorage.removeItem(draftStorageKey(savedStoryId));
      localStorage.removeItem(LOCAL_DRAFT_NO_ID_KEY);
      localStorage.removeItem(LOCAL_DRAFT_LEGACY_KEY);
      if (storyRef) lastFp = storyFingerprint(storyRef.value);
    } catch {}
  };

  const startAutoSave = (
    sRef: Ref<any>,
    idRef: Ref<string | null>,
    options?: { intervalMs?: number; readOnly?: boolean | Ref<boolean>; saveInProgressRef?: Ref<boolean> },
  ) => {
    storyRef = sRef;
    currentStoryIdRef = idRef;
    saveInProgressRef = options?.saveInProgressRef ?? null;
    readOnlyFlag = options?.readOnly ?? null;
    const intervalMs = options?.intervalMs ?? 30000;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    timer = setInterval(() => {
      try {
        const readOnlyNow = typeof readOnlyFlag === "boolean" ? readOnlyFlag : (readOnlyFlag && (readOnlyFlag as Ref<boolean>).value) || false;
        if (readOnlyNow) return;
        if (saveInProgressRef && saveInProgressRef.value) return;
        const fp = storyFingerprint(storyRef?.value);
        if (!fp || fp === lastFp) return;
        saveDraftNow();
      } catch {}
    }, intervalMs);
  };

  const stopAutoSave = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const tryRestoreDraft = async (args: {
    sid: string | null;
    serverStory?: IStory | null;
    applyStory: (s: StoryData & Partial<Pick<IStory, "shortname" | "status">>) => void;
  }) => {
    const { sid, serverStory, applyStory } = args;
    if (sid) {
      const keys = new Set<string>();
      keys.add(draftStorageKey(sid));
      if (serverStory?.id) keys.add(draftStorageKey(serverStory.id));
      let newest: LocalStoryDraft | null = null;
      for (const key of keys) {
        const d = getDraftByKey(key);
        if (!d) continue;
        if (!newest || (d.savedAt || 0) > (newest.savedAt || 0)) newest = d;
      }
      if (!newest) return false;
      const draftFp = storyFingerprint(newest.story);
      const serverFp = storyFingerprint(serverStory as any);
      const draftTime = newest.savedAt || 0;
      const storyUpdatedAt = toTimestampMs((serverStory as any)?.updatedAt);
      const isNewer = draftTime > storyUpdatedAt;
      const isDifferent = draftFp !== serverFp;
      if (!isDifferent || !isNewer) return false;
      const timeText = formatDraftTime(newest.savedAt);
      const shouldLoad = await msgbox.confirm(`${timeText} 有一份本地存档，是否载入？`, "检测到本地存档");
      if (!shouldLoad) return false;
      applyStory({ ...(newest.story as any), id: serverStory?.id });
      return true;
    }

    const draft = getDraftByKey(LOCAL_DRAFT_NO_ID_KEY) || getDraftByKey(LOCAL_DRAFT_LEGACY_KEY);
    if (!draft) return false;
    const timeText = formatDraftTime(draft.savedAt);
    const shouldLoad = await msgbox.confirm(`${timeText} 有一份本地存档，是否载入？`, "检测到本地存档");
    if (!shouldLoad) return false;
    applyStory(draft.story as any);
    return true;
  };

  return { startAutoSave, stopAutoSave, saveDraftNow, clearDraftAfterSave, tryRestoreDraft };
}
