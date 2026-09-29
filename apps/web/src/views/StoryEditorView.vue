<template>
  <div class="h-full md:p-4 w-full">
    <div class="flex h-full md:gap-4">
      <aside
        v-if="!isMobile"
        data-tour="passage-list"
        class="hidden lg:flex flex-col rounded-2xl border border-base-300 bg-base-100 p-3 shadow-sm min-w-70 w-72 shrink-0 self-start sticky top-4 max-h-[calc(100vh-2rem)]"
      >
        <PassageList
          v-model:passages="story.passages"
          v-model:selectedPassage="selectedPassage"
          :start-passage="story.startPassage"
          :read-only="props.readOnly"
          @add="addPassage"
        />
      </aside>

      <!-- 移动端段落抽屉 -->
      <div class="lg:hidden">
        <dialog
          ref="passageRef"
          class="modal modal-bottom sm:modal-middle w-screen"
        >
          <div class="modal-box h-[80vh] flex flex-col relative p-4">
            <PassageList
              v-model:passages="story.passages"
              v-model:selectedPassage="selectedPassage"
              :start-passage="story.startPassage"
              :read-only="props.readOnly"
              @add="addPassage"
              @select="passageRef?.close()"
            />
            <div class="modal-action bottom-4 right-4 absolute">
              <form method="dialog">
                <button class="btn btn-circle btn-error btn-soft btn-sm" title="关闭">
                  <Icon icon="mdi:close" class="text-base" />
                </button>
              </form>
            </div>
          </div>
        </dialog>
      </div>

      <!-- 内测用户管理弹窗 -->
      <Teleport to="body">
        <dialog ref="betaDialogRef" class="modal" @close="resetBetaDialog">
          <div class="modal-box max-w-xl">
            <h3 class="flex items-center gap-2 text-lg font-bold">
              <Icon
                icon="mdi:account-group-outline"
                class="text-xl text-primary"
              />
              内测用户管理
            </h3>
            <p class="pt-1 text-sm text-base-content/60">
              内测用户可通过试玩链接查看本故事尚未发布的内容。
            </p>

            <!-- 搜索添加（autocomplete） -->
            <label
              class="input input-bordered mt-4 flex w-full items-center gap-2"
            >
              <Icon icon="mdi:magnify" class="text-base opacity-50" />
              <input
                v-model="betaQuery"
                type="text"
                class="grow"
                placeholder="输入昵称 / 用户名搜索用户…"
                @input="onBetaQueryInput"
                @keydown.enter.prevent="addFirstBetaResult"
              />
              <span
                v-if="betaSearching"
                class="loading loading-spinner loading-xs"
              ></span>
            </label>
            <ul
              v-if="betaQuery.trim()"
              class="mt-1 max-h-56 overflow-y-auto rounded-box border border-base-300 bg-base-100 shadow-sm"
            >
              <li v-for="user in betaResults" :key="user.id">
                <button
                  type="button"
                  class="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-base-200 disabled:opacity-60"
                  :disabled="betaAdding !== null"
                  @click="confirmAddBetaTester(user)"
                >
                  <Avatar :user="user" size="28" shrink />
                  <span class="min-w-0 flex-1 truncate text-sm">
                    <span class="font-medium">{{ user.nickname }}</span>
                    <span class="ml-1 text-xs text-base-content/50"
                      >@{{ user.username }}</span
                    >
                  </span>
                  <span
                    v-if="betaAdding === user.id"
                    class="loading loading-spinner loading-xs"
                  ></span>
                  <Icon
                    v-else
                    icon="mdi:account-plus-outline"
                    class="text-lg text-primary"
                  />
                </button>
              </li>
              <li
                v-if="!betaSearching && betaResults.length === 0"
                class="px-3 py-4 text-center text-sm text-base-content/50"
              >
                没有找到匹配的用户
              </li>
            </ul>

            <!-- 已有内测用户 -->
            <div class="mt-5">
              <div class="mb-1 flex items-center gap-2">
                <span class="text-sm font-medium">已有内测用户</span>
                <span
                  v-if="betaTesters.length"
                  class="badge badge-ghost badge-sm"
                  >{{ betaTesters.length }}</span
                >
              </div>
              <div v-if="betaLoading" class="flex justify-center py-6">
                <span
                  class="loading loading-spinner loading-md text-primary"
                ></span>
              </div>
              <ul
                v-else-if="betaTesters.length"
                class="max-h-56 divide-y divide-base-200 overflow-y-auto rounded-box border border-base-300"
              >
                <li
                  v-for="tester in betaTesters"
                  :key="tester.id"
                  class="flex items-center gap-2 px-3 py-2"
                >
                  <Avatar :user="tester" size="28" shrink />
                  <span class="min-w-0 flex-1 truncate text-sm">
                    <span class="font-medium">{{ tester.nickname }}</span>
                    <span class="ml-1 text-xs text-base-content/50"
                      >@{{ tester.username }}</span
                    >
                  </span>
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    :disabled="betaRemoving !== null"
                    @click="confirmRemoveBetaTester(tester)"
                  >
                    <span
                      v-if="betaRemoving === tester.id"
                      class="loading loading-spinner loading-xs"
                    ></span>
                    <Icon v-else icon="mdi:close" class="text-sm" />
                    移除
                  </button>
                </li>
              </ul>
              <p
                v-else
                class="rounded-box border border-dashed border-base-300 px-3 py-6 text-center text-sm text-base-content/50"
              >
                还没有内测用户。搜索昵称或用户名，添加后对方即可通过试玩链接访问。
              </p>
            </div>

            <div class="modal-action">
              <form method="dialog">
                <button class="btn">关闭</button>
              </form>
            </div>
          </div>
          <form method="dialog" class="modal-backdrop">
            <button type="submit">close</button>
          </form>
        </dialog>
      </Teleport>

      <!-- 历史版本与比对弹窗 -->
      <Teleport to="body">
        <StoryHistoryModal
          ref="storyHistoryModalRef"
          :story-id="currentStoryId || ''"
          :story-title="story.title"
          :current-content="currentSerializedStory"
        />
      </Teleport>
      <main
        class="rounded-2xl border border-base-300 bg-base-100 md:p-4 shadow-sm w-full"
      >
        <div
          data-tour="story-info"
          class="mb-4 space-y-2.5 bg-base-200/40 p-3 rounded-xl border border-base-200"
        >
          <div
            v-if="props.readOnly && storyAny.status === 'rejected'"
            class="p-3 mb-2 rounded-lg bg-error/10 text-error text-sm border border-error/20"
          >
            <strong class="mr-2">已拒绝</strong>
            <span>{{ storyAny.reviewReason || "未填写拒绝理由" }}</span>
          </div>
          <div
            class="flex-wrap items-center justify-between gap-3"
            :class="{ flex: !isMobile }"
          >
            <div class="flex items-center gap-2 flex-1 min-w-60">
              <div class="lg:hidden" v-if="isMobile">
                <button
                  class="btn btn-sm btn-square btn-ghost"
                  data-tour="passage-list"
                  @click="passageRef?.showModal()"
                >
                  <Icon icon="mdi:menu" size="16px" />
                </button>
              </div>
              <input
                v-model="story.title"
                :readonly="props.readOnly"
                class="input input-bordered input-sm flex-1 font-bold text-base bg-base-100"
                placeholder="故事标题..."
              />
              <div v-if="isMobile">
                <button
                  data-tour="right-panel"
                  class="btn btn-sm btn-square btn-ghost"
                  @click="
                    activeRightTab = 'preview';
                    (previewRef as any)?.showModal();
                  "
                >
                  <Icon icon="at-icons:play" size="16px" />
                </button>
              </div>
            </div>
            <div
              class="flex items-center gap-1 md:shrink-0"
              :class="{ 'py-2 justify-around': isMobile }"
            >
              <div class="tooltip tooltip-bottom" data-tip="编辑器引导" data-tour="btn-tour">
                <button
                  class="btn btn-sm btn-ghost btn-square"
                  type="button"
                  @click="startEditorTour"
                >
                  <Icon icon="mdi:help-circle-outline" size="16px" />
                </button>
              </div>
              <div
                v-if="!props.readOnly"
                class="tooltip tooltip-bottom"
                data-tip="从剪贴板粘贴导入"
                data-tour="btn-paste"
              >
                <button
                  class="btn btn-sm btn-ghost btn-square"
                  type="button"
                  @click="pasteImport"
                >
                  <Icon icon="mdi:content-paste" size="16px" />
                </button>
              </div>
              <div
                class="tooltip tooltip-bottom"
                data-tip="复制文本源码"
                data-tour="btn-copy"
              >
                <button
                  class="btn btn-sm btn-ghost btn-square"
                  type="button"
                  @click="copyStory"
                >
                  <Icon icon="mdi:content-copy" size="16px" />
                </button>
              </div>
              <div
                class="tooltip tooltip-bottom"
                data-tip="编译导出 HTML 文件"
                data-tour="btn-build"
              >
                <button
                  class="btn btn-sm btn-ghost btn-square"
                  type="button"
                  @click="buildStory"
                >
                  <Icon icon="mdi:hammer" size="16px" />
                </button>
              </div>
              <div
                class="tooltip tooltip-bottom"
                data-tip="段落关系图"
                data-tour="btn-graph"
              >
                <button
                  class="btn btn-sm btn-ghost btn-square"
                  type="button"
                  @click="openGraph"
                >
                  <Icon icon="mdi:graph-outline" size="16px" />
                </button>
              </div>
              <div
                v-if="currentStoryId && !props.readOnly"
                class="tooltip tooltip-bottom"
                data-tip="内测用户管理"
                data-tour="btn-beta"
              >
                <button
                  class="btn btn-sm btn-ghost btn-square"
                  type="button"
                  @click="openBetaDialog"
                >
                  <Icon icon="mdi:account-group-outline" size="16px" />
                </button>
              </div>
              <div
                v-if="currentStoryId && !props.readOnly"
                class="tooltip tooltip-bottom"
                data-tip="历史发布版本与比对"
                data-tour="btn-history"
              >
                <button
                  class="btn btn-sm btn-ghost btn-square"
                  type="button"
                  @click="openStoryHistory"
                >
                  <Icon icon="mdi:history" size="16px" />
                </button>
              </div>
              <div
                v-if="currentStoryId"
                class="tooltip tooltip-bottom"
                data-tip="试玩故事"
                data-tour="btn-test"
              >
                <button
                  class="btn btn-sm btn-ghost btn-secondary btn-circle"
                  type="button"
                  @click="$router.push(`/test/${testRouteKey}`)"
                >
                  <Icon icon="mdi:play-circle-outline" size="16px" />
                </button>
              </div>
              <template v-if="!props.readOnly">
                <!-- 保存按钮与自动保存选项（紧凑集成胶囊按钮） -->
                <div
                  class="inline-flex items-center h-8 rounded-full border border-base-300/80 bg-base-100/80 hover:border-base-content/25 transition-all shadow-2xs"
                  data-tour="btn-save"
                >
                  <div
                    class="tooltip tooltip-bottom h-full"
                    :data-tip="hasUnsavedChanges() ? '保存（有未保存修改）' : '保存至服务器'"
                  >
                    <button
                      class="h-8 pl-2.5 pr-1.5 flex items-center justify-center rounded-l-full text-primary hover:bg-primary/10 transition-colors relative cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      type="button"
                      :disabled="syntaxChecking || saveInProgress"
                      @click="saveToServer"
                    >
                      <Icon icon="mdi:content-save-outline" size="16px" />
                      <span
                        v-if="hasUnsavedChanges()"
                        class="absolute top-1 right-0.5 w-2 h-2 rounded-full bg-warning ring-1 ring-base-100"
                        title="有未保存修改"
                      ></span>
                    </button>
                  </div>
                  <span class="w-px h-3.5 bg-base-content/15 shrink-0"></span>
                  <details
                    ref="autoSaveDropdownRef"
                    class="dropdown dropdown-end h-full"
                  >
                    <summary
                      class="h-8 pl-1 pr-1.5 min-w-0 flex items-center justify-center cursor-pointer list-none rounded-r-full hover:bg-base-content/10 transition-colors relative"
                      :class="autoSaveEnabled ? 'text-primary' : 'text-base-content/40'"
                      :title="autoSaveEnabled ? `自动定时保存：已开启 (${autoSaveIntervalSec}秒)` : '自动定时保存：已关闭'"
                    >
                      <Icon icon="mdi:menu-down" size="14px" />
                      <span
                        v-if="autoSaveEnabled"
                        class="absolute bottom-1 right-0.5 w-1 h-1 rounded-full bg-success ring-1 ring-base-100"
                      ></span>
                    </summary>
                    <div
                      class="dropdown-content z-50 card card-compact w-64 p-3 shadow-xl bg-base-100 rounded-2xl border border-base-200 mt-2"
                    >
                      <div class="flex items-center justify-between pb-2 border-b border-base-200">
                        <span class="font-bold text-sm flex items-center gap-1.5">
                          <Icon icon="mdi:content-save-cog-outline" class="text-primary text-base" />
                          自动定时保存
                        </span>
                        <span
                          class="badge badge-xs"
                          :class="autoSaveEnabled ? 'badge-success' : 'badge-ghost'"
                        >
                          {{ autoSaveEnabled ? '已开启' : '已关闭' }}
                        </span>
                      </div>

                      <label class="label cursor-pointer justify-between py-2">
                        <span class="label-text text-xs font-medium">启用定时自动保存</span>
                        <input
                          v-model="autoSaveEnabled"
                          type="checkbox"
                          class="toggle toggle-primary toggle-sm"
                        />
                      </label>

                      <div v-if="autoSaveEnabled" class="space-y-1.5 pt-1.5 border-t border-base-200">
                        <div class="flex items-center justify-between text-xs text-base-content/70">
                          <span>保存间隔</span>
                          <span class="font-mono text-primary font-medium">{{ autoSaveIntervalLabel }}</span>
                        </div>
                        <select
                          v-model="autoSaveInterval"
                          class="select select-bordered select-xs w-full"
                        >
                          <option :value="15000">15 秒</option>
                          <option :value="30000">30 秒（默认）</option>
                          <option :value="60000">1 分钟</option>
                          <option :value="120000">2 分钟</option>
                          <option :value="300000">5 分钟</option>
                        </select>
                      </div>

                      <div class="text-[11px] text-base-content/50 pt-2 border-t border-base-200 mt-2 leading-relaxed">
                        开启后，有未保存修改时将定时自动保存到草稿与服务器。
                      </div>
                    </div>
                  </details>
                </div>
                <div
                  class="tooltip tooltip-bottom"
                  :data-tip="`提交审核` + (!currentStoryId || story.status !== 'draft' ? '' : '（请先保存）')"
                  data-tour="btn-submit"
                >
                  <button
                    class="btn btn-sm btn-ghost btn-accent btn-circle"
                    type="button"
                    :disabled="!(currentStoryId && story.status === 'draft')"
                    @click="submitForReview"
                  >
                    <Icon icon="fa:paper-plane" size="16px" />
                  </button>
                </div>
              </template>
              <div v-else class="tooltip tooltip-bottom" data-tip="语法检查">
                <button
                  class="btn btn-sm btn-ghost btn-circle"
                  type="button"
                  @click="saveToServer"
                >
                  <Icon icon="mdi:check-decagram-outline" size="16px" />
                </button>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <div
              class="flex-1 min-w-70 input input-sm"
            >
              <Icon
                icon="mdi:text-box-outline"
                class="text-base text-base-content/50 shrink-0"
              />
              <input
                v-model="story.description"
                :readonly="props.readOnly"
                class="w-full px-1"
                placeholder="故事描述/简述..."
              />
            </div>
            <div class="w-full md:w-48 input input-sm">
              <Icon
                icon="mdi:link-variant"
                class="text-base text-base-content/50 shrink-0"
              />
              <input
                v-model="storyShortname"
                :readonly="props.readOnly"
                class="w-full px-1"
                :class="{ 'text-error': shortnameInvalid }"
                :title="
                  shortnameInvalid
                    ? '短名只能包含字母、数字、下划线和连字符'
                    : '短名（可选）用于 /play/短名 访问'
                "
                placeholder="短名（可选，用于短链接）"
              />
            </div>
            <div
              class="w-full sm:w-72 input input-sm"
            >
              <Icon
                icon="mdi:tag-multiple-outline"
                class="text-base text-base-content/50 shrink-0"
              />
              <input
                v-model="storyTagsStr"
                :readonly="props.readOnly"
                class="w-full px-1"
                placeholder="故事标签（逗号分隔，如: 奇幻, 动作）"
              />
            </div>
            <div class="w-44 sm:w-48 flex items-center gap-2">
              <Icon
                icon="mdi:map-marker"
                class="text-base text-base-content/50 shrink-0 tooltip"
                data-tip="起始章节"
                aria-label="起始章节"
              />
              <select
                v-model="story.startPassage"
                :disabled="props.readOnly"
                class="select select-sm select-bordered w-full"
              >
                <option
                  v-for="p in story.passages"
                  :key="p.name"
                  :value="p.name"
                >
                  {{ p.name }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <div class="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <StoryEditorPanel
            ref="editorPanel"
            :readOnly="props.readOnly"
            :story="story"
            v-model:selectedPassage="selectedPassage"
            v-model:content="selectedPassageContent"
            :tagEditValue="tagEditValue"
            :variables="variables"
            @save-tags="saveTags"
            @rename-passage="renamePassage"
            @delete-passage="deletePassage"
            @show-manual="() => (showManual = true)"
            @init-default="initDefaultStory"
          />

          <StoryRightPanel
            v-if="!isMobile"
            data-tour="right-panel"
            :story="story"
            :variables="variables"
            :previewPassage="previewPassage"
            :activeRightTab="activeRightTab"
            @update:previewPassage="previewPassage = $event"
            @update:activeRightTab="activeRightTab = $event"
            @update:variables="handleUpdateVariables($event)"
            @update:currentPassage="handleUpdateCurrentPassage($event)"
            @refresh-preview="refreshPreview"
            @reset-preview-vars="resetPreviewVars"
            @insert-variable="insertVariableToEditor"
            @edit-variable="openEditVar"
          />
        </div>
      </main>
    </div>
    <dialog
      v-if="isMobile"
      ref="previewRef"
      class="modal md:modal-middle modal-bottom p-0"
    >
      <div class="modal-box h-full flex flex-col relative bg-base-200 p-2!">
        <StoryRightPanel
          :story="story"
          :variables="variables"
          :previewPassage="previewPassage"
          :activeRightTab="activeRightTab"
          @update:previewPassage="previewPassage = $event"
          @update:activeRightTab="activeRightTab = $event"
          @update:variables="handleUpdateVariables($event)"
          @update:currentPassage="handleUpdateCurrentPassage($event)"
          @refresh-preview="refreshPreview"
          @reset-preview-vars="resetPreviewVars"
          @insert-variable="insertVariableToEditor"
          @edit-variable="openEditVar"
        />
        <form class="modal-action bottom-5 right-5 fixed" method="dialog">
          <button class="btn btn-circle btn-error btn-soft">
            <Icon icon="mdi:close" class="text-lg" />
          </button>
        </form>
      </div>
    </dialog>
    <dialog id="json-editor-dialog" class="modal">
      <div class="modal-box w-screen md:w-11/12 max-w-3xl">
        <h3 class="text-lg font-bold">编辑变量 JSON</h3>
        <div class="py-4" ref="jsonEditorRef">
          <textarea style="width: 100%; height: 400px"></textarea>
        </div>
        <div class="modal-action">
          <button class="btn btn-ghost" type="button" @click="closeJsonEditor">
            取消
          </button>
          <button class="btn btn-primary" type="button" @click="saveEditedVar">
            保存
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="submit">close</button>
      </form>
    </dialog>
    <dialog id="paste-import-dialog" class="modal">
      <div class="modal-box w-screen md:w-11/12 max-w-3xl">
        <h3 class="text-lg font-bold">粘贴并导入故事源码</h3>
        <div class="py-4" ref="pasteEditorRef">
          <textarea style="width: 100%; height: 400px"></textarea>
        </div>
            <div class="py-2" v-if="showAppendToggle">
              <div class="flex items-center gap-2">
                <span class="text-sm">覆盖</span>
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  v-model="appendMode"
                  aria-label="追加或覆盖"
                />
                <span class="text-sm">追加</span>
              </div>
            </div>
        <div class="modal-action">
          <button class="btn btn-ghost" type="button" @click="closePasteDialog">
            取消
          </button>
          <button
            class="btn btn-primary"
            type="button"
            @click="confirmPasteImport"
          >
            导入
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="submit">close</button>
      </form>
    </dialog>
    <dialog ref="syntaxDialogRef" class="modal" @cancel="onSyntaxDialogCancel">
      <div class="modal-box max-w-2xl">
        <h3 class="flex items-center gap-2 text-lg font-bold">
          <Icon
            :icon="
              syntaxIssues.length
                ? 'mdi:check-decagram-outline'
                : 'mdi:check-circle-outline'
            "
            class="text-xl text-primary"
          />
          语法检查
        </h3>

        <div
          v-if="syntaxChecking"
          class="flex flex-col items-center gap-3 py-10"
        >
          <span class="loading loading-spinner loading-lg text-primary"></span>
          <p class="text-sm text-base-content/70">正在检查语法…</p>
        </div>

        <template v-else>
          <div class="space-y-3 py-4">
            <div
              role="alert"
              class="alert alert-soft"
              :class="syntaxIssues.length ? 'alert-warning' : 'alert-success'"
            >
              <Icon
                :icon="
                  syntaxIssues.length
                    ? 'mdi:alert-circle-outline'
                    : 'mdi:check-circle-outline'
                "
                class="text-lg"
              />
              <span v-if="syntaxIssues.length">
                发现 {{ syntaxIssues.length }} 个语法问题，是否仍要继续保存？
              </span>
              <span v-else> 故事语法检查通过，没有发现问题。 </span>
            </div>
            <ul v-if="syntaxIssues.length" class="max-h-80 space-y-2 overflow-y-auto pr-1">
              <li
                v-for="(issue, index) in syntaxIssues"
                :key="index"
                class="rounded-box border border-base-300 bg-base-200/50 p-3 text-sm"
              >
                <div class="flex flex-wrap items-center gap-2">
                  <span class="badge badge-warning badge-sm">{{
                    syntaxIssueLabel(issue.type)
                  }}</span>
                  <span class="font-medium">段落「{{ issue.passage }}」</span>
                  <span v-if="issue.line" class="text-base-content/60"
                    >第 {{ issue.line }} 行</span
                  >
                </div>
                <p class="mt-1 text-base-content/70">{{ issue.message }}</p>
              </li>
            </ul>
          </div>
          <div class="modal-action">
            <button class="btn" type="button" @click="cancelSyntaxSave">
              {{ syntaxIssues.length && !props.readOnly ? "取消" : "关闭" }}
            </button>
            <button
              class="btn btn-soft"
              type="button"
              @click="copySyntaxResultsAsMarkdown"
            >
              复制
            </button>
            <button
              v-if="syntaxIssues.length && !props.readOnly"
              class="btn btn-warning"
              type="button"
              @click="confirmSyntaxSave"
            >
              继续保存
            </button>
          </div>
        </template>
      </div>
    </dialog>
    <dialog ref="graphRef" class="modal" @close="graphFullscreen = true">
      <div
        class="modal-box w-screen p-2!"
        :class="
          graphFullscreen
            ? 'flex h-dvh max-h-none max-w-none flex-col rounded-none'
            : 'max-w-6xl'
        "
      >
        <div class="mb-2 flex items-center justify-between px-2 pt-1">
          <h3 class="flex items-center gap-2 text-lg font-bold">
            <Icon icon="mdi:graph-outline" class="text-xl text-primary" />
            段落关系图
          </h3>
          <div class="flex items-center gap-1">
            <div
              class="tooltip tooltip-bottom"
              :data-tip="graphFullscreen ? '退出全屏' : '全屏显示'"
            >
              <button
                class="btn btn-sm btn-circle btn-ghost"
                type="button"
                :aria-label="graphFullscreen ? '退出全屏' : '全屏显示'"
                @click="toggleGraphFullscreen"
              >
                <Icon
                  :icon="
                    graphFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'
                  "
                  size="16px"
                />
              </button>
            </div>
            <form method="dialog">
              <button class="btn btn-sm btn-circle btn-ghost" type="submit">
                <Icon icon="mdi:close" size="16px" />
              </button>
            </form>
          </div>
        </div>
        <div class="min-h-0" :class="{ grow: graphFullscreen }">
          <StoryGraph
            :story="graphStory"
            :active-passage="selectedPassage"
            :height="graphFullscreen ? '100%' : '68vh'"
            @select-passage="openPassageFromGraph"
          />
        </div>
        <p class="mt-2 px-2 text-xs text-base-content/50">
          点击任一段落即可切换编辑目标；滚轮缩放，拖拽平移。
        </p>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="submit">close</button>
      </form>
    </dialog>
    <SyntaxManual v-if="showManual" @close="showManual = false" />

    <!-- 编辑器使用引导 -->
    <Tour
      ref="tourRef"
      v-model="tourOpen"
      :steps="tourSteps"
      finish-text="开始创作"
      @finish="markTourSeen"
      @close="markTourSeen"
    />
  </div>
</template>
<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  nextTick,
  onBeforeUnmount,
  watch,
} from "vue";
import { useRouter, useRoute, onBeforeRouteLeave } from "vue-router";
import {
  getStory,
  createStory,
  updateStory,
  publishStory,
  listBetaTesters,
  addBetaTester,
  removeBetaTester,
  IStory,
  type IStoryBetaTester,
} from "@/api/stories";
import { completeTour, searchUsers, type UserSummary } from "@/api/user";
import StoryPlayView from "@/views/StoryPlayView.vue";
import StoryEditorPanel from "@/components/StoryEditor/StoryEditorPanel.vue";
import StoryRightPanel from "@/components/StoryEditor/StoryRightPanel.vue";
import PassageList from "@/components/StoryEditor/PassageList.vue";
import StoryGraph from "@/components/StoryGraph/src/StoryGraph.vue";
import {
  createDefaultStory,
  createEmptyStory,
  parseStorySource,
  serializeStory,
  buildInitialVariables,
  checkStorySyntax,
  extractStorySpecials,
  type StoryData,
  type StorySyntaxIssue,
  buildStandaloneExport,
} from "@/lib/storyEngine";
import {} from "@/lib/storyEngine";
import { storyRouteKey } from "@/lib/storyRoute";

