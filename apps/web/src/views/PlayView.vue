<template>
  <div
    class="min-h-screen bg-base-200/50 flex flex-col font-serif text-base-content antialiased selection:bg-primary/20 selection:text-primary"
  >
    <!-- 主阅读区域：典雅纸张感设计 -->
    <main
      class="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-10 flex flex-col"
    >
      <!-- 故事操作快捷工具栏 -->
      <div
        class="flex items-center justify-between mb-4 px-2 text-xs font-sans text-base-content/60"
      >
        <div class="flex items-center gap-2">
          <button
            class="btn btn-ghost btn-xs gap-1 hover:text-base-content"
            @click="router.push('/stories')"
          >
            <Icon icon="mdi:arrow-left" class="size-3.5" />
            <span>返回故事</span>
          </button>
          <span v-if="story?.author" class="opacity-60">
            • 作者：{{ authorName }}
          </span>
        </div>

        <div class="flex items-center gap-1">
          <button
            v-if="canUndo"
            class="btn btn-ghost btn-xs gap-1 hover:text-base-content"
            title="撤销上一步"
            :disabled="undoing"
            @click="undo"
          >
            <Icon icon="mdi:undo-variant" class="size-3.5" />
            <span>{{ undoing ? "撤销中" : "撤销" }}</span>
          </button>
          <button
            class="btn btn-ghost btn-xs gap-1 hover:text-base-content"
            title="重新开始"
            @click="showRestartConfirm = true"
          >
            <Icon icon="mdi:restart" class="size-3.5" />
            <span>{{ isEnding ? '重来' : '重置' }}</span>
          </button>
          <button
            class="btn btn-ghost btn-xs gap-1 hover:text-base-content"
            title="故事详情"
            @click="showDetailModal = true"
          >
            <Icon icon="mdi:information-outline" class="size-3.5" />
            <span>简介</span>
          </button>
        </div>
      </div>

      <!-- 故事更新提示 Alert -->
      <transition name="slide-fade">
        <div
          v-if="showUpdateAlert"
          role="alert"
          class="alert alert-info alert-soft mb-4 rounded-xl shadow-xs font-sans text-xs flex items-center justify-between gap-3 border border-info/20"
        >
          <div class="flex items-center gap-2 min-w-0">
            <Icon icon="mdi:information-outline" class="size-4 shrink-0 text-info" />
            <span class="text-base-content/90">
              故事已发布更新，当前阅读内容基于更新前的版本。
            </span>
          </div>
          <button
            type="button"
            class="btn btn-ghost btn-xs btn-circle shrink-0 text-base-content/50 hover:text-base-content"
            title="关闭提示"
            @click="dismissUpdateAlert"
          >
            <Icon icon="mdi:close" class="size-3.5" />
          </button>
        </div>
      </transition>

      <!-- 故事主卡片 -->
      <article
        class="bg-base-100/90 shadow-sm hover:shadow-md transition-shadow duration-300 rounded-2xl p-6 sm:p-12 border border-base-300/60 min-h-[60vh] flex flex-col justify-between"
      >
        <!-- 正文渲染区 -->
        <div class="page-turn-stage">
          <transition
            name="page-turn"
            mode="out-in"
            @after-enter="onSceneAfterEnter"
          >
            <div
              :key="sceneRenderKey"
              ref="contentRef"
              class="story-content prose prose-stone lg:prose-lg max-w-none focus:outline-none"
              v-html="currentHtml"
              @click="onContentClick"
            ></div>
          </transition>
        </div>

        <!-- 底部微交互/状态指示 -->
        <footer
          class="mt-12 pt-6 border-t border-base-200/80 flex items-center justify-between text-xs text-base-content/40 font-sans"
        >
          <span class="flex items-center gap-1.5">
            <span
              class="inline-block w-1.5 h-1.5 rounded-full bg-success/80 animate-pulse"
            ></span>
            当前章节: {{ play?.currentPassage || play?.passage || "序幕" }}
          </span>
          <div class="flex items-center gap-2 flex-wrap">
            <div class="text-xs text-base-content/50">正在阅读</div>
            <div class="avatar-group -space-x-3">
              <Avatar
                v-for="reader in readers.slice(0, 5)"
                :key="reader.id"
                :user="reader"
                tip
                link
                size="28"
                shrink
              />
            </div>
            <span
              v-if="readers.length > 5"
              class="text-xs text-base-content/40"
            >
              等 {{ readers.length }} 人
            </span>
          </div>
        </footer>
      </article>

      <!-- 文章下方评论区 -->
      <CommentSection
        v-if="storyId"
        ref="commentSectionRef"
        class="mt-8"
        :story-id="storyId"
        :scene-name="currentPassageName"
        :variables="variables"
      />
    </main>

    <!-- 划词操作悬浮按钮 -->
    <div
      v-if="floatingBtnVisible"
      class="fixed z-50 -translate-x-1/2 -translate-y-full pointer-events-auto transition-all duration-150"
      :style="{ top: `${floatingBtnPos.top}px`, left: `${floatingBtnPos.left}px` }"
    >
      <button
        type="button"
        class="btn btn-primary btn-xs sm:btn-sm rounded-full shadow-xl gap-1.5 px-3 py-1 font-sans font-medium hover:scale-105 transition-transform"
        @mousedown.prevent="openSelectionCommentModal"
      >
        <Icon icon="mdi:comment-quote-outline" class="size-3.5 sm:size-4" />
        <span>划线评论</span>
      </button>
    </div>

    <!-- 划线评论发布弹窗 -->
    <div
      v-if="showInlineModal"
      class="modal modal-open backdrop-blur-sm bg-neutral/40"
    >
      <div class="modal-box max-w-lg p-5 sm:p-6 space-y-4 rounded-2xl font-sans bg-base-100">
        <div class="flex items-center justify-between pb-2 border-b border-base-200">
          <div class="flex items-center gap-2">
            <div class="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Icon icon="mdi:comment-quote" class="size-4" />
            </div>
            <h3 class="font-bold text-base text-base-content">
              划线评论
            </h3>
          </div>
          <button
            type="button"
            class="btn btn-sm btn-ghost btn-circle"
            @click="closeSelectionCommentModal"
          >
            ✕
          </button>
        </div>

        <!-- 选中文本展示 -->
        <div
          v-if="currentSelection?.text"
          class="border-l-3 border-primary bg-base-200/50 p-3 rounded-r-xl text-xs sm:text-sm font-serif leading-relaxed text-base-content/85 italic max-h-32 overflow-y-auto"
        >
          “{{ currentSelection.text }}”
        </div>

        <!-- 评论输入框 -->
        <div class="space-y-2">
          <textarea
            v-model="inlineCommentContent"
            rows="3"
            class="textarea textarea-bordered w-full text-xs sm:text-sm font-sans"
            placeholder="写下你对此处的想法、推测或体验感受..."
            :disabled="inlineSubmitting"
          ></textarea>

          <div class="flex items-center gap-4 flex-wrap">
            <label class="label cursor-pointer justify-start gap-2 py-0">
              <input
                v-model="inlineIsSpoiler"
                type="checkbox"
                class="checkbox checkbox-sm checkbox-warning rounded"
                :disabled="inlineSubmitting"
              />
              <span class="label-text text-xs text-base-content/70">标记剧透</span>
            </label>

            <label class="label cursor-pointer justify-start gap-2 py-0">
              <input
                v-model="inlineIsAuthorOnly"
                type="checkbox"
                class="checkbox checkbox-sm checkbox-primary rounded"
                :disabled="inlineSubmitting"
              />
              <span class="label-text text-xs text-base-content/70 flex items-center gap-1">
                <Icon icon="mdi:lock-outline" class="size-3.5 text-primary" />
                仅作者可见
              </span>
            </label>
          </div>
        </div>

        <!-- 弹窗底部操作按钮 -->
        <div class="modal-action flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            class="btn btn-sm btn-ghost"
            :disabled="inlineSubmitting"
            @click="closeSelectionCommentModal"
          >
            取消
          </button>
          <button
            type="button"
            class="btn btn-sm btn-primary gap-1"
            :disabled="!inlineCommentContent.trim() || inlineSubmitting"
            @click="submitSelectionComment"
          >
            <span v-if="inlineSubmitting" class="loading loading-spinner loading-xs"></span>
            <Icon v-else icon="mdi:send" class="size-3.5" />
            <span>发表评论</span>
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="closeSelectionCommentModal"></div>
    </div>

    <!-- 划线评论预览弹窗 (点击正文划线高亮触发) -->
    <div
      v-if="showQuoteCommentsModal"
      class="modal modal-open backdrop-blur-sm bg-neutral/40"
    >
      <div class="modal-box max-w-lg p-5 space-y-4 rounded-2xl font-sans bg-base-100">
        <div class="flex items-center justify-between pb-2 border-b border-base-200">
          <div class="flex items-center gap-2">
            <div class="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Icon icon="mdi:format-quote-open" class="size-4" />
            </div>
            <h3 class="font-bold text-base text-base-content">
              关于此处的划线评论 ({{ activeQuoteTotalCount }})
            </h3>
          </div>
          <button
            type="button"
            class="btn btn-sm btn-ghost btn-circle"
            @click="showQuoteCommentsModal = false"
          >
            ✕
          </button>
        </div>

        <!-- 引用文本 -->
        <div class="border-l-3 border-primary bg-base-200/50 p-3 rounded-r-xl text-xs sm:text-sm font-serif leading-relaxed text-base-content/85 italic max-h-32 overflow-y-auto">
          “{{ activeQuoteText }}”
        </div>

        <!-- 评论列表 -->
        <div class="space-y-3 max-h-80 overflow-y-auto pr-1">
          <div
            v-for="c in activeQuoteComments"
            :key="c.id"
            :id="`quote-comment-${c.id}`"
            class="p-3 bg-base-200/40 rounded-xl border border-base-200/80 space-y-2 text-xs transition-colors duration-300"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <Avatar
                  :user="c.author"
                  size="24"
                  link
                  class="shrink-0"
                />
                <span class="font-medium text-base-content">
                  {{ c.author?.nickname || c.author?.username || "读者" }}
                </span>
                <span v-if="c.isSpoiler" class="badge badge-warning badge-xs">剧透</span>
                <span
                  v-if="c.isAuthorOnly"
                  class="badge badge-primary badge-soft badge-xs gap-1 font-sans"
                >
                  <Icon icon="mdi:lock-outline" class="size-2.5" />
                  仅作者可见
                </span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-base-content/40 font-mono text-[10px]">
                  {{ formatTime(c.createdAt) }}
                </span>
                <button
                  v-if="canDeleteQuoteComment(c)"
                  type="button"
                  class="btn btn-ghost btn-xs text-error/60 hover:text-error btn-square size-5"
                  title="删除此评论"
                  @click="deleteQuoteComment(c)"
                >
                  <Icon icon="mdi:delete-outline" class="size-3.5" />
                </button>
              </div>
            </div>

            <!-- 内容与剧透折叠 -->
            <div class="text-base-content/90 leading-relaxed break-words whitespace-pre-wrap">
              <template v-if="c.isSpoiler && !revealedQuoteSpoilers.has(c.id)">
                <button
                  type="button"
                  class="text-warning text-xs hover:underline flex items-center gap-1"
                  @click="revealedQuoteSpoilers.add(c.id)"
                >
                  <Icon icon="mdi:eye-off-outline" class="size-3.5" />
                  <span>剧透内容，点击查看</span>
                </button>
              </template>
              <template v-else>
                {{ c.content }}
              </template>
            </div>

            <!-- 根评论操作栏 -->
            <div class="flex items-center gap-3 pt-1 text-[11px] text-base-content/50">
              <button
                type="button"
                class="hover:text-primary transition-colors flex items-center gap-1"
                @click="startQuoteReply(c, c)"
              >
                <Icon icon="mdi:reply-outline" class="size-3" />
                <span>回复</span>
              </button>
            </div>

            <!-- 针对根评论的回复输入框 -->
            <div
              v-if="activeQuoteReply?.rootId === c.id && activeQuoteReply?.targetComment.id === c.id"
              class="mt-2 bg-base-100 p-2.5 rounded-lg border border-base-300 space-y-2"
            >
              <textarea
                v-model="quoteReplyContent"
                rows="2"
                class="textarea textarea-bordered textarea-xs w-full rounded text-xs bg-base-100"
                :placeholder="`回复 @${c.author?.nickname || c.author?.username || '读者'}...`"
                :disabled="quoteReplySubmitting"
              ></textarea>
              <div class="flex items-center justify-between flex-wrap gap-2">
                <div class="flex items-center gap-2">
                  <label class="label cursor-pointer gap-1 py-0">
                    <input
                      v-model="quoteReplyIsSpoiler"
                      type="checkbox"
                      class="checkbox checkbox-warning checkbox-xs rounded"
                    />
                    <span class="label-text text-[11px] text-base-content/70">包含剧透</span>
                  </label>
                  <label class="label cursor-pointer gap-1 py-0">
                    <input
                      v-model="quoteReplyIsAuthorOnly"
                      type="checkbox"
                      class="checkbox checkbox-primary checkbox-xs rounded"
                    />
                    <span class="label-text text-[11px] text-base-content/70 flex items-center gap-0.5">
                      <Icon icon="mdi:lock-outline" class="size-2.5 text-primary" />
                      仅作者可见
                    </span>
                  </label>
                </div>
                <div class="flex items-center gap-1.5">
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    :disabled="quoteReplySubmitting"
                    @click="cancelQuoteReply"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    class="btn btn-primary btn-xs"
                    :disabled="quoteReplySubmitting || !quoteReplyContent.trim()"
                    @click="submitQuoteReply"
                  >
                    <span v-if="quoteReplySubmitting" class="loading loading-spinner loading-xs"></span>
                    <span>回复</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- 子回复楼层 (二级列表) -->
            <div
              v-if="c.replies && c.replies.length > 0"
              class="mt-2.5 space-y-2.5 pl-3 border-l-2 border-base-300/80"
            >
              <div
                v-for="reply in c.replies"
                :key="reply.id"
                :id="`quote-comment-${reply.id}`"
                class="sub-reply space-y-1 text-xs transition-colors duration-300"
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <Avatar
                      :user="reply.author"
                      size="20"
                      link
                      class="shrink-0"
                    />
                    <span class="font-medium text-base-content/90">
                      {{ reply.author?.nickname || reply.author?.username || "未知读者" }}
                    </span>
                    <template v-if="reply.replyToUser">
                      <span class="text-base-content/40 text-[11px]">回复</span>
                      <span class="text-primary font-medium text-[11px]">
                        @{{ reply.replyToUser.nickname || reply.replyToUser.username }}
                      </span>
                    </template>
                    <span v-if="reply.isSpoiler" class="badge badge-warning badge-xs">剧透</span>
                    <span
                      v-if="reply.isAuthorOnly"
                      class="badge badge-primary badge-soft badge-xs gap-1 font-sans"
                    >
                      <Icon icon="mdi:lock-outline" class="size-2.5" />
                      仅作者可见
                    </span>
                  </div>
                  <div class="flex items-center gap-1">
                    <span class="text-base-content/40 font-mono text-[10px]">
                      {{ formatTime(reply.createdAt) }}
                    </span>
                    <button
                      v-if="canDeleteQuoteComment(reply)"
                      type="button"
                      class="btn btn-ghost btn-xs text-error/60 hover:text-error btn-square size-4.5"
                      title="删除此回复"
                      @click="deleteQuoteComment(reply)"
                    >
                      <Icon icon="mdi:delete-outline" class="size-3" />
                    </button>
                  </div>
                </div>

                <!-- 回复内容与剧透 -->
                <div class="text-base-content/85 leading-relaxed break-words whitespace-pre-wrap pl-6">
                  <template v-if="reply.isSpoiler && !revealedQuoteSpoilers.has(reply.id)">
                    <button
                      type="button"
                      class="text-warning text-xs hover:underline flex items-center gap-1"
                      @click="revealedQuoteSpoilers.add(reply.id)"
                    >
                      <Icon icon="mdi:eye-off-outline" class="size-3.5" />
                      <span>剧透内容，点击查看</span>
                    </button>
                  </template>
                  <template v-else>
                    {{ reply.content }}
                  </template>
                </div>

                <!-- 回复按钮 -->
                <div class="flex items-center gap-2 pl-6 text-[10px] text-base-content/50">
                  <button
                    type="button"
                    class="hover:text-primary transition-colors flex items-center gap-0.5"
                    @click="startQuoteReply(c, reply)"
                  >
                    <Icon icon="mdi:reply-outline" class="size-2.5" />
                    <span>回复</span>
                  </button>
                </div>

                <!-- 针对子回复的回复输入框 -->
                <div
                  v-if="activeQuoteReply?.rootId === c.id && activeQuoteReply?.targetComment.id === reply.id"
                  class="mt-2 ml-6 bg-base-100 p-2.5 rounded-lg border border-base-300 space-y-2"
                >
                  <textarea
                    v-model="quoteReplyContent"
                    rows="2"
                    class="textarea textarea-bordered textarea-xs w-full rounded text-xs bg-base-100"
                    :placeholder="`回复 @${reply.author?.nickname || reply.author?.username || '读者'}...`"
                    :disabled="quoteReplySubmitting"
                  ></textarea>
                  <div class="flex items-center justify-between flex-wrap gap-2">
                    <div class="flex items-center gap-2">
                      <label class="label cursor-pointer gap-1 py-0">
                        <input
                          v-model="quoteReplyIsSpoiler"
                          type="checkbox"
                          class="checkbox checkbox-warning checkbox-xs rounded"
                        />
                        <span class="label-text text-[11px] text-base-content/70">包含剧透</span>
                      </label>
                      <label class="label cursor-pointer gap-1 py-0">
                        <input
                          v-model="quoteReplyIsAuthorOnly"
                          type="checkbox"
                          class="checkbox checkbox-primary checkbox-xs rounded"
                        />
                        <span class="label-text text-[11px] text-base-content/70 flex items-center gap-0.5">
                          <Icon icon="mdi:lock-outline" class="size-2.5 text-primary" />
                          仅作者可见
                        </span>
                      </label>
                    </div>
                    <div class="flex items-center gap-1.5">
                      <button
                        type="button"
                        class="btn btn-ghost btn-xs"
                        :disabled="quoteReplySubmitting"
                        @click="cancelQuoteReply"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        class="btn btn-primary btn-xs"
                        :disabled="quoteReplySubmitting || !quoteReplyContent.trim()"
                        @click="submitQuoteReply"
                      >
                        <span v-if="quoteReplySubmitting" class="loading loading-spinner loading-xs"></span>
                        <span>回复</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部快捷操作 -->
        <div class="modal-action flex items-center justify-between pt-2 border-t border-base-200">
          <button
            type="button"
            class="btn btn-xs sm:btn-sm btn-ghost"
            @click="showQuoteCommentsModal = false"
          >
            关闭
          </button>
          <button
            type="button"
            class="btn btn-xs sm:btn-sm btn-primary gap-1"
            @click="openInlineFromQuote"
          >
            <Icon icon="mdi:plus" class="size-3.5" />
            <span>我也写一条</span>
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="showQuoteCommentsModal = false"></div>
    </div>

    <VariableInspector
      :is-test="isTest"
      :variables="variables"
      :drawer-open="inspectorDrawerOpen"
      @view="openValueModal"
      @toggle-drawer="inspectorDrawerOpen = !inspectorDrawerOpen"
      @close-drawer="inspectorDrawerOpen = false"
    />

    <transition name="ending-unlock-layer">
      <div
        v-if="showEndUnlockFx && unlockedEnding"
        class="pointer-events-auto fixed inset-0 z-[90] flex items-center justify-center px-4"
        @click.self="dismissEndingUnlock"
      >
        <div class="ending-overlay absolute inset-0" @click="dismissEndingUnlock"></div>
        <div class="ending-burst" aria-hidden="true">
          <span
            v-for="n in 12"
            :key="`spark-${n}`"
            class="ending-spark"
            :style="`--spark-index:${n}`"
          ></span>
        </div>
        <div
          class="ending-card relative w-full max-w-lg rounded-3xl border border-amber-800/25 p-6 sm:p-8 shadow-2xl"
        >
          <div class="novel-seal mb-4">终章解锁</div>
          <h4 class="text-3xl font-serif font-bold text-base-content leading-tight tracking-wide">
            {{ unlockedEnding.name || "未命名结局" }}
          </h4>
          <p class="mt-4 text-base text-base-content/80 leading-relaxed">
            {{ unlockedEnding.description || "你抵达了故事的一个结局。" }}
          </p>
          <div class="ending-divider my-5"></div>
          <p class="text-xs tracking-[0.22em] text-base-content/55 uppercase">
            点击任意空白处 或 继续阅读
          </p>
          <div class="mt-4">
            <button class="btn btn-sm btn-neutral" @click="dismissEndingUnlock">
              继续阅读
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 开始游玩 / 简介弹窗 -->
    <div
      v-if="showModal === true"
      class="modal modal-open backdrop-blur-sm bg-neutral/40"
    >
      <div
        class="modal-box max-w-lg border border-base-300/80 shadow-2xl p-6 sm:p-8 rounded-2xl bg-base-100 font-sans"
      >
        <div class="flex items-center justify-between mb-4">
          <span
            class="badge badge-outline badge-primary text-xs font-mono tracking-wider"
            >INTERACTIVE STORY</span
          >
        </div>

        <h3
          class="font-serif font-bold text-2xl text-base-content mb-2 tracking-tight"
        >
          {{ story?.title }}
        </h3>
        <p class="text-xs text-base-content/60 mb-6 flex items-center gap-1.5">
          <span>作者：{{ authorName }}</span>
        </p>
        <div
          class="bg-base-200/50 rounded-xl p-4 mb-6 border border-base-200 text-sm text-base-content/80 leading-relaxed font-serif max-h-48 overflow-y-auto"
        >
          <div
            v-html="story?.description || '探索属于你的剧情分支与故事世界。'"
          ></div>
        </div>

        <div v-if="readers.length > 0" >
          <div class="flex items-center gap-2 flex-wrap">
            <div class="text-xs text-base-content/50">正在阅读</div>
            <div class="avatar-group -space-x-2">
              <Avatar
                v-for="reader in readers.slice(0, 5)"
                :key="reader.id"
                :user="reader"
                tip
                link
                size="24"
                shrink
              />
            </div>
            <span
              v-if="readers.length > 5"
              class="text-xs text-base-content/40"
            >
              等 {{ readers.length }} 人
            </span>
          </div>
        </div>

        <div class="modal-action flex items-center justify-end gap-3 pt-2">
          <button class="btn btn-ghost text-sm font-normal" @click="closeModal">
            返回列表
          </button>
          <button
            class="btn btn-primary px-6 shadow-sm shadow-primary/30"
            @click="startPlay"
          >
            开始阅读体验
          </button>
        </div>
      </div>
    </div>

    <!-- 故事详情弹窗 -->
    <div
      v-if="showDetailModal"
      class="modal modal-open backdrop-blur-sm bg-neutral/40"
    >
      <div
        class="modal-box max-w-md border border-base-300/80 rounded-2xl p-6 bg-base-100 font-sans"
      >
        <h3 class="font-serif font-bold text-xl mb-3">{{ story?.title }}</h3>
        <p class="text-xs text-base-content/60 mb-4">作者：{{ authorName }}</p>
        <div
          class="text-sm text-base-content/80 leading-relaxed font-serif max-h-60 overflow-y-auto bg-base-200/40 p-4 rounded-xl mb-6"
        >
          <div v-html="story?.description || '暂无故事简介'"></div>
        </div>
        <div class="modal-action">
          <button class="btn btn-sm btn-ghost" @click="showDetailModal = false">
            关闭
          </button>
        </div>
      </div>
    </div>

    <!-- 重新开始确认弹窗 -->
    <div
      v-if="showRestartConfirm"
      class="modal modal-open backdrop-blur-sm bg-neutral/40"
    >
      <div
        class="modal-box max-w-sm border border-base-300/80 rounded-2xl p-6 bg-base-100 font-sans"
      >
        <h4 class="font-bold text-lg mb-2">重新开始故事？</h4>
        <p class="text-sm text-base-content/70 mb-6">
          当前的故事进度将被重置并从头开始。
        </p>
        <div class="modal-action flex gap-2">
          <button
            class="btn btn-sm btn-ghost"
            @click="showRestartConfirm = false"
          >
            取消
          </button>
          <button class="btn btn-sm btn-error" @click="confirmRestart">
            确认重置
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- 变量值查看弹窗 -->
  <div v-if="showValueModal" class="modal modal-open backdrop-blur-sm bg-neutral/40">
    <div
      class="modal-box max-w-xl overflow-hidden rounded-2xl border border-base-300/70 bg-base-100 p-0 font-sans"
      @click.stop
    >
      <header class="flex items-center gap-2 border-b border-base-300/50 px-4 py-3">
        <span
          class="flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
        >
          <Icon icon="mdi:code-json" class="size-3.5" />
        </span>
        <h3 class="truncate font-mono text-sm text-base-content/80">
          {{ selectedKey }}
        </h3>
        <span class="badge badge-xs badge-soft shrink-0 font-mono">
          {{ selectedValueLabel }}
        </span>
        <div class="ml-auto flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            class="btn btn-ghost btn-xs btn-square"
            title="复制 JSON"
            @click="copySelectedValue"
          >
            <Icon
              :icon="copiedValue ? 'mdi:check' : 'mdi:content-copy'"
              class="size-3.5"
              :class="copiedValue ? 'text-success' : ''"
            />
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-xs btn-square"
            title="关闭"
            @click="closeValueModal"
          >
            <Icon icon="mdi:close" class="size-4" />
          </button>
        </div>
      </header>

      <div class="max-h-[60vh] overflow-auto bg-base-200/30 p-3">
        <JsonView :data="selectedValue" :default-open-depth="2" />
      </div>

      <footer class="flex justify-end border-t border-base-300/50 px-4 py-2.5">
        <button class="btn btn-sm btn-ghost" @click="closeValueModal">关闭</button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getStory } from "@/api/stories";
