<template>
  <div class="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
    <div
      class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-base-100 p-4 sm:p-5 rounded-2xl border border-base-200/80 shadow-2xs"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"
        >
          <Icon icon="mdi:gamepad-variant-outline" class="w-6 h-6" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-xl font-bold text-base-content tracking-tight">游玩管理</h2>
            <span class="badge badge-primary badge-soft badge-xs">管理员</span>
          </div>
          <p class="text-xs text-base-content/60 mt-0.5">
            查看所有游玩会话，支持读取 runtime dataset 解码结果
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2 text-xs text-base-content/60">
        <Icon icon="mdi:database-outline" class="w-4 h-4 text-primary" />
        <span>
          当前列表 <strong class="text-base-content font-semibold">{{ rows.length }}</strong> 条
          / 总计 <strong class="text-base-content font-semibold">{{ total }}</strong> 条
        </span>
      </div>
    </div>

    <div class="card bg-base-100 border border-base-200/80 rounded-2xl">
      <div class="card-body p-4 sm:p-5">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label class="form-control">
            <span class="label-text text-xs text-base-content/60 mb-1">按故事 ID 筛选</span>
            <input
              v-model.trim="filters.storyId"
              type="text"
              class="input input-bordered input-sm"
              placeholder="storyId"
            />
          </label>

          <label class="form-control">
            <span class="label-text text-xs text-base-content/60 mb-1">按用户 ID 筛选</span>
            <input
              v-model.trim="filters.userId"
              type="text"
              class="input input-bordered input-sm"
              placeholder="userId"
            />
          </label>

          <label class="form-control">
            <span class="label-text text-xs text-base-content/60 mb-1">列表数量</span>
            <select v-model.number="filters.limit" class="select select-bordered select-sm">
              <option :value="20">20</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
            </select>
          </label>

          <div class="flex items-end gap-2">
            <button type="button" class="btn btn-primary btn-sm flex-1" :disabled="loading" @click="loadList">
              <Icon icon="mdi:magnify" class="w-4 h-4" />
              查询
            </button>
            <button type="button" class="btn btn-ghost btn-sm" :disabled="loading" @click="resetFilters">
              重置
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading && rows.length === 0" class="space-y-3">
      <div v-for="n in 5" :key="n" class="card bg-base-100 border border-base-200/80 p-4 rounded-xl">
        <div class="skeleton h-5 w-1/3 mb-3"></div>
        <div class="skeleton h-4 w-full"></div>
      </div>
    </div>

    <div v-else class="card bg-base-100 border border-base-200/80 rounded-2xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="table table-zebra table-sm sm:table-md">
          <thead>
            <tr>
              <th>时间</th>
              <th>故事</th>
              <th>用户</th>
              <th>当前段落</th>
              <th>状态</th>
              <th>历史</th>
              <th class="text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in rows" :key="item.id">
              <td class="text-xs text-base-content/70 whitespace-nowrap">{{ formatTime(item.createdAt) }}</td>
              <td>
                <div class="flex flex-col">
                  <span class="font-medium text-sm">{{ item.story?.title || "未知故事" }}</span>
                  <span class="text-xs text-base-content/60 font-mono">{{ item.storyId }}</span>
                </div>
              </td>
              <td>
                <div class="flex flex-col">
                  <span class="text-sm">{{ item.user?.nickname || item.user?.username || "匿名用户" }}</span>
                  <span class="text-xs text-base-content/60 font-mono">{{ item.userId || "(空)" }}</span>
                </div>
              </td>
              <td class="font-mono text-xs max-w-40 truncate" :title="item.currentPassage">
                {{ item.currentPassage }}
              </td>
              <td>
                <span class="badge badge-sm" :class="item.isEnding ? 'badge-neutral' : 'badge-success badge-soft'">
                  {{ item.isEnding ? "已结束" : "进行中" }}
                </span>
              </td>
              <td class="text-sm">{{ item.history?.length || 0 }}</td>
              <td>
                <div class="flex justify-end gap-2">
                  <button type="button" class="btn btn-xs btn-primary" @click="openDetail(item.id)">
                    查看详情
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="!loading && rows.length === 0" class="p-8 text-center text-base-content/60 text-sm">
        暂无游玩记录
      </div>
    </div>

    <dialog ref="detailDialogRef" class="modal">
      <div class="modal-box max-w-5xl p-0 overflow-hidden">
        <div class="px-5 py-4 border-b border-base-200 flex items-center justify-between">
          <h3 class="font-bold text-base">Play 详情</h3>
          <form method="dialog">
            <button class="btn btn-sm btn-circle btn-ghost">✕</button>
          </form>
        </div>

        <div v-if="detailLoading" class="p-8 text-center">
          <span class="loading loading-spinner loading-md text-primary"></span>
        </div>

        <div v-else-if="detail" class="p-5 space-y-5 max-h-[78vh] overflow-y-auto">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div class="card bg-base-200/50 border border-base-200">
              <div class="card-body p-3 space-y-1.5">
                <div><span class="text-base-content/60">Play ID：</span><span class="font-mono text-xs">{{ detail.id }}</span></div>
                <div><span class="text-base-content/60">Story ID：</span><span class="font-mono text-xs">{{ detail.storyId }}</span></div>
                <div><span class="text-base-content/60">User ID：</span><span class="font-mono text-xs">{{ detail.userId || '(空)' }}</span></div>
                <div><span class="text-base-content/60">当前段落：</span><span class="font-mono text-xs">{{ detail.currentPassage }}</span></div>
                <div><span class="text-base-content/60">创建时间：</span>{{ formatTime(detail.createdAt) }}</div>
                <div><span class="text-base-content/60">更新时间：</span>{{ formatTime(detail.updatedAt) }}</div>
              </div>
            </div>

            <div class="card bg-base-200/50 border border-base-200">
              <div class="card-body p-3 space-y-1.5">
                <div><span class="text-base-content/60">故事标题：</span>{{ detail.story?.title || '未知故事' }}</div>
                <div>
                  <span class="text-base-content/60">状态：</span>
                  <span class="badge badge-sm" :class="detail.isEnding ? 'badge-neutral' : 'badge-success badge-soft'">
                    {{ detail.isEnding ? '已结束' : '进行中' }}
                  </span>
                </div>
                <div><span class="text-base-content/60">历史条目：</span>{{ detail.history?.length || 0 }}</div>
                <div><span class="text-base-content/60">变量键数：</span>{{ Object.keys(detail.variables || {}).length }}</div>
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h4 class="font-semibold text-sm">decodedDataset</h4>
              <div class="join">
                <button
                  type="button"
                  class="btn btn-xs btn-ghost join-item"
                  @click="copyStorySourceFromDecodedDataset(detail.decodedDataset)"
                >
                  复制故事源码
                </button>
                <button
                  type="button"
                  class="btn btn-xs btn-ghost join-item"
                  @click="copyJson(detail.decodedDataset)"
                >
                  复制 JSON
                </button>
              </div>
            </div>
            <pre class="bg-base-200/60 border border-base-200 rounded-xl p-3 text-xs overflow-x-auto leading-relaxed"><code>{{ prettyJson(detail.decodedDataset) }}</code></pre>
          </div>

          <div class="space-y-2">
            <h4 class="font-semibold text-sm">variables</h4>
            <pre class="bg-base-200/60 border border-base-200 rounded-xl p-3 text-xs overflow-x-auto leading-relaxed"><code>{{ prettyJson(detail.variables) }}</code></pre>
          </div>

          <div class="space-y-2">
            <h4 class="font-semibold text-sm">history</h4>
            <pre class="bg-base-200/60 border border-base-200 rounded-xl p-3 text-xs overflow-x-auto leading-relaxed"><code>{{ prettyJson(detail.history) }}</code></pre>
          </div>
        </div>

        <div v-else class="p-8 text-center text-base-content/60">未找到详情数据</div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from "vue";