// CodeMirror v5 for JSON editing
// CodeMirror v5 for JSON editing (used for modals/paste editor)
import CodeMirror from "codemirror";
import "codemirror/lib/codemirror.css";
import "codemirror/theme/dracula.css";
import "codemirror/mode/javascript/javascript";
// load simple mode addon for defining custom mode
import "codemirror/addon/mode/simple";
import msg from "@/components/msg";
import { useAppStore } from "@/stores/modules/app";
import { useAuthStore } from "@/stores/modules/auth";
import { omit } from "lodash-es";
import msgbox from "@/components/msgbox";
import useStoryDraft, {
  normalizeStoryTags,
  cloneStoryForDraft,
  storyFingerprint,
} from "@/composables/useStoryDraft";
import Icon from "@/components/Icon/src/Icon.vue";
import Avatar from "@/components/Avatar/src/Avatar.vue";
import Tour from "@/components/Tour/src/Tour.vue";
import type { TourStep } from "@/components/Tour/src/types";
import { availableTourSteps } from "@/lib/editorTour";
import { delay } from "@/utils";
import StoryHistoryModal from "@/components/StoryHistory/StoryHistoryModal.vue";
import { onClickOutside } from "@vueuse/core";

const props = defineProps<{ readOnly?: boolean; initialStory?: any }>();

