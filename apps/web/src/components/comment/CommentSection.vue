<template>
  <section
    class="comment-section bg-base-100/90 shadow-sm hover:shadow-md transition-shadow duration-300 rounded-2xl p-6 sm:p-8 border border-base-300/60 font-sans text-base-content"
  >
    <!-- 评论区顶部标题与统计 -->
    <div class="flex items-center justify-between pb-4 border-b border-base-200/80 mb-6">
      <div class="flex items-center gap-2.5">
        <Icon icon="mdi:comment-text-multiple-outline" class="size-5 text-primary" />
        <h3 class="font-bold text-lg text-base-content tracking-tight">故事评论</h3>
        <span class="badge badge-neutral badge-sm font-mono">{{ total }}</span>
      </div>
      <div class="flex items-center gap-2 text-xs text-base-content/60">
        <button
          class="btn btn-ghost btn-xs gap-1"
          :class="{ 'text-primary font-bold': filterScene }"
          :title="filterScene ? '查看全部评论' : '只看当前章节评论'"
          @click="toggleSceneFilter"
        >
          <Icon icon="mdi:filter-variant" class="size-3.5" />
          <span>{{ filterScene ? "当前章节" : "全部评论" }}</span>
        </button>
      </div>
    </div>

    <!-- 顶部主评论发布框 -->
    <div class="flex gap-3 sm:gap-4 items-start mb-8">
      <Avatar
        :user="currentUser"
        size="40"
        class="shrink-0 mt-0.5"
      />
      <div class="flex-1 min-w-0">
        <div class="relative">
          <textarea
            v-model="commentContent"
            rows="3"
            class="textarea textarea-bordered w-full rounded-xl bg-base-200/40 focus:bg-base-100 transition-colors text-sm leading-relaxed resize-y"
            placeholder="写下你对故事的想法、推测或体验感受..."
            :disabled="submitting"
          ></textarea>
        </div>

        <div class="mt-2.5 flex items-center justify-between flex-wrap gap-2">
          <label class="label cursor-pointer gap-2 py-0">
            <input
              v-model="isSpoiler"
              type="checkbox"
              class="checkbox checkbox-warning checkbox-xs rounded"
            />
            <span class="label-text text-xs text-base-content/70 flex items-center gap-1">
              <Icon icon="mdi:alert-circle-outline" class="size-3.5 text-warning" />
              包含剧情剧透
            </span>
          </label>

          <div class="flex items-center gap-2">
            <button
              class="btn btn-primary btn-sm rounded-lg px-4 gap-1.5 shadow-sm"
              :disabled="submitting || !commentContent.trim()"
              @click="submitComment"
            >
              <span v-if="submitting" class="loading loading-spinner loading-xs"></span>
              <Icon v-else icon="mdi:send-outline" class="size-4" />
              <span>发表评论</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 评论列表区域 -->
    <div v-if="loading && comments.length === 0" class="flex justify-center py-12">
      <span class="loading loading-dots loading-md text-primary"></span>
    </div>

    <div v-else-if="comments.length === 0" class="text-center py-12 text-base-content/40">
      <Icon icon="mdi:comment-outline" class="size-12 mx-auto mb-2 opacity-40" />
      <p class="text-sm">暂无评论，快来留下第一条想法吧~</p>
    </div>

    <div v-else class="space-y-6">
      <div
        v-for="comment in comments"
        :key="comment.id"
        class="comment-thread group/thread border-b border-base-200/60 pb-6 last:border-none last:pb-0"
      >
        <!-- 根评论主体 -->
        <div class="flex gap-3 sm:gap-4 items-start">
          <Avatar
            :user="comment.author"
            size="36"
            class="shrink-0 mt-0.5"
            link
          />

          <div class="flex-1 min-w-0">
            <!-- 评论作者与标签 -->
            <div class="flex items-center gap-2 flex-wrap text-xs">
              <span class="font-bold text-base-content/90 hover:text-primary transition-colors">
                {{ comment.author?.nickname || comment.author?.username || "未知读者" }}
              </span>

              <!-- 剧透标记 -->
              <span
                v-if="comment.isSpoiler"
                class="badge badge-warning badge-xs gap-1 font-sans"
              >
                <Icon icon="mdi:alert-circle" class="size-3" />
                剧透
              </span>

              <!-- 场景划词标记 -->
              <span
                v-if="comment.position?.sceneName"
                class="badge badge-outline badge-xs text-base-content/60 font-mono"
              >
                场景: {{ comment.position.sceneName }}
              </span>

              <span class="text-base-content/40 ml-auto font-mono text-[11px]">
                {{ formatTime(comment.createdAt) }}
              </span>
            </div>

            <!-- 划词引文（若有） -->
            <div
              v-if="comment.position?.selectedText"
              class="mt-2 text-xs bg-base-200/60 border-l-2 border-primary/60 px-2.5 py-1.5 rounded-r text-base-content/70 italic"
            >
              “{{ comment.position.selectedText }}”
            </div>

            <!-- 评论内容（支持剧透折叠） -->
            <div class="mt-2 text-sm leading-relaxed break-words">
              <!-- 已被屏蔽 -->
              <span v-if="comment.isBlocked && !isAdmin" class="text-base-content/40 italic">
                {{ comment.content }}
              </span>

              <!-- 已被删除 -->
              <span v-else-if="comment.isDeleted" class="text-base-content/40 italic">
                {{ comment.content }}
              </span>

              <!-- 剧透内容遮盖 -->
              <div
                v-else-if="comment.isSpoiler && !revealedSpoilers.has(comment.id)"
                class="bg-base-200/50 hover:bg-base-200/80 cursor-pointer rounded-lg p-3 text-xs text-base-content/60 flex items-center justify-between transition-colors border border-dashed border-base-300"
                @click="toggleSpoiler(comment.id)"
              >
                <span class="flex items-center gap-1.5 text-warning font-medium">
                  <Icon icon="mdi:eye-off-outline" class="size-4" />
                  此评论包含剧透，点击展开查看
                </span>
                <Icon icon="mdi:chevron-down" class="size-4 opacity-60" />
              </div>

              <!-- 正常展示内容 -->
              <div v-else class="whitespace-pre-wrap">
                <span
                  v-if="comment.isBlocked && isAdmin"
                  class="badge badge-error badge-xs mr-1"
                >已屏蔽</span>
                {{ comment.content }}
              </div>
            </div>

            <!-- 根评论操作栏 -->
            <div class="mt-2.5 flex items-center gap-3 text-xs text-base-content/50">
              <button
                class="hover:text-primary transition-colors flex items-center gap-1"
                @click="startReply(comment, comment)"
              >
                <Icon icon="mdi:reply-outline" class="size-3.5" />
                <span>回复</span>
              </button>

              <button
                v-if="canDelete(comment)"
                class="hover:text-error transition-colors flex items-center gap-1"
                @click="handleDelete(comment)"
              >
                <Icon icon="mdi:delete-outline" class="size-3.5" />
                <span>删除</span>
              </button>

              <button
                v-if="!comment.isDeleted"
                class="hover:text-warning transition-colors flex items-center gap-1"
                @click="openReport(comment)"
              >
                <Icon icon="mdi:flag-outline" class="size-3.5" />
                <span>举报</span>
              </button>

              <!-- 管理员屏蔽与解除屏蔽 -->
              <template v-if="isAdmin && !comment.isDeleted">
                <button
                  v-if="!comment.isBlocked"
                  class="hover:text-error transition-colors flex items-center gap-1"
                  @click="openBlock(comment)"
                >
                  <Icon icon="mdi:shield-alert-outline" class="size-3.5" />
                  <span>屏蔽</span>
                </button>
                <button
                  v-else
                  class="hover:text-success transition-colors flex items-center gap-1"
                  @click="handleUnblock(comment)"
                >
                  <Icon icon="mdi:shield-check-outline" class="size-3.5" />
                  <span>解封</span>
                </button>
              </template>
            </div>

            <!-- 内联回复输入框（回复当前根评论） -->
            <div
              v-if="activeReply?.rootId === comment.id && activeReply?.targetComment.id === comment.id"
              class="mt-3 bg-base-200/40 p-3 rounded-xl border border-base-200"
            >
              <textarea
                v-model="replyContent"
                rows="2"
                class="textarea textarea-bordered w-full rounded-lg text-sm bg-base-100"
                :placeholder="`回复 @${comment.author?.nickname || comment.author?.username}...`"
                :disabled="replySubmitting"
              ></textarea>
              <div class="mt-2 flex items-center justify-between">
                <label class="label cursor-pointer gap-1.5 py-0">
                  <input
                    v-model="replyIsSpoiler"
                    type="checkbox"
                    class="checkbox checkbox-warning checkbox-xs rounded"
                  />
                  <span class="label-text text-xs text-base-content/70">包含剧透</span>
                </label>
                <div class="flex items-center gap-2">
                  <button
                    class="btn btn-ghost btn-xs"
                    :disabled="replySubmitting"
                    @click="cancelReply"
                  >
                    取消
                  </button>
                  <button
                    class="btn btn-primary btn-xs rounded"
                    :disabled="replySubmitting || !replyContent.trim()"
                    @click="submitReply"
                  >
                    <span v-if="replySubmitting" class="loading loading-spinner loading-xs"></span>
                    <span>回复</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- 子回复楼层 (二级列表) -->
            <div
              v-if="comment.replies && comment.replies.length > 0"
              class="mt-4 space-y-3.5 pl-3 sm:pl-4 border-l-2 border-base-200"
            >
              <div
                v-for="reply in comment.replies"
                :key="reply.id"
                class="sub-reply flex gap-2.5 sm:gap-3 items-start group/sub"
              >
                <Avatar
                  :user="reply.author"
                  size="28"
                  class="shrink-0 mt-0.5"
                  link
                />

                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 flex-wrap text-xs">
                    <span class="font-bold text-base-content/90">
                      {{ reply.author?.nickname || reply.author?.username || "未知读者" }}
                    </span>

                    <template v-if="reply.replyToUser">
                      <span class="text-base-content/40">回复</span>
                      <span class="text-primary font-medium">
                        @{{ reply.replyToUser.nickname || reply.replyToUser.username }}
                      </span>
                    </template>

                    <span
                      v-if="reply.isSpoiler"
                      class="badge badge-warning badge-xs gap-1 font-sans"
                    >
                      剧透
                    </span>

                    <span class="text-base-content/40 ml-auto font-mono text-[10px]">
                      {{ formatTime(reply.createdAt) }}
                    </span>
                  </div>

                  <!-- 回复内容 -->
                  <div class="mt-1 text-xs sm:text-sm leading-relaxed break-words">
                    <span v-if="reply.isBlocked && !isAdmin" class="text-base-content/40 italic">
                      {{ reply.content }}
                    </span>
                    <span v-else-if="reply.isDeleted" class="text-base-content/40 italic">
                      {{ reply.content }}
                    </span>
                    <div
                      v-else-if="reply.isSpoiler && !revealedSpoilers.has(reply.id)"
                      class="bg-base-200/50 hover:bg-base-200/80 cursor-pointer rounded p-2 text-xs text-base-content/60 flex items-center justify-between border border-dashed border-base-300"
                      @click="toggleSpoiler(reply.id)"
                    >
                      <span class="flex items-center gap-1 text-warning">
                        <Icon icon="mdi:eye-off-outline" class="size-3.5" />
                        剧透已折叠，点击展开
                      </span>
                      <Icon icon="mdi:chevron-down" class="size-3.5 opacity-60" />
                    </div>
                    <div v-else class="whitespace-pre-wrap">
                      <span
                        v-if="reply.isBlocked && isAdmin"
                        class="badge badge-error badge-xs mr-1"
                      >已屏蔽</span>
                      {{ reply.content }}
                    </div>
                  </div>

                  <!-- 子回复操作栏 -->
                  <div class="mt-1.5 flex items-center gap-2.5 text-[11px] text-base-content/50">
                    <button
                      class="hover:text-primary transition-colors flex items-center gap-0.5"
                      @click="startReply(comment, reply)"
                    >
                      <Icon icon="mdi:reply-outline" class="size-3" />
                      <span>回复</span>
                    </button>

                    <button
                      v-if="canDelete(reply)"
                      class="hover:text-error transition-colors flex items-center gap-0.5"
                      @click="handleDelete(reply)"
                    >
                      <Icon icon="mdi:delete-outline" class="size-3" />
                      <span>删除</span>
                    </button>

                    <button
                      v-if="!reply.isDeleted"
                      class="hover:text-warning transition-colors flex items-center gap-0.5"
                      @click="openReport(reply)"
                    >
                      <Icon icon="mdi:flag-outline" class="size-3" />
                      <span>举报</span>
                    </button>

                    <template v-if="isAdmin && !reply.isDeleted">
                      <button
                        v-if="!reply.isBlocked"
                        class="hover:text-error transition-colors"
                        @click="openBlock(reply)"
                      >
                        屏蔽
                      </button>
                      <button
                        v-else
                        class="hover:text-success transition-colors"
                        @click="handleUnblock(reply)"
                      >
                        解封
                      </button>
                    </template>
                  </div>

                  <!-- 内联回复输入框（针对子回复进行回复） -->
                  <div
                    v-if="activeReply?.rootId === comment.id && activeReply?.targetComment.id === reply.id"
                    class="mt-2 bg-base-200/40 p-2.5 rounded-lg border border-base-200"
                  >
                    <textarea
                      v-model="replyContent"
                      rows="2"
                      class="textarea textarea-bordered w-full rounded-md text-xs bg-base-100"
                      :placeholder="`回复 @${reply.author?.nickname || reply.author?.username}...`"
                      :disabled="replySubmitting"
                    ></textarea>
                    <div class="mt-1.5 flex items-center justify-between">
                      <label class="label cursor-pointer gap-1 py-0">
                        <input
                          v-model="replyIsSpoiler"
                          type="checkbox"
                          class="checkbox checkbox-warning checkbox-xs rounded"
                        />
                        <span class="label-text text-[11px] text-base-content/70">包含剧透</span>
                      </label>
                      <div class="flex items-center gap-1.5">
                        <button
                          class="btn btn-ghost btn-xs"
                          :disabled="replySubmitting"
                          @click="cancelReply"
                        >
                          取消
                        </button>
                        <button
                          class="btn btn-primary btn-xs rounded"
                          :disabled="replySubmitting || !replyContent.trim()"
                          @click="submitReply"
                        >
                          <span v-if="replySubmitting" class="loading loading-spinner loading-xs"></span>
                          <span>回复</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 加载更多 -->
      <div v-if="comments.length < total" class="pt-4 text-center">
        <button
          class="btn btn-ghost btn-sm w-full gap-2 text-base-content/60"
          :disabled="loading"
          @click="loadMore"
        >
          <span v-if="loading" class="loading loading-spinner loading-xs"></span>
          <span>加载更多评论</span>
        </button>
      </div>
    </div>

    <!-- 举报弹窗 -->
    <div v-if="showReportModal" class="modal modal-open backdrop-blur-sm bg-neutral/40 z-50">
      <div class="modal-box max-w-md p-6 rounded-2xl bg-base-100 font-sans">
        <h3 class="font-bold text-lg text-base-content mb-3 flex items-center gap-1.5">
          <Icon icon="mdi:flag-outline" class="size-5 text-warning" />
          <span>举报评论</span>
        </h3>
        <p class="text-xs text-base-content/60 mb-4">
          请选择举报理由，管理员将尽快进行核实处理。
        </p>

        <div class="space-y-2 mb-4">
          <label
            v-for="item in reportOptions"
            :key="item"
            class="flex items-center gap-2 p-2 rounded-lg border border-base-200 hover:bg-base-200/40 cursor-pointer transition-colors"
          >
            <input
              v-model="reportReason"
              type="radio"
              name="report-reason"
              :value="item"
              class="radio radio-warning radio-sm"
            />
            <span class="text-sm">{{ item }}</span>
          </label>
        </div>

        <textarea
          v-model="reportDescription"
          rows="2"
          class="textarea textarea-bordered w-full rounded-xl text-xs bg-base-200/30 mb-4"
          placeholder="补充详细说明（选填）..."
        ></textarea>

        <div class="modal-action mt-2">
          <button
            class="btn btn-ghost btn-sm"
            :disabled="reporting"
            @click="closeReport"
          >
            取消
          </button>
          <button
            class="btn btn-warning btn-sm gap-1"
            :disabled="reporting || !reportReason"
            @click="submitReport"
          >
            <span v-if="reporting" class="loading loading-spinner loading-xs"></span>
            <span>提交举报</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 管理员屏蔽弹窗 -->
    <div v-if="showBlockModal" class="modal modal-open backdrop-blur-sm bg-neutral/40 z-50">
      <div class="modal-box max-w-md p-6 rounded-2xl bg-base-100 font-sans">
        <h3 class="font-bold text-lg text-base-content mb-2 flex items-center gap-1.5">
          <Icon icon="mdi:shield-alert" class="size-5 text-error" />
          <span>屏蔽评论</span>
        </h3>
        <p class="text-xs text-base-content/60 mb-4">
          屏蔽后，非管理员用户将无法查看该评论正文（显示为屏蔽提示）。
        </p>

        <div class="form-control mb-4">
          <label class="label text-xs font-semibold py-1">屏蔽原因</label>
          <input
            v-model="blockReason"
            type="text"
            class="input input-bordered w-full text-sm rounded-lg"
            placeholder="如：违反社区规范、涉嫌违规等"
          />
        </div>

        <div class="modal-action mt-2">
          <button
            class="btn btn-ghost btn-sm"
            :disabled="blocking"
            @click="closeBlock"
          >
            取消
          </button>
          <button
            class="btn btn-error btn-sm gap-1"
            :disabled="blocking"
            @click="submitBlock"
          >
            <span v-if="blocking" class="loading loading-spinner loading-xs"></span>
            <span>确认屏蔽</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import Icon from "@/components/Icon/src/Icon.vue";