import {
  createPlay,
  getPlay,
  updatePlay,
  getReleaseStory,
  resetPlay,
  getReaders,
  type IEndingUnlock,
  type IUpdatePlayResponse,
} from "@/api/play";
import { useAppStore } from "@/stores/modules/app";
import { User } from "@/api/auth";
import { Message } from "@/components/msg";
import { useAuthStore } from "@/stores/modules/auth";
import VariableInspector from "@/components/debug/VariableInspector.vue";
import JsonView from "@/components/debug/JsonView.vue";
import Icon from "@/components/Icon/src/Icon.vue";
import CommentSection from "@/components/comment/CommentSection.vue";
import {
  getSelectionOffsets,
  renderCommentMarks,
  clearCommentMarks,
} from "@/lib/commentSelection";
import {
  getComments,
  createComment,
  deleteComment,
  matchVariableSnapshot,
  type CommentItem,
} from "@/api/comments";

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const authStore = useAuthStore();
const userInfo = computed(() => authStore.getUser);
const storyId = ref<string>(route.params.storyId.toString() || "");

const story = ref<any>(null);
const play = ref<any>(null);
const currentHtml = ref("");
const variables = ref<Record<string, any>>({});
const showModal = ref<boolean | null>(null);
const showDetailModal = ref(false);
const showRestartConfirm = ref(false);
const showEndUnlockFx = ref(false);
const unlockedEnding = ref<IEndingUnlock | null>(null);
const isEnding = ref(false);
const sceneRenderKey = ref(0);
const undoing = ref(false);