const appStore = useAppStore();
const authStore = useAuthStore();
const isDark = computed(() => appStore.getTheme === "dark");
const isMobile = computed(() => appStore.isMobile);

const router = useRouter();
const passageRef = ref<HTMLDialogElement | null>(null);
const previewRef = ref<HTMLDialogElement | null>(null);
const graphRef = ref<HTMLDialogElement | null>(null);
const jsonEditorRef = ref<HTMLDivElement | null>(null);
let cmInstance: any = null;
let globalKeydownHandler: ((e: KeyboardEvent) => void) | null = null;
let beforeUnloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;
let visibilityChangeHandler: (() => void) | null = null;
// CodeMirror instance for story editor
// story editor instance moved to StoryEditorPanel component
const editorPanel = ref<any | null>(null);
// CodeMirror instance for paste-import dialog
const pasteEditorRef = ref<HTMLDivElement | null>(null);
let cmPasteInstance: any = null;
const jsonEditorValue = ref("");
const editingVarName = ref("");
const showManual = ref(false);
const appendMode = ref(true);
const showAppendToggle = ref(false);

const AUTO_SAVE_STORAGE_KEY = "haide-story-editor-auto-save-enabled";
const AUTO_SAVE_INTERVAL_KEY = "haide-story-editor-auto-save-interval";
const DEFAULT_AUTO_SAVE_INTERVAL = 30000;

