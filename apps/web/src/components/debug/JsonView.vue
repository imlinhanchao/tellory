<template>
  <div class="font-mono text-xs leading-5 text-base-content">
    <JsonNode
      v-for="child in entries"
      :key="child.key"
      :label="child.key"
      :value="child.value"
      :depth="1"
      :default-open-depth="defaultOpenDepth + 1"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import JsonNode from "./JsonNode.vue";

const props = withDefaults(
  defineProps<{ data: unknown; defaultOpenDepth?: number }>(),
  { defaultOpenDepth: 1 },
);

const entries = computed(() =>
  Object.entries((props.data as Record<string, unknown>) ?? {}).map(
    ([key, value]) => ({ key, value }),
  ),
);
</script>