// 故事更新检测与关闭状态（按更新时间戳记录，关闭后直到下次更新才再次提醒）
const dismissedUpdateVersion = ref<number>(0);

const storyUpdatedTime = computed(() => {
  if (!story.value) return 0;
  return (
    Number(
      route.name === "test"
        ? story.value.updatedAt || story.value.approvedAt
        : story.value.approvedAt || story.value.updatedAt,
    ) || 0
  );
});

const isStoryUpdated = computed(() => {
  if (!play.value?.id || !story.value) return false;

  const playCreatedAt = Number(play.value.createdAt || 0);
  const storyUpdatedAt = storyUpdatedTime.value;

  if (!playCreatedAt || !storyUpdatedAt) return false;

  return storyUpdatedAt > playCreatedAt;
});

const showUpdateAlert = computed(() => {
  if (!isStoryUpdated.value || showModal.value) return false;
  return dismissedUpdateVersion.value < storyUpdatedTime.value;
});

function initDismissedUpdate() {
  const sid = storyId.value;
  if (!sid) return;
  try {
    const saved = localStorage.getItem(`dismissed_story_update_${sid}`);
    if (saved) {
      dismissedUpdateVersion.value = Number(saved) || 0;
    }
  } catch {
    // 忽略 localStorage 异常
  }
}

