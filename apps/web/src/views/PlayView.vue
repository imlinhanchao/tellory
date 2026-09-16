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
            <span class="icon-[solar--arrow-left-linear] text-sm"></span>
            <span>返回故事</span>
          </button>
          <span v-if="story?.author" class="opacity-60">
            • 作者：{{ authorName }}
          </span>
        </div>

        <div class="flex items-center gap-1">
          <button
            class="btn btn-ghost btn-xs gap-1 hover:text-base-content"
            title="重新开始"
            @click="showRestartConfirm = true"
          >
            <span class="icon-[solar--restart-linear] text-sm"></span>
            <span>{{ isEnding ? '重来' : '重置' }}</span>
          </button>
          <button
            class="btn btn-ghost btn-xs gap-1 hover:text-base-content"
            title="故事详情"
            @click="showDetailModal = true"
          >
            <span class="icon-[solar--info-circle-linear] text-sm"></span>
            <span>简介</span>
          </button>
        </div>
      </div>

      <!-- 故事主卡片 -->
      <article
        class="bg-base-100/90 shadow-sm hover:shadow-md transition-shadow duration-300 rounded-2xl p-6 sm:p-12 border border-base-300/60 min-h-[60vh] flex flex-col justify-between"
      >
        <!-- 正文渲染区 -->
        <div
          ref="contentRef"
          class="story-content prose prose-stone lg:prose-lg max-w-none focus:outline-none"
          v-html="currentHtml"
          @click="onContentClick"
        ></div>

        <!-- 底部微交互/状态指示 -->
        <footer
          class="mt-12 pt-6 border-t border-base-200/80 flex items-center justify-between text-xs text-base-content/40 font-sans"
        >
          <span class="flex items-center gap-1.5">
            <span
              class="inline-block w-1.5 h-1.5 rounded-full bg-success/80 animate-pulse"
            ></span>
            当前章节: {{ play?.passage || play?.currentPassage || "序幕" }}
          </span>
          <div class="flex items-center gap-2 flex-wrap">
            <div class="text-xs text-base-content/50">正在阅读</div>
            <div class="avatar-group -space-x-6">
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
    </main>

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
      class="modal modal-open backdrop-blur-sm bg-base-900/40"
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
      class="modal modal-open backdrop-blur-sm bg-base-900/40"
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
      class="modal modal-open backdrop-blur-sm bg-base-900/40"
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
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from "vue";
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

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const storyId = ref<string>(route.params.storyId.toString() || "");

const story = ref<any>(null);
const play = ref<any>(null);
const currentHtml = ref("");
const showModal = ref<boolean | null>(null);
const showDetailModal = ref(false);
const showRestartConfirm = ref(false);
const showEndUnlockFx = ref(false);
const unlockedEnding = ref<IEndingUnlock | null>(null);
const isEnding = ref(false);

const authorName = computed(
  () =>
    story.value?.author?.nickname || story.value?.author?.username || "佚名",
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
    showModal.value = false;
  } catch (err) {
    console.error("startPlay error", err);
  }
}

async function confirmRestart() {
  showRestartConfirm.value = false;
  const res = await resetPlay(storyId.value);
  play.value = res as any;
  currentHtml.value = res.html || "";
}

function closeModal() {
  showModal.value = false;
  router.push("/stories");
}

const contentRef = ref<HTMLElement>();
onMounted(async () => {
  await loadStory();
  await loadReaders();
  const started = await loadExistingPlay();
  if (started) {
    showModal.value = false;
  } else {
    showModal.value = true;
  }
});

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
    if (res.html) {
      currentHtml.value = res.html;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (res.end) {
      triggerEndingUnlock(res.end);
      isEnding.value = true;
    }
  } catch (err) {
    console.error("[PlayView] interaction update failed", err);
  }
}
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
</style>