const autoSaveDropdownRef = ref<HTMLDetailsElement | null>(null);
const autoSaveEnabled = ref<boolean>(
  localStorage.getItem(AUTO_SAVE_STORAGE_KEY) !== "false",
);
const autoSaveInterval = ref<number>(
  (() => {
    const saved = localStorage.getItem(AUTO_SAVE_INTERVAL_KEY);
    const num = saved ? parseInt(saved, 10) : NaN;
    return !isNaN(num) && num >= 5000 ? num : DEFAULT_AUTO_SAVE_INTERVAL;
  })(),
);

const autoSaveIntervalSec = computed(() =>
  Math.round(autoSaveInterval.value / 1000),
);
const autoSaveIntervalLabel = computed(() => {
  const sec = autoSaveIntervalSec.value;
  if (sec < 60) return `${sec} 秒`;
  const min = Math.round(sec / 60);
  return `${min} 分钟`;
});

let initVersion = 0;

// 保存前的语法检查对话框状态
const syntaxDialogRef = ref<HTMLDialogElement | null>(null);
const syntaxChecking = ref(false);
const syntaxIssues = ref<StorySyntaxIssue[]>([]);
const saveInProgress = ref(false);

/* ---------------------------- 编辑器使用引导 ---------------------------- */
const tourRef = ref<any | null>(null);
const tourOpen = ref(false);
const tourSteps = ref<TourStep[]>([]);

/** 打开编辑器引导；移动端或只读模式下会自动跳过不可用的步骤 */
const startEditorTour = async () => {
  const steps = availableTourSteps();
  if (steps.length < 2) return;
  tourSteps.value = steps;
  tourOpen.value = true;
  await nextTick();
  await tourRef.value?.open(0);
};

/** 记下已走过引导（写入用户表），之后再进编辑器不再自动弹出 */
const markTourSeen = async () => {
  if (props.readOnly || authStore.getUser?.isToured) return;
  // 先更新本地状态，避免同一次会话里重复弹出
  authStore.patchUser({ isToured: true });
  try {
    await completeTour();
  } catch (e) {
    // 写库失败不影响当前会话，下次进入可能再引导一次
  }
};

const maybeAutoStartTour = () => {
  if (props.readOnly) return;
  if (authStore.getUser?.isToured) return;
  window.setTimeout(() => void startEditorTour(), 900);
};

