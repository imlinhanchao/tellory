<template>
  <div class="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
    <!-- 头部信息卡片 -->
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-base-100 p-4 sm:p-5 rounded-2xl border border-base-200/80 shadow-2xs"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"
        >
          <Icon icon="mdi:book-clock-outline" class="w-6 h-6" />
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h2 class="text-lg sm:text-xl font-bold text-base-content tracking-tight">我的阅读历史</h2>
            <span class="badge badge-primary badge-soft badge-xs">个人足迹</span>
          </div>
          <p class="text-xs text-base-content/60 mt-0.5 truncate sm:whitespace-normal">
            回溯探索分支路线，播放场景动线轨迹；达成全成就与结局后可解锁隐藏场景位置
          </p>
        </div>
      </div>

      <div class="flex items-center gap-3 text-xs text-base-content/60">
        <div class="flex items-center gap-1.5 bg-base-200/50 px-3 py-1.5 rounded-xl">
          <Icon icon="mdi:book-open-page-variant-outline" class="w-4 h-4 text-primary shrink-0" />
          <span>已读 <strong class="text-base-content font-semibold">{{ list.length }}</strong> 部故事</span>
        </div>
        <button
          type="button"
          class="btn btn-ghost btn-sm btn-circle"
          :title="loading ? '刷新中' : '刷新阅读历史'"
          @click="loadHistory"
        >
          <Icon icon="mdi:refresh" class="w-4 h-4" :class="{ 'animate-spin': loading }" />
        </button>
      </div>
    </div>

    <!-- 加载骨架屏 -->
    <div v-if="loading && list.length === 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="n in 6"
        :key="n"
        class="card bg-base-100 border border-base-200/80 p-4 sm:p-5 rounded-2xl space-y-3"
      >
        <div class="flex justify-between items-start">
          <div class="skeleton h-5 w-3/4"></div>
          <div class="skeleton h-5 w-14 rounded-full"></div>
        </div>
        <div class="skeleton h-12 w-full rounded-xl"></div>
        <div class="grid grid-cols-2 gap-2">
          <div class="skeleton h-8 w-full rounded-lg"></div>
          <div class="skeleton h-8 w-full rounded-lg"></div>
        </div>
        <div class="flex justify-between items-center pt-2">
          <div class="skeleton h-4 w-24"></div>
          <div class="skeleton h-8 w-24 rounded-lg"></div>
        </div>
      </div>
    </div>

    <!-- 阅读记录卡片列表 -->
    <div
      v-else-if="list.length > 0"
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      <div
        v-for="item in list"
        :key="item.storyId"
        class="card bg-base-100 border border-base-200/80 hover:border-primary/40 rounded-2xl shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden"
      >
        <div class="card-body p-4 sm:p-5 space-y-3">
          <!-- 故事标题与状态 -->
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              <h3
                class="font-bold text-base text-base-content hover:text-primary transition-colors cursor-pointer truncate"
                @click="openTrace(item)"
              >
                {{ item.title || "未命名故事" }}
              </h3>
              <p v-if="item.shortname" class="text-xs text-base-content/50 font-mono mt-0.5">
                {{ item.shortname }}
              </p>
            </div>
            <span
              class="badge badge-sm shrink-0"
              :class="item.play?.isEnding ? 'badge-neutral' : 'badge-success badge-soft'"
            >
              {{ item.play?.isEnding ? "已完结" : "进行中" }}
            </span>
          </div>

          <!-- 故事简介 -->
          <p class="text-xs text-base-content/70 line-clamp-2 leading-relaxed min-h-8">
            {{ item.description || "暂无故事描述" }}
          </p>

          <!-- 成就与结局进度条 -->
          <div class="p-2.5 rounded-xl bg-base-200/40 space-y-2 text-xs">
            <!-- 成就达成状态 -->
            <div class="flex items-center justify-between text-[11px]">
              <span class="flex items-center gap-1 text-base-content/70">
                <Icon icon="mdi:star-outline" class="w-3.5 h-3.5 text-primary" />
                成就解锁
              </span>
              <span class="font-mono font-medium">
                {{ item.points?.length || 0 }} / {{ item.pointSize || 0 }}
              </span>
            </div>
            <progress
              class="progress progress-primary h-1.5 w-full"
              :value="item.points?.length || 0"
              :max="item.pointSize || 1"
            ></progress>

            <!-- 结局达成状态 -->
            <div class="flex items-center justify-between text-[11px]">
              <span class="flex items-center gap-1 text-base-content/70">
                <Icon icon="boxicons:flag-chequered" class="w-3.5 h-3.5 text-accent" />
                结局解锁
              </span>
              <span class="font-mono font-medium">
                {{ item.end?.length || 0 }} / {{ item.endSize || 0 }}
              </span>
            </div>
            <progress
              class="progress progress-accent h-1.5 w-full"
              :value="item.end?.length || 0"
              :max="item.endSize || 1"
            ></progress>

            <!-- 全达成金色标识 -->
            <div
              v-if="checkHasCompletedAll(item)"
              class="flex items-center gap-1 text-[11px] text-warning font-semibold pt-0.5"
            >
              <Icon icon="mdi:trophy" class="w-3.5 h-3.5" />
              <span>全成就与结局已达成（隐藏场景已解锁）</span>
            </div>
          </div>

          <!-- 游玩步数与当前位置元信息 -->
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="bg-base-200/30 p-2 rounded-lg flex flex-col justify-center">
              <span class="text-[10px] text-base-content/50 mb-0.5">当前位置</span>
              <span class="font-mono text-xs font-medium truncate" :title="item.play?.currentPassage">
                {{ item.play?.currentPassage || "起点" }}
              </span>
            </div>
            <div class="bg-base-200/30 p-2 rounded-lg flex flex-col justify-center">
              <span class="text-[10px] text-base-content/50 mb-0.5">探索足迹</span>
              <div class="flex items-center gap-1 font-medium text-xs truncate">
                <Icon icon="mdi:map-marker-path" class="w-3.5 h-3.5 text-primary shrink-0" />
                <span>{{ item.play?.trace?.length || item.play?.history?.length || 0 }} 步动线</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 卡片底部时间与操作 -->
        <div class="border-t border-base-200/80 px-4 sm:px-5 py-3 bg-base-200/20 flex items-center justify-between gap-2">
          <span class="text-[11px] text-base-content/50 truncate flex items-center gap-1">
            <Icon icon="mdi:clock-outline" class="w-3.5 h-3.5 shrink-0" />
            {{ formatTime(item.play?.updatedAt || item.play?.createdAt) }}
          </span>

          <div class="flex items-center gap-2 shrink-0">
            <button
              type="button"
              class="btn btn-sm btn-primary gap-1"
              @click="openTrace(item)"
            >
              <Icon icon="mdi:map-marker-path" class="w-4 h-4" />
              探索动线
            </button>
            <router-link
              :to="item.status === 'published' ? `/play/${item.storyId}` : `/test/${item.storyId}`"
              class="btn btn-sm btn-ghost gap-1"
            >
              <Icon icon="mdi:play-outline" class="w-4 h-4" />
              {{ item.status === "published" ? "游玩" : "试玩" }}
            </router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-else
      class="card bg-base-100 border border-base-200/80 rounded-2xl p-8 sm:p-14 text-center space-y-3"
    >
      <div class="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
        <Icon icon="mdi:book-open-page-variant-outline" class="w-8 h-8" />
      </div>
      <h3 class="font-bold text-base text-base-content">暂无阅读历史</h3>
      <p class="text-xs text-base-content/60 max-w-sm mx-auto">
        您还没有开始阅读任何互动故事。探索丰富的互动故事，随时回溯属于您的抉择动线！
      </p>
      <div class="pt-2">
        <router-link to="/stories" class="btn btn-primary btn-sm gap-1.5">
          <Icon icon="mdi:compass-outline" class="w-4 h-4" />
          去探索故事
        </router-link>
      </div>
    </div>

    <!-- 全屏探索动线弹窗 -->
    <dialog
      ref="traceDialogRef"
      class="modal"
      :class="{ 'modal-open': isTraceModalOpen }"
    >
      <div class="modal-box w-screen max-w-none h-screen max-h-none rounded-none p-0 flex flex-col overflow-hidden bg-base-100">
        <!-- 弹窗加载状态 -->
        <div
          v-if="traceStoryLoading"
          class="flex-1 flex flex-col items-center justify-center p-6 space-y-3"
        >
          <span class="loading loading-spinner loading-lg text-primary"></span>
          <p class="text-xs text-base-content/60">正在加载故事场景树与探索动线...</p>
        </div>

        <!-- 探索动线播放器 -->
        <StoryTracePlayer
          v-else-if="selectedProgress && selectedStoryData"
          :story="selectedStoryData"
          :trace="selectedProgress.play?.trace || []"
          :user-points="selectedProgress.points || []"
          :user-endings="selectedProgress.end || []"
          :point-size="selectedProgress.pointSize"
          :end-size="selectedProgress.endSize"
          :is-ending="selectedProgress.play?.isEnding"
          show-close-button
          @close="closeTraceModal"
        />

        <div
          v-else
          class="flex-1 flex flex-col items-center justify-center p-6 space-y-3 text-base-content/60"
        >
          <p>加载故事数据失败</p>
          <button type="button" class="btn btn-sm btn-ghost" @click="closeTraceModal">关闭</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="button" @click="closeTraceModal">close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { Icon } from "@iconify/vue";
