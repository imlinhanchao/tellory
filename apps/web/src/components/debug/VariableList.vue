<template>
  <div class="flex min-h-0 flex-col">
    <label
      v-if="entries.length >= 5"
      class="input input-xs input-ghost mb-2 w-full gap-1.5 rounded-lg bg-base-200/60"
    >
      <Icon icon="mdi:magnify" class="size-3.5 shrink-0 text-base-content/40" />
      <input v-model="keyword" type="text" placeholder="搜索变量" class="grow" />
    </label>

    <div
      v-if="!entries.length"
      class="flex flex-col items-center gap-2 py-10 text-base-content/30"
    >
      <Icon icon="mdi:code-braces" class="size-6" />
      <p class="text-xs">暂无变量</p>
    </div>

    <p
      v-else-if="!rows.length"
      class="py-8 text-center text-xs text-base-content/30"
    >
      没有匹配的变量
    </p>

    <ul v-else class="flex flex-col gap-0.5">
      <li v-for="row in rows" :key="row.key" class="border-b border-base-content/10">
        <button
          type="button"
          class="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-base-200/70"
          @click="onRowClick(row)"
        >
          <span class="flex min-w-0 flex-1 justify-between">
            <span
              class="truncate font-mono text-[11px] leading-4 text-base-content/50"
            >
              {{ row.key }}
            </span>
            <span
              class="truncate font-mono text-xs leading-5"
              :class="row.valueClass"
            >
              {{ row.preview }}
            </span>
          </span>

          <span
            v-if="row.expandable"
            class="badge badge-xs badge-ghost shrink-0 font-mono text-[10px] text-base-content/45"
          >
            {{ row.typeLabel }}
          </span>

          <Icon
            :icon="
              row.expandable
                ? 'mdi:chevron-right'
                : copiedKey === row.key
                  ? 'mdi:check'
                  : 'mdi:content-copy'
            "
            class="size-3.5 shrink-0 transition-opacity"
            :class="
              row.expandable
                ? 'text-base-content/25 group-hover:text-base-content/60'
                : copiedKey === row.key
                  ? 'text-success opacity-80'
                  : 'text-base-content/40 opacity-0 group-hover:opacity-100'
            "
          />
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import Icon from "@/components/Icon/src/Icon.vue";
import { computed, ref } from "vue";

const props = defineProps<{ variables: Record<string, any> }>();

const emit = defineEmits<{
  (e: "view", payload: { key: string; value: any }): void;
}>();

const keyword = ref("");
const copiedKey = ref<string | null>(null);

const entries = computed(() =>
  Object.entries(props.variables ?? {}).map(([key, value]) => ({ key, value })),
);

const rows = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  return entries.value
    .filter((e) => !kw || e.key.toLowerCase().includes(kw))
    .map((e) => ({
      ...e,
      ...describe(e.value),
    }));
});

/** 值的类型描述：预览文本、配色、是否可展开 */
function describe(value: any) {
  if (Array.isArray(value)) {
    return {
      expandable: true,
      typeLabel: `arr · ${value.length}`,
      preview:
        value.length && value.every((v) => v === null || typeof v !== "object")
          ? JSON.stringify(value).slice(0, 60)
          : "[ ]",
      valueClass: "text-base-content/40",
    };
  }
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value);
    const shown = keys.slice(0, 3).join(", ");
    return {
      expandable: true,
      typeLabel: `obj · ${keys.length}`,
      preview: keys.length ? `{ ${shown}${keys.length > 3 ? ", …" : ""} }` : "{ }",
      valueClass: "text-base-content/40",
    };
  }
  if (value === null || value === undefined) {
    return {
      expandable: false,
      typeLabel: "",
      preview: String(value),
      valueClass: "text-base-content/30 italic",
    };
  }
  if (typeof value === "string") {
    return {
      expandable: false,
      typeLabel: "",
      preview: JSON.stringify(value),
      valueClass: "text-success",
    };
  }
  if (typeof value === "number") {
    return {
      expandable: false,
      typeLabel: "",
      preview: String(value),
      valueClass: "text-info",
    };
  }
  return {
    expandable: false,
    typeLabel: "",
    preview: String(value),
    valueClass: "text-warning",
  };
}

function onRowClick(row: { key: string; value: any; expandable: boolean }) {
  if (row.expandable) {
    emit("view", { key: row.key, value: row.value });
    return;
  }
  void copy(row);
}

async function copy(row: { key: string; value: any }) {
  const raw = typeof row.value === "string" ? row.value : String(row.value);
  try {
    await navigator.clipboard.writeText(raw);
    copiedKey.value = row.key;
    window.setTimeout(() => {
      if (copiedKey.value === row.key) copiedKey.value = null;
    }, 1200);
  } catch {
    /* 忽略剪贴板不可用的情况 */
  }
}
</script>
