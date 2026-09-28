<template>
  <div class="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
    <!-- 头部信息栏 -->
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-base-100 p-4 sm:p-5 rounded-2xl border border-base-200/80 shadow-2xs"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"
        >
          <Icon icon="mdi:gamepad-variant-outline" class="w-6 h-6" />
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h2 class="text-lg sm:text-xl font-bold text-base-content tracking-tight">游玩管理</h2>
            <span class="badge badge-primary badge-soft badge-xs">管理员</span>
          </div>
          <p class="text-xs text-base-content/60 mt-0.5 truncate sm:whitespace-normal">
            查看所有游玩会话，支持读取 runtime dataset 解码结果
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2 text-xs text-base-content/60 bg-base-200/50 sm:bg-transparent px-3 py-1.5 sm:p-0 rounded-xl">
        <Icon icon="mdi:database-outline" class="w-4 h-4 text-primary shrink-0" />
        <span>
          当前列表 <strong class="text-base-content font-semibold">{{ rows.length }}</strong> 条
          / 总计 <strong class="text-base-content font-semibold">{{ total }}</strong> 条
        </span>
      </div>
    </div>

    <!-- 查询与筛选栏 -->
    <div class="card bg-base-100 border border-base-200/80 rounded-2xl shadow-2xs">
      <div class="card-body p-4 sm:p-5 space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <!-- 故事 ID 筛选 -->
          <div class="form-control">
            <div class="label pb-1.5 pt-0">
              <span class="label-text text-xs text-base-content/70 font-medium flex items-center gap-1.5">
                <Icon icon="mdi:book-outline" class="w-3.5 h-3.5 text-primary" />
                按故事 ID 筛选
              </span>
              <span v-if="filters.storyId" class="badge badge-primary badge-xs badge-soft">已输入</span>
            </div>
            <div class="relative flex items-center">
              <input
                v-model.trim="filters.storyId"
                type="text"
                class="input input-sm border-base-300 w-full pr-8 text-xs font-mono"
                placeholder="输入故事 ID..."
                @keyup.enter="handleSearch"
              />
              <button
                v-if="filters.storyId"
                type="button"
                class="absolute right-2 text-base-content/40 hover:text-base-content transition-colors"
                title="清除故事 ID"
                @click="clearFilter('storyId')"
              >
                <Icon icon="mdi:close-circle" class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- 用户 ID 筛选 -->
          <div class="form-control">
            <div class="label pb-1.5 pt-0">
              <span class="label-text text-xs text-base-content/70 font-medium flex items-center gap-1.5">
                <Icon icon="mdi:account-outline" class="w-3.5 h-3.5 text-primary" />
                按用户 ID 筛选
              </span>
              <span v-if="filters.userId" class="badge badge-primary badge-xs badge-soft">已输入</span>
            </div>
            <div class="relative flex items-center">
              <input
                v-model.trim="filters.userId"
                type="text"
                class="input input-sm border-base-300 w-full pr-8 text-xs font-mono"
                placeholder="输入用户 ID..."
                @keyup.enter="handleSearch"
              />
              <button
                v-if="filters.userId"
                type="button"
                class="absolute right-2 text-base-content/40 hover:text-base-content transition-colors"
                title="清除用户 ID"
                @click="clearFilter('userId')"
              >
                <Icon icon="mdi:close-circle" class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- 列表数量 -->
          <div class="form-control">
            <div class="label pb-1.5 pt-0">
              <span class="label-text text-xs text-base-content/70 font-medium flex items-center gap-1.5">
                <Icon icon="mdi:format-list-numbered" class="w-3.5 h-3.5 text-primary" />
                每页条数
              </span>
            </div>
            <select
              v-model.number="filters.limit"
              class="select select-sm border-base-300 w-full text-xs"
              @change="handleSearch"
            >
              <option :value="20">20 条 / 页</option>
              <option :value="50">50 条 / 页</option>
              <option :value="100">100 条 / 页</option>
            </select>
          </div>

          <!-- 操作按钮组 -->
          <div class="flex items-center gap-2 pt-1 sm:pt-0">
            <button
              type="button"
              class="btn btn-primary btn-sm flex-1 gap-1.5 font-medium"
              :disabled="loading"
              @click="handleSearch"
            >
              <span v-if="loading" class="loading loading-spinner loading-xs"></span>
              <Icon v-else icon="mdi:magnify" class="w-4 h-4" />
              查询
            </button>
            <button
              type="button"
              class="btn btn-outline btn-sm gap-1 text-base-content/70"
              :disabled="loading"
              title="刷新列表"
              @click="loadList()"
            >
              <Icon icon="mdi:refresh" class="w-4 h-4" :class="{ 'animate-spin': loading }" />
              <span class="hidden sm:inline">刷新</span>
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-sm gap-1 text-base-content/60"
              :disabled="loading || (!hasActiveFilters && filters.limit === 20)"
              title="重置筛选"
              @click="resetFilters"
            >
              <Icon icon="mdi:filter-off-outline" class="w-4 h-4" />
              重置
            </button>
          </div>
        </div>

        <!-- 激活的筛选条件标签栏 -->
        <div
          v-if="hasActiveFilters"
          class="flex flex-wrap items-center gap-2 pt-2 border-t border-base-200/80 text-xs"
        >
          <span class="text-base-content/50 flex items-center gap-1">
            <Icon icon="mdi:filter-outline" class="w-3.5 h-3.5 text-primary" />
            当前筛选：
          </span>
          <span
            v-if="filters.storyId"
            class="badge badge-sm badge-primary badge-soft gap-1.5 font-mono"
          >
            故事: {{ filters.storyId }}
            <button
              type="button"
              class="hover:opacity-70 cursor-pointer"
              title="清除"
              @click="clearFilter('storyId')"
            >✕</button>
          </span>
          <span
            v-if="filters.userId"
            class="badge badge-sm badge-primary badge-soft gap-1.5 font-mono"
          >
            用户: {{ filters.userId }}
            <button
              type="button"
              class="hover:opacity-70 cursor-pointer"
              title="清除"
              @click="clearFilter('userId')"
            >✕</button>
          </span>
          <button
            type="button"
            class="btn btn-ghost btn-xs text-error hover:bg-error/10 ml-auto"
            @click="resetFilters"
          >
            清空全部筛选
          </button>
        </div>
      </div>
    </div>

    <!-- 加载骨架屏 -->
    <div v-if="loading && rows.length === 0" class="space-y-3">
      <!-- 桌面端骨架 -->
      <div class="hidden md:block card bg-base-100 border border-base-200/80 p-5 rounded-2xl space-y-4">
        <div v-for="n in 5" :key="n" class="flex items-center gap-4">
          <div class="skeleton h-4 w-28"></div>
          <div class="skeleton h-4 w-40"></div>
          <div class="skeleton h-4 w-32"></div>
          <div class="skeleton h-4 w-24"></div>
          <div class="skeleton h-4 w-16"></div>
          <div class="skeleton h-4 w-16"></div>
          <div class="skeleton h-6 w-24 ml-auto"></div>
        </div>
      </div>

      <!-- 移动端骨架 -->
      <div class="md:hidden space-y-3">
        <div v-for="n in 4" :key="n" class="card bg-base-100 border border-base-200/80 p-4 rounded-2xl space-y-3">
          <div class="flex justify-between items-center">
            <div class="skeleton h-4 w-32"></div>
            <div class="skeleton h-5 w-14 rounded-full"></div>
          </div>
          <div class="skeleton h-10 w-full rounded-xl"></div>
          <div class="grid grid-cols-2 gap-2">
            <div class="skeleton h-12 w-full rounded-lg"></div>
            <div class="skeleton h-12 w-full rounded-lg"></div>
          </div>
          <div class="flex justify-between items-center pt-1">
            <div class="skeleton h-3 w-24"></div>
            <div class="skeleton h-6 w-28 rounded-lg"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 列表展示区 -->
    <div v-else class="card bg-base-100 border border-base-200/80 rounded-2xl overflow-hidden shadow-2xs">
      <!-- 桌面端表格 (>= md) -->
      <div class="hidden md:block overflow-x-auto">
        <table class="table table-zebra table-sm sm:table-md">
          <thead>
            <tr>
              <th>时间</th>
              <th>故事</th>
              <th>用户</th>
              <th>当前段落</th>
              <th>状态</th>
              <th>历史 / 动线</th>
              <th class="text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in rows" :key="item.id" class="hover">
              <td class="text-xs text-base-content/70 whitespace-nowrap">
                {{ formatTime(item.createdAt) }}
              </td>
              <td>
                <div class="flex flex-col">
                  <span class="font-medium text-sm text-base-content hover:text-primary transition-colors">
                    {{ item.story?.title || "未知故事" }}
                  </span>
                  <div class="flex items-center gap-1 mt-0.5">
                    <span class="text-xs text-base-content/50 font-mono">{{ item.storyId }}</span>
                    <button
                      type="button"
                      class="btn btn-ghost btn-circle btn-xs text-base-content/30 hover:text-primary"
                      title="复制故事 ID"
                      @click="copyText(item.storyId, '故事 ID')"
                    >
                      <Icon icon="mdi:content-copy" class="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs text-[10px] px-1 h-4 min-h-0 text-primary hover:bg-primary/10"
                      title="按此故事筛选"
                      @click="filterByStory(item.storyId)"
                    >
                      筛选
                    </button>
                  </div>
                </div>
              </td>
              <td>
                <div class="flex items-center gap-2">
                  <Avatar :user="item.user" size="28" shrink />
                  <div class="flex flex-col min-w-0">
                    <span class="text-sm font-medium truncate">
                      {{ item.user?.nickname || item.user?.username || "匿名用户" }}
                    </span>
                    <div class="flex items-center gap-1 text-xs text-base-content/50 font-mono">
                      <span class="truncate">{{ item.userId || "(空)" }}</span>
                      <template v-if="item.userId">
                        <button
                          type="button"
                          class="btn btn-ghost btn-circle btn-xs text-base-content/30 hover:text-primary"
                          title="复制用户 ID"
                          @click="copyText(item.userId, '用户 ID')"
                        >
                          <Icon icon="mdi:content-copy" class="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          class="btn btn-ghost btn-xs text-[10px] px-1 h-4 min-h-0 text-primary hover:bg-primary/10"
                          title="按此用户筛选"
                          @click="filterByUser(item.userId)"
                        >
                          筛选
                        </button>
                      </template>
                    </div>
                  </div>
                </div>
              </td>
              <td class="font-mono text-xs max-w-40 truncate" :title="item.currentPassage">
                <span class="px-2 py-0.5 rounded bg-base-200/80 font-semibold">{{ item.currentPassage }}</span>
              </td>
              <td>
                <span
                  class="badge badge-sm"
                  :class="item.isEnding ? 'badge-neutral' : 'badge-success badge-soft'"
                >
                  {{ item.isEnding ? "已结束" : "进行中" }}
                </span>
              </td>
              <td>
                <div class="flex flex-col">
                  <span class="badge badge-ghost badge-sm w-fit font-medium">{{ item.history?.length || 0 }} 步主线</span>
                  <span v-if="(item.trace?.length || 0) > (item.history?.length || 0)" class="text-[10px] text-primary mt-0.5 font-medium">
                    探索 {{ item.trace?.length }} 步
                  </span>
                </div>
              </td>
              <td>
                <div class="flex justify-end gap-1.5">
                  <button
                    type="button"
                    class="btn btn-xs btn-primary gap-1"
                    @click="openDetail(item.id)"
                  >
                    <Icon icon="mdi:eye-outline" class="w-3.5 h-3.5" />
                    查看详情
                  </button>
                  <button
                    type="button"
                    class="btn btn-xs btn-ghost text-error hover:bg-error/10 gap-1"
                    :disabled="deletingId === item.id"
                    @click="handleDelete(item)"
                  >
                    <span
                      v-if="deletingId === item.id"
                      class="loading loading-spinner loading-xs"
                    ></span>
                    <Icon v-else icon="mdi:trash-can-outline" class="w-3.5 h-3.5" />
                    删除
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 移动端卡片列表 (< md) -->
      <div class="md:hidden divide-y divide-base-200">
        <div
          v-for="item in rows"
          :key="item.id"
          class="p-4 space-y-3 hover:bg-base-200/20 transition-colors"
        >
          <!-- 故事与状态 -->
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 font-bold text-sm text-base-content leading-snug">
                <Icon icon="mdi:book-open-outline" class="w-4 h-4 text-primary shrink-0" />
                <span class="truncate">{{ item.story?.title || "未知故事" }}</span>
              </div>
              <div class="flex items-center gap-1 mt-1 text-[11px] text-base-content/50 font-mono">
                <span class="truncate">ID: {{ item.storyId }}</span>
                <button
                  type="button"
                  class="btn btn-ghost btn-circle btn-xs text-base-content/40 hover:text-primary"
                  title="复制故事 ID"
                  @click="copyText(item.storyId, '故事 ID')"
                >
                  <Icon icon="mdi:content-copy" class="w-3 h-3" />
                </button>
                <button
                  type="button"
                  class="btn btn-ghost btn-xs text-[10px] px-1 h-4 min-h-0 text-primary hover:bg-primary/10"
                  title="按此故事筛选"
                  @click="filterByStory(item.storyId)"
                >
                  筛选
                </button>
              </div>
            </div>
            <span
              class="badge badge-sm shrink-0"
              :class="item.isEnding ? 'badge-neutral' : 'badge-success badge-soft'"
            >
              {{ item.isEnding ? "已结束" : "进行中" }}
            </span>
          </div>

          <!-- 用户信息条 -->
          <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-base-200/50 text-xs">
            <div class="flex items-center gap-2 min-w-0">
              <Avatar :user="item.user" size="28" shrink />
              <div class="min-w-0">
                <div class="font-medium text-xs truncate">
                  {{ item.user?.nickname || item.user?.username || "匿名用户" }}
                </div>
                <div class="text-[10px] text-base-content/50 font-mono truncate">
                  UID: {{ item.userId || "(空)" }}
                </div>
              </div>
            </div>
            <div v-if="item.userId" class="flex items-center gap-1 shrink-0">
              <button
                type="button"
                class="btn btn-ghost btn-circle btn-xs text-base-content/40 hover:text-primary"
                title="复制用户 ID"
                @click="copyText(item.userId, '用户 ID')"
              >
                <Icon icon="mdi:content-copy" class="w-3 h-3" />
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-xs text-[10px] px-1.5 h-5 min-h-0 text-primary hover:bg-primary/10"
                title="按此用户筛选"
                @click="filterByUser(item.userId)"
              >
                筛选
              </button>
            </div>
          </div>

          <!-- 当前段落与步数 -->
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="bg-base-200/30 rounded-lg p-2 flex flex-col justify-center">
              <span class="text-[10px] text-base-content/50 mb-0.5">当前段落</span>
              <span class="font-mono text-xs truncate font-medium" :title="item.currentPassage">
                {{ item.currentPassage || "-" }}
              </span>
            </div>
            <div class="bg-base-200/30 rounded-lg p-2 flex flex-col justify-center">
              <span class="text-[10px] text-base-content/50 mb-0.5">主线 / 探索动线</span>
              <div class="flex items-center gap-1 text-xs font-medium">
                <Icon icon="mdi:history" class="w-3.5 h-3.5 text-base-content/50" />
                <span>{{ item.history?.length || 0 }} 步主线</span>
                <span v-if="(item.trace?.length || 0) > (item.history?.length || 0)" class="text-[10px] text-primary font-normal">
                  (探索 {{ item.trace?.length }})
                </span>
              </div>
            </div>
          </div>

          <!-- 底部时间与操作 -->
          <div class="pt-1 flex items-center justify-between gap-2">
            <div class="flex items-center gap-1 text-[11px] text-base-content/50 truncate">
              <Icon icon="mdi:clock-outline" class="w-3.5 h-3.5 shrink-0" />
              <span class="truncate">{{ formatTime(item.createdAt) }}</span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button
                type="button"
                class="btn btn-xs btn-primary gap-1"
                @click="openDetail(item.id)"
              >
                <Icon icon="mdi:eye-outline" class="w-3.5 h-3.5" />
                详情
              </button>
              <button
                type="button"
                class="btn btn-xs btn-ghost text-error hover:bg-error/10 gap-1"
                :disabled="deletingId === item.id"
                @click="handleDelete(item)"
              >
                <span
                  v-if="deletingId === item.id"
                  class="loading loading-spinner loading-xs"
                ></span>
                <Icon v-else icon="mdi:trash-can-outline" class="w-3.5 h-3.5" />
                删除
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div
        v-if="!loading && rows.length === 0"
        class="p-8 sm:p-12 text-center"
      >
        <div class="w-16 h-16 rounded-2xl bg-base-200/60 text-base-content/40 flex items-center justify-center mx-auto mb-3">
          <Icon icon="mdi:database-search-outline" class="w-8 h-8" />
        </div>
        <h3 class="font-bold text-base text-base-content">暂无游玩记录</h3>
        <p class="text-xs text-base-content/60 mt-1 max-w-sm mx-auto">
          {{ hasActiveFilters ? "当前筛选条件下没有匹配的游玩记录，可尝试重置筛选" : "数据库中暂未记录任何游玩会话" }}
        </p>
        <div v-if="hasActiveFilters" class="mt-4">
          <button type="button" class="btn btn-sm btn-ghost gap-1" @click="resetFilters">
            <Icon icon="mdi:filter-off-outline" class="w-4 h-4" />
            清空筛选条件
          </button>
        </div>
      </div>
    </div>

    <!-- 分页栏 -->
    <div
      v-if="totalPages > 1"
      class="flex flex-col sm:flex-row items-center justify-between gap-3 bg-base-100 p-3 sm:p-4 rounded-xl border border-base-200/80 text-xs shadow-2xs"
    >
      <div class="text-base-content/60 flex items-center gap-1.5">
        <span>第 <strong class="font-semibold text-base-content">{{ page }}</strong> / {{ totalPages }} 页</span>
        <span class="text-base-content/30">|</span>
        <span>共 <strong class="font-semibold text-base-content">{{ total }}</strong> 条记录</span>
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
        <button type="button" class="join-item btn btn-sm btn-active font-mono" disabled>
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

    <!-- 全屏详情弹窗 -->
    <dialog ref="detailDialogRef" class="modal">
      <div class="modal-box w-screen max-w-none h-screen max-h-none rounded-none p-0 flex flex-col overflow-hidden bg-base-100">
        <!-- 顶栏 -->
        <div class="px-3 sm:px-6 py-2.5 sm:py-3 border-b border-base-200 flex items-center justify-between shrink-0 bg-base-100 gap-2">
          <div class="flex items-center gap-2 sm:gap-3 min-w-0">
            <div class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Icon icon="mdi:gamepad-variant-outline" class="w-5 h-5" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="font-bold text-sm sm:text-base truncate">Play 详情</h3>
                <template v-if="detail">
                  <span
                    class="badge badge-xs sm:badge-sm"
                    :class="detail.isEnding ? 'badge-neutral' : 'badge-success badge-soft'"
                  >
                    {{ detail.isEnding ? '已结束' : '进行中' }}
                  </span>
                </template>
              </div>
              <p v-if="detail" class="text-[11px] text-base-content/50 font-mono truncate hidden sm:block">
                {{ detail.id }}
              </p>
            </div>
          </div>

          <!-- 视图切换 (PC & 移动端统一放置在顶栏) + 关闭按钮 -->
          <div class="flex items-center gap-2 shrink-0">
            <div v-if="detail" class="join">
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

        <!-- 移动端锚点导航（仅在可视模式和屏幕小于 lg 时显示） -->
        <div
          v-if="detail && detailTab === 'visual'"
          class="lg:hidden border-b border-base-200 shrink-0 bg-base-100/90 backdrop-blur overflow-x-auto"
        >
          <div class="flex px-3 py-1.5 gap-1.5 min-w-max">
            <button
              v-for="section in detailSections"
              :key="section.id"
              type="button"
              class="btn btn-xs btn-ghost text-xs rounded-full px-2.5"
              @click="scrollToSection(section.id)"
            >{{ section.label }}</button>
          </div>
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
                <div class="flex items-center justify-between mb-2">
                  <h4 class="font-semibold text-sm">{{ detailSections[0].label }}</h4>
                </div>
                <div class="space-y-2 text-xs sm:text-sm bg-base-200/30 p-3 rounded-xl border border-base-200/60">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-base-content/60 shrink-0">Play ID：</span>
                    <div class="flex items-center gap-1 min-w-0">
                      <span class="font-mono text-xs truncate">{{ detail.id }}</span>
                      <button
                        type="button"
                        class="btn btn-ghost btn-circle btn-xs text-base-content/40 hover:text-primary"
                        title="复制 Play ID"
                        @click="copyText(detail.id, 'Play ID')"
                      >
                        <Icon icon="mdi:content-copy" class="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-base-content/60 shrink-0">Story ID：</span>
                    <div class="flex items-center gap-1 min-w-0">
                      <span class="font-mono text-xs truncate">{{ detail.storyId }}</span>
                      <button
                        type="button"
                        class="btn btn-ghost btn-circle btn-xs text-base-content/40 hover:text-primary"
                        title="复制 Story ID"
                        @click="copyText(detail.storyId, 'Story ID')"
                      >
                        <Icon icon="mdi:content-copy" class="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-base-content/60 shrink-0">User ID：</span>
                    <div class="flex items-center gap-1 min-w-0">
                      <span class="font-mono text-xs truncate">{{ detail.userId || '(空)' }}</span>
                      <button
                        v-if="detail.userId"
                        type="button"
                        class="btn btn-ghost btn-circle btn-xs text-base-content/40 hover:text-primary"
                        title="复制 User ID"
                        @click="copyText(detail.userId, 'User ID')"
                      >
                        <Icon icon="mdi:content-copy" class="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-base-content/60 shrink-0">故事标题：</span>
                    <span class="font-medium truncate">{{ detail.story?.title || '未知故事' }}</span>
                  </div>
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-base-content/60 shrink-0">当前段落：</span>
                    <span class="font-mono text-xs px-1.5 py-0.5 rounded bg-base-200 font-semibold truncate">{{ detail.currentPassage }}</span>
                  </div>
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-base-content/60 shrink-0">创建时间：</span>
                    <span class="text-xs text-base-content/70">{{ formatTime(detail.createdAt) }}</span>
                  </div>
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-base-content/60 shrink-0">更新时间：</span>
                    <span class="text-xs text-base-content/70">{{ formatTime(detail.updatedAt) }}</span>
                  </div>
                </div>
              </section>

              <div class="divider my-0"></div>

              <section :id="detailSections[1].id">
                <h4 class="font-semibold text-sm mb-2">{{ detailSections[1].label }}</h4>
                <div
                  v-if="detail.html"
                  class="prose prose-sm max-w-none bg-base-200/50 border border-base-200 rounded-xl p-3 sm:p-4 text-xs sm:text-sm leading-relaxed overflow-x-auto"
                  v-html="detail.html"
                />
                <div v-else class="text-xs text-base-content/50 italic bg-base-200/30 p-3 rounded-xl border border-base-200/60">
                  无 HTML 内容
                </div>
              </section>

              <div class="divider my-0"></div>

              <section :id="detailSections[2].id">
                <div class="flex items-center justify-between mb-2">
                  <h4 class="font-semibold text-sm">{{ detailSections[2].label }}</h4>
                  <span v-if="Object.keys(detail.variables || {}).length" class="text-xs text-base-content/50">
                    共 {{ Object.keys(detail.variables || {}).length }} 个变量
                  </span>
                </div>
                <div v-if="Object.keys(detail.variables || {}).length" class="overflow-x-auto border border-base-200/60 rounded-xl">
                  <table class="table table-xs">
                    <thead><tr><th>键</th><th>值</th></tr></thead>
                    <tbody>
                      <tr v-for="(val, key) in detail.variables" :key="key">
                        <td class="font-mono text-primary font-medium">{{ key }}</td>
                        <td class="font-mono break-all">{{ JSON.stringify(val) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div v-else class="text-xs text-base-content/50 italic bg-base-200/30 p-3 rounded-xl border border-base-200/60">
                  无变量
                </div>
              </section>
            </div>

            <!-- 栏 2：游玩历史与动线时间线 -->
            <div class="overflow-y-auto p-4 sm:p-5">
              <section :id="detailSections[3].id">
                <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div class="join">
                    <button
                      type="button"
                      class="join-item btn btn-xs"
                      :class="historyViewMode === 'trace' ? 'btn-primary' : 'btn-ghost'"
                      @click="historyViewMode = 'trace'"
                    >
                      <Icon icon="mdi:map-marker-path" class="w-3.5 h-3.5" />
                      探索动线 ({{ currentTrace.length }})
                    </button>
                    <button
                      type="button"
                      class="join-item btn btn-xs"
                      :class="historyViewMode === 'mainline' ? 'btn-primary' : 'btn-ghost'"
                      @click="historyViewMode = 'mainline'"
                    >
                      <Icon icon="mdi:source-branch" class="w-3.5 h-3.5" />
                      主线记录 ({{ detail.history?.length || 0 }})
                    </button>
                  </div>
                  <div
                    v-if="historyViewMode === 'trace' && rollbackCount > 0"
                    class="badge badge-warning badge-soft badge-xs gap-1"
                  >
                    <Icon icon="mdi:undo-variant" class="w-3 h-3" />
                    包含 {{ rollbackCount }} 次撤回
                  </div>
                </div>

                <!-- 探索动线视图 -->
                <div v-if="historyViewMode === 'trace'">
                  <div v-if="currentTrace.length" class="space-y-2">
                    <div
                      v-for="(step, idx) in currentTrace"
                      :key="idx"
                      class="flex gap-2.5 text-xs p-2.5 rounded-xl border transition-colors"
                      :class="
                        step.type === 'back' || step.action === 'back'
                          ? 'bg-warning/8 border-warning/30'
                          : step.type === 'start' || step.action === 'start'
                            ? 'bg-info/5 border-info/20'
                            : 'bg-base-200/30 border-base-200/80 hover:bg-base-200/50'
                      "
                    >
                      <div class="flex flex-col items-center shrink-0">
                        <div
                          class="w-5 h-5 rounded-full flex items-center justify-center font-medium text-[10px]"
                          :class="
                            step.type === 'back' || step.action === 'back'
                              ? 'bg-warning text-warning-content font-bold'
                              : step.type === 'start' || step.action === 'start'
                                ? 'bg-info/20 text-info font-bold'
                                : 'bg-primary/15 text-primary'
                          "
                        >
                          <Icon v-if="step.type === 'back' || step.action === 'back'" icon="mdi:undo" class="w-3 h-3" />
                          <span v-else>{{ idx + 1 }}</span>
                        </div>
                        <div v-if="idx < currentTrace.length - 1" class="w-px flex-1 bg-base-300 my-0.5"></div>
                      </div>
                      <div class="min-w-0 flex-1 space-y-1">
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <span v-if="step.from" class="font-mono text-base-content/70">{{ step.from }}</span>
                          <Icon
                            :icon="step.type === 'back' || step.action === 'back' ? 'mdi:arrow-left' : 'mdi:arrow-right'"
                            class="w-3 h-3 shrink-0"
                            :class="step.type === 'back' || step.action === 'back' ? 'text-warning' : 'text-base-content/40'"
                          />
                          <span
                            class="font-mono font-medium"
                            :class="step.type === 'back' || step.action === 'back' ? 'text-warning font-bold' : 'text-primary'"
                          >
                            {{ step.to }}
                          </span>
                          <span
                            v-if="step.type === 'back' || step.action === 'back'"
                            class="badge badge-warning badge-xs badge-soft ml-1"
                          >
                            撤回
                          </span>
                          <span
                            v-else-if="step.type === 'start' || step.action === 'start'"
                            class="badge badge-info badge-xs badge-soft ml-1"
                          >
                            起点
                          </span>
                          <span class="ml-auto text-base-content/40 shrink-0 text-[11px] whitespace-nowrap">
                            {{ formatTime(step.at) }}
                          </span>
                        </div>
                        <div
                          v-if="step.action && step.action !== 'back' && step.action !== 'start'"
                          class="text-[11px] text-base-content/60 truncate bg-base-100/60 px-2 py-0.5 rounded border border-base-200/50"
                        >
                          动作：{{ step.action }}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div v-else class="text-xs text-base-content/50 italic bg-base-200/30 p-3 rounded-xl border border-base-200/60">
                    暂无探索动线记录
                  </div>
                </div>

                <!-- 主线历史视图 -->
                <div v-else-if="historyViewMode === 'mainline'">
                  <div v-if="detail.history?.length" class="space-y-1.5">
                    <div
                      v-for="(step, idx) in detail.history"
                      :key="idx"
                      class="flex gap-2.5 text-xs"
                    >
                      <div class="flex flex-col items-center shrink-0">
                        <div class="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center font-medium text-[10px]">
                          {{ idx + 1 }}
                        </div>
                        <div v-if="idx < detail.history.length - 1" class="w-px flex-1 bg-base-300 my-0.5"></div>
                      </div>
                      <div class="pb-3 min-w-0 flex-1">
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <span class="font-mono text-base-content/70">{{ step.from || '起点' }}</span>
                          <Icon icon="mdi:arrow-right" class="w-3 h-3 text-base-content/40 shrink-0" />
                          <span class="font-mono font-medium text-primary">{{ step.to }}</span>
                          <span class="ml-auto text-base-content/40 shrink-0 text-[11px] whitespace-nowrap">{{ formatTime(step.at) }}</span>
                        </div>
                        <div v-if="step.action" class="mt-1 text-[11px] text-base-content/60 truncate bg-base-200/50 px-2 py-0.5 rounded">
                          动作：{{ step.action }}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div v-else class="text-xs text-base-content/50 italic bg-base-200/30 p-3 rounded-xl border border-base-200/60">
                    暂无主线历史记录
                  </div>
                </div>
              </section>
            </div>

            <!-- 栏 3：故事段落 -->
            <div class="overflow-y-auto p-4 sm:p-5">
              <section :id="detailSections[4].id">
                <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div class="flex items-center gap-2">
                    <h4 class="font-semibold text-sm">{{ detailSections[4].label }}</h4>
                    <span v-if="detail.decodedDataset?.passages?.length" class="badge badge-ghost badge-xs">
                      {{ detail.decodedDataset.passages.length }} 个段落
                    </span>
                  </div>
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
                    :class="passage.name === detail.currentPassage ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20' : 'bg-base-200/30'"
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
                      <span class="ml-auto text-[10px] text-base-content/40 font-normal">
                        {{ (passage.content as string)?.length ?? 0 }} 字符
                      </span>
                    </button>
                    <pre v-if="!collapsedPassages.has(passage.name)" class="p-3 text-xs leading-relaxed whitespace-pre-wrap break-words font-mono overflow-x-auto"><code>{{ passage.content }}</code></pre>
                  </div>
                </div>
                <div v-else class="text-xs text-base-content/50 italic bg-base-200/30 p-3 rounded-xl border border-base-200/60">
                  无段落数据
                </div>
              </section>
            </div>
          </div>
        </div>

        <!-- 原始 JSON 视图 -->
        <div v-else-if="detail && detailTab === 'json'" class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h4 class="font-semibold text-sm">decodedDataset</h4>
              <button type="button" class="btn btn-xs btn-ghost gap-1" @click="copyJson(detail.decodedDataset)">
                <Icon icon="mdi:content-copy" class="w-3 h-3" />
                复制
              </button>
            </div>
            <pre class="bg-base-200/60 border border-base-200 rounded-xl p-3 text-xs overflow-x-auto leading-relaxed"><code>{{ prettyJson(detail.decodedDataset) }}</code></pre>
          </div>
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h4 class="font-semibold text-sm">variables</h4>
              <button type="button" class="btn btn-xs btn-ghost gap-1" @click="copyJson(detail.variables)">
                <Icon icon="mdi:content-copy" class="w-3 h-3" />
                复制
              </button>
            </div>
            <pre class="bg-base-200/60 border border-base-200 rounded-xl p-3 text-xs overflow-x-auto leading-relaxed"><code>{{ prettyJson(detail.variables) }}</code></pre>
          </div>
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h4 class="font-semibold text-sm">history（主线记录）</h4>
              <button type="button" class="btn btn-xs btn-ghost gap-1" @click="copyJson(detail.history)">
                <Icon icon="mdi:content-copy" class="w-3 h-3" />
                复制
              </button>
            </div>
            <pre class="bg-base-200/60 border border-base-200 rounded-xl p-3 text-xs overflow-x-auto leading-relaxed font-mono"><code>{{ prettyJson(detail.history) }}</code></pre>
          </div>
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <h4 class="font-semibold text-sm">trace（探索动线）</h4>
                <span class="badge badge-xs badge-ghost">{{ currentTrace.length }} 步</span>
              </div>
              <button type="button" class="btn btn-xs btn-ghost gap-1" @click="copyJson(currentTrace)">
                <Icon icon="mdi:content-copy" class="w-3 h-3" />
                复制
              </button>
            </div>
            <pre class="bg-base-200/60 border border-base-200 rounded-xl p-3 text-xs overflow-x-auto leading-relaxed font-mono"><code>{{ prettyJson(currentTrace) }}</code></pre>
          </div>
        </div>

        <div v-else-if="!detailLoading" class="flex-1 flex items-center justify-center text-base-content/60">
          未找到详情数据
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, onMounted, watch } from "vue";
import { Icon } from "@iconify/vue";
import Message from "@/components/msg";
import msgbox from "@/components/msgbox";
import Avatar from "@/components/Avatar";
import { serializeStory, type StoryData } from "@/lib/storyEngine";
import {
  adminDeletePlay,
  adminGetPlayDetail,
  adminListPlays,
  type IAdminPlayDetail,
  type IAdminPlayRow,
  type IPlayTrace,
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
  { id: "section-history",  label: "历史动线" },
  { id: "section-passages", label: "故事段落" },
] as const;

const detailScrollRef = ref<HTMLElement | null>(null);
const collapsedPassages = ref(new Set<string>());

const historyViewMode = ref<"trace" | "mainline">("trace");

const currentTrace = computed<IPlayTrace[]>(() => {
  if (detail.value?.trace && detail.value.trace.length > 0) {
    return detail.value.trace;
  }
  return (detail.value?.history || []).map((h) => ({
    from: h.from,
    to: h.to,
    action: h.action,
    at: h.at,
    type: h.action === "start" ? ("start" as const) : ("forward" as const),
  }));
});

const rollbackCount = computed(() => {
  return currentTrace.value.filter((t) => t.type === "back" || t.action === "back").length;
});

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
    historyViewMode.value = "trace";
    collapsedPassages.value = new Set();
  }
});

const filters = reactive({
  limit: 20,
  storyId: "",
  userId: "",
});

const hasActiveFilters = computed(() => Boolean(filters.storyId || filters.userId));

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

const filterByStory = (storyId: string) => {
  filters.storyId = storyId;
  handleSearch();
};

const filterByUser = (userId: string) => {
  filters.userId = userId;
  handleSearch();
};

const clearFilter = (key: "storyId" | "userId") => {
  filters[key] = "";
  handleSearch();
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

const copyText = async (text?: string | null, label = "内容") => {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    Message.success(`已复制${label}`);
  } catch {
    Message.error("复制失败");
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