import Message from "@/components/msg";
import {
  getMyReadingHistory,
  getPlayTraceDetail,
  type IUserStoryProgress,
} from "@/api/play";
import StoryTracePlayer from "@/components/StoryTrace/StoryTracePlayer.vue";
import type { StoryData } from "tellory";

const list = ref<IUserStoryProgress[]>([]);
const loading = ref(false);

const isTraceModalOpen = ref(false);
const traceDialogRef = ref<HTMLDialogElement | null>(null);
const selectedProgress = ref<IUserStoryProgress | null>(null);
const selectedStoryData = ref<StoryData | null>(null);
const traceStoryLoading = ref(false);

const loadHistory = async () => {
  loading.value = true;
  try {
    const res = await getMyReadingHistory();
    list.value = res || [];
  } catch (err: any) {
    Message.error(err?.message || "加载阅读历史失败");
  } finally {
    loading.value = false;
  }
};

const checkHasCompletedAll = (item: IUserStoryProgress) => {
  const pts = item.pointSize ?? 0;
  const ends = item.endSize ?? 0;
  const uPts = item.points?.length ?? 0;
  const uEnds = item.end?.length ?? 0;

  if (pts > 0 || ends > 0) {
    const ptsOk = pts === 0 || uPts >= pts;
    const endsOk = ends === 0 || uEnds >= ends;
    return ptsOk && endsOk;
  }
  return item.play?.isEnding ?? false;
};

