<template>
  <div class="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 w-full max-w-[1920px] mx-auto">
    <!-- 头部信息栏 -->
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-base-100 p-4 sm:p-5 rounded-2xl border border-base-200/80 shadow-2xs"
    >
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="btn btn-ghost btn-circle btn-sm shrink-0"
          title="返回"
          @click="goBack"
        >
          <Icon icon="mdi:arrow-left" class="w-5 h-5 text-base-content/80" />
        </button>

        <div
          class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"
        >
          <Icon icon="mdi:account-group-outline" class="w-6 h-6" />
        </div>

        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="text-lg sm:text-xl font-bold text-base-content tracking-tight truncate">
              {{ story?.title || "故事读者进度" }}
            </h2>
            <span
              v-if="story?.status"
              class="badge badge-xs"
              :class="story.status === 'published' ? 'badge-success badge-soft' : 'badge-neutral badge-soft'"
            >
              {{ story.status === 'published' ? '已发布' : '草稿' }}
            </span>
            <span v-if="story?.shortname" class="badge badge-ghost badge-xs font-mono">
              /play/{{ story.shortname }}
            </span>
          </div>
          <p class="text-xs text-base-content/60 mt-0.5 truncate sm:whitespace-normal">
            读者阅读进展与游玩记录概览 · 仅作者与管理员可见
          </p>
        </div>
      </div>

      <!-- 操作与跳转 -->
      <div class="flex items-center gap-2 self-end sm:self-auto flex-wrap">
        <button
          type="button"
          class="btn btn-outline btn-xs sm:btn-sm gap-1"
          @click="goToStoryPage"
        >
          <Icon icon="mdi:book-open-page-variant-outline" class="w-3.5 h-3.5" />
          <span>前往故事</span>
        </button>
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

    <!-- 统计卡片栏 -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
      <div class="card bg-base-100 border border-base-200/80 rounded-2xl shadow-2xs p-3.5 sm:p-4">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon icon="mdi:account-multiple-outline" class="w-5 h-5" />
          </div>
          <div class="min-w-0">
            <div class="text-[11px] text-base-content/60 font-medium">读者总数</div>
            <div class="text-lg sm:text-xl font-bold text-base-content mt-0.5">
              {{ stats.totalReaders }}
            </div>
          </div>
        </div>
      </div>

      <div class="card bg-base-100 border border-base-200/80 rounded-2xl shadow-2xs p-3.5 sm:p-4">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
            <Icon icon="mdi:gamepad-variant-outline" class="w-5 h-5" />
          </div>
          <div class="min-w-0">
            <div class="text-[11px] text-base-content/60 font-medium">总游玩次数</div>
            <div class="text-lg sm:text-xl font-bold text-base-content mt-0.5">
              {{ stats.totalPlays }}
            </div>
          </div>
        </div>
      </div>

      <div class="card bg-base-100 border border-base-200/80 rounded-2xl shadow-2xs p-3.5 sm:p-4">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-success/10 text-success flex items-center justify-center shrink-0">
            <Icon icon="mdi:flag-checkered" class="w-5 h-5" />
          </div>
          <div class="min-w-0">
            <div class="text-[11px] text-base-content/60 font-medium">已完结次数</div>
            <div class="text-lg sm:text-xl font-bold text-success mt-0.5">
              {{ stats.completedPlays }}
            </div>
          </div>
        </div>
      </div>

      <div class="card bg-base-100 border border-base-200/80 rounded-2xl shadow-2xs p-3.5 sm:p-4">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-warning/10 text-warning flex items-center justify-center shrink-0">
            <Icon icon="mdi:progress-clock" class="w-5 h-5" />
          </div>
          <div class="min-w-0">
            <div class="text-[11px] text-base-content/60 font-medium">进行中次数</div>
            <div class="text-lg sm:text-xl font-bold text-warning mt-0.5">
              {{ stats.inProgressPlays }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 筛选与搜索工具条 -->
    <div class="card bg-base-100 border border-base-200/80 rounded-2xl shadow-2xs">
      <div class="card-body p-3.5 sm:p-4">
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <!-- 搜索框 -->
          <div class="relative flex-1 max-w-sm">
            <Icon
              icon="mdi:magnify"
              class="w-4 h-4 text-base-content/40 absolute left-3 top-1/2 -translate-y-1/2"
            />
            <input
              v-model.trim="searchQuery"
              type="text"
              class="input input-sm border-base-300 w-full pl-9 text-xs"
              placeholder="搜索读者昵称或用户名..."
            />
            <button
              v-if="searchQuery"
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content"
              @click="searchQuery = ''"
            >
              <Icon icon="mdi:close-circle" class="w-3.5 h-3.5" />
            </button>
          </div>

          <!-- 筛选状态与排序 -->
          <div class="flex items-center gap-2 flex-wrap text-xs">
            <!-- 状态过滤 -->
            <div class="join">
              <button
                type="button"
                class="btn btn-xs join-item"
                :class="statusFilter === 'all' ? 'btn-primary' : 'btn-ghost'"
                @click="statusFilter = 'all'"
              >
                全部 ({{ readers.length }})
              </button>
              <button
                type="button"
                class="btn btn-xs join-item"
                :class="statusFilter === 'in_progress' ? 'btn-primary' : 'btn-ghost'"
                @click="statusFilter = 'in_progress'"
              >
                有进行中
              </button>
              <button
                type="button"
                class="btn btn-xs join-item"
                :class="statusFilter === 'completed' ? 'btn-primary' : 'btn-ghost'"
                @click="statusFilter = 'completed'"
              >
                已达成完结
              </button>
            </div>

            <!-- 排序 -->
            <select v-model="sortBy" class="select select-xs border-base-300 text-xs">
              <option value="recent">最近活跃</option>
              <option value="plays">游玩次数最多</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- 加载骨架屏 -->
    <div v-if="loading && readers.length === 0" class="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
      <div
        v-for="n in 3"
        :key="n"
        class="card bg-base-100 border border-base-200/80 p-4 sm:p-5 rounded-2xl space-y-3"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="skeleton w-11 h-11 rounded-full"></div>
            <div class="space-y-1.5">
              <div class="skeleton h-4 w-32"></div>
              <div class="skeleton h-3 w-20"></div>
            </div>
          </div>
          <div class="skeleton h-5 w-24 rounded-full"></div>
        </div>
        <div class="skeleton h-16 w-full rounded-xl"></div>
      </div>
    </div>

    <!-- 空状态：暂无读者 -->
    <div
      v-else-if="filteredReaders.length === 0"
      class="card bg-base-100 border border-base-200/80 rounded-2xl p-8 sm:p-12 text-center"
    >
      <div class="flex flex-col items-center justify-center gap-3 max-w-sm mx-auto">
        <div class="w-14 h-14 rounded-2xl bg-base-200/70 text-base-content/40 flex items-center justify-center">
          <Icon icon="mdi:book-open-blank-variant-outline" class="w-8 h-8" />
        </div>
        <h3 class="text-base font-bold text-base-content">
          {{ searchQuery ? '未找到匹配的读者' : '暂无读者游玩记录' }}
        </h3>
        <p class="text-xs text-base-content/60 leading-relaxed">
          {{ searchQuery ? '尝试更换搜索关键词或清空筛选条件' : '当有读者阅读并探索你的故事时，这里将汇集每位读者的所有游玩进度与探索动线。' }}
        </p>
        <button
          v-if="searchQuery"
          type="button"
          class="btn btn-outline btn-xs mt-1"
          @click="searchQuery = ''"
        >
          清空搜索
        </button>
      </div>
    </div>

    <!-- 读者卡片列表（宽屏下一行显示多个用户卡片） -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 sm:gap-6 items-start">
      <div
        v-for="reader in filteredReaders"
        :key="reader.userId || reader.latestActiveAt"
        class="card bg-base-100 border border-base-200/80 hover:border-primary/30 rounded-2xl shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between overflow-hidden"
      >
        <div class="card-body p-4 sm:p-5 space-y-4">
          <!-- 卡片头部：读者信息与总体成就/结局徽章 -->
          <div class="flex items-start justify-between gap-3 pb-3 border-b border-base-200/70">
            <!-- 读者个人资料 -->
            <div class="flex items-center gap-3 min-w-0">
              <Avatar
                :user="reader.user"
                size="44"
                link
                class="shrink-0 ring-2 ring-base-200"
              />
              <div class="min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="font-bold text-sm sm:text-base text-base-content truncate">
                    {{ reader.user?.nickname || reader.user?.username || (reader.userId ? '未知读者' : '匿名读者') }}
                  </span>
                  <span
                    v-if="reader.user?.username && reader.user.username !== reader.user.nickname"
                    class="text-xs text-base-content/50 font-mono truncate"
                  >
                    @{{ reader.user.username }}
                  </span>
                  <span
                    v-if="reader.inProgressPlays > 0"
                    class="badge badge-warning badge-soft badge-xs gap-1"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-warning animate-pulse"></span>
                    进行中
                  </span>
                  <span
                    v-else
                    class="badge badge-neutral badge-soft badge-xs"
                  >
                    全部完结
                  </span>
                </div>

                <div class="flex items-center gap-2 text-xs text-base-content/60 mt-1 flex-wrap">
                  <span class="inline-flex items-center gap-1">
                    <Icon icon="mdi:clock-outline" class="w-3.5 h-3.5 text-base-content/40" />
                    最后活动：{{ formatRelativeTime(reader.latestActiveAt) }}
                  </span>
                  <span>•</span>
                  <span>共 {{ reader.plays.length }} 次游玩</span>
                </div>
              </div>
            </div>

            <!-- 成就与结局统计徽章 -->
            <div class="flex items-center gap-1.5 flex-wrap shrink-0 text-xs">
              <div
                class="badge badge-sm badge-soft gap-1"
                :class="reader.points.length > 0 ? 'badge-primary' : 'badge-ghost text-base-content/40'"
                :title="reader.points.map(p => p.name).join('、') || '暂无达成成就'"
              >
                <Icon icon="mdi:star-outline" class="w-3.5 h-3.5 shrink-0" />
                <span>成就 {{ reader.points.length }}{{ story?.pointSize ? ` / ${story.pointSize}` : '' }}</span>
              </div>

              <div
                class="badge badge-sm badge-soft gap-1"
                :class="reader.end.length > 0 ? 'badge-accent' : 'badge-ghost text-base-content/40'"
                :title="reader.end.map(e => e.name).join('、') || '暂无达成结局'"
              >
                <Icon icon="mdi:flag-checkered" class="w-3.5 h-3.5 shrink-0" />
                <span>结局 {{ reader.end.length }}{{ story?.endSize ? ` / ${story.endSize}` : '' }}</span>
              </div>
            </div>
          </div>

          <!-- 该读者的所有 Play 入口与进度展示 -->
          <div class="space-y-2.5 flex-1">
            <div class="flex items-center justify-between text-xs text-base-content/60 px-0.5">
              <span class="font-medium flex items-center gap-1.5">
                <Icon icon="mdi:history" class="w-3.5 h-3.5 text-primary" />
                游玩记录列表 ({{ reader.plays.length }})
              </span>
              <span class="text-[11px] text-base-content/40">点击进入详情</span>
            </div>

            <!-- 垂直展开并支持适度滚动的分支列表 -->
            <div class="space-y-2 max-h-80 overflow-y-auto pr-1">
              <div
                v-for="(play, pIdx) in reader.plays"
                :key="play.id"
                class="p-2.5 sm:p-3 rounded-xl border border-base-200/90 bg-base-200/30 hover:bg-base-200/60 hover:border-primary/40 transition-all cursor-pointer flex flex-col justify-between gap-2 group"
                @click="goToPlayDetail(play.id)"
              >
                <!-- 顶部：次序号与状态 -->
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span class="badge badge-sm badge-ghost font-mono text-[11px] px-1.5">
                      #{{ reader.plays.length - pIdx }}
                    </span>
                    <span
                      class="badge badge-xs"
                      :class="play.isEnding ? 'badge-neutral badge-soft' : 'badge-warning badge-soft'"
                    >
                      {{ play.isEnding ? '已完结' : '进行中' }}
                    </span>
                    <span
                      v-if="play.endingName"
                      class="badge badge-accent badge-soft badge-xs truncate max-w-36"
                      :title="play.endingName"
                    >
                      🏆 {{ play.endingName }}
                    </span>
                  </div>

                  <span class="text-[11px] text-base-content/40 shrink-0 font-mono">
                    {{ formatTimeShort(play.updatedAt) }}
                  </span>
                </div>

                <!-- 中间：当前段落与步数 -->
                <div class="flex items-center justify-between gap-2 text-xs">
                  <div class="flex items-center gap-1.5 min-w-0 text-base-content/80">
                    <Icon icon="mdi:map-marker-outline" class="w-3.5 h-3.5 text-primary shrink-0" />
                    <span class="truncate font-medium" :title="play.currentPassage">
                      {{ play.currentPassage || '起点' }}
                    </span>
                  </div>

                  <div class="flex items-center gap-1 text-[11px] text-base-content/50 shrink-0 font-mono">
                    <Icon icon="mdi:shoe-print" class="w-3 h-3 text-base-content/40" />
                    <span>{{ play.stepCount }} 步</span>
                  </div>
                </div>

                <!-- 底部：入口按钮 -->
                <div class="flex items-center justify-between pt-1 border-t border-base-200/60 text-[11px]">
                  <span class="text-base-content/40 font-mono">
                    ID: {{ play.id.slice(0, 8) }}...
                  </span>

                  <div class="flex items-center gap-1 text-primary group-hover:translate-x-0.5 transition-transform font-medium">
                    <span>查看进度</span>
                    <Icon icon="mdi:chevron-right" class="w-3.5 h-3.5" />
                  </div>
                </div>
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
import {
  getStoryReadersProgress,
  type IStoryReaderProgress,
  type IStoryReadersProgressResponse,
} from "@/api/play";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const storyId = computed(() => (route.params.storyId as string) || "");

const loading = ref(false);
const story = ref<IStoryReadersProgressResponse["story"] | null>(null);
const stats = ref({
  totalReaders: 0,
  totalPlays: 0,
  completedPlays: 0,
  inProgressPlays: 0,
});
const readers = ref<IStoryReaderProgress[]>([]);

const searchQuery = ref("");
const statusFilter = ref<"all" | "in_progress" | "completed">("all");
const sortBy = ref<"recent" | "plays">("recent");

const filteredReaders = computed(() => {
  let list = [...readers.value];

  // 搜索过滤
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase();
    list = list.filter((r) => {
      const nickname = (r.user?.nickname || "").toLowerCase();
      const username = (r.user?.username || "").toLowerCase();
      return nickname.includes(q) || username.includes(q);
    });
  }

  // 状态过滤
  if (statusFilter.value === "in_progress") {
    list = list.filter((r) => r.inProgressPlays > 0);
  } else if (statusFilter.value === "completed") {
    list = list.filter((r) => r.completedPlays > 0);
  }

  // 排序
  if (sortBy.value === "plays") {
    list.sort((a, b) => b.totalPlays - a.totalPlays);
  } else {
    list.sort((a, b) => b.latestActiveAt - a.latestActiveAt);
  }

  return list;
});