import Avatar from "@/components/Avatar/src/Avatar.vue";
import { Message } from "@/components/msg";
import { useAuthStore } from "@/stores/modules/auth";
import {
  getComments,
  createComment,
  deleteComment,
  reportComment,
  blockComment,
  unblockComment,
  type CommentItem,
} from "@/api/comments";

const props = defineProps<{
  storyId: string;
  sceneName?: string;
}>();

const authStore = useAuthStore();
const currentUser = computed(() => authStore.getUser);
const isAdmin = computed(() => authStore.isAdmin);
const currentUserId = computed(() => authStore.getUser?.id);

// 状态定义
const comments = ref<CommentItem[]>([]);
const total = ref(0);
const page = ref(1);
const limit = 20;
const loading = ref(false);
const submitting = ref(false);
const filterScene = ref(false);

// 主评论输入
const commentContent = ref("");
const isSpoiler = ref(false);

// 展开查看的剧透评论 ID 集合
const revealedSpoilers = ref<Set<string>>(new Set());

// 回复状态管理
const activeReply = ref<{
  rootId: string;
  targetComment: CommentItem;
} | null>(null);
const replyContent = ref("");
const replyIsSpoiler = ref(false);
const replySubmitting = ref(false);

// 举报状态管理
const showReportModal = ref(false);
const reportTargetComment = ref<CommentItem | null>(null);
const reportReason = ref("垃圾广告或引流");
const reportDescription = ref("");
const reporting = ref(false);
const reportOptions = [
  "垃圾广告或引流",
  "剧透未标记",
  "人身攻击或不友善言论",
  "违法违规信息",
  "其他原因",
];

