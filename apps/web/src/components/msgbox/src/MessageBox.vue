<template>
  <dialog
    ref="dialogRef"
    class="modal"
    @cancel.prevent="handleCancel"
    @close="handleClose"
  >
    <div
      class="modal-box bg-base-100 text-base-content rounded shadow-lg max-w-lg w-full mx-4"
    >
      <div class="flex items-center justify-between pb-2">
        <div class="text-lg font-bold">{{ title }}</div>
        <button
          type="button"
          class="btn btn-ghost btn-circle btn-sm"
          @click="handleClose"
        >
          ✕
        </button>
      </div>
      <div class="py-4">
        <div v-if="isString && message" class="whitespace-pre-wrap mb-4">
          {{ message }}
        </div>
        <div v-if="!isString">
          <slot />
        </div>
        <input
          v-if="showInput"
          ref="inputRef"
          v-model="internalInputValue"
          :type="inputType"
          :placeholder="inputPlaceholder"
          class="input input-bordered w-full"
          @keyup.enter="handleConfirm"
        />
      </div>
      <div class="pt-2 flex justify-end gap-3">
        <button
          v-if="showCancel"
          type="button"
          class="btn"
          @click="handleCancel"
        >
          {{ cancelText }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          @click="handleConfirm"
        >
          {{ confirmText }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button type="button" @click="handleClose">close</button>
    </form>
  </dialog>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    visible: boolean;
    title: string;
    message: string | object;
    showCancel: boolean;
    confirmText: string;
    cancelText: string;
    showInput?: boolean;
    inputPlaceholder?: string;
    inputValue?: string;
    inputType?: string;
  }>(),
  {
    visible: false,
    title: "提示",
    message: "",
    showCancel: true,
    confirmText: "确定",
    cancelText: "取消",
    showInput: false,
    inputPlaceholder: "",
    inputValue: "",
    inputType: "text",
  },
);

const emit = defineEmits(["confirm", "cancel", "close"]);

const isString = computed(() => typeof props.message === "string");
const internalInputValue = ref(props.inputValue);
const dialogRef = ref<HTMLDialogElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);

function showDialog() {
  if (dialogRef.value && !dialogRef.value.open) {
    try {
      dialogRef.value.showModal();
    } catch (e) {
      console.error("[MessageBox] Failed to showModal:", e);
    }
  }
}

function closeDialog() {
  if (dialogRef.value?.open) {
    try {
      dialogRef.value.close();
    } catch (e) {
      console.error("[MessageBox] Failed to close dialog:", e);
    }
  }
}

onMounted(() => {
  if (props.visible) {
    showDialog();
  }
  if (props.showInput) {
    nextTick(() => {
      inputRef.value?.focus();
    });
  }
});

watch(
  () => props.visible,
  (val) => {
    if (val) {
      showDialog();
    } else {
      closeDialog();
    }
  },
);

watch(
  () => props.inputValue,
  (val) => {
    internalInputValue.value = val;
  },
);

onBeforeUnmount(() => {
  closeDialog();
});

function handleConfirm() {
  emit("confirm", props.showInput ? internalInputValue.value : true);
}

function handleCancel() {
  emit("cancel");
}

function handleClose() {
  emit("close");
}
</script>

<style scoped>
/* Let daisyui/tailwind handle colors */
</style>