const loadData = async () => {
  if (!storyId.value) return;
  loading.value = true;
  try {
    const res = await getStoryReadersProgress(storyId.value);
    if (!res) {
      Message.error("未获取到故事数据");
      goToStoryPage();
      return;
    }

    // 检查权限：必须是作者或管理员
    const currentUserId = authStore.getUser?.id;
    const isAdmin = authStore.isAdmin;
    if (res.story.authorId !== currentUserId && !isAdmin) {
      Message.error("仅作者或管理员可以访问该页面");
      goToStoryPage();
      return;
    }

    story.value = res.story;
    stats.value = res.stats;
    readers.value = res.readers || [];
  } catch (error: any) {
    Message.error(error?.message || "无权访问或故事不存在，已返回故事页");
    goToStoryPage();
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push({ path: "/my-stories" });
  }
};

const goToStoryPage = () => {
  const targetId = story.value?.shortname || story.value?.id || storyId.value;
  router.replace({ path: `/play/${targetId}` });
};

const goToPlayDetail = (playId: string) => {
  router.push({
    name: "story-reader-play-detail",
    params: {
      storyId: storyId.value,
      playId,
    },
  });
};

const formatTimeShort = (timestamp?: number) => {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${month}/${date} ${hours}:${mins}`;
};

const formatRelativeTime = (timestamp?: number) => {
  if (!timestamp) return "从未";
  const diff = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;

  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

onMounted(() => {
  loadData();
});
</script>