/** 语法问题类型 -> 中文标签 */
const SYNTAX_ISSUE_LABELS: Record<string, string> = {
  "dead-link": "死链",
  "orphan-passage": "孤立段落",
  "invalid-ending": "结局标记",
  "leftover-macro": "残留宏",
  "duplicate-passage": "重复段落名",
  "inconsistent-point-description": "成就描述不一致",
  "inconsistent-ending-description": "结局描述不一致",
  "missing-ending": "缺少结局标记",
};

const syntaxIssueLabel = (type: StorySyntaxIssue["type"]): string =>
  SYNTAX_ISSUE_LABELS[type] ?? type;

const story = ref<IStory>(createEmptyStory());
const storyAny = computed(() => story.value as any);
const route = useRoute();
const currentStoryId = ref<string | null>(null);
const selectedPassage = ref("");
const variables = ref<Record<string, unknown>>({});
const previewPassage = ref<string>("");
const selectedInsertVar = ref("");
const variableKeys = computed(() => Object.keys(variables.value));
const storyTagsStr = computed({
  get: () => (story.value.tags || []).join(","),
  set: (v: string) => {
    story.value.tags = (v || "")
      .replaceAll("，", ",")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  },
});

/** 短名只允许字母/数字/下划线/连字符，与后端校验保持一致 */
const SHORTNAME_PATTERN = /^[A-Za-z0-9_-]+$/;
const storyShortname = computed({
  get: () => story.value.shortname || "",
  set: (v: string) => {
    const name = (v || "").trim();
    story.value.shortname = name || undefined;
  },
});
const shortnameInvalid = computed(
  () => !!storyShortname.value && !SHORTNAME_PATTERN.test(storyShortname.value),
);

/**
 * 服务器上已落库的短名。试玩链接必须用它，否则用户刚输入短名还没保存时，
 * 链接会因为服务端查不到而失效。
 */
const persistedShortname = ref<string | null>(null);

/** /test/:storyId 用的标识：有已保存短名用短名，否则用真实 id。 */
const testRouteKey = computed(() =>
  storyRouteKey({
    id: currentStoryId.value,
    shortname: persistedShortname.value,
  }),
);
const activeRightTab = ref<"preview" | "vars" | "points" | "endings">(
  "preview",
);

const {
  startAutoSave,
  stopAutoSave,
  saveLocalDraftNow,
  clearLocalDraft,
  tryRestoreNoIdDraft,
  updateSnapshot,
  hasUnsavedChanges,
} = useStoryDraft();

const selectedPassageContent = computed({
  get: () => {
    const current =
      story.value.passages.find(
        (passage) => passage.name === selectedPassage.value,
      ) ?? story.value.passages[0];
    return current?.content ?? "";
  },
  set: (value: string) => {
    const current =
      story.value.passages.find(
        (passage) => passage.name === selectedPassage.value,
      ) ?? story.value.passages[0];
    if (!current) {
      return;
    }
    current.content = value;
  },
});

function insertJsGlobalSnippet() {
  if (props.readOnly) return;
  if (
    editorPanel.value &&
    typeof editorPanel.value.insertSnippet === "function"
  ) {
    editorPanel.value.insertSnippet(
      `(fn:\"myFunc\")[console.log(\"hello\"); return 123]`,
    );
  }
}

function insertCallSnippet() {
  if (props.readOnly) return;
  if (
    editorPanel.value &&
    typeof editorPanel.value.insertSnippet === "function"
  ) {
    editorPanel.value.insertSnippet(`(call:\"myFunc\")`);
  }
}

const insertVariableToEditor = (key: string) => {
  if (
    editorPanel.value &&
    typeof editorPanel.value.insertSnippet === "function"
  ) {
    editorPanel.value.insertSnippet(`$${key}`);
  }
};

const openEditVar = async (key: string) => {
  editingVarName.value = key;
  jsonEditorValue.value = JSON.stringify(variables.value[key], null, 2);
  // show modal
  await nextTick();
  const dlg = document.getElementById(
    "json-editor-dialog",
  ) as HTMLDialogElement | null;
  if (dlg) dlg.showModal();
  // init CodeMirror
  await nextTick();
  const currentTheme = isDark.value ? "dracula" : "default";
  if (jsonEditorRef.value && !cmInstance) {
    const textarea = jsonEditorRef.value.querySelector(
      "textarea",
    ) as HTMLTextAreaElement | null;
    if (textarea) {
      textarea.value = jsonEditorValue.value;
      cmInstance = CodeMirror.fromTextArea(textarea, {
        mode: { name: "javascript", json: true },
        theme: currentTheme,
        lineNumbers: true,
        tabSize: 2,
        autofocus: true,
      });
      cmInstance.setSize("100%", 400);
    }
  } else if (cmInstance) {
    cmInstance.setOption("theme", currentTheme);
    cmInstance.setValue(jsonEditorValue.value);
  }
};

const saveEditedVar = () => {
  if (!editingVarName.value) return;
  let raw = jsonEditorValue.value;
  if (cmInstance) raw = cmInstance.getValue();
  try {
    const parsed = JSON.parse(raw);
    variables.value[editingVarName.value] = parsed;
  } catch (e) {
    // fallback: treat as string
    variables.value[editingVarName.value] = raw;
  }
  const dlg = document.getElementById(
    "json-editor-dialog",
  ) as HTMLDialogElement | null;
  if (dlg) dlg.close();
};

const closeJsonEditor = () => {
  const dlg = document.getElementById(
    "json-editor-dialog",
  ) as HTMLDialogElement | null;
  if (dlg) dlg.close();
};

const refreshPreview = async () => {
  const current = previewPassage.value;
  previewPassage.value = "";
  await nextTick();
  previewPassage.value = current;
};

const resetPreviewVars = () => {
  variables.value = buildInitialVariables(story.value);
};

const insertSelectedVar = () => {
  if (!selectedInsertVar.value) return;
  if (
    editorPanel.value &&
    typeof editorPanel.value.insertSnippet === "function"
  ) {
    editorPanel.value.insertSnippet(`$${selectedInsertVar.value}`);
  }
};

onBeforeUnmount(() => {
  if (cmInstance) {
    try {
      cmInstance.toTextArea();
    } catch {}
    cmInstance = null;
  }
  if (cmPasteInstance) {
    try {
      cmPasteInstance.toTextArea();
    } catch {}
    cmPasteInstance = null;
  }
  if (betaSearchTimer !== null) {
    window.clearTimeout(betaSearchTimer);
    betaSearchTimer = null;
  }
  if (globalKeydownHandler) {
    try {
      window.removeEventListener('keydown', globalKeydownHandler);
    } catch {}
    globalKeydownHandler = null;
  }
  try {
    stopAutoSave();
  } catch {}
  if (beforeUnloadHandler) {
    try {
      window.removeEventListener("beforeunload", beforeUnloadHandler);
    } catch {}
    beforeUnloadHandler = null;
  }
  if (visibilityChangeHandler) {
    try {
      document.removeEventListener("visibilitychange", visibilityChangeHandler);
    } catch {}
    visibilityChangeHandler = null;
  }
});

const handleUpdateVariables = (v: any) => {
  variables.value = v;
};

const handleUpdateCurrentPassage = (p: string) => {
  // save previous passage name into built-in variable before updating
  try {
    const prev = previewPassage.value;
    if (prev) variables.value.prevPassage = prev;
  } catch (e) {
    // ignore if variables object shape differs
  }
  previewPassage.value = p;
};

const ensurePassage = (name: string) => {
  const normalized = name.trim() || "Untitled";
  if (!story.value.passages.some((passage) => passage.name === normalized)) {
    story.value.passages.push({
      name: normalized,
      tags: [],
      content: "新段落内容",
    });
  }
  selectedPassage.value = normalized;
};

const addPassage = async () => {
  const baseName = `Passage_${story.value.passages.length + 1}`;
  try {
    const input = await msgbox.prompt("段落名：", "新增段落", {
      inputValue: baseName,
    });
    if (!input || !input.trim()) return;
    let name = input.trim();
    // if name exists, generate a unique one
    if (story.value.passages.some((p) => p.name === name)) {
      name = generateUniquePassageName(name);
    }
    story.value.passages.push({ name, tags: [], content: "新段落内容" });
    story.value.passages = normalizePassageTags(story.value.passages);
    selectedPassage.value = name;
  } catch (e) {
    // user cancelled or prompt failed, do nothing
  }
};