// 管理员屏蔽状态管理
const showBlockModal = ref(false);
const blockTargetComment = ref<CommentItem | null>(null);
const blockReason = ref("违反社区规范");
const blocking = ref(false);

// 格式化时间戳
function formatTime(timestamp: number) {
  if (!timestamp) return "";
  const diff = Date.now() - Number(timestamp);
  if (diff < 60 * 1000) return "刚刚";
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))} 分钟前`;
  if (diff < 24 * 60 * 60 * 1000)
    return `${Math.floor(diff / (60 * 60 * 1000))} 小时前`;
  if (diff < 30 * 24 * 60 * 60 * 1000)
    return `${Math.floor(diff / (24 * 60 * 60 * 1000))} 天前`;
  return new Date(Number(timestamp)).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// 检查是否可删除（所有者或管理员，且无回复）
function canDelete(c: CommentItem): boolean {
  if (c.isDeleted) return false;
  const isOwnerOrAdmin = c.userId === currentUserId.value || isAdmin.value;
  if (!isOwnerOrAdmin) return false;
  // 若包含子回复，则不可删除
  if (c.replies && c.replies.length > 0) return false;
  return true;
}

// 获取评论列表
async function loadComments(reset = false) {
  if (!props.storyId) return;
  if (reset) {
    page.value = 1;
  }
  loading.value = true;
  try {
    const res = await getComments({
      storyId: props.storyId,
      sceneName: filterScene.value ? props.sceneName : undefined,
      tree: true,
      page: page.value,
      limit,
    });
    if (reset) {
      comments.value = res.data || [];
    } else {
      comments.value = [...comments.value, ...(res.data || [])];
    }
    total.value = res.total || 0;
  } catch (err: any) {
    Message.error(err?.message || "获取评论列表失败");
  } finally {
    loading.value = false;
  }
}

function loadMore() {
  page.value++;
  loadComments(false);
}

function toggleSceneFilter() {
  filterScene.value = !filterScene.value;
  loadComments(true);
}

// 切换剧透展示
function toggleSpoiler(id: string) {
  if (revealedSpoilers.value.has(id)) {
    revealedSpoilers.value.delete(id);
  } else {
    revealedSpoilers.value.add(id);
  }
}

// 提交主评论
async function submitComment() {
  if (!authStore.isAuthenticated) {
    Message.warning("请先登录后再发表评论");
    return;
  }
  const text = commentContent.value.trim();
  if (!text) {
    Message.warning("评论内容不能为空");
    return;
  }

  submitting.value = true;
  try {
    await createComment({
      storyId: props.storyId,
      content: text,
      isSpoiler: isSpoiler.value,
    });
    Message.success("评论发表成功");
    commentContent.value = "";
    isSpoiler.value = false;
    await loadComments(true);
  } catch (err: any) {
    Message.error(err?.message || "发表评论失败");
  } finally {
    submitting.value = false;
  }
}

// 回复功能
function startReply(root: CommentItem, target: CommentItem) {
  if (!authStore.isAuthenticated) {
    Message.warning("请先登录后再进行回复");
    return;
  }
  activeReply.value = { rootId: root.id, targetComment: target };
  replyContent.value = "";
  replyIsSpoiler.value = false;
}

function cancelReply() {
  activeReply.value = null;
  replyContent.value = "";
}

async function submitReply() {
  if (!activeReply.value) return;
  const text = replyContent.value.trim();
  if (!text) {
    Message.warning("回复内容不能为空");
    return;
  }

  replySubmitting.value = true;
  try {
    await createComment({
      storyId: props.storyId,
      content: text,
      parentId: activeReply.value.rootId,
      replyToId: activeReply.value.targetComment.id,
      replyToUserId: activeReply.value.targetComment.userId,
      isSpoiler: replyIsSpoiler.value,
    });
    Message.success("回复发送成功");
    cancelReply();
    await loadComments(true);
  } catch (err: any) {
    Message.error(err?.message || "回复发送失败");
  } finally {
    replySubmitting.value = false;
  }
}

// 删除评论
async function handleDelete(c: CommentItem) {
  if (!confirm("确定要删除这条评论吗？")) return;
  try {
    await deleteComment(c.id);
    Message.success("评论已删除");
    await loadComments(true);
  } catch (err: any) {
    Message.error(err?.message || "删除评论失败");
  }
}

// 举报
function openReport(c: CommentItem) {
  if (!authStore.isAuthenticated) {
    Message.warning("请先登录后再提交举报");
    return;
  }
  reportTargetComment.value = c;
  reportReason.value = "垃圾广告或引流";
  reportDescription.value = "";
  showReportModal.value = true;
}

function closeReport() {
  showReportModal.value = false;
  reportTargetComment.value = null;
}

async function submitReport() {
  if (!reportTargetComment.value) return;
  reporting.value = true;
  try {
    await reportComment(reportTargetComment.value.id, {
      reason: reportReason.value,
      description: reportDescription.value.trim() || undefined,
    });
    Message.success("举报提交成功，感谢你的监督");
    closeReport();
  } catch (err: any) {
    Message.error(err?.message || "举报提交失败");
  } finally {
    reporting.value = false;
  }
}

// 管理员屏蔽
function openBlock(c: CommentItem) {
  blockTargetComment.value = c;
  blockReason.value = "违反社区规范";
  showBlockModal.value = true;
}

function closeBlock() {
  showBlockModal.value = false;
  blockTargetComment.value = null;
}

async function submitBlock() {
  if (!blockTargetComment.value) return;
  blocking.value = true;
  try {
    await blockComment(blockTargetComment.value.id, blockReason.value);
    Message.success("该评论已被屏蔽");
    closeBlock();
    await loadComments(true);
  } catch (err: any) {
    Message.error(err?.message || "屏蔽操作失败");
  } finally {
    blocking.value = false;
  }
}

async function handleUnblock(c: CommentItem) {
  try {
    await unblockComment(c.id);
    Message.success("已解除屏蔽");
    await loadComments(true);
  } catch (err: any) {
    Message.error(err?.message || "解除屏蔽失败");
  }
}

// 监听 storyId 变化重载评论
watch(
  () => props.storyId,
  (newId) => {
    if (newId) loadComments(true);
  },
);

onMounted(() => {
  loadComments(true);
});
</script>

<style scoped>
.comment-section {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
