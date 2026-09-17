<template>
  <div>
    <div
      class="flex items-start gap-1.5 rounded-lg px-1.5 py-[3px] transition-colors"
      :class="
        expandable
          ? 'cursor-pointer hover:bg-base-200/70'
          : 'cursor-copy hover:bg-base-200/40'
      "
      @click="onRowClick"
    >
      <Icon
        v-if="expandable"
        :icon="open ? 'mdi:chevron-down' : 'mdi:chevron-right'"
        class="mt-[3px] size-3.5 shrink-0 text-base-content/35"
      />
      <span v-else class="mt-[3px] size-3.5 shrink-0"></span>

      <span class="min-w-0 flex-1 break-all leading-5">
        <template v-if="label !== undefined">
          <span class="text-base-content/50">{{ label }}</span>
          <span class="px-1 text-base-content/25">:</span>
        </template>
        <span v-if="expandable" class="text-base-content/35">
          {{ open ? brackets[0] : summary }}
        </span>
        <span v-else :class="valueClass">{{ display }}</span>
      </span>

      <Icon
        v-if="!expandable"
        :icon="copied ? 'mdi:check' : 'mdi:content-copy'"
        class="mt-[3px] size-3.5 shrink-0 transition-opacity"
        :class="
          copied
            ? 'text-success opacity-70'
            : 'text-base-content opacity-0 group-hover:opacity-50'
        "
      />
    </div>

    <template v-if="expandable && open">
      <div class="ml-[0.7rem] border-l border-base-300/60 pl-1">
        <JsonNode
          v-for="child in entries"
          :key="child.key"
          :label="child.key"
          :value="child.value"
          :depth="depth + 1"
          :default-open-depth="defaultOpenDepth"
        />
      </div>
      <div class="py-[3px] pl-[1.7rem] text-base-content/30">
        {{ brackets[1] }}
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import Icon from "@/components/Icon/src/Icon.vue";
import { computed, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    value: unknown;
    label?: string | number;
    depth?: number;
    defaultOpenDepth?: number;
  }>(),
  { depth: 0, defaultOpenDepth: 1 },
);

const copied = ref(false);

const isArray = computed(() => Array.isArray(props.value));
const expandable = computed(
  () => props.value !== null && typeof props.value === "object",
);
const entries = computed(() =>
  Object.entries(props.value as Record<string, unknown> ?? {}).map(
    ([key, value]) => ({ key, value }),
  ),
);
const brackets = computed(() =>
  isArray.value ? (["[", "]"] as const) : (["{", "}"] as const),
);
const summary = computed(
  () => `${brackets.value[0]} ${entries.value.length} 项 ${brackets.value[1]}`,
);

const display = computed(() => {
  const v = props.value;
  if (typeof v === "string") return JSON.stringify(v) ?? '""';
  if (v === undefined) return "undefined";
  return String(v);
});

const valueClass = computed(() => {
  switch (typeof props.value) {
    case "string":
      return "text-success";
    case "number":
      return "text-info";
    case "boolean":
      return "text-warning";
    default:
      return "text-base-content/35";
  }
});

const open = ref(props.depth < props.defaultOpenDepth);

watch(
  () => props.value,
  () => {
    open.value = props.depth < props.defaultOpenDepth;
  },
);

async function copyValue() {
  const raw =
    typeof props.value === "string" ? props.value : JSON.stringify(props.value);
  try {
    await navigator.clipboard.writeText(raw ?? String(props.value));
    copied.value = true;
    window.setTimeout(() => (copied.value = false), 1200);
  } catch {
    /* 忽略剪贴板不可用的情况 */
  }
}

function onRowClick() {
  if (expandable.value) {
    open.value = !open.value;
    return;
  }
  void copyValue();
}
</script>
