<template>
  <div class="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
    <div
      class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-base-100 p-4 sm:p-5 rounded-2xl border border-base-200/80 shadow-2xs"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"
        >
          <Icon icon="mdi:text-box-search-outline" class="w-6 h-6" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-xl font-bold text-base-content tracking-tight">
              操作日志
            </h2>
            <span class="badge badge-primary badge-soft badge-xs">管理员</span>
          </div>
          <p class="text-xs text-base-content/60 mt-0.5">
            分页查看 POST/PUT/DELETE 操作日志
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2 text-xs text-base-content/60">
        <Icon icon="mdi:counter" class="w-4 h-4 text-primary" />
        <span>
          当前列表
          <strong class="text-base-content font-semibold">{{ rows.length }}</strong>
          条 / 总计
          <strong class="text-base-content font-semibold">{{ total }}</strong>
          条
        </span>
      </div>
    </div>

    <div class="card bg-base-100 border border-base-200/80 rounded-2xl">
      <div class="card-body p-4 sm:p-5">
        <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
          <label class="form-control">
            <span class="label-text text-xs text-base-content/60 mb-1">
              方法
            </span>
            <select
              v-model="filters.method"
              class="select select-bordered select-sm"
            >
              <option value="">全部</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
          </label>

          <label class="form-control">
            <span class="label-text text-xs text-base-content/60 mb-1">
              路径包含
            </span>
            <input
              v-model.trim="filters.path"
              type="text"
              class="input input-bordered input-sm"
              placeholder="/stories"
            />
          </label>

          <label class="form-control">
            <span class="label-text text-xs text-base-content/60 mb-1">
              用户 ID
            </span>
            <input
              v-model.trim="filters.userId"
              type="text"
              class="input input-bordered input-sm"
              placeholder="userId"
            />
          </label>

          <label class="form-control">
            <span class="label-text text-xs text-base-content/60 mb-1">
              每页数量
            </span>
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
            <button
              type="button"
              class="btn btn-primary btn-sm flex-1"
              :disabled="loading"
              @click="handleSearch"
            >
              <Icon icon="mdi:magnify" class="w-4 h-4" />
              查询
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              :disabled="loading"
              @click="resetFilters"
            >
              重置
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading && rows.length === 0" class="space-y-3">
      <div
        v-for="n in 5"
        :key="n"
        class="card bg-base-100 border border-base-200/80 p-4 rounded-xl"
      >
        <div class="skeleton h-5 w-1/3 mb-3"></div>
        <div class="skeleton h-4 w-full"></div>
      </div>
    </div>

    <div
      v-else
      class="card bg-base-100 border border-base-200/80 rounded-2xl overflow-hidden"
    >
      <div class="overflow-x-auto">
        <table class="table table-zebra table-sm sm:table-md">
          <thead>
            <tr>
              <th>时间</th>
              <th>方法</th>
              <th>路径</th>
              <th>用户</th>
              <th>状态</th>
              <th>耗时</th>
              <th class="text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in rows" :key="item.id">
              <td class="text-xs text-base-content/70 whitespace-nowrap">
                {{ formatTime(item.createdAt) }}
              </td>
              <td>
                <span class="badge badge-sm" :class="methodClass(item.method)">
                  {{ item.method }}
                </span>
              </td>
              <td class="font-mono text-xs max-w-80 truncate" :title="item.path">
                {{ item.path }}
              </td>
              <td class="font-mono text-xs">{{ item.userId || "(匿名)" }}</td>
              <td class="text-xs">
                <span
                  v-if="item.statusCode"
                  class="badge badge-sm"
                  :class="Number(item.statusCode) >= 400 ? 'badge-error badge-soft' : 'badge-success badge-soft'"
                >
                  {{ item.statusCode }}
                </span>
                <span v-else class="text-base-content/50">-</span>
              </td>
              <td class="text-xs">{{ item.durationMs ?? "-" }} ms</td>
              <td>
                <div class="flex justify-end gap-2">
                  <button
                    type="button"
                    class="btn btn-xs btn-primary"
                    @click="openDetail(item.id)"
                  >
                    查看详情
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="!loading && rows.length === 0"
        class="p-8 text-center text-base-content/60 text-sm"
      >
        暂无日志记录
      </div>
    </div>

    <div
      v-if="totalPages > 1"
      class="flex items-center justify-between gap-4 bg-base-100 p-3 sm:p-4 rounded-xl border border-base-200/80 text-xs"
    >
      <div class="text-base-content/60">
        第 <span class="font-medium text-base-content">{{ page }}</span> /
        {{ totalPages }} 页
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
      <div class="modal-box max-w-5xl p-0 overflow-hidden">
        <div
          class="px-5 py-4 border-b border-base-200 flex items-center justify-between"
        >
          <h3 class="font-bold text-base">日志详情</h3>
          <form method="dialog">
            <button class="btn btn-sm btn-circle btn-ghost">✕</button>
          </form>
        </div>

        <div v-if="detailLoading" class="p-8 text-center">
          <span class="loading loading-spinner loading-md text-primary"></span>
        </div>

        <div v-else-if="detail" class="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div class="card bg-base-200/50 border border-base-200">
              <div class="card-body p-3 space-y-1.5">
                <div>
                  <span class="text-base-content/60">ID：</span>
                  <span class="font-mono text-xs">{{ detail.id }}</span>
                </div>
                <div>
                  <span class="text-base-content/60">方法：</span>
                  <span class="font-mono text-xs">{{ detail.method }}</span>
                </div>
                <div>
                  <span class="text-base-content/60">路径：</span>
                  <span class="font-mono text-xs">{{ detail.path }}</span>
                </div>
                <div>
                  <span class="text-base-content/60">用户：</span>
                  <span class="font-mono text-xs">{{ detail.userId || "(匿名)" }}</span>
                </div>
              </div>
            </div>

            <div class="card bg-base-200/50 border border-base-200">
              <div class="card-body p-3 space-y-1.5">
                <div>
                  <span class="text-base-content/60">状态码：</span>
                  {{ detail.statusCode ?? "-" }}
                </div>
                <div>
                  <span class="text-base-content/60">耗时：</span>
                  {{ detail.durationMs ?? "-" }} ms
                </div>
                <div>
                  <span class="text-base-content/60">时间：</span>
                  {{ formatTime(detail.createdAt) }}
                </div>
                <div>
                  <span class="text-base-content/60">错误：</span>
                  {{ detail.error || "-" }}
                </div>
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <h4 class="font-semibold text-sm">headers</h4>
            <pre class="bg-base-200/60 border border-base-200 rounded-xl p-3 text-xs overflow-x-auto leading-relaxed"><code>{{ prettyJson(detail.headers) }}</code></pre>
          </div>

          <div class="space-y-2">
            <h4 class="font-semibold text-sm">body</h4>
            <pre class="bg-base-200/60 border border-base-200 rounded-xl p-3 text-xs overflow-x-auto leading-relaxed"><code>{{ prettyJson(detail.body) }}</code></pre>
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
import { onMounted, reactive, ref } from "vue";
import { Icon } from "@iconify/vue";
import Message from "@/components/msg";
import {
  adminGetOperationLogDetail,
  adminListOperationLogs,
  type IOperationLogItem,
} from "@/api/operationLog";