const generateUniquePassageName = (base: string) => {
  let name = base.trim() || "Untitled";
  let i = 1;
  while (story.value.passages.some((p) => p.name === name)) {
    i += 1;
    name = `${base} (imported ${i})`;
  }
  return name;
};

const pasteImport = async () => {
  // Open paste dialog and load clipboard text into CodeMirror for user editing
  let clipboard = "";
  try {
    clipboard = await navigator.clipboard.readText();
  } catch (e) {
    // ignore clipboard errors, start with empty
  }
  await nextTick();
  const dlg = document.getElementById(
    "paste-import-dialog",
  ) as HTMLDialogElement | null;
  if (dlg) dlg.showModal();
  await nextTick();
  const currentTheme = isDark.value ? "dracula" : "default";
  if (pasteEditorRef.value && !cmPasteInstance) {
    const ta = pasteEditorRef.value.querySelector(
      "textarea",
    ) as HTMLTextAreaElement | null;
    if (ta) {
      ta.value = clipboard || "";
      cmPasteInstance = CodeMirror.fromTextArea(ta, {
        mode: "haideStory",
        theme: currentTheme,
        lineNumbers: true,
        lineWrapping: true,
        tabSize: 2,
      });
      cmPasteInstance.setSize("100%", 400);
      // show append toggle if content looks like a full story (:: header)
      showAppendToggle.value = (clipboard || "").trim().startsWith("::");
      cmPasteInstance.on &&
        cmPasteInstance.on("change", () => {
          try {
            const v = cmPasteInstance.getValue();
            showAppendToggle.value = (v || "").trim().startsWith("::");
          } catch (e) {
            // ignore
          }
        });
    }
  } else if (cmPasteInstance) {
    cmPasteInstance.setOption("theme", currentTheme);
    if (clipboard) cmPasteInstance.setValue(clipboard);
    showAppendToggle.value = (clipboard || "").trim().startsWith("::");
  }
};

const closePasteDialog = () => {
  const dlg = document.getElementById(
    "paste-import-dialog",
  ) as HTMLDialogElement | null;
  if (dlg) dlg.close();
  if (cmPasteInstance) {
    try {
      cmPasteInstance.toTextArea();
    } catch {}
    cmPasteInstance = null;
  }
  // reset append toggle state
  appendMode.value = false;
  showAppendToggle.value = false;
};

const confirmPasteImport = () => {
  let raw = "";
  if (cmPasteInstance) raw = cmPasteInstance.getValue();
  else {
    const ta = pasteEditorRef.value?.querySelector(
      "textarea",
    ) as HTMLTextAreaElement | null;
    raw = ta?.value || "";
  }
  if (!raw || !raw.trim()) {
    msg.error("未检测到可导入的文本。");
    return;
  }
  try {
    const parsed = parseStorySource(raw);
    if (!parsed || !parsed.passages || parsed.passages.length === 0) {
      msg.error("未检测到可导入的段落内容。");
      return;
    }
    let added = 0;
    if (!appendMode.value || !showAppendToggle.value) {
      // overwrite metadata and passages
      story.value.title = parsed.title || story.value.title;
      story.value.startPassage = parsed.startPassage || story.value.startPassage;
      story.value.tags = parsed.tags || story.value.tags;
      story.value.description = parsed.description || story.value.description;
      story.value.passages = [];
      for (const p of parsed.passages) {
        const toAdd = { ...p };
        story.value.passages.push(toAdd);
        added += 1;
      }
    } else {
      // append: keep existing metadata, add new passages, avoid name conflicts
      for (const p of parsed.passages) {
        const exists = story.value.passages.some((q) => q.name === p.name);
        const toAdd = { ...p };
        if (exists) toAdd.name = generateUniquePassageName(p.name);
        story.value.passages.push(toAdd);
        added += 1;
      }
    }
    story.value.passages = normalizePassageTags(story.value.passages);
    const newVars = buildInitialVariables(story.value);
    for (const [k, v] of Object.entries(newVars)) {
      if (variables.value[k] === undefined) variables.value[k] = v;
    }
    if (added > 0)
      selectedPassage.value =
        story.value.passages[story.value.passages.length - added].name;
    msg.success(`已从粘贴文本导入 ${added} 个段落。`);
    closePasteDialog();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    msg.error("导入失败，请检查文本格式。");
  }
};