import { Icon } from "@iconify/vue";
import Message from "@/components/msg";
import { serializeStory, type StoryData } from "@/lib/storyEngine";
import {
  adminGetPlayDetail,
  adminListPlays,
  type IAdminPlayDetail,
  type IAdminPlayRow,
} from "@/api/play";

const rows = ref<IAdminPlayRow[]>([]);
const total = ref(0);
const loading = ref(false);
const detailLoading = ref(false);
const detail = ref<IAdminPlayDetail | null>(null);
const detailDialogRef = ref<HTMLDialogElement | null>(null);

const filters = reactive({
  limit: 20,
  storyId: "",
  userId: "",
});

const loadList = async () => {
  loading.value = true;
  try {
    const res = await adminListPlays({
      limit: filters.limit,
      storyId: filters.storyId || '',
      userId: filters.userId || '',
    });
    rows.value = res?.data || [];
    total.value = res?.total || 0;
  } catch (err: any) {
    Message.error(err?.message || "加载游玩数据失败");
  } finally {
    loading.value = false;
  }
};

const openDetail = async (playId: string) => {
  detail.value = null;
  detailLoading.value = true;
  detailDialogRef.value?.showModal();
  try {
    const res = await adminGetPlayDetail(playId);
    detail.value = res;
  } catch (err: any) {
    Message.error(err?.message || "加载详情失败");
    detailDialogRef.value?.close();
  } finally {
    detailLoading.value = false;
  }
};