function dismissUpdateAlert() {
  const sid = storyId.value;
  const currentStoryTime = storyUpdatedTime.value;
  dismissedUpdateVersion.value = currentStoryTime;
  if (sid && currentStoryTime) {
    try {
      localStorage.setItem(
        `dismissed_story_update_${sid}`,
        String(currentStoryTime),
      );
    } catch {
      // 忽略 localStorage 异常
    }
  }
}

const commentSectionRef = ref<any>(null);

// 划线操作与选区
const floatingBtnVisible = ref(false);
const floatingBtnPos = ref({ top: 0, left: 0 });
const currentSelection = ref<{
  text: string;
  start: number;
  end: number;
} | null>(null);

// 划线发布弹窗
const showInlineModal = ref(false);
const inlineCommentContent = ref("");
const inlineIsSpoiler = ref(false);
const inlineIsAuthorOnly = ref(false);
const inlineSubmitting = ref(false);

// 点击高亮引文查看评论弹窗
const showQuoteCommentsModal = ref(false);
const activeQuoteComments = ref<CommentItem[]>([]);
const activeQuoteText = ref("");
const revealedQuoteSpoilers = ref<Set<string>>(new Set());

// 划线评论回复状态
const activeQuoteReply = ref<{
  rootId: string;
  targetComment: CommentItem;
} | null>(null);
const quoteReplyContent = ref("");
const quoteReplyIsSpoiler = ref(false);
const quoteReplyIsAuthorOnly = ref(false);
const quoteReplySubmitting = ref(false);