function normalizePassageTags(passages: any[]) {
  if (!passages) return [];
  for (const p of passages) {
    if (p.tags == null) {
      p.tags = [];
    } else if (!Array.isArray(p.tags)) {
      p.tags = String(p.tags)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return passages;
}
const applyStoryToEditor = (input: Partial<IStory> | StoryData) => {
  const normalized = cloneStoryForDraft(input);
  const base = createEmptyStory();
  story.value = {
    ...(base as IStory),
    ...(input as any),
    title: normalized.title,
    startPassage: normalized.startPassage,
    description: normalized.description,
    shortname: normalized.shortname,
    status: normalized.status,
    tags: normalized.tags,
    passages: normalized.passages,
  } as IStory;
  variables.value = buildInitialVariables(story.value);
  selectedPassage.value =
    story.value.startPassage || story.value.passages[0]?.name || "Start";
  previewPassage.value = selectedPassage.value;
  refreshPreview();
};

const copyStory = () => {
  const source = serializeStory(story.value);
  try {
    navigator.clipboard.writeText(source);
    msg.success("已复制文本源码到剪贴板。");
  } catch (e) {
    console.error(e);
    msg.error("复制失败，请手动复制。");
  }
};

const buildStory = () => {
  const source = buildStandaloneExport(
    story.value,
    variables.value,
    selectedPassage.value,
  );
  const blob = new Blob([source], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${(story.value.title || "story").replace(/\s+/g, "-")}.html`;
  anchor.click();
  URL.revokeObjectURL(url);
};

/**
 * 保存前先做一次语法检查：弹出对话框显示 loading，检查完成后
 * - 无问题：关闭对话框并直接保存；
 * - 有问题：列出问题，等待用户选择「继续保存」或「取消」。
 */
const saveToServer = async () => {
  if (syntaxChecking.value || saveInProgress.value) {
    return;
  }
  syntaxIssues.value = [];
  syntaxChecking.value = true;
  const dialog = syntaxDialogRef.value;
  if (dialog && !dialog.open) {
    dialog.showModal();
  }

  // 先让 loading 状态渲染一帧，再执行（同步的）语法检查
  await nextTick();
  await new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve(null));
    } else {
      setTimeout(resolve, 0);
    }
  });

  let issues: StorySyntaxIssue[] = [];
  try {
    issues = checkStorySyntax(story.value as unknown as StoryData);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[StoryEditor] syntax check failed", e);
  }
  await delay(500);
  syntaxIssues.value = issues;
  syntaxChecking.value = false;

  await delay(1500);

  if (!issues.length) {
    closeSyntaxDialog();
    if (props.readOnly) {
      msg.success("语法检查通过");
    } else {
      await performSave();
    }
  }
};

const closeSyntaxDialog = () => {
  const dialog = syntaxDialogRef.value;
  if (dialog?.open) {
    dialog.close();
  }
};

/** 检查进行中禁止关闭；检查完成后按 ESC 等同于「取消」。 */
const onSyntaxDialogCancel = (event: Event) => {
  if (syntaxChecking.value) {
    event.preventDefault();
    return;
  }
  syntaxIssues.value = [];
};

const cancelSyntaxSave = () => {
  syntaxIssues.value = [];
  closeSyntaxDialog();
};

const confirmSyntaxSave = async () => {
  closeSyntaxDialog();
  await performSave();
};

const copySyntaxResultsAsMarkdown = async () => {
  const lines: string[] = [];
  lines.push(`# 语法检查结果：${story.value.title || "(未命名)"}`);
  lines.push(``);
  if (!syntaxIssues.value || syntaxIssues.value.length === 0) {
    lines.push(`- ✅ 无语法问题，检查通过。`);
  } else {
    for (const issue of syntaxIssues.value) {
      const lineInfo = issue.line ? `（第 ${issue.line} 行）` : "";
      const label = syntaxIssueLabel(issue.type as any);
      lines.push(`- **${label}**：段落「${issue.passage}」${lineInfo} — ${issue.message}`);
    }
  }
  const md = lines.join("\n");
  try {
    await navigator.clipboard.writeText(md);
    msg.success("已复制");
  } catch (e) {
    console.error(e);
    msg.error("复制失败，请手动复制");
  }
};

/** 真正执行服务端保存，失败时回退到本地草稿。 */
const performSave = async (silent = false) => {
  if (saveInProgress.value) {
    return false;
  }
  if (shortnameInvalid.value) {
    if (!silent) msg.error("短名只能包含字母、数字、下划线和连字符");
    return false;
  }
  saveInProgress.value = true;
  // Create payload compatible with server CreateStoryDto: title + content
  const payload = {
    ...omit(story.value, ["passages", "author"]),
    content: serializeStory(story.value),
    passageSize: story.value.passages.length,
    // compute achievement (point) and ending counts
    ...(() => {
      try {
        const specials = extractStorySpecials(story.value as StoryData);
        return {
          pointSize: (specials.points || []).length,
          endSize: (specials.endings || []).length,
        };
      } catch (e) {
        return { pointSize: 0, endSize: 0 };
      }
    })(),
    status: 'draft'
  };
  try {
    if (currentStoryId.value) {
      story.value.status = 'draft';
      await updateStory(currentStoryId.value, payload);
      persistedShortname.value = story.value.shortname || null;
      updateSnapshot();
      clearLocalDraft();
      if (!silent) {
        msg.success("已保存");
      } else {
        msg.success("已自动保存");
      }
      return true;
    } else {
      const res = await createStory(payload);
      const newId = res?.id;
      if (newId) {
        currentStoryId.value = newId;
        persistedShortname.value = story.value.shortname || null;
        updateSnapshot();
        clearLocalDraft();
        router.replace({ name: "story-editor", params: { storyId: newId } });
      }
      story.value.status = 'draft';
      if (!silent) {
        msg.success("已保存");
      } else {
        msg.success("已自动保存");
      }
      return true;
    }
  } catch (e) {
    console.error("[StoryEditor] save failed", e);
    if (!silent) {
      const errMessage =
        (e as any)?.response?.data?.message || (e as any)?.message;
      msg.error(errMessage || "保存到服务器失败");
    }
    return false;
  } finally {
    saveInProgress.value = false;
  }
};

const submitForReview = async () => {
  if (!currentStoryId.value) {
    msg.error("请先保存故事到服务器再提交审核");
    return;
  }
  try {
    await publishStory(currentStoryId.value);
    story.value.status = 'pending';
    msg.success("已提交审核");
  } catch (e) {
    msg.error("提交审核失败");
  }
};

const selectPassage = (name: string) => {
  selectedPassage.value = name;
};

/** 关系图弹窗：展示段落之间的跳转/包含关系。 */
const graphStory = computed(() => story.value as unknown as StoryData);
const graphFullscreen = ref(true);

const openGraph = () => {
  graphRef.value?.showModal();
};

const toggleGraphFullscreen = () => {
  graphFullscreen.value = !graphFullscreen.value;
};

const openPassageFromGraph = (name: string) => {
  selectPassage(name);
  graphRef.value?.close();
};

/* ---------------------------- 内测用户管理 ---------------------------- */
const betaDialogRef = ref<HTMLDialogElement | null>(null);
const betaTesters = ref<IStoryBetaTester[]>([]);
const betaLoading = ref(false);
const betaQuery = ref("");
const betaSearching = ref(false);
const betaResults = ref<UserSummary[]>([]);
const betaAdding = ref<string | null>(null);
const betaRemoving = ref<string | null>(null);
let betaSearchTimer: number | null = null;
let betaSearchSeq = 0;

/** 打开内测用户管理弹窗（仅作者可见） */
async function openBetaDialog() {
  if (!currentStoryId.value) return;
  betaDialogRef.value?.showModal();
  await loadBetaTesters();
}

/** 加载已有内测用户列表 */
async function loadBetaTesters() {
  if (!currentStoryId.value) return;
  betaLoading.value = true;
  try {
    betaTesters.value = await listBetaTesters(currentStoryId.value);
  } catch (e) {
    console.error("[StoryEditor] load beta testers failed", e);
  } finally {
    betaLoading.value = false;
  }
}

/** 搜索输入防抖：停止输入 300ms 后再发起搜索 */
function onBetaQueryInput() {
  if (betaSearchTimer !== null) {
    window.clearTimeout(betaSearchTimer);
  }
  const keyword = betaQuery.value.trim();
  if (!keyword) {
    betaSearchSeq += 1; // 让在途请求的结果失效
    betaResults.value = [];
    betaSearching.value = false;
    return;
  }
  betaSearchTimer = window.setTimeout(() => void searchBetaUsers(), 300);
}

async function searchBetaUsers() {
  const keyword = betaQuery.value.trim();
  if (!keyword) return;
  const seq = ++betaSearchSeq;
  betaSearching.value = true;
  try {
    const users = await searchUsers(keyword);
    if (seq !== betaSearchSeq) return; // 只采纳最新一次搜索的结果
    const testerIds = new Set(betaTesters.value.map((t) => t.id));
    betaResults.value = users.filter((u) => !testerIds.has(u.id));
  } catch (e) {
    if (seq === betaSearchSeq) betaResults.value = [];
    console.error("[StoryEditor] search users failed", e);
  } finally {
    if (seq === betaSearchSeq) betaSearching.value = false;
  }
}

/** 回车：直接添加第一个搜索结果 */
function addFirstBetaResult() {
  const first = betaResults.value[0];
  if (first) void confirmAddBetaTester(first);
}

async function confirmAddBetaTester(user: UserSummary) {
  if (!currentStoryId.value || betaAdding.value) return;
  betaAdding.value = user.id;
  try {
    await addBetaTester(currentStoryId.value, user.id);
    msg.success(`已添加内测用户「${user.nickname || user.username}」`);
    // 添加成功后清空搜索，随即刷新已有内测用户列表
    betaQuery.value = "";
    betaResults.value = [];
    await loadBetaTesters();
  } catch (e) {
    // 失败提示由 http 层统一处理
    console.error("[StoryEditor] add beta tester failed", e);
  } finally {
    betaAdding.value = null;
  }
}

async function confirmRemoveBetaTester(tester: IStoryBetaTester) {
  if (!currentStoryId.value || betaRemoving.value) return;
  const name = tester.nickname || tester.username;
  const confirmed = await msgbox.confirm(
    `确定将「${name}」从内测用户中移除吗？移除后对方将无法再访问未发布的内容。`,
    "移除内测用户",
    { confirmText: "移除", cancelText: "取消" },
  );
  if (!confirmed) return;
  betaRemoving.value = tester.id;
  try {
    await removeBetaTester(currentStoryId.value, tester.id);
    betaTesters.value = betaTesters.value.filter((t) => t.id !== tester.id);
    msg.success(`已移除内测用户「${name}」`);
  } catch (e) {
    console.error("[StoryEditor] remove beta tester failed", e);
  } finally {
    betaRemoving.value = null;
  }
}

/** 弹窗关闭后重置搜索状态，避免下次打开残留旧结果 */
function resetBetaDialog() {
  if (betaSearchTimer !== null) {
    window.clearTimeout(betaSearchTimer);
    betaSearchTimer = null;
  }
  betaSearchSeq += 1;
  betaQuery.value = "";
  betaResults.value = [];
  betaSearching.value = false;
  betaAdding.value = null;
  betaRemoving.value = null;
  betaTesters.value = [];
}

/* ---------------------------- 故事历史发布版本与比对 ---------------------------- */
const storyHistoryModalRef = ref<InstanceType<typeof StoryHistoryModal> | null>(null);

const currentSerializedStory = computed(() => {
  try {
    return serializeStory(story.value);
  } catch (e) {
    console.error("[StoryEditor] serializeStory failed", e);
    return "";
  }
});

function openStoryHistory() {
  if (!currentStoryId.value) return;
  storyHistoryModalRef.value?.showModal();
}

// keep tag editor sync with selected passage
watch(selectedPassage, () => {
  const p = story.value.passages.find((x) => x.name === selectedPassage.value);
  tagEditValue.value = (p?.tags || []).join(", ");
});

// Ensure startPassage remains valid when passages change (add/rename/delete/import)
watch(
  () => story.value.passages.map((p) => p.name),
  (names) => {
    if (
      !story.value.startPassage ||
      !names.includes(story.value.startPassage)
    ) {
      story.value.startPassage = names[0] ?? "Start";
    }
  },
  { immediate: true },
);

const renamePassage = async () => {
  const current = story.value.passages.find(
    (passage) => passage.name === selectedPassage.value,
  );
  if (!current) {
    return;
  }
  const oldName = current.name;
  const nextName = await msgbox.prompt("新段落名：", "重命名", {
    inputValue: current.name,
  });
  if (!nextName || !nextName.trim()) {
    return;
  }
  current.name = nextName.trim();
  selectedPassage.value = current.name;
  if (story.value.startPassage === oldName) {
    story.value.startPassage = current.name;
  }
};

const deletePassage = () => {
  if (story.value.passages.length <= 1) {
    return;
  }
  const toDelete = selectedPassage.value;
  story.value.passages = story.value.passages.filter(
    (passage) => passage.name !== toDelete,
  );
  // if startPassage was deleted, reset it to first
  if (story.value.startPassage === toDelete) {
    story.value.startPassage = story.value.passages[0]?.name ?? "Start";
  }
  selectedPassage.value = story.value.passages[0].name;
};

const tagEditValue = ref("");

const saveTags = () => {
  const p = story.value.passages.find((x) => x.name === selectedPassage.value);
  if (!p) return;
  p.tags = (tagEditValue.value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

const refreshAutoSave = () => {
  stopAutoSave();
  if (props.readOnly || !autoSaveEnabled.value) {
    return;
  }
  startAutoSave(story, currentStoryId, {
    intervalMs: autoSaveInterval.value,
    readOnly: props.readOnly,
    saveInProgressRef: saveInProgress,
    onSaveToServer: async () => {
      // 有 id 的直接定时存档
      await performSave(true);
    },
  });
};

watch(autoSaveEnabled, (val) => {
  try {
    localStorage.setItem(AUTO_SAVE_STORAGE_KEY, String(val));
  } catch {}
  refreshAutoSave();
});

watch(autoSaveInterval, (val) => {
  try {
    localStorage.setItem(AUTO_SAVE_INTERVAL_KEY, String(val));
  } catch {}
  refreshAutoSave();
});

onClickOutside(autoSaveDropdownRef, () => {
  if (autoSaveDropdownRef.value?.open) {
    autoSaveDropdownRef.value.open = false;
  }
});

onMounted(() => {
  // register global Ctrl/Cmd+S to trigger save
  globalKeydownHandler = (e: KeyboardEvent) => {
    try {
      const key = (e as KeyboardEvent).key;
      if ((e.ctrlKey || e.metaKey) && (key === 's' || key === 'S')) {
        e.preventDefault();
        // trigger save (syntax check or server save depending on readOnly)
        // fire asynchronously to avoid blocking the event
        void saveToServer();
      }
    } catch (err) {
      // ignore
    }
  };
  window.addEventListener('keydown', globalKeydownHandler);
  refreshAutoSave();

  // 关闭或刷新网页前检查是否有未保存的更新
  beforeUnloadHandler = (e: BeforeUnloadEvent) => {
    if (hasUnsavedChanges()) {
      e.preventDefault();
      e.returnValue = "当前故事有更新未保存，确定要离开吗？";
      return "当前故事有更新未保存，确定要离开吗？";
    }
  };
  window.addEventListener("beforeunload", beforeUnloadHandler);

  // 页面切入后台时如有未保存更新且开启了自动保存则执行相应存档
  visibilityChangeHandler = () => {
    try {
      if (props.readOnly || !autoSaveEnabled.value) return;
      if (document.visibilityState === "hidden" && hasUnsavedChanges()) {
        if (!currentStoryId.value) {
          saveLocalDraftNow();
        } else {
          void performSave(true);
        }
      }
    } catch {}
  };
  document.addEventListener("visibilitychange", visibilityChangeHandler);

  // if initialStory provided (read-only preview), use it directly
  if (props.initialStory) {
    try {
      const data = props.initialStory;
      currentStoryId.value = data.id;
      persistedShortname.value = data.shortname ?? null;
      const parsed = parseStorySource(data.content);
      const s = {
        ...(data as any),
        tags: normalizeStoryTags((data as any).tags),
        passages: parsed.passages,
      };
      applyStoryToEditor(s);
      updateSnapshot(s);
    } catch {
      // ignore
    }
    return;
  }

  void init();
  maybeAutoStartTour();
});

// 跳转到其他路由页面时阻塞并提示未保存内容
onBeforeRouteLeave(async () => {
  if (hasUnsavedChanges()) {
    const confirmed = await msgbox.confirm(
      "当前故事有更新未保存，离开后未保存的修改可能会丢失，是否确定离开？",
      "未保存的更改",
      {
        confirmText: "离开",
        cancelText: "留下",
      },
    );
    if (!confirmed) {
      return false; // 阻塞路由跳转
    }
  }
});

async function init() {
  const version = ++initVersion;
  currentStoryId.value = null;
  persistedShortname.value = null;

  // load story if id provided
  const sid = (route.params.storyId as string) || null;
  currentStoryId.value = sid;

  if (sid) {
    try {
      const data = (await getStory(sid)) as IStory | null;
      if (version !== initVersion || !data) return;

      const parsed = parseStorySource((data as any).content || "");
      const serverStory = {
        ...(data as any),
        tags: normalizeStoryTags((data as any).tags),
        passages: parsed.passages,
      } as IStory;

      currentStoryId.value = serverStory.id || sid;
      persistedShortname.value = serverStory.shortname ?? null;

      applyStoryToEditor(serverStory);
      updateSnapshot(serverStory);
      return;
    } catch {
      return;
    }
  }

  // 无 ID 的故事，本地存档只针对无 id 的情况
  const restored = await tryRestoreNoIdDraft({ applyStory: applyStoryToEditor });
  if (version !== initVersion) return;

  if (!restored) {
    applyStoryToEditor(createEmptyStory());
    updateSnapshot(story.value);
  }
}

watch(() => route.params.storyId, (newStoryId) => {
  void init();
});

// Define a simple custom mode for our story syntax using simple mode
// tokens: header (:: name), macro ( (set:) (if:) (print:) etc), link [[...]], jsfn (fn: call:), style tag, strings
// Story editor is initialized inside StoryEditorPanel component.

async function initDefaultStory() {
  if (await msgbox.confirm("是否初始化默认故事？将会覆盖当前所有内容！")) {
    story.value = createDefaultStory();
    variables.value = buildInitialVariables(story.value);
    selectedPassage.value =
      story.value.startPassage || story.value.passages[0]?.name || "Start";
    previewPassage.value = selectedPassage.value;
    refreshPreview();
  }
}
</script>

<style scoped>
/* Basic styling for custom CodeMirror tokens */
.cm-s-default .cm-header {
  color: #0f172a;
  font-weight: 600;
}
.cm-s-dracula .cm-header {
  color: #8be9fd;
  font-weight: 600;
}
.cm-header {
  font-weight: 600;
}
.cm-keyword {
  color: #7c3aed;
}
.cm-link {
  color: #0366d6;
  text-decoration: underline;
}
.cm-style-tag {
  color: #b58900;
}
.cm-variable-2 {
  color: #b85252;
}
.cm-string {
  color: #16a34a;
}
.cm-comment {
  color: #6b7280;
  font-style: italic;
}
</style>
