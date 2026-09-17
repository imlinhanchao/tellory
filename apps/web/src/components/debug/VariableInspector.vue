<template>
  <!-- 桌面端：贴右侧边缘的调试面板，收起后变成一条竖标签 -->
  <aside
    v-if="isTest"
    class="pointer-events-none fixed inset-y-0 right-0 z-40 hidden items-center md:flex"
  >
    <button
      v-if="collapsed"
      type="button"
      class="pointer-events-auto flex flex-col items-center gap-2 rounded-l-xl border border-r-0 border-base-300/70 bg-base-100/85 px-2 py-4 shadow-lg backdrop-blur-xl transition-colors hover:bg-base-200/80"
      title="展开变量面板"
      @click="collapsed = false"
    >
      <Icon icon="mdi:code-braces" class="size-4 text-base-content/50" />
      <span
        class="text-[11px] tracking-[0.25em] text-base-content/50 [writing-mode:vertical-rl]"
      >
        变量
      </span>
      <span class="badge badge-xs badge-soft badge-primary font-mono">
        {{ count }}
      </span>
    </button>

    <section
      v-else
      class="pointer-events-auto flex h-[26rem] w-80 flex-col overflow-hidden rounded-l-2xl border border-r-0 border-base-300/70 bg-base-100/85 shadow-2xl backdrop-blur-xl"
    >
      <header class="flex items-center gap-2 border-b border-base-300/50 px-3 py-2.5">
        <span
          class="flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
        >
          <Icon icon="mdi:code-braces" class="size-3.5" />
        </span>
        <h3 class="text-xs font-semibold tracking-wide text-base-content/70">
          变量
        </h3>
        <span class="badge badge-xs badge-soft badge-primary font-mono">
          {{ count }}
        </span>
        <div class="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            class="btn btn-ghost btn-xs btn-square"
            title="复制全部 JSON"
            @click="copyAll"
          >
            <Icon
              :icon="copiedAll ? 'mdi:check' : 'mdi:content-copy'"
              class="size-3.5"
              :class="copiedAll ? 'text-success' : ''"
            />
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-xs btn-square"
            title="收起"
            @click="collapsed = true"
          >
            <Icon icon="mdi:chevron-double-right" class="size-4" />
          </button>
        </div>
      </header>

      <div class="min-h-0 flex-1 overflow-y-auto p-2">
        <VariableList :variables="variables" @view="emit('view', $event)" />
      </div>
    </section>
  </aside>

  <!-- 移动端：右侧抽屉 -->
  <transition name="sheet">
    <div v-if="isTest && drawerOpen" class="fixed inset-0 z-50 md:hidden">
      <div
        class="absolute inset-0 bg-neutral/40 backdrop-blur-sm"
        @click="emit('close-drawer')"
      ></div>

      <div
        class="sheet-panel absolute inset-y-0 right-0 flex w-[86%] max-w-sm flex-col bg-base-100 shadow-2xl"
      >
        <header class="flex items-center gap-2 border-b border-base-300/50 px-4 py-3">
          <span
            class="flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            <Icon icon="mdi:code-braces" class="size-3.5" />
          </span>
          <h3 class="text-sm font-semibold text-base-content/80">变量</h3>
          <span class="badge badge-xs badge-soft badge-primary font-mono">
            {{ count }}
          </span>
          <button
            type="button"
            class="btn btn-ghost btn-xs btn-square ml-auto"
            title="复制全部 JSON"
            @click="copyAll"
          >
            <Icon
              :icon="copiedAll ? 'mdi:check' : 'mdi:content-copy'"
              class="size-4"
              :class="copiedAll ? 'text-success' : ''"
            />
          </button>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto p-3 pb-24">
          <VariableList :variables="variables" @view="emit('view', $event)" />
        </div>
      </div>
    </div>
  </transition>

  <!-- 移动端：右下角浮动开关（同一个按钮切换开/关） -->
  <button
    v-if="isTest"
    type="button"
    class="btn btn-circle btn-lg indicator fixed right-5 bottom-5 z-[60] border-0 shadow-xl md:hidden"
    :class="drawerOpen ? 'btn-neutral' : 'btn-primary'"
    :aria-expanded="drawerOpen"
    :title="drawerOpen ? '关闭变量面板' : '打开变量面板'"
    @click="emit('toggle-drawer')"
  >
    <span
      v-if="count && !drawerOpen"
      class="indicator-item badge badge-sm font-mono"
      :class="drawerOpen ? 'badge-neutral' : 'badge-secondary'"
    >
      {{ count }}
    </span>
    <Icon
      :icon="drawerOpen ? 'mdi:close' : 'mdi:code-braces'"
      class="size-6"
    />
  </button>
</template>

<script setup lang="ts">
import Icon from "@/components/Icon/src/Icon.vue";
import { computed, ref } from "vue";
import VariableList from "./VariableList.vue";

const props = defineProps<{
  isTest: boolean;
  variables: Record<string, any>;
  drawerOpen: boolean;
}>();

const emit = defineEmits<{
  (e: "view", payload: { key: string; value: any }): void;
  (e: "close-drawer"): void;
  (e: "toggle-drawer"): void;
}>();

const collapsed = ref(false);
const copiedAll = ref(false);

const count = computed(() => Object.keys(props.variables ?? {}).length);

async function copyAll() {
  try {
    await navigator.clipboard.writeText(
      JSON.stringify(props.variables ?? {}, null, 2),
    );
    copiedAll.value = true;
    window.setTimeout(() => (copiedAll.value = false), 1200);
  } catch {
    /* 忽略剪贴板不可用的情况 */
  }
}
</script>

<style scoped>
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.2s ease;
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-active .sheet-panel,
.sheet-leave-active .sheet-panel {
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}

.sheet-enter-from .sheet-panel,
.sheet-leave-to .sheet-panel {
  transform: translateX(100%);
}
</style>