const activeQuoteTotalCount = computed(() => {
  return activeQuoteComments.value.reduce((sum, c) => {
    const repCount = Array.isArray(c.replies)
      ? c.replies.length
      : (c.replyCount || 0);
    return sum + 1 + repCount;
  }, 0);
});

// 场景名称
const currentPassageName = computed(() => {
  return (
    play.value?.currentPassage ||
    play.value?.passage ||
    story.value?.startPassage ||
    "Start"
  );
});

// 当前场景匹配的划词评论
const sceneMatchingComments = ref<CommentItem[]>([]);

// Inspector state (测试模式)
const inspectorDrawerOpen = ref(false);
const selectedKey = ref<string | null>(null);
const selectedValue = ref<any>(null);
const showValueModal = ref(false);
const copiedValue = ref(false);

const selectedValueLabel = computed(() => {
  const v = selectedValue.value;
  if (Array.isArray(v)) return `array · ${v.length}`;
  if (v !== null && typeof v === "object") {
    return `object · ${Object.keys(v).length}`;
  }
  return typeof v;
});

function openValueModal(payload: { key: string; value: any }) {
  selectedKey.value = payload.key;
  selectedValue.value = payload.value;
  showValueModal.value = true;
}

function closeValueModal() {
  showValueModal.value = false;
  selectedKey.value = null;
  selectedValue.value = null;
}

async function copySelectedValue() {
  try {
    await navigator.clipboard.writeText(
      JSON.stringify(selectedValue.value, null, 2),
    );
    copiedValue.value = true;
    window.setTimeout(() => (copiedValue.value = false), 1200);
  } catch {
    /* 忽略剪贴板不可用的情况 */
  }
}

const authorName = computed(
  () =>
    story.value?.author?.nickname || story.value?.author?.username || "佚名",
);
const canUndo = computed(
  () =>
    Array.isArray(play.value?.history) &&
    (play.value?.history?.length || 0) > 1,
);

watch(
  () => story.value?.title,
  (newTitle) => {
    if (newTitle) {
      appStore.setCustomHeaderTitle(newTitle);
    }
  },
);

onUnmounted(() => {
  appStore.setCustomHeaderTitle(null);
  window.removeEventListener("mouseup", handleMouseUp);
  window.removeEventListener("touchend", handleMouseUp);
  document.removeEventListener("selectionchange", handleSelectionChange);
});

function dismissEndingUnlock() {
  showEndUnlockFx.value = false;
}

function triggerEndingUnlock(end: IEndingUnlock | null | undefined) {
  if (!end) return;
  const name = (end.name || "").trim() || "未命名结局";
  const description = (end.description || "").trim() || "你抵达了故事的一个结局。";
  unlockedEnding.value = { name, description };
  showEndUnlockFx.value = true;
  Message.success(`解锁结局：${name}`, 2800);
}

async function loadStory() {
  const res = await (route.name == "play" ? getReleaseStory : getStory)(
    storyId.value,
  );
  story.value = res as any;
  storyId.value = story.value?.sourceStoryId || story.value?.id;
  if (story.value?.title) {
    appStore.setCustomHeaderTitle(story.value.title);
    document.title = story.value.title + " | 织言 - Tellory";
  }
}

const readers = ref<User[]>([]);
async function loadReaders() {
  try {
    const res = await getReaders(storyId.value);
    readers.value = res;
  } catch (err) {
    console.error("[PlayView] loadReaders failed", err);
  }
}

async function loadExistingPlay() {
  try {
    const p = await getPlay(storyId.value);
    play.value = p;
    currentHtml.value = p.html || "";
    isEnding.value = !!p?.isEnding;
    variables.value = p.variables || {};
    return true;
  } catch (err) {
    console.warn("[PlayView] loadExistingPlay failed", err);
    return false;
  }
}

async function startPlay() {
  try {
    const res = await createPlay(storyId.value, {
      currentPassage: story.value?.startPassage,
    });
    play.value = res as any;
    currentHtml.value = res.html || "";
    isEnding.value = false;
    variables.value = (res as any).variables || {};
    showModal.value = false;
    dismissUpdateAlert();
    nextTick(() => {
      refreshSceneCommentsAndMarks();
    });
  } catch (err) {
    console.error("startPlay error", err);
  }
}

async function confirmRestart() {
  showRestartConfirm.value = false;
  const res = await resetPlay(storyId.value);
  play.value = res as any;
  currentHtml.value = res.html || "";
  isEnding.value = false;
  variables.value = (res as any).variables || {};
  dismissUpdateAlert();
  Message.success("已重新开始故事");
  nextTick(() => {
    refreshSceneCommentsAndMarks();
  });
}

