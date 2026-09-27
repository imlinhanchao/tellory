<template>
  <div class="p-4">
    <div v-if="loading" class="text-center py-8">加载中…</div>
    <div v-else>
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-xl font-bold">审核：{{ story?.title }}</h2>
        <div class="flex items-center gap-2">
          <button class="btn btn-sm" @click="goBack">返回</button>
          <button
            class="btn btn-sm btn-ghost"
            :disabled="!approved?.content"
            :title="
              approved?.content
                ? '对比当前已发布版本与提审版本的 content 差异'
                : '该故事尚无已发布版本，无法对比'
            "
            @click="openDiff"
          >
            <Icon icon="mdi:compare" class="w-4 h-4" />
            版本对比
          </button>
          <button class="btn btn-sm btn-ghost" @click="goHistory">
            历史版本
          </button>
          <button class="btn btn-sm btn-ghost" @click="rejectPrompt">
            拒绝
          </button>
          <button class="btn btn-sm btn-primary" @click="approve">通过</button>
        </div>
      </div>
      <StoryEditorView :readOnly="true" :initialStory="story" />
    </div>

    <!-- 已发布版本 vs 提审版本 内容差异弹窗 -->
    <dialog ref="diffDialogRef" class="modal">
      <div class="modal-box max-w-384 w-11/12 p-0 overflow-hidden">
        <div
          class="px-5 py-4 border-b border-base-200 flex items-center justify-between gap-3 flex-wrap"
        >
          <div class="flex items-center gap-2 flex-wrap">
            <h3 class="font-bold text-base">版本内容差异</h3>
            <span class="badge badge-sm badge-ghost">
              已发布版本{{ approvedText }}
            </span>
            <Icon icon="mdi:arrow-right" class="w-4 h-4 text-base-content/50" />
            <span class="badge badge-sm badge-primary badge-soft">提审版本</span>
          </div>
          <div class="flex items-center gap-2">
            <select
              v-model="diffLayout"
              class="select select-bordered select-xs"
              title="对比布局"
            >
              <option value="side-by-side">并排</option>
              <option value="line-by-line">行内</option>
            </select>
            <select
              v-model="diffStyle"
              class="select select-bordered select-xs"
              title="高亮粒度"
            >
              <option value="word">按词对比</option>
              <option value="char">按字符对比</option>
            </select>
            <form method="dialog">
              <button class="btn btn-sm btn-circle btn-ghost">✕</button>
            </form>
          </div>
        </div>

        <div class="p-4 max-h-[78vh] overflow-y-auto">
          <StoryDiffViewer
            v-if="approved"
            :old-content="approved.content || ''"
            :new-content="story?.content || ''"
            old-label="已发布版本（线上快照）"
            new-label="提审版本（最新修改）"
            :old-meta="approved.approvedAt ? `通过于 ${new Date(Number(approved.approvedAt)).toLocaleString()}` : ''"
            :new-meta="story?.updatedAt ? `更新于 ${new Date(Number(story.updatedAt)).toLocaleString()}` : ''"
          />
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Icon } from "@iconify/vue";
import StoryDiffViewer from "@/components/StoryDiff/StoryDiffViewer.vue";
import StoryEditorView from "@/views/StoryEditorView.vue";
import {
  getStory,
  getApprovedStorySnapshot,
  approveStory,
  rejectStory,
  type IApprovedStorySnapshot,
} from "@/api/stories";
import { useAppStore } from "@/stores/modules/app";
import msg from "@/components/msg";
import msgbox from "@/components/msgbox";

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const id = (route.params.id as string) || "";
const story = ref<any | null>(null);
const loading = ref(true);
const isDark = computed(() => appStore.getTheme === "dark");

/** 当前已发布快照（提审前线上生效的版本），可能不存在（首次上架） */
const approved = ref<IApprovedStorySnapshot | null>(null);

// 差异弹窗状态
const diffDialogRef = ref<HTMLDialogElement | null>(null);
const diffLayout = ref<"side-by-side" | "line-by-line">("side-by-side");
const diffStyle = ref<"word" | "char">("word");

const formatTime = (ts?: number) => {
  if (!ts) return "-";
  return new Date(Number(ts)).toLocaleString();
};

const approvedText = computed(() =>
  approved.value?.approvedAt
    ? `（通过于 ${formatTime(approved.value.approvedAt)}）`
    : "",
);

const load = async () => {
  loading.value = true;
  try {
    const [storyRes, approvedRes] = await Promise.all([
      getStory(id),
      getApprovedStorySnapshot(id).catch(() => null),
    ]);
    story.value = storyRes;
    approved.value = approvedRes || null;
  } catch (e) {
    msg.error("加载失败");
  } finally {
    loading.value = false;
  }
};

const goBack = () => router.back();

const goHistory = () => {
  router.push({ name: "admin-story-history", params: { id } });
};

const openDiff = () => {
  if (!approved.value?.content) {
    msg.error("该故事尚无已发布版本，无法对比");
    return;
  }
  diffDialogRef.value?.showModal();
};

const approve = async () => {
  try {
    await approveStory(id);
    msg.success("已通过并上架");
    router.replace({ name: "admin-reviews" });
  } catch (e) {
    msg.error("操作失败");
  }
};

const rejectPrompt = async () => {
  const reason = (await msgbox.prompt("拒绝理由（可选）")) as string | false;
  if (reason === false) return;
  try {
    await rejectStory(id, reason || undefined);
    msg.success("已拒绝");
    router.replace({ name: "admin-reviews" });
  } catch (e) {
    msg.error("操作失败");
  }
};

onMounted(() => load());
</script>

<style scoped></style>
