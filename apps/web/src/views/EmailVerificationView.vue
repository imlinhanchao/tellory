<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="card w-full max-w-md bg-base-100 shadow-xl border border-base-200 p-8 text-center">
      <div v-if="loading" class="py-8">
        <span class="loading loading-spinner loading-lg text-primary"></span>
        <h2 class="text-xl font-bold mt-4">正在验证</h2>
        <p class="text-base-content/60 mt-2">请稍候，正在处理您的验证请求...</p>
      </div>
      <div v-else>
        <div v-if="success" class="py-4">
          <div class="w-20 h-20 bg-success/20 text-success rounded-full flex items-center justify-center mx-auto mb-6">
            <Icon icon="mdi:check-circle" class="w-10 h-10" />
          </div>
          <h2 class="text-2xl font-bold">验证成功</h2>
          <p class="text-base-content/60 mt-2">您的邮箱已成功激活，现在可以享受完整功能了。</p>
          <div class="mt-8">
            <router-link :to="profilePath" class="btn btn-primary w-full rounded-xl">返回个人主页</router-link>
          </div>
        </div>
        <div v-else class="py-4">
          <div class="w-20 h-20 bg-error/20 text-error rounded-full flex items-center justify-center mx-auto mb-6">
            <Icon icon="mdi:alert-circle" class="w-10 h-10" />
          </div>
          <h2 class="text-2xl font-bold">验证失败</h2>
          <p class="text-base-content/60 mt-2">{{ errorMsg || '验证链接无效或已过期。' }}</p>
          <div class="mt-8">
            <router-link to="/" class="btn btn-ghost w-full rounded-xl">返回首页</router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { Icon } from '@iconify/vue';
import request from '@/utils/http';

const route = useRoute();
const loading = ref(true);
const success = ref(false);
const errorMsg = ref('');

const username = (route.params.username as string) || '';
const profilePath = username ? `/${username}` : '/';

onMounted(async () => {
  const token = String(route.query.token || '');
  if (!token) {
    errorMsg.value = '缺少验证 Token';
    loading.value = false;
    return;
  }

  try {
    await request.post({ url: '/auth/verification', data: { token } });
    success.value = true;
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.message || err?.message || '验证失败';
  } finally {
    loading.value = false;
  }
});
</script>