async function undo() {
  if (!canUndo.value || undoing.value) return;
  undoing.value = true;
  try {
    const res = (await updatePlay(storyId.value, {
      back: true,
    })) as IUpdatePlayResponse;
    play.value = res as any;
    variables.value = res.variables || {};
    if (res.html) {
      applySceneHtml(res.html, true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    isEnding.value = !!res.isEnding;
    showEndUnlockFx.value = false;
    unlockedEnding.value = null;
  } catch (err) {
    Message.error("撤销失败，请稍后再试");
    console.error("[PlayView] undo failed", err);
  } finally {
    undoing.value = false;
  }
}

function applySceneHtml(nextHtml: string, withPageTurn: boolean) {
  currentHtml.value = nextHtml;
  if (withPageTurn) {
    sceneRenderKey.value += 1;
  }
  nextTick(() => {
    refreshSceneCommentsAndMarks();
    commentSectionRef.value?.loadComments(true);
  });
}

function onSceneAfterEnter() {
  refreshSceneCommentsAndMarks();
  if (route.query.commentId) {
    setTimeout(() => {
      locateComment(route.query.commentId as string);
    }, 150);
  }
}

function closeModal() {
  showModal.value = false;
  router.push("/stories");
}

const contentRef = ref<HTMLElement>();
onMounted(async () => {
  window.addEventListener("mouseup", handleMouseUp);
  window.addEventListener("touchend", handleMouseUp);
  document.addEventListener("selectionchange", handleSelectionChange);

  await loadStory();
  initDismissedUpdate();
  await loadReaders();
  const started = await loadExistingPlay();
  if (started) {
    showModal.value = false;
  } else if (route.query.commentId) {
    await startPlay();
  } else {
    showModal.value = true;
  }
  await nextTick();
  await refreshSceneCommentsAndMarks();

  if (route.query.commentId) {
    setTimeout(() => {
      locateComment(route.query.commentId as string);
    }, 250);
  }
});

// 选区检测与悬浮按钮定位
function checkSelection() {
  if (showInlineModal.value || showQuoteCommentsModal.value) {
    floatingBtnVisible.value = false;
    return;
  }

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    floatingBtnVisible.value = false;
    return;
  }

  const range = selection.getRangeAt(0);
  const text = selection.toString().trim();
  if (!text || text.length < 1) {
    floatingBtnVisible.value = false;
    return;
  }

  if (
    !contentRef.value ||
    !contentRef.value.contains(range.commonAncestorContainer)
  ) {
    floatingBtnVisible.value = false;
    return;
  }

  const commonAncestor = range.commonAncestorContainer;
  const element =
    commonAncestor.nodeType === Node.ELEMENT_NODE
      ? (commonAncestor as Element)
      : commonAncestor.parentElement;
  if (element && element.closest(".tellory-mark-badge")) {
    floatingBtnVisible.value = false;
    return;
  }

  const rect = range.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    floatingBtnVisible.value = false;
    return;
  }

  const { start, end } = getSelectionOffsets(contentRef.value, range);
  currentSelection.value = {
    text,
    start,
    end,
  };

  floatingBtnPos.value = {
    top: Math.max(12, rect.top - 8),
    left: Math.max(
      60,
      Math.min(window.innerWidth - 60, rect.left + rect.width / 2),
    ),
  };
  floatingBtnVisible.value = true;
}

let selectionTimeout: any = null;
function handleSelectionChange() {
  if (selectionTimeout) clearTimeout(selectionTimeout);
  selectionTimeout = setTimeout(() => {
    checkSelection();
  }, 100);
}

function handleMouseUp() {
  setTimeout(() => {
    checkSelection();
  }, 20);
}

function openSelectionCommentModal() {
  if (!currentSelection.value) return;
  floatingBtnVisible.value = false;
  inlineCommentContent.value = "";
  inlineIsSpoiler.value = false;
  inlineIsAuthorOnly.value = false;
  showInlineModal.value = true;
  // 清除浏览器选区，避免后续 selectionchange / mouseup 循环触发
  window.getSelection()?.removeAllRanges();
}

function closeSelectionCommentModal() {
  showInlineModal.value = false;
  inlineCommentContent.value = "";
  inlineIsSpoiler.value = false;
  inlineIsAuthorOnly.value = false;
}

async function submitSelectionComment() {
  if (
    !inlineCommentContent.value.trim() ||
    !storyId.value ||
    !currentSelection.value
  )
    return;
  inlineSubmitting.value = true;
  try {
    const payload = {
      storyId: storyId.value,
      content: inlineCommentContent.value.trim(),
      isSpoiler: inlineIsSpoiler.value,
      isAuthorOnly: inlineIsAuthorOnly.value,
      position: {
        sceneName: currentPassageName.value,
        start: currentSelection.value.start,
        end: currentSelection.value.end,
        selectedText: currentSelection.value.text,
      },
    };
    await createComment(payload);
    Message.success("划线评论发表成功");
    closeSelectionCommentModal();
    floatingBtnVisible.value = false;
    await refreshSceneCommentsAndMarks();
  } catch (err: any) {
    Message.error(err?.message || "发表划线评论失败");
  } finally {
    inlineSubmitting.value = false;
  }
}

async function refreshSceneCommentsAndMarks() {
  if (!storyId.value) return;
  await nextTick();
  if (!contentRef.value) return;

  try {
    const scene = currentPassageName.value;
    const currentVars = variables.value;
    const res = await getComments({
      storyId: storyId.value,
      sceneName: scene,
      hasPosition: true,
      variables: currentVars,
      tree: true,
      limit: 100,
    });
    const list = res.data || [];
    const matching = list.filter((c) =>
      matchVariableSnapshot(c.position?.variableSnapshot, currentVars),
    );
    sceneMatchingComments.value = matching;

    const currentEl = contentRef.value;
    if (currentEl) {
      renderCommentMarks(currentEl, matching, (group, markEl) => {
        activeQuoteComments.value = group;
        activeQuoteText.value =
          group[0]?.position?.selectedText ||
          markEl.getAttribute("data-quote") ||
          "";
        revealedQuoteSpoilers.value = new Set();
        cancelQuoteReply();
        showQuoteCommentsModal.value = true;
      });
    }
  } catch (err) {
    console.warn("[PlayView] refreshSceneCommentsAndMarks failed", err);
  }
}

function scrollToCommentSection() {
  showQuoteCommentsModal.value = false;
  const el =
    commentSectionRef.value?.$el || document.querySelector(".comment-section");
  if (el) {
    el.scrollIntoView({ behavior: "smooth" });
  }
}

function openInlineFromQuote() {
  showQuoteCommentsModal.value = false;
  currentSelection.value = {
    text: activeQuoteText.value,
    start: 0,
    end: activeQuoteText.value.length,
  };
  openSelectionCommentModal();
}

function startQuoteReply(root: CommentItem, target: CommentItem) {
  if (!authStore.isAuthenticated) {
    Message.warning("请先登录后再进行回复");
    return;
  }
  activeQuoteReply.value = { rootId: root.id, targetComment: target };
  quoteReplyContent.value = "";
  quoteReplyIsSpoiler.value = false;
  quoteReplyIsAuthorOnly.value = Boolean(
    root.isAuthorOnly || target.isAuthorOnly,
  );
}

function cancelQuoteReply() {
  activeQuoteReply.value = null;
  quoteReplyContent.value = "";
  quoteReplyIsSpoiler.value = false;
  quoteReplyIsAuthorOnly.value = false;
}

async function submitQuoteReply() {
  if (!activeQuoteReply.value || !storyId.value) return;
  const text = quoteReplyContent.value.trim();
  if (!text) {
    Message.warning("回复内容不能为空");
    return;
  }

  quoteReplySubmitting.value = true;
  try {
    await createComment({
      storyId: storyId.value,
      content: text,
      parentId: activeQuoteReply.value.rootId,
      replyToId: activeQuoteReply.value.targetComment.id,
      replyToUserId: activeQuoteReply.value.targetComment.userId,
      isSpoiler: quoteReplyIsSpoiler.value,
      isAuthorOnly: quoteReplyIsAuthorOnly.value,
    });
    Message.success("回复发送成功");
    cancelQuoteReply();
    await refreshSceneCommentsAndMarks();
    const targetQuote = activeQuoteText.value;
    if (targetQuote) {
      const matchingGroup = sceneMatchingComments.value.filter(
        (c) => c.position?.selectedText?.trim() === targetQuote.trim(),
      );
      activeQuoteComments.value = matchingGroup;
    }
  } catch (err: any) {
    Message.error(err?.message || "回复发送失败");
  } finally {
    quoteReplySubmitting.value = false;
  }
}

