<template>
  <InlineTooltip v-if="tip" :text="tooltipText">
    <component :is="link ? RouterLink : 'span'" :to="link ? userLink : undefined">
      <div class="avatar rounded-full overflow-clip" :class="shrinkClass" :style="containerStyle">
        <div
          v-if="!displayAvatar"
          :class="fallbackClass"
          :style="fallbackStyle"
        >
          {{ initials }}
        </div>
        <img
          v-else
          :src="displayAvatar"
          :alt="userAlt"
          :style="imgStyle"
          class="rounded-full object-cover"
        />
      </div>
    </component>
  </InlineTooltip>
  <template v-else>
    <component :is="link ? RouterLink : 'span'" :to="link ? userLink : undefined">
      <div class="avatar rounded-full overflow-clip" :class="shrinkClass" :style="containerStyle">
        <div
          v-if="!displayAvatar"
          :class="fallbackClass"
          :style="fallbackStyle"
        >
          {{ initials }}
        </div>
        <img
          v-else
          :src="displayAvatar"
          :alt="userAlt"
          :style="imgStyle"
          class="rounded-full object-cover"
        />
      </div>
    </component>
  </template>
</template>

<script setup lang="ts">
import { computed, toRef } from "vue";
import InlineTooltip from "@/components/InlineTooltip";
import { RouterLink } from "vue-router";
import md5 from "crypto-js/md5";

interface IUser {
  avatar?: string;
  nickname?: string;
  username?: string;
  from?: string;
  email?: string;
}

const props = defineProps<{
  user?: IUser | null;
  size?: number;
  shrink?: boolean;
  tip?: boolean;
  link?: boolean;
}>();

const user = toRef(props, "user");
const size = computed(() => props.size ?? 40);
const shrinkClass = computed(() => (props.shrink ? "shrink-0" : ""));
const tip = computed(() => !!props.tip);
const link = computed(() => !!props.link);

const initials = computed(() => {
  const name = user.value?.nickname || user.value?.username || "";
  if (!name) return "U";
  return String(name).trim().slice(0, 1).toUpperCase();
});

const userAlt = computed(() => user.value?.nickname || user.value?.username || "avatar");
const tooltipText = computed(() => user.value?.nickname || user.value?.username || "");

const containerStyle = computed(() => ({ width: `${size.value}px`, height: `${size.value}px` }));
const imgStyle = computed(() => ({ width: `${size.value}px`, height: `${size.value}px` }));
const fallbackStyle = computed(() => ({ width: `${size.value}px`, height: `${size.value}px`, fontSize: `${Math.max(12, Math.floor(size.value / 2.5))}px` }));
const fallbackClass = computed(() => "rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-bold border border-primary/20");

const userLink = computed(() => {
  const from = user.value?.from;
  const username = user.value?.username;
  if (from && username) return `/${from}/${username}`;
  return `/${username}`;
});

const cravatarUrl = computed(() => {
  const email = user.value?.email;
  if (email) {
    const hash = md5(String(email).trim().toLowerCase()).toString();
    return `https://cravatar.cn/avatar/${hash}?d=mp&s=${size.value}`;
  }
  return null;
});

const displayAvatar = computed(() => user.value?.avatar || cravatarUrl.value || null);
</script>

<style scoped>
.avatar { display: inline-block; }
</style>
