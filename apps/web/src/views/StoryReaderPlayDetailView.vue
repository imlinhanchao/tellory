<template>
  <div class="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 w-full max-w-[1920px] mx-auto">
    <!-- 面包屑与顶部导航 -->
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-base-100 p-4 sm:p-5 rounded-2xl border border-base-200/80 shadow-2xs"
    >
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="btn btn-ghost btn-circle btn-sm shrink-0"
          title="返回读者列表"
          @click="goBackToReaders"
        >
          <Icon icon="mdi:arrow-left" class="w-5 h-5 text-base-content/80" />
        </button>

        <div class="min-w-0">
          <!-- 面包屑 -->
          <div class="breadcrumbs text-xs text-base-content/50 py-0 mb-1">
            <ul>
              <li>
                <router-link to="/my-stories" class="hover:text-primary">我的故事</router-link>
              </li>
              <li>
                <router-link
                  :to="`/story/${storyRouteKey}/play`"
                  class="hover:text-primary truncate max-w-40 sm:max-w-xs"
                >
                  {{ detail?.story?.title || "读者进度" }}
                </router-link>
              </li>
              <li class="font-medium text-base-content/80">游玩详情</li>
            </ul>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="text-base sm:text-lg font-bold text-base-content tracking-tight">
              读者阅读轨迹详情
            </h2>
            <span
              v-if="detail"
              class="badge badge-xs"
              :class="detail.isEnding ? 'badge-neutral badge-soft' : 'badge-warning badge-soft'"
            >
              {{ detail.isEnding ? "已完结" : "进行中" }}
            </span>
            <span v-if="detail?.id" class="badge badge-ghost badge-xs font-mono">
              ID: {{ detail.id.slice(0, 8) }}
            </span>
          </div>
        </div>
      </div>

      <!-- 右侧：读者其他游玩记录快速切换与刷新 -->
      <div class="flex items-center gap-2 self-start sm:self-auto flex-wrap">
        <div v-if="siblingPlays.length > 1" class="dropdown dropdown-end">
          <label tabindex="0" class="btn btn-xs sm:btn-sm btn-outline gap-1 text-xs">
            <Icon icon="mdi:swap-horizontal" class="w-4 h-4 text-primary" />
            <span>切换该读者游玩 ({{ siblingPlays.length }})</span>
          </label>
          <ul
            tabindex="0"
            class="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-64 z-50 text-xs border border-base-200 mt-1 max-h-72 overflow-y-auto"
          >
            <li class="menu-title text-[11px]">该读者的游玩记录</li>
            <li v-for="(sp, idx) in siblingPlays" :key="sp.id">
              <a
                :class="{ active: sp.id === playId }"
                class="flex items-center justify-between py-2"
                @click="switchPlay(sp.id)"
              >
                <div class="flex flex-col min-w-0">
                  <span class="font-medium truncate">
                    记录 #{{ siblingPlays.length - idx }} · {{ sp.currentPassage }}
                  </span>
                  <span class="text-[10px] text-base-content/50">
                    {{ formatTimeShort(sp.updatedAt) }} · {{ sp.stepCount || 0 }} 步
                  </span>
                </div>
                <span
                  class="badge badge-xs shrink-0 ml-1"
                  :class="sp.isEnding ? 'badge-neutral' : 'badge-warning badge-soft'"
                >
                  {{ sp.isEnding ? '完结' : '进行中' }}
                </span>
              </a>
            </li>
          </ul>
        </div>

        <button
          type="button"
          class="btn btn-ghost btn-xs sm:btn-sm btn-circle"
          :title="loading ? '刷新中' : '刷新数据'"
          :disabled="loading"
          @click="loadData"
        >
          <Icon icon="mdi:refresh" class="w-4 h-4" :class="{ 'animate-spin': loading }" />
        </button>
      </div>
    </div>

    <!-- 加载骨架屏 -->
    <div v-if="loading && !detail" class="space-y-4">
      <div class="card bg-base-100 border border-base-200/80 p-5 rounded-2xl space-y-3">
        <div class="skeleton h-5 w-48"></div>
        <div class="skeleton h-32 w-full rounded-xl"></div>
      </div>
      <div class="card bg-base-100 border border-base-200/80 p-5 rounded-2xl space-y-3">
        <div class="skeleton h-96 w-full rounded-xl"></div>
      </div>
    </div>

    <div v-else-if="detail" class="space-y-4 sm:space-y-6">
      <!-- 读者资料与游玩概况横幅卡片 -->
      <div class="card bg-base-100 border border-base-200/80 rounded-2xl shadow-2xs">
        <div class="card-body p-4 sm:p-5">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <!-- 读者个人信息 -->
            <div class="flex items-center gap-3.5 min-w-0">
              <Avatar
                :user="detail.user"
                size="48"
                link
                class="shrink-0 ring-2 ring-base-200"
              />
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-bold text-base text-base-content truncate">
                    {{ detail.user?.nickname || detail.user?.username || (detail.userId ? '未知读者' : '匿名读者') }}
                  </span>
                  <span
                    v-if="detail.user?.username && detail.user.username !== detail.user.nickname"
                    class="text-xs text-base-content/50 font-mono truncate"
                  >
                    @{{ detail.user.username }}
                  </span>
                  <span
                    class="badge badge-xs"
                    :class="detail.isEnding ? 'badge-neutral badge-soft' : 'badge-warning badge-soft'"
                  >
                    {{ detail.isEnding ? '已完结' : '探索进行中' }}
                  </span>
                </div>

                <div class="flex items-center gap-2 sm:gap-4 text-xs text-base-content/60 mt-1 flex-wrap font-mono">
                  <span>开始于：{{ formatTimeExact(detail.createdAt) }}</span>
                  <span class="hidden sm:inline">•</span>
                  <span>最后活跃：{{ formatTimeExact(detail.updatedAt) }}</span>
                </div>
              </div>
            </div>

            <!-- 当前段落与动线步数快速统计 -->
            <div class="flex items-center gap-2 sm:gap-4 flex-wrap border-t md:border-t-0 border-base-200/60 pt-3 md:pt-0">
              <div class="bg-base-200/40 px-3 py-2 rounded-xl text-xs space-y-0.5">
                <div class="text-[11px] text-base-content/50">当前停留在</div>
                <div class="font-bold text-primary truncate max-w-40 sm:max-w-56" :title="detail.currentPassage">
                  {{ detail.currentPassage || '起点' }}
                </div>
              </div>

              <div class="bg-base-200/40 px-3 py-2 rounded-xl text-xs space-y-0.5">
                <div class="text-[11px] text-base-content/50">动线轨迹</div>
                <div class="font-bold text-base-content font-mono">
                  {{ currentTrace.length }} 步
                </div>
              </div>

              <div
                v-if="sessionEnding"
                class="bg-accent/10 text-accent px-3 py-2 rounded-xl text-xs space-y-0.5"
              >
                <div class="text-[11px] opacity-70">达成结局</div>
                <div class="font-bold truncate max-w-36">
                  🏆 {{ sessionEnding.name }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 宽屏适配布局：宽屏下双栏并排 (左侧图与内容预览，右侧变量与动线时序) -->
      <div class="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6 items-start">
        <!-- 主栏（探索动线画布 + 当前段落预览）：宽屏下占据 7~8 列 -->
        <div class="space-y-4 sm:space-y-6 xl:col-span-7 2xl:col-span-8">
          <!-- 探索动线可视化播放器 (StoryTracePlayer) -->
          <div class="card bg-base-100 border border-base-200/80 rounded-2xl shadow-2xs overflow-hidden">
            <div class="card-body p-0">
              <StoryTracePlayer
                v-if="detail.decodedDataset"
                :story="(detail.decodedDataset as any)"
                :trace="currentTrace"
                :point-size="detail.story?.pointSize || 1"
                :end-size="detail.story?.endSize || 1"
                :user-points="userPoints"
                :user-endings="userEndings"
                :is-ending="detail.isEnding"
                height="560px"
              />
              <div
                v-else
                class="p-12 text-center text-xs text-base-content/50 flex flex-col items-center justify-center gap-2"
              >
                <Icon icon="mdi:map-marker-question-outline" class="w-8 h-8 text-base-content/30" />
                <span>未能解析故事场景树数据集，无法渲染可视化动线</span>
              </div>
            </div>
          </div>

          <!-- 当前段落内容预览 -->
          <div class="card bg-base-100 border border-base-200/80 rounded-2xl shadow-2xs">
            <div class="card-body p-4 sm:p-5 space-y-3">
              <div class="flex items-center justify-between pb-2 border-b border-base-200/60">
                <div class="flex items-center gap-2">
                  <Icon icon="mdi:book-open-page-variant" class="w-4 h-4 text-primary" />
                  <h3 class="font-bold text-sm text-base-content">
                    当前停留段落：{{ detail.currentPassage }}
                  </h3>
                </div>
                <span class="badge badge-primary badge-soft badge-xs">当前位置</span>
              </div>

              <!-- 段落 HTML 预览 -->
              <div
                v-if="detail.html"
                class="prose prose-sm max-w-none p-4 rounded-xl bg-base-200/30 border border-base-200/60 text-base-content/90 leading-relaxed max-h-96 overflow-y-auto"
                v-html="detail.html"
              ></div>
              <div
                v-else
                class="text-xs text-base-content/50 italic p-6 text-center bg-base-200/20 rounded-xl"
              >
                无当前段落 HTML 渲染缓存
              </div>
            </div>
          </div>
        </div>

        <!-- 侧栏（变量快照 + 解锁项 + 时序动线时间轴）：宽屏下占据 5~4 列并排显示 -->
        <div class="space-y-4 sm:space-y-6 xl:col-span-5 2xl:col-span-4">
          <!-- 状态变量快照与解锁项卡片 -->
          <div class="card bg-base-100 border border-base-200/80 rounded-2xl shadow-2xs">
            <div class="card-body p-4 sm:p-5 space-y-4">
              <!-- 变量快照 -->
              <div>
                <div class="flex items-center justify-between pb-2 border-b border-base-200/60 mb-2.5">
                  <div class="flex items-center gap-1.5 text-sm font-bold text-base-content">
                    <Icon icon="mdi:variable" class="w-4 h-4 text-primary" />
                    <span>状态变量快照 ({{ Object.keys(detail.variables || {}).length }})</span>
                  </div>
                </div>

                <div
                  v-if="detail.variables && Object.keys(detail.variables).length > 0"
                  class="space-y-1.5 max-h-48 overflow-y-auto pr-1"
                >
                  <div
                    v-for="(val, key) in detail.variables"
                    :key="key"
                    class="flex items-center justify-between gap-2 p-2 rounded-lg bg-base-200/40 text-xs font-mono"
                  >
                    <span class="text-base-content/60 truncate">{{ key }}:</span>
                    <span class="text-primary font-semibold truncate">{{ formatVariable(val) }}</span>
                  </div>
                </div>
                <div v-else class="text-xs text-base-content/50 italic p-3 text-center bg-base-200/20 rounded-lg">
                  暂无状态变量
                </div>
              </div>

              <!-- 本次游玩解锁项 -->
              <div>
                <div class="flex items-center justify-between pb-2 border-b border-base-200/60 mb-2.5">
                  <div class="flex items-center gap-1.5 text-sm font-bold text-base-content">
                    <Icon icon="mdi:trophy-outline" class="w-4 h-4 text-warning" />
                    <span>本次游玩解锁成就与结局</span>
                  </div>
                  <span class="badge badge-ghost badge-xs">{{ (detail.playUnlocks || []).length }} 项</span>
                </div>

                <div v-if="detail.playUnlocks && detail.playUnlocks.length > 0" class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  <div
                    v-for="un in detail.playUnlocks"
                    :key="un.id"
                    class="p-2 rounded-lg border border-base-200/70 bg-base-200/30 text-xs space-y-0.5"
                  >
                    <div class="flex items-center gap-1.5 font-bold">
                      <Icon
                        :icon="un.type === 'ending' ? 'mdi:flag-checkered' : 'mdi:star-outline'"
                        class="w-3.5 h-3.5"
                        :class="un.type === 'ending' ? 'text-accent' : 'text-primary'"
                      />
                      <span :class="un.type === 'ending' ? 'text-accent' : 'text-primary'">
                        {{ un.name }}
                      </span>
                      <span class="badge badge-xs badge-ghost text-[10px] ml-auto">
                        {{ un.type === 'ending' ? '结局' : '成就' }}
                      </span>
                    </div>
                    <div v-if="un.description" class="text-[11px] text-base-content/60">
                      {{ un.description }}
                    </div>
                  </div>
                </div>
                <div v-else class="text-xs text-base-content/50 italic p-3 text-center bg-base-200/20 rounded-lg">
                  本会话暂未解锁特殊成就或结局
                </div>
              </div>
            </div>
          </div>

          <!-- 详细探索选择动线时间轴 -->
          <div class="card bg-base-100 border border-base-200/80 rounded-2xl shadow-2xs">
            <div class="card-body p-4 sm:p-5 space-y-3">
              <div class="flex items-center justify-between pb-2 border-b border-base-200/60">
                <div class="flex items-center gap-2">
                  <Icon icon="mdi:timeline-text-outline" class="w-4 h-4 text-primary" />
                  <h3 class="font-bold text-sm text-base-content">
                    探索动线时序 (共 {{ currentTrace.length }} 步)
                  </h3>
                </div>
                <span class="text-xs text-base-content/50">每次选择记录</span>
              </div>

              <!-- 时间轴列表 -->
              <div
                v-if="currentTrace.length > 0"
                class="relative pl-6 space-y-3 pt-2 max-h-[520px] overflow-y-auto pr-1"
              >
                <!-- 竖直时间轴引线 -->
                <div class="absolute left-2.5 top-3 bottom-3 w-0.5 bg-base-200"></div>

                <div
                  v-for="(step, sIdx) in currentTrace"
                  :key="sIdx"
                  class="relative flex items-start gap-3 group"
                >
                  <!-- 节点圆点 -->
                  <div
                    class="absolute -left-6 top-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2"
                    :class="
                      step.type === 'start'
                        ? 'bg-primary text-primary-content border-primary'
                        : step.type === 'back'
                          ? 'bg-warning text-warning-content border-warning'
                          : 'bg-base-100 text-base-content border-base-300 group-hover:border-primary'
                    "
                  >
                    {{ sIdx + 1 }}
                  </div>

                  <!-- 节点卡片 -->
                  <div class="flex-1 p-3 rounded-xl border border-base-200 bg-base-200/30 text-xs space-y-1">
                    <div class="flex items-center justify-between gap-2 flex-wrap">
                      <div class="flex items-center gap-1.5">
                        <span
                          class="badge badge-xs font-medium"
                          :class="
                            step.type === 'start'
                              ? 'badge-primary badge-soft'
                              : step.type === 'back'
                                ? 'badge-warning badge-soft'
                                : 'badge-ghost'
                          "
                        >
                          {{ step.type === 'start' ? '开始阅读' : step.type === 'back' ? '撤销回退' : '推进选择' }}
                        </span>

                        <span class="font-semibold text-base-content">
                          {{ step.from ? `${step.from} → ` : '' }}{{ step.to }}
                        </span>
                      </div>

                      <span class="text-[10px] text-base-content/40 font-mono">
                        {{ formatTimeExact(step.at) }}
                      </span>
                    </div>

                    <div v-if="step.action && step.action !== 'start' && step.action !== 'back'" class="text-base-content/70">
                      <span class="text-base-content/40">玩家操作：</span>
                      <span class="font-mono bg-base-200/60 px-1.5 py-0.5 rounded text-[11px]">{{ step.action }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="text-xs text-base-content/50 italic p-6 text-center bg-base-200/20 rounded-xl">
                暂无步骤记录
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Icon } from "@iconify/vue";
import Message from "@/components/msg";
import Avatar from "@/components/Avatar";
import { useAuthStore } from "@/stores/modules/auth";
import StoryTracePlayer from "@/components/StoryTrace/StoryTracePlayer.vue";
import {
  getStoryReaderPlayDetail,
  type IPlayTrace,
  type IStoryReaderPlayDetailResponse,
} from "@/api/play";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const storyId = computed(() => (route.params.storyId as string) || "");
const playId = computed(() => (route.params.playId as string) || "");

const loading = ref(false);
const detail = ref<IStoryReaderPlayDetailResponse | null>(null);

const storyRouteKey = computed(() => {
  return detail.value?.story?.shortname || detail.value?.story?.id || storyId.value;
});

const siblingPlays = computed(() => {
  return detail.value?.readerPlays || [];
});

const currentTrace = computed<IPlayTrace[]>(() => {
  if (!detail.value) return [];
  if (detail.value.trace && detail.value.trace.length > 0) {
    return detail.value.trace;
  }
  return (detail.value.history || []).map((h) => ({
    from: h.from,
    to: h.to,
    action: h.action,
    at: h.at,
    type: h.action === "start" ? ("start" as const) : ("forward" as const),
  }));
});

const userPoints = computed(() => {
  if (!detail.value?.userUnlocks) return [];
  return detail.value.userUnlocks
    .filter((u) => u.type === "achievement")
    .map((u) => ({ name: u.name, description: u.description }));
});

const userEndings = computed(() => {
  if (!detail.value?.userUnlocks) return [];
  return detail.value.userUnlocks
    .filter((u) => u.type === "ending")
    .map((u) => ({ name: u.name, description: u.description }));
});

const sessionEnding = computed(() => {
  if (!detail.value?.playUnlocks) return null;
  return detail.value.playUnlocks.find((u) => u.type === "ending") || null;
});

const loadData = async () => {
  if (!storyId.value || !playId.value) return;
  loading.value = true;
  try {
    const res = await getStoryReaderPlayDetail(storyId.value, playId.value);
    if (!res) {
      Message.error("未找到该游玩记录");
      goToStoryPage();
      return;
    }

    // 权限检查
    const currentUserId = authStore.getUser?.id;
    const isAdmin = authStore.isAdmin;
    if (res.story?.authorId !== currentUserId && !isAdmin) {
      Message.error("仅作者或管理员可以访问该页面");
      goToStoryPage();
      return;
    }

    detail.value = res;
  } catch (error: any) {
    Message.error(error?.message || "无权访问该游玩记录，已返回故事页");
    goToStoryPage();
  } finally {
    loading.value = false;
  }
};

const goBackToReaders = () => {
  router.push({
    name: "story-readers-progress",
    params: { storyId: storyId.value },
  });
};

const goToStoryPage = () => {
  const target = storyRouteKey.value || storyId.value;
  router.replace({ path: `/play/${target}` });
};

const switchPlay = (targetPlayId: string) => {
  if (targetPlayId === playId.value) return;
  router.push({
    name: "story-reader-play-detail",
    params: {
      storyId: storyId.value,
      playId: targetPlayId,
    },
  });
};

const formatVariable = (val: any): string => {
  if (val === null) return "null";
  if (val === undefined) return "undefined";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
};

const formatTimeExact = (timestamp?: number) => {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
};

const formatTimeShort = (timestamp?: number) => {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const m = d.getMonth() + 1;
  const date = d.getDate();
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${m}/${date} ${h}:${min}`;
};

onMounted(() => {
  loadData();
});
</script>