const openTrace = async (item: IUserStoryProgress) => {
  selectedProgress.value = item;
  selectedStoryData.value = null;
  traceStoryLoading.value = true;
  isTraceModalOpen.value = true;
  traceDialogRef.value?.showModal();

  try {
    const identifier = item.play?.id || item.storyId;
    const res = await getPlayTraceDetail(identifier);
    if (!res) {
      throw new Error("未能获取到游玩记录数据");
    }

    // 同步更及时的 trace 步骤（如果有返回）
    if (res.trace && res.trace.length > 0 && selectedProgress.value?.play) {
      selectedProgress.value.play.trace = res.trace;
    }

    const dataset = res.decodedDataset;
    if (!dataset || !Array.isArray(dataset.passages) || dataset.passages.length === 0) {
      throw new Error("未能从游玩记录中解析到故事场景数据");
    }

    const startPassage =
      dataset.startPassage ||
      dataset.variables?.passage ||
      res.trace?.[0]?.to ||
      item.play?.trace?.[0]?.to ||
      dataset.passages[0]?.name ||
      "";

    selectedStoryData.value = {
      title: dataset.title || item.title || "未命名故事",
      startPassage,
      passages: dataset.passages,
    };
  } catch (err: any) {
    Message.error(err?.message || "加载故事场景数据失败");
  } finally {
    traceStoryLoading.value = false;
  }
};

const closeTraceModal = () => {
  isTraceModalOpen.value = false;
  traceDialogRef.value?.close();
  selectedProgress.value = null;
  selectedStoryData.value = null;
};

const formatTime = (ts?: number) => {
  if (!ts) return "-";
  return new Date(Number(ts)).toLocaleString();
};

onMounted(() => {
  loadHistory();
});
</script>