const rows = ref<IOperationLogItem[]>([]);
const total = ref(0);
const page = ref(1);
const totalPages = ref(1);
const loading = ref(false);

const detailLoading = ref(false);
const detail = ref<IOperationLogItem | null>(null);
const detailDialogRef = ref<HTMLDialogElement | null>(null);

const filters = reactive({
  method: "",
  path: "",
  userId: "",
  limit: 20,
});

const loadList = async (targetPage = page.value) => {
  loading.value = true;
  try {
    const res = await adminListOperationLogs({
      page: targetPage,
      limit: filters.limit,
      method: filters.method || '',
      path: filters.path || '',
      userId: filters.userId || '',
    });
    rows.value = res?.data || [];
    total.value = res?.total || 0;
    page.value = res?.page || targetPage;
    totalPages.value = res?.totalPages || Math.max(1, Math.ceil(total.value / filters.limit));
  } catch (err: any) {
    Message.error(err?.message || "加载日志列表失败");
  } finally {
    loading.value = false;
  }
};

const handleSearch = async () => {
  page.value = 1;
  await loadList(1);
};

const resetFilters = async () => {
  filters.method = "";
  filters.path = "";
  filters.userId = "";
  filters.limit = 20;
  page.value = 1;
  totalPages.value = 1;
  await loadList(1);
};

const changePage = async (nextPage: number) => {
  if (nextPage < 1 || nextPage > totalPages.value || nextPage === page.value) {
    return;
  }
  await loadList(nextPage);
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const openDetail = async (id: string) => {
  detail.value = null;
  detailLoading.value = true;
  detailDialogRef.value?.showModal();
  try {
    detail.value = await adminGetOperationLogDetail(id);
  } catch (err: any) {
    Message.error(err?.message || "加载日志详情失败");
    detailDialogRef.value?.close();
  } finally {
    detailLoading.value = false;
  }
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

const methodClass = (method?: string) => {
  const normalized = String(method || "").toUpperCase();
  if (normalized === "POST") return "badge-info badge-soft";
  if (normalized === "PUT") return "badge-warning badge-soft";
  if (normalized === "DELETE") return "badge-error badge-soft";
  return "badge-ghost";
};

onMounted(() => {
  loadList();
});
</script>