const resetFilters = async () => {
  filters.limit = 20;
  filters.storyId = "";
  filters.userId = "";
  await loadList();
};

const formatTime = (ts?: number) => {
  if (!ts) return "-";
  return new Date(Number(ts)).toLocaleString();
};

const prettyJson = (value: unknown) => {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value);
  }
};

const copyJson = async (value: unknown) => {
  try {
    await navigator.clipboard.writeText(prettyJson(value));
    Message.success("已复制 JSON");
  } catch {
    Message.error("复制失败");
  }
};

const toStoryData = (decodedDataset: unknown): StoryData | null => {
  if (!decodedDataset || typeof decodedDataset !== "object") return null;
  const raw = decodedDataset as {
    title?: unknown;
    currentPassage?: unknown;
    passages?: unknown;
  };

  if (!Array.isArray(raw.passages) || raw.passages.length === 0) {
    return null;
  }

  const passages = raw.passages
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const passage = item as { name?: unknown; tags?: unknown; content?: unknown };
      const name = typeof passage.name === "string" ? passage.name.trim() : "";
      if (!name) return null;
      const tags = Array.isArray(passage.tags)
        ? passage.tags
            .filter((tag): tag is string => typeof tag === "string")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [];
      const content = typeof passage.content === "string" ? passage.content : "";
      return { name, tags, content };
    })
    .filter(
      (item): item is { name: string; tags: string[]; content: string } =>
        Boolean(item),
    );

  if (passages.length === 0) return null;

  const title =
    typeof raw.title === "string" && raw.title.trim()
      ? raw.title.trim()
      : "未命名故事";

  const candidateStart =
    typeof raw.currentPassage === "string" ? raw.currentPassage.trim() : "";
  const startPassage = passages.some((passage) => passage.name === candidateStart)
    ? candidateStart
    : passages[0].name;

  return {
    title,
    startPassage,
    passages,
  };
};

const copyStorySourceFromDecodedDataset = async (decodedDataset: unknown) => {
  const story = toStoryData(decodedDataset);
  if (!story) {
    Message.error("decodedDataset 中缺少可序列化的故事结构");
    return;
  }

  try {
    await navigator.clipboard.writeText(serializeStory(story));
    Message.success("已复制故事源码");
  } catch {
    Message.error("复制故事源码失败");
  }
};

onMounted(() => {
  loadList();
});
</script>
