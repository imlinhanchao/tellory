<template>
  <dialog
    ref="dialogRef"
    class="modal"
    @cancel="onDialogCancel"
    @close="onDialogClose"
  >
    <div
      class="modal-box w-11/12 max-w-6xl max-h-[92vh] flex flex-col p-4 sm:p-6 bg-base-100 text-base-content rounded-2xl shadow-xl overflow-hidden"
    >
      <!-- 弹窗顶栏 -->
      <div class="flex items-center justify-between pb-3 border-b border-base-200 shrink-0">
        <div class="flex items-center gap-2.5">
          <div
            class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"
          >
            <Icon icon="mdi:compare" class="w-5 h-5" />
          </div>
          <div>
            <h3 class="font-bold text-base sm:text-lg text-base-content">
              {{ title || "故事版本差异比对" }}
            </h3>
            <p v-if="subtitle" class="text-xs text-base-content/60">
              {{ subtitle }}
            </p>
          </div>
        </div>

        <button
          type="button"
          class="btn btn-sm btn-circle btn-ghost"
          @click="close"
        >
          ✕
        </button>
      </div>

      <!-- 弹窗主体内容滚动区 -->
      <div class="flex-1 overflow-y-auto py-4 pr-1">
        <div v-if="loading" class="py-16 text-center">
          <span class="loading loading-spinner loading-lg text-primary"></span>
          <p class="text-xs text-base-content/60 mt-3">正在解析比对内容…</p>
        </div>

        <StoryDiffViewer
          v-else
          :old-content="oldContent"
          :new-content="newContent"
          :old-label="oldLabel"
          :new-label="newLabel"
          :old-meta="oldMeta"
          :new-meta="newMeta"
        />
      </div>

      <!-- 弹窗底部操作栏 -->
      <div class="pt-3 border-t border-base-200 flex items-center justify-between shrink-0">
        <div class="text-xs text-base-content/50">
          按 ESC 键或点击外部可关闭
        </div>
        <button type="button" class="btn btn-sm btn-ghost" @click="close">
          关闭
        </button>
      </div>
    </div>

    <!-- 背景遮罩 -->
    <form method="dialog" class="modal-backdrop">
      <button type="button" @click="close">close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { Icon } from "@iconify/vue";
import StoryDiffViewer from "./StoryDiffViewer.vue";

export interface StoryDiffModalOptions {
  title?: string;
  subtitle?: string;
  oldContent: string;
  newContent: string;
  oldLabel?: string;
  newLabel?: string;
  oldMeta?: string;
  newMeta?: string;
}

const dialogRef = ref<HTMLDialogElement | null>(null);
const loading = ref(false);

const title = ref("故事版本差异比对");
const subtitle = ref("");
const oldContent = ref("");
const newContent = ref("");
const oldLabel = ref("旧版本");
const newLabel = ref("新版本");
const oldMeta = ref("");
const newMeta = ref("");

const emit = defineEmits(["close"]);

function showModal(options: StoryDiffModalOptions) {
  title.value = options.title || "故事版本差异比对";
  subtitle.value = options.subtitle || "";
  oldContent.value = options.oldContent || "";
  newContent.value = options.newContent || "";
  oldLabel.value = options.oldLabel || "旧版本";
  newLabel.value = options.newLabel || "新版本";
  oldMeta.value = options.oldMeta || "";
  newMeta.value = options.newMeta || "";
  loading.value = false;

  if (dialogRef.value && !dialogRef.value.open) {
    dialogRef.value.showModal();
  }
}

function close() {
  if (dialogRef.value?.open) {
    dialogRef.value.close();
  }
}

function onDialogClose() {
  emit("close");
}

function onDialogCancel() {
  close();
}

defineExpose({
  showModal,
  close,
});
</script>