function canDeleteQuoteComment(c: CommentItem): boolean {
  if (c.isDeleted) return false;
  const curUser = userInfo.value;
  return c.userId === curUser?.id || Boolean(curUser?.isAdmin);
}

async function deleteQuoteComment(c: CommentItem) {
  if (!confirm("确定要删除这条评论吗？")) return;
  try {
    await deleteComment(c.id);
    Message.success("评论已删除");
    await refreshSceneCommentsAndMarks();
    const targetQuote = activeQuoteText.value;
    if (targetQuote) {
      const matchingGroup = sceneMatchingComments.value.filter(
        (item) => item.position?.selectedText?.trim() === targetQuote.trim(),
      );
      activeQuoteComments.value = matchingGroup;
      if (matchingGroup.length === 0) {
        showQuoteCommentsModal.value = false;
      }
    }
  } catch (err: any) {
    Message.error(err?.message || "删除评论失败");
  }
}

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

watch(
  () => variables.value,
  () => {
    refreshSceneCommentsAndMarks();
  },
  { deep: true },
);

watch(
  () => currentPassageName.value,
  () => {
    nextTick(() => {
      refreshSceneCommentsAndMarks();
    });
  },
);

watch(contentRef, (el) => {
  if (el) {
    nextTick(() => {
      refreshSceneCommentsAndMarks();
    });
  }
});

function triggerFlashAnimation(el: HTMLElement, className: string) {
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  setTimeout(() => {
    el.classList.remove(className);
  }, 4000);
}

async function locateComment(commentId: string) {
  if (!commentId) return;
  await nextTick();

  // 若当前场景的评论尚未加载完成，先执行刷新
  if (sceneMatchingComments.value.length === 0) {
    await refreshSceneCommentsAndMarks();
    await nextTick();
  }

  // 1. 检查是否匹配当前场景中的划词评论或回复
  const matchingGroup = sceneMatchingComments.value.filter(
    (c) => c.id === commentId || c.replies?.some((r) => r.id === commentId),
  );

  if (matchingGroup.length > 0) {
    const isReply = matchingGroup.some((c) =>
      c.replies?.some((r) => r.id === commentId),
    );

    // 查找文本中标记的对应 mark 元素
    const markEl = contentRef.value?.querySelector(
      `mark[data-comment-ids*="${commentId}"]`,
    ) as HTMLElement | null;

    if (!isReply) {
      // 划词根评论：在划词处滚动并闪烁
      if (markEl) {
        markEl.scrollIntoView({ behavior: "smooth", block: "center" });
        triggerFlashAnimation(markEl, "tellory-mark-flash");
      }
      return;
    } else {
      // 回复的划词评论：打开划词评论弹框并滚动到对应的回复
      activeQuoteComments.value = matchingGroup;
      activeQuoteText.value =
        matchingGroup[0]?.position?.selectedText ||
        markEl?.getAttribute("data-quote") ||
        "";
      // 自动展开此回复以及根评论的剧透遮盖
      revealedQuoteSpoilers.value.add(commentId);
      matchingGroup.forEach((c) => revealedQuoteSpoilers.value.add(c.id));
      cancelQuoteReply();
      showQuoteCommentsModal.value = true;

      await nextTick();
      setTimeout(() => {
        const replyEl = document.getElementById(`quote-comment-${commentId}`);
        if (replyEl) {
          replyEl.scrollIntoView({ behavior: "smooth", block: "center" });
          triggerFlashAnimation(replyEl, "comment-reply-flash");
        }
      }, 150);
      return;
    }
  }

  // 2. 如果当前场景没有该划词评论，提示场景差异（如果是跨场景的划词评论）
  const targetScene = route.query.scene as string | undefined;
  if (targetScene && targetScene !== currentPassageName.value) {
    Message.info(
      `该评论位于场景「${targetScene}」，当前阅读场景为「${currentPassageName.value}」`,
      3500,
    );
  }

  // 3. 定位到下方常规故事评论区
  commentSectionRef.value?.scrollToComment(commentId);
}

watch(
  () => route.query.commentId,
  (newCommentId) => {
    if (newCommentId) {
      locateComment(newCommentId as string);
    }
  },
);

async function onContentClick(e: MouseEvent) {
  const targetEl = (e.target as HTMLElement)?.closest(
    "[data-story-target], [data-story-action], [data-story-display]",
  ) as HTMLElement | null;
  if (!targetEl || !Object.keys(targetEl.dataset).length) return;
  const target = targetEl.dataset.storyTarget || undefined;
  const action = targetEl.dataset.storyAction || undefined;
  const display = targetEl.dataset.storyDisplay || undefined;
  if (!target && !action && !display) return;

  try {
    if (!play.value?.id) {
      await startPlay();
    }

    const res = (await updatePlay(storyId.value, {
      target,
      action,
      display,
    })) as IUpdatePlayResponse;
    play.value = res as any;
    variables.value = res.variables || {};
    if (res.html) {
      applySceneHtml(res.html, !res.end);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (res.end) {
      triggerEndingUnlock(res.end);
      isEnding.value = true;
    } else {
      isEnding.value = !!res.isEnding;
    }
  } catch (err) {
    console.error("[PlayView] interaction update failed", err);
  }
}

const isTest = computed(
  () =>
    route.name == "test" &&
    (userInfo.value?.isAdmin || story.value?.authorId == userInfo.value?.id),
);
</script>

<style scoped>
/* 典雅交互式小说排版与交互按键样式 */
:deep(.story-content) {
  line-height: 1.95;
  letter-spacing: 0.015em;
}

:deep(.story-content p) {
  margin-bottom: 1.5em;
  text-align: justify;
}

:deep(.story-link),
:deep(button[data-story-target]),
:deep(button[data-story-action]) {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin: 2px;
  padding: 2px 4px;
  font-family:
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Roboto,
    sans-serif;
  font-size: 0.925rem;
  font-weight: 500;
  line-height: 1.4;
  color: var(--color-primary, oklch(0.48 0.24 270));
  background: color-mix(in oklch, currentColor 8%, transparent);
  border: 1px solid color-mix(in oklch, currentColor 20%, transparent);
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03);
}

:deep(.story-link:hover),
:deep(button[data-story-target]:hover),
:deep(button[data-story-action]:hover) {
  background: color-mix(in oklch, currentColor 16%, transparent);
  border-color: color-mix(in oklch, currentColor 45%, transparent);
  transform: translateY(-1px);
  box-shadow: 0 4px 10px -2px color-mix(in oklch, currentColor 20%, transparent);
}

:deep(.story-link:active),
:deep(button[data-story-target]:active),
:deep(button[data-story-action]:active) {
  transform: translateY(0);
}

