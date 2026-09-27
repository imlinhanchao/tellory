<template>
  <div class="max-w-6xl mx-auto p-4 space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="flex items-center gap-2 text-xl font-bold">
        <Icon icon="mdi:flask-outline" class="text-2xl text-primary" />
        内测故事
      </h2>
      <span class="text-sm text-base-content/60">
        共 <strong class="font-semibold text-base-content">{{ total }}</strong> 个故事
      </span>
    </div>
    <p class="text-sm text-base-content/60">
      你是这些故事的内测用户，可以在正式上架前提前体验最新内容。
    </p>

    <!-- 加载骨架 -->
    <div
      v-if="loading"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      <div
        v-for="n in 6"
        :key="n"
        class="card bg-base-100 border border-base-200/80 p-4 space-y-3"
      >
        <div class="skeleton h-5 w-3/4"></div>
        <div class="skeleton h-3 w-1/2"></div>
        <div class="skeleton h-10 w-full"></div>
        <div class="skeleton h-8 w-24"></div>
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-else-if="!stories.length"
      class="flex flex-col items-center py-24 text-base-content/50"
    >
      <Icon icon="mdi:flask-outline" class="mb-3 size-16 stroke-1" />
      <p class="text-sm">还没有获得内测资格的故事</p>
      <p class="mt-1 text-xs">作者将你添加为内测用户后，故事会出现在这里</p>
    </div>

    <!-- 故事卡片网格 -->
    <div
      v-else
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      <div
        v-for="s in stories"
        :key="s.id"
        class="card card-compact bg-base-100 border border-base-200/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 rounded-2xl overflow-hidden flex flex-col justify-between"
      >
        <div class="card-body p-4 space-y-3">
          <div class="flex items-start gap-3">
            <Avatar :user="s.author" tip link size="40" />
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-2">
                <h3
                  class="font-bold text-base text-base-content truncate hover:text-primary transition-colors cursor-pointer"
                  @click="openStory(s)"
                >
                  {{ s.title || "未命名" }}
                </h3>
                <span class="badge badge-sm shrink-0" :class="statusClass(s.status)">
                  {{ statusLabel(s.status) }}
                </span>
              </div>
              <div
                class="flex items-center gap-1 text-xs text-base-content/60 truncate mt-0.5"
              >
                <Icon icon="mdi:account-outline" class="w-3.5 h-3.5 shrink-0" />
                <RouterLink
                  :to="userLink(s)"
                  class="truncate hover:text-primary"
                >
                  {{ s.author?.nickname || s.author?.username || "未知作者" }}
                </RouterLink>
              </div>
            </div>
          </div>

          <p
            class="text-xs text-base-content/70 line-clamp-2 leading-relaxed min-h-8"
          >
            {{ s.description || "暂无故事描述" }}
          </p>

          <div class="flex flex-wrap gap-1.5">
            <span
              v-if="!(s.tags || []).length"
              class="badge badge-xs badge-ghost text-base-content/40"
              >无标签</span
            >
            <span
              v-for="t in s.tags || []"
              :key="t"
              class="badge badge-xs badge-secondary badge-soft"
              >{{ t }}</span
            >
          </div>

          <div
            class="flex items-center justify-between gap-2 pt-1 border-t border-base-200"
          >
            <span class="text-xs text-base-content/50">
              {{ formatDate(s.updatedAt || s.createdAt) }}更新
            </span>
            <button
              class="btn btn-sm gap-1"
              :class="s.status === 'published' ? 'btn-primary' : 'btn-secondary'"
              @click="openStory(s)"
            >
              <Icon
                :icon="
                  s.status === 'published'
                    ? 'mdi:book-open-outline'
                    : 'mdi:play-circle-outline'
                "
                class="w-4 h-4"
              />
              {{ s.status === "published" ? "开始阅读" : "进入试玩" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { Icon } from "@iconify/vue";
import Avatar from "@/components/Avatar/src/Avatar.vue";
import { listMyBetaStories, type IBetaStory } from "@/api/stories";
import { storyRouteKey } from "@/lib/storyRoute";

const router = useRouter();
const loading = ref(true);
const stories = ref<IBetaStory[]>([]);
const total = ref(0);

async function load() {
  loading.value = true;
  try {
    const res = await listMyBetaStories();
    stories.value = res?.data || [];
    total.value = res?.total ?? stories.value.length;
  } catch (e) {
    console.error("[BetaStories] load failed", e);
  } finally {
    loading.value = false;
  }
}

/** 已上架的故事走正式阅读路由，未上架的走试玩路由 */
function openStory(story: IBetaStory) {
  const key = storyRouteKey(story);
  if (!key) return;
  router.push({
    name: story.status === "published" ? "play" : "test",
    params: { storyId: key },
  });
}

const userLink = (story: IBetaStory) => {
  const from = story.author?.from;
  const username = story.author?.username;
  if (from && username) return { path: `/${from}/${username}` };
  return { path: `/${username}` };
};

function statusLabel(status?: string) {
  switch (status) {
    case "draft":
      return "创作中";
    case "pending":
      return "待审核";
    case "published":
      return "已上架";
    case "unpublished":
      return "已下架";
    case "rejected":
      return "已拒绝";
    default:
      return "未知";
  }
}

function statusClass(status?: string) {
  switch (status) {
    case "draft":
      return "badge-ghost";
    case "pending":
      return "badge-warning";
    case "published":
      return "badge-success";
    case "unpublished":
      return "badge-error";
    case "rejected":
      return "badge-error";
    default:
      return "badge-ghost";
  }
}

function formatDate(timestamp?: number) {
  const t = Number(timestamp) || 0;
  if (!t) return "";
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

onMounted(load);
</script>
