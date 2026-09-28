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
            <select
              v-model.number="filters.limit"
              class="select select-bordered select-sm"
              @change="handleSearch"
            >
              <option :value="20">20</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
            </select>
          </label>

          <div class="flex items-end gap-2">
            <button type="button" class="btn btn-primary btn-sm flex-1" :disabled="loading" @click="handleSearch">
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
                  <button
                    type="button"
                    class="btn btn-xs btn-ghost text-error hover:bg-error/10"
                    :disabled="deletingId === item.id"
                    @click="handleDelete(item)"
                  >
                    <span
                      v-if="deletingId === item.id"
                      class="loading loading-spinner loading-xs"
                    ></span>
                    删除
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

    <div
      v-if="totalPages > 1"
      class="flex items-center justify-between gap-4 bg-base-100 p-3 sm:p-4 rounded-xl border border-base-200/80 text-xs"
    >
      <div class="text-base-content/60">
        第 <span class="font-medium text-base-content">{{ page }}</span> / {{ totalPages }} 页
      </div>
      <div class="join">
        <button
          type="button"
          class="join-item btn btn-sm"
          :disabled="page <= 1 || loading"
          @click="changePage(page - 1)"
        >
          上一页
        </button>
        <button type="button" class="join-item btn btn-sm btn-active" disabled>
          {{ page }}
        </button>
        <button
          type="button"
          class="join-item btn btn-sm"
          :disabled="page >= totalPages || loading"
          @click="changePage(page + 1)"
        >
          下一页
        </button>
      </div>
    </div>

    <dialog ref="detailDialogRef" class="modal">
      <!-- 全屏 modal box -->
      <div class="modal-box w-screen max-w-none h-screen max-h-none rounded-none p-0 flex flex-col overflow-hidden">

        <!-- 顶栏 -->
        <div class="px-4 sm:px-6 py-3 border-b border-base-200 flex items-center justify-between shrink-0 bg-base-100">
          <div class="flex items-center gap-3 min-w-0">
            <h3 class="font-bold text-base truncate">Play 详情</h3>
            <template v-if="detail">
              <span class="badge badge-sm font-mono hidden sm:inline-flex truncate max-w-40">{{ detail.id }}</span>
              <span class="badge badge-sm" :class="detail.isEnding ? 'badge-neutral' : 'badge-success badge-soft'">
                {{ detail.isEnding ? '已结束' : '进行中' }}
              </span>
            </template>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <!-- 视图切换（PC 显示在顶栏） -->
            <div v-if="detail" class="join hidden sm:flex">
              <button
                v-for="tab in detailTabs"
                :key="tab.key"
                type="button"
                class="join-item btn btn-xs"
                :class="detailTab === tab.key ? 'btn-primary' : 'btn-ghost'"
                @click="detailTab = tab.key"
              >{{ tab.label }}</button>
            </div>
            <form method="dialog">
              <button class="btn btn-sm btn-circle btn-ghost">✕</button>
            </form>
          </div>
        </div>

        <!-- 移动端 tab 导航（锚点滚动，仅可视化模式） -->
        <div v-if="detail && detailTab === 'visual'" class="sm:hidden border-b border-base-200 shrink-0 bg-base-100 overflow-x-auto">
          <div class="flex px-4 gap-1 py-1.5 min-w-max">
            <button
              v-for="section in detailSections"
              :key="section.id"
              type="button"
              class="btn btn-xs btn-ghost"
              @click="scrollToSection(section.id)"
            >{{ section.label }}</button>
          </div>
        </div>
        <!-- 移动端视图切换（JSON 模式入口） -->
        <div v-if="detail" class="sm:hidden border-b border-base-200 px-4 py-1.5 shrink-0 bg-base-100 flex gap-2">
          <button
            v-for="tab in detailTabs"
            :key="tab.key"
            type="button"
            class="btn btn-xs"
            :class="detailTab === tab.key ? 'btn-primary' : 'btn-ghost'"
            @click="detailTab = tab.key"
          >{{ tab.label }}</button>
        </div>

        <div v-if="detailLoading" class="flex-1 flex items-center justify-center">
          <span class="loading loading-spinner loading-md text-primary"></span>
        </div>

        <!-- 可视化视图：PC 三栏，移动端单列锚点滚动 -->
        <div v-else-if="detail && detailTab === 'visual'" ref="detailScrollRef" class="flex-1 overflow-y-auto">
          <div class="grid grid-cols-1 lg:grid-cols-3 h-full divide-y lg:divide-y-0 lg:divide-x divide-base-200">

            <!-- 栏 1：基础信息 + 当前段落预览 + 变量 -->
            <div class="overflow-y-auto p-4 sm:p-5 space-y-5">
              <section :id="detailSections[0].id">
                <h4 class="font-semibold text-sm mb-2">{{ detailSections[0].label }}</h4>
                <div class="space-y-1.5 text-sm">
                  <div><span class="text-base-content/60">Play ID：</span><span class="font-mono text-xs break-all">{{ detail.id }}</span></div>
                  <div><span class="text-base-content/60">Story ID：</span><span class="font-mono text-xs break-all">{{ detail.storyId }}</span></div>
                  <div><span class="text-base-content/60">User ID：</span><span class="font-mono text-xs break-all">{{ detail.userId || '(空)' }}</span></div>
                  <div><span class="text-base-content/60">故事标题：</span>{{ detail.story?.title || '未知故事' }}</div>
                  <div><span class="text-base-content/60">当前段落：</span><span class="font-mono text-xs">{{ detail.currentPassage }}</span></div>
                  <div><span class="text-base-content/60">创建时间：</span>{{ formatTime(detail.createdAt) }}</div>
                  <div><span class="text-base-content/60">更新时间：</span>{{ formatTime(detail.updatedAt) }}</div>
                </div>
              </section>

              <div class="divider my-0"></div>

              <section :id="detailSections[1].id">
                <h4 class="font-semibold text-sm mb-2">{{ detailSections[1].label }}</h4>
                <div
                  v-if="detail.html"
                  class="prose prose-sm max-w-none bg-base-200/50 border border-base-200 rounded-xl p-4 text-sm leading-relaxed"
                  v-html="detail.html"
                />
                <div v-else class="text-xs text-base-content/50 italic">无 HTML 内容</div>
              </section>

              <div class="divider my-0"></div>

              <section :id="detailSections[2].id">
                <h4 class="font-semibold text-sm mb-2">{{ detailSections[2].label }}</h4>
                <div v-if="Object.keys(detail.variables || {}).length" class="overflow-x-auto">
                  <table class="table table-xs">
                    <thead><tr><th>键</th><th>值</th></tr></thead>
                    <tbody>
                      <tr v-for="(val, key) in detail.variables" :key="key">
                        <td class="font-mono">{{ key }}</td>
                        <td class="font-mono">{{ JSON.stringify(val) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div v-else class="text-xs text-base-content/50 italic">无变量</div>
              </section>
            </div>

            <!-- 栏 2：游玩历史时间线 -->
            <div class="overflow-y-auto p-4 sm:p-5">
              <section :id="detailSections[3].id">
                <h4 class="font-semibold text-sm mb-3">{{ detailSections[3].label }}</h4>
                <div v-if="detail.history?.length" class="space-y-1.5">
                  <div
                    v-for="(step, idx) in detail.history"
                    :key="idx"
                    class="flex gap-3 text-xs"
                  >
                    <div class="flex flex-col items-center shrink-0">
                      <div class="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center font-medium text-[10px]">{{ idx + 1 }}</div>
                      <div v-if="idx < detail.history.length - 1" class="w-px flex-1 bg-base-300 my-0.5"></div>
                    </div>
                    <div class="pb-3 min-w-0 flex-1">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-mono text-base-content/70">{{ step.from }}</span>
                        <Icon icon="mdi:arrow-right" class="w-3 h-3 text-base-content/40 shrink-0" />
                        <span class="font-mono font-medium">{{ step.to }}</span>
                        <span class="ml-auto text-base-content/40 shrink-0 whitespace-nowrap">{{ formatTime(step.at) }}</span>
                      </div>
                      <div v-if="step.action" class="mt-0.5 text-base-content/60 truncate">动作：{{ step.action }}</div>
                    </div>
                  </div>
                </div>
                <div v-else class="text-xs text-base-content/50 italic">暂无历史记录</div>
              </section>
            </div>

            <!-- 栏 3：故事段落 -->
            <div class="overflow-y-auto p-4 sm:p-5">
              <section :id="detailSections[4].id">
                <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h4 class="font-semibold text-sm">{{ detailSections[4].label }}</h4>
                  <div class="flex gap-1 flex-wrap">
                    <button type="button" class="btn btn-xs btn-ghost" @click="toggleAllPassages(true)">全部展开</button>
                    <button type="button" class="btn btn-xs btn-ghost" @click="toggleAllPassages(false)">全部折叠</button>
                    <button type="button" class="btn btn-xs btn-ghost" @click="copyStorySourceFromDecodedDataset(detail.decodedDataset)">复制源码</button>
                    <button type="button" class="btn btn-xs btn-ghost" @click="copyJson(detail.decodedDataset)">复制 JSON</button>
                  </div>
                </div>
                <div v-if="detail.decodedDataset?.passages?.length" class="space-y-2">
                  <div
                    v-for="passage in (detail.decodedDataset.passages as any[])"
                    :key="passage.name"
                    class="border border-base-200 rounded-xl overflow-hidden"
                    :class="passage.name === detail.currentPassage ? 'border-primary/40 bg-primary/5' : 'bg-base-200/30'"
                  >
                    <button
                      type="button"
                      class="w-full flex items-center gap-2 px-3 py-2 border-b border-base-200/60 flex-wrap text-left hover:bg-base-200/40 transition-colors"
                      @click="collapsedPassages.has(passage.name) ? collapsedPassages.delete(passage.name) : collapsedPassages.add(passage.name)"
                    >
                      <Icon
                        :icon="collapsedPassages.has(passage.name) ? 'mdi:chevron-right' : 'mdi:chevron-down'"
                        class="w-3.5 h-3.5 text-base-content/40 shrink-0"
                      />
                      <span class="font-mono text-xs font-semibold">{{ passage.name }}</span>
                      <span v-if="passage.name === detail.currentPassage" class="badge badge-primary badge-xs badge-soft">当前</span>
                      <span
                        v-for="tag in (passage.tags as string[])"
                        :key="tag"
                        class="badge badge-neutral badge-xs badge-soft"
                      >{{ tag }}</span>
                      <span v-if="collapsedPassages.has(passage.name)" class="ml-auto text-[10px] text-base-content/30 font-normal">
                        {{ (passage.content as string)?.length ?? 0 }} 字符
                      </span>
                    </button>
                    <pre v-if="!collapsedPassages.has(passage.name)" class="p-3 text-xs leading-relaxed whitespace-pre-wrap wrap-break-word"><code>{{ passage.content }}</code></pre>
                  </div>
                </div>
                <div v-else class="text-xs text-base-content/50 italic">无段落数据</div>
              </section>
            </div>

          </div>
        </div>

        <!-- 原始 JSON 视图 -->
        <div v-else-if="detail && detailTab === 'json'" class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          <div class="space-y-2">
            <h4 class="font-semibold text-sm">decodedDataset</h4>
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

        <div v-else-if="!detailLoading" class="flex-1 flex items-center justify-center text-base-content/60">未找到详情数据</div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, watch } from "vue";
import { Icon } from "@iconify/vue";
import Message from "@/components/msg";
import msgbox from "@/components/msgbox";
import { serializeStory, type StoryData } from "@/lib/storyEngine";
import {
  adminDeletePlay,
  adminGetPlayDetail,
  adminListPlays,
  type IAdminPlayDetail,
  type IAdminPlayRow,
} from "@/api/play";

const rows = ref<IAdminPlayRow[]>([]);
const total = ref(0);
const page = ref(1);
const totalPages = ref(1);
const loading = ref(false);
const detailLoading = ref(false);
const detail = ref<IAdminPlayDetail | null>(null);
const detailDialogRef = ref<HTMLDialogElement | null>(null);
const deletingId = ref("");

type DetailTab = "visual" | "json";
const detailTab = ref<DetailTab>("visual");
const detailTabs: { key: DetailTab; label: string }[] = [
  { key: "visual", label: "可视化" },
  { key: "json", label: "原始 JSON" },
];
const detailSections = [
  { id: "section-info",     label: "基础信息" },
  { id: "section-html",     label: "段落预览" },
  { id: "section-vars",     label: "变量" },
  { id: "section-history",  label: "历史" },
  { id: "section-passages", label: "故事段落" },
] as const;

const detailScrollRef = ref<HTMLElement | null>(null);
const collapsedPassages = ref(new Set<string>());

// 展开/折叠所有段落，切换详情时重置
const toggleAllPassages = (expand: boolean) => {
  if (expand) {
    collapsedPassages.value.clear();
  } else {
    const passages = (detail.value?.decodedDataset as any)?.passages as any[] | undefined;
    collapsedPassages.value = new Set(passages?.map((p) => p.name) ?? []);
  }
};

const scrollToSection = (id: string) => {
  const el = detailScrollRef.value?.querySelector(`#${id}`);
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
};

// 每次打开详情重置视图和折叠状态
watch(detail, (val) => {
  if (val) {
    detailTab.value = "visual";
    collapsedPassages.value = new Set();
  }
});

const filters = reactive({
  limit: 20,
  storyId: "",
  userId: "",
});

const loadList = async (targetPage = page.value) => {
  loading.value = true;
  try {
    const res = await adminListPlays({
      page: targetPage,
      limit: filters.limit,
      storyId: filters.storyId || '',
      userId: filters.userId || '',
    });
    rows.value = res?.data || [];
    total.value = res?.total || 0;
    page.value = res?.page || targetPage;
    totalPages.value = res?.totalPages || Math.max(1, Math.ceil(total.value / filters.limit));
  } catch (err: any) {
    Message.error(err?.message || "加载游玩数据失败");
  } finally {
    loading.value = false;
  }
};

const handleSearch = async () => {
  page.value = 1;
  await loadList(1);
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
  page.value = 1;
  totalPages.value = 1;
  filters.limit = 20;
  filters.storyId = "";
  filters.userId = "";
  await loadList(1);
};

const handleDelete = async (item: IAdminPlayRow) => {
  const storyName = item.story?.title || item.storyId;
  const userName =
    item.user?.nickname || item.user?.username || item.userId || "匿名用户";
  const confirmed = await msgbox.confirm(
    `确定要删除这条游玩记录吗？此操作不可恢复。\n故事：${storyName}\n用户：${userName}`,
  );
  if (!confirmed) return;
  deletingId.value = item.id;
  try {
    await adminDeletePlay(item.id);
    Message.success("已删除该游玩记录");
    // 当前页被删空则回退一页
    if (rows.value.length === 1 && page.value > 1) {
      page.value -= 1;
    }
    await loadList();
  } catch (err: any) {
    Message.error(err?.message || "删除失败");
  } finally {
    deletingId.value = "";
  }
};

const changePage = async (nextPage: number) => {
  if (nextPage < 1 || nextPage > totalPages.value || nextPage === page.value) {
    return;
  }
  await loadList(nextPage);
  window.scrollTo({ top: 0, behavior: "smooth" });
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
