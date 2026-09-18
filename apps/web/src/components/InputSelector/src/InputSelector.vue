<template>
  <div class="relative w-48">
    <div class="relative">
      <input
        v-model="searchQuery"
        @click="showDropdown = true"
        @focus="showDropdown = true"
        @blur="handleBlur"
        :placeholder="placeholder"
        class="input input-sm input-bordered w-full pr-8 font-mono text-xs"
      />
      <button 
        class="btn btn-xs btn-ghost absolute right-0 top-0 h-full px-1" 
        @click="showDropdown = !showDropdown"
      >
        <Icon icon="mdi:chevron-down" class="text-sm opacity-50" />
      </button>
    </div>

    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <ul
        v-if="showDropdown && filtered.length > 0"
        class="menu bg-base-100 shadow-xl rounded-box absolute mt-1 w-full max-h-60 overflow-auto z-50 border border-base-300 p-1"
      >
        <li v-for="name in filtered" :key="name">
          <a 
            class="text-xs py-2 px-3 hover:bg-primary hover:text-primary-content rounded-md" 
            @mousedown.prevent="select(name)"
          >
            {{ name }}
          </a>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Icon from '@/components/Icon/src/Icon.vue';

const props = defineProps<{
  options: string[];
  placeholder?: string;
}>();

const data = defineModel<string>({ required: true });
const searchQuery = ref(data.value);
const emit = defineEmits<{
  (e: 'change', value: string): void;
}>();

watch(data, (val) => {
  searchQuery.value = val;
});

const showDropdown = ref(false);

const filtered = computed(() => {
  const q = searchQuery.value.toLowerCase();
  return props.options.filter(n => n.toLowerCase().includes(q) || searchQuery.value == data.value);
});

function select(name: string) {
  searchQuery.value = name;
  data.value = name;
  emit('change', name);
  showDropdown.value = false;
}

function handleBlur() {
  setTimeout(() => { showDropdown.value = false; }, 200);
}
</script>