.page-turn-stage {
  perspective: 1500px;
  transform-style: preserve-3d;
}

.page-turn-enter-active,
.page-turn-leave-active {
  backface-visibility: hidden;
  transform-origin: left center;
  will-change: transform, opacity, filter;
}

.page-turn-leave-active {
  animation: novel-page-leave 320ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.page-turn-enter-active {
  animation: novel-page-enter 420ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
}

@keyframes novel-page-leave {
  0% {
    opacity: 1;
    transform: rotate3d(-1, 1, 0, 0deg) translateX(0);
    filter: brightness(1);
  }
  100% {
    opacity: 0;
    transform: rotate3d(-1, 1, 0, -30deg) translateX(-20%) translateY(-10%);
    filter: brightness(0.8);
  }
}

@keyframes novel-page-enter {
  0% {
    opacity: 0;
    transform: rotate3d(-1, 1, 0, 30deg) translateX(20%) translateY(10%);
    filter: brightness(1.1);
  }
  100% {
    opacity: 1;
    transform: rotate3d(-1, 1, 0, 0deg) translateX(0);
    filter: brightness(1);
  }
}

.ending-unlock-layer-enter-active,
.ending-unlock-layer-leave-active {
  transition: opacity 0.25s ease;
}

.ending-unlock-layer-enter-from,
.ending-unlock-layer-leave-to {
  opacity: 0;
}

.ending-overlay {
  background:
    radial-gradient(circle at 50% 38%, color-mix(in oklch, var(--color-warning) 18%, transparent) 0%, transparent 52%),
    radial-gradient(circle at center, color-mix(in oklch, black 35%, transparent) 0%, color-mix(in oklch, black 62%, transparent) 72%);
  backdrop-filter: blur(2px);
  animation: ending-overlay-breathe 4.2s ease-in-out infinite;
}

.ending-card {
  background:
    linear-gradient(
      165deg,
      color-mix(in oklch, var(--color-base-100) 92%, #f4ead1) 0%,
      color-mix(in oklch, var(--color-base-100) 88%, #efe0bf) 100%
    );
  box-shadow:
    0 22px 50px -18px color-mix(in oklch, black 46%, transparent),
    inset 0 0 0 1px color-mix(in oklch, #6a4a2f 18%, transparent);
  animation: ending-card-reveal 420ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.novel-seal {
  display: inline-flex;
  align-items: center;
  border: 1px solid color-mix(in oklch, #6d4f31 35%, transparent);
  border-radius: 999px;
  padding: 0.2rem 0.8rem;
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  color: color-mix(in oklch, #5c3f27 88%, var(--color-base-content));
}

.ending-divider {
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    color-mix(in oklch, #5e3e21 40%, transparent) 20%,
    color-mix(in oklch, #5e3e21 52%, transparent) 50%,
    color-mix(in oklch, #5e3e21 40%, transparent) 80%,
    transparent 100%
  );
}

.ending-burst {
  position: absolute;
  width: min(72vmin, 430px);
  aspect-ratio: 1;
}

.ending-spark {
  --spark-index: 1;
  position: absolute;
  left: calc(50% - 1px);
  top: 50%;
  width: 2px;
  height: 44%;
  border-radius: 999px;
  transform-origin: 50% 100%;
  transform: rotate(calc(var(--spark-index) * 30deg)) translateY(-100%);
  background: linear-gradient(
    to top,
    transparent 0%,
    color-mix(in oklch, var(--color-warning) 80%, white) 36%,
    transparent 100%
  );
  opacity: 0;
  animation: ending-spark-burst 1.5s ease-out;
}

.ending-spark:nth-child(odd) {
  animation-delay: 0.06s;
}

@keyframes ending-overlay-breathe {
  0% {
    opacity: 0.82;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.82;
  }
}

@keyframes ending-card-reveal {
  0% {
    opacity: 0;
    transform: translateY(16px) scale(0.92);
    filter: blur(8px);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}

@keyframes ending-spark-burst {
  0% {
    opacity: 0;
    transform: rotate(calc(var(--spark-index) * 30deg)) translateY(-46%) scaleY(0.4);
  }
  20% {
    opacity: 0.9;
  }
  70% {
    opacity: 0.45;
  }
  100% {
    opacity: 0;
    transform: rotate(calc(var(--spark-index) * 30deg)) translateY(-108%) scaleY(1.05);
  }
}

/* Inspector styles */
.inspector-pre {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", "Segoe UI Mono", monospace;
  font-size: 12px;
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 220ms ease;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(12px);
  opacity: 0;
}

/* 划词评论高亮样式：常态下仅显示数字小气泡，鼠标悬停展示虚线下划线 */
:deep(.tellory-comment-mark) {
  background-color: transparent;
  text-decoration: none;
  border-radius: 2px;
  cursor: pointer;
  transition: background-color 0.15s ease;
  color: inherit;
}

:deep(.tellory-comment-mark:hover) {
  text-decoration: underline dashed var(--color-primary, #646cff);
  text-underline-offset: 3px;
  text-decoration-thickness: 1.5px;
  background-color: color-mix(in oklch, var(--color-primary, #646cff) 8%, transparent);
}

:deep(.tellory-mark-badge) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: 0.35em;
  margin-left: 3px;
  min-width: 15px;
  height: 15px;
  padding: 0 3.5px;
  font-size: 9.5px;
  line-height: 1;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-weight: 600;
  border-radius: 9999px;
  background-color: var(--color-primary, #646cff);
  color: var(--color-primary-content, #ffffff);
  pointer-events: none;
  user-select: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
  transition: transform 0.15s ease, filter 0.15s ease;
  text-decoration: none !important;
  border-bottom: none !important;
}

:deep(.tellory-comment-mark:hover .tellory-mark-badge) {
  transform: scale(1.08);
  filter: brightness(1.08);
}

/* 划词评论定位时的闪烁高亮动画 */
:deep(.tellory-comment-mark.tellory-mark-flash) {
  animation: tellory-quote-flash 1.2s ease-in-out 3;
  text-decoration: underline dashed var(--color-primary, #646cff) !important;
  text-underline-offset: 4px;
  text-decoration-thickness: 2px;
}

:deep(.tellory-comment-mark.tellory-mark-flash .tellory-mark-badge) {
  animation: tellory-badge-pulse 1.2s ease-in-out 3;
}

@keyframes tellory-quote-flash {
  0%, 100% {
    background-color: transparent;
  }
  50% {
    background-color: color-mix(in oklch, var(--color-primary, #646cff) 35%, transparent);
    box-shadow: 0 0 0 4px color-mix(in oklch, var(--color-primary, #646cff) 30%, transparent);
    border-radius: 4px;
  }
}

@keyframes tellory-badge-pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.4);
    box-shadow: 0 0 8px var(--color-primary, #646cff);
  }
}

/* 划词评论弹窗内被定位回复的高亮闪烁动画 */
:deep(.comment-reply-flash) {
  animation: reply-card-flash 1.2s ease-in-out 3;
}

@keyframes reply-card-flash {
  0%, 100% {
    background-color: transparent;
  }
  50% {
    background-color: color-mix(in oklch, var(--color-primary, #646cff) 25%, transparent);
    box-shadow: 0 0 0 3px var(--color-primary, #646cff);
    border-radius: 8px;
  }
}
</style>
