<template>
  <div v-if="userInfo" class="p-4 sm:p-8 max-w-5xl w-full mx-auto space-y-8">
    <div class="bg-base-100 p-8 rounded-3xl border border-base-200 shadow-sm flex flex-col md:flex-row gap-8 items-start">
      <div class="relative">
        <Avatar :user="userInfo" :size="120" class="ring-4 ring-base-200" />
        <div v-if="isCurrentUser && userInfo?.email && !userInfo?.from" class="absolute -bottom-2 -right-2">
          <a :href="cravatarHome" target="_blank" class="btn btn-circle btn-sm btn-primary shadow-lg tooltip tooltip-bottom" data-tip="前往 Cravatar 更换头像">
            <Icon icon="mdi:pencil" />
          </a>
        </div>
      </div>
      <div class="flex-1 space-y-4">
        <div class="flex items-center gap-3">
          <h2 class="text-3xl font-black">{{ userInfo?.nickname || userInfo?.username }}</h2>
          <span v-if="userInfo?.nickname && userInfo?.username" class="text-sm text-base-content/50 font-mono">
            @{{ userInfo.username }}
          </span>
          <button
            v-if="isCurrentUser"
            class="btn btn-circle btn-ghost btn-sm tooltip tooltip-right"
            data-tip="编辑资料"
            @click="openEditModal"
          >
            <Icon icon="mdi:pencil" class="text-lg" />
          </button>
        </div>

        <template v-if="isCurrentUser">
          <div v-if="userInfo?.email" class="text-sm text-base-content/70 flex items-center gap-2">
            <Icon icon="mdi:email-outline" />
            <span>{{ userInfo.email }}</span>
            <span v-if="userInfo.isVerified" class="badge badge-xs badge-success gap-0.5">
              <Icon icon="mdi:check" class="text-xs" /> 已验证
            </span>
            <span v-else class="badge badge-xs badge-warning gap-0.5">
              <Icon icon="mdi:alert-circle-outline" class="text-xs" /> 未激活
            </span>
          </div>
        </template>

        <div class="flex gap-6 text-base-content/70">
          <div class="flex items-center gap-2"><Icon icon="mdi:book-edit" /> {{ totalCount }} 篇创作</div>
          <div class="flex items-center gap-2"><Icon icon="mdi:book-open-page-variant" /> {{ progress.length }} 篇阅读</div>
        </div>
        <div v-if="isCurrentUser && !userInfo.isVerified && userInfo?.email" class="flex gap-2">
          <button class="btn btn-sm btn-outline btn-warning" :disabled="sendingVerify" @click="resendVerification">
            <Icon v-if="!sendingVerify" icon="mdi:email-send" />
            {{ sendingVerify ? '发送中...' : '重新发送激活邮件' }}
          </button>
        </div>
      </div>
      <div v-if="isCurrentUser" class="md:ml-auto">
        <button class="btn btn-ghost btn-sm text-error" @click="logout">
          <Icon icon="mdi:logout" /> 退出登录
        </button>
      </div>
    </div>

    <div v-if="loading" class="text-center py-12">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <div v-else>
      <div class="flex justify-center mb-8">
        <div class="tabs tabs-boxed bg-base-200/50 p-1 rounded-full">
          <a
            class="tab tab-lg rounded-full px-8 transition-all duration-300"
            :class="{ 'tab-active bg-base-100 shadow-sm': activeTab === 'stories' }"
            @click="activeTab = 'stories'"
          >
            发布的故事
          </a>
          <a
            class="tab tab-lg rounded-full px-8 transition-all duration-300"
            :class="{ 'tab-active bg-base-100 shadow-sm': activeTab === 'progress' }"
            @click="activeTab = 'progress'"
          >
            阅读记录
          </a>
        </div>
      </div>

      <div v-if="activeTab === 'progress'" class="animate-in fade-in duration-500">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="p in progress"
            :key="p.id"
            class="group bg-base-100 border border-base-200 p-6 rounded-2xl hover:border-primary/30 transition-all shadow-sm hover:shadow-md flex flex-col"
          >
            <div class="flex justify-between items-start">
              <h4 class="font-bold text-lg truncate flex items-center gap-2">
                {{ p.title }}
                <button class="btn btn-ghost btn-xs" @click="previewStory(progressRouteKey(p), p.status)">
                  <Icon icon="mdi:book-open-variant" />
                </button>
              </h4>
              <span class="badge badge-sm" :class="p.isPlaying ? 'badge-primary' : 'badge-ghost'">
                {{ p.isPlaying ? "正在阅读" : "已读" }}
              </span>
            </div>
            <p class="text-sm text-base-content/60 line-clamp-2 mt-3 flex-1">
              {{ p.description || "暂无描述" }}
            </p>
            <div class="mt-6 space-y-3">
              <div class="flex items-center justify-between text-sm">
                <span class="text-base-content/60 font-medium">解锁进度</span>
                <span class="font-bold text-primary">{{ getCombinedProgress(p).percent || 0 }}%</span>
              </div>
              <progress
                v-if="p.pointSize || p.endSize"
                class="progress progress-primary w-full h-2 bg-base-200"
                :value="getCombinedProgress(p).percent || 0"
                max="100"
              ></progress>
              <div class="flex gap-2">
                <button
                  v-if="p.pointSize"
                  class="badge badge-soft badge-xs badge-warning p-3 cursor-pointer rounded-lg flex-1"
                  @click="openUnlockModal(p, 'points')"
                >
                  <Icon icon="mdi:star" class="mr-1" />
                  成就 {{ (p.points || []).length }} / {{ p.pointSize || 0 }}
                </button>
                <button
                  v-if="p.endSize"
                  class="badge badge-soft badge-xs badge-success p-3 cursor-pointer rounded-lg flex-1"
                  @click="openUnlockModal(p, 'endings')"
                >
                <Icon icon="boxicons:flag-chequered" class="mr-1" />
                  结局 {{ (p.end || []).length }} / {{ p.endSize || 0 }}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div v-if="!progress.length" class="text-center text-base-content/50 py-16">
          暂无阅读记录
        </div>
      </div>

      <div v-if="activeTab === 'stories'" class="animate-in fade-in duration-500">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="s in stories"
            :key="s.id"
            class="card bg-base-100 border border-base-200 p-5 rounded-2xl hover:shadow-lg transition-all"
          >
            <div class="flex flex-col h-full">
              <div class="flex-1">
                <div class="flex items-start justify-between gap-2">
                  <h4 class="font-bold text-lg truncate flex items-center gap-2">
                {{ s.title }}
                <button class="btn btn-ghost btn-xs" @click="previewStory(storyRouteKey(s), s.status)">
                  <Icon icon="mdi:book-open-variant" />
                </button>
              </h4>
                  <div v-if="isCurrentUser" class="shrink-0">
                    <span class="badge badge-sm" :class="statusClass(s.status)">{{
                      statusLabel(s.status)
                    }}</span>
                  </div>
                </div>
                <p class="text-sm text-base-content/60 line-clamp-2 mt-3">
                  {{ s.description || "暂无描述" }}
                </p>
              </div>
              <div
                class="mt-6 flex items-center justify-between text-sm text-base-content/50"
              >
                <div class="flex items-center gap-2">
                  <Icon icon="mdi:book-open-variant" class="w-4 h-4" />
                  <span>{{ s.passageSize || 0 }} 章</span>
                </div>
                <div class="flex gap-2">
                  <button
                    v-if="isCurrentUser"
                    class="btn btn-ghost btn-xs"
                    @click="editStory(storyRouteKey(s))"
                  >
                    编辑
                  </button>
                  <button
                    class="btn btn-primary btn-xs rounded-full px-4"
                    @click="previewStory(storyRouteKey(s), s.status)"
                  >
                    阅读
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="!stories.length" class="text-center text-base-content/50 py-16">
          暂无发布的故事
        </div>
      </div>
    </div>
  </div>

  <dialog ref="unlockModalRef" class="modal">
    <div class="modal-box max-w-3xl w-full">
      <h3 class="text-lg font-bold">{{ unlockModalData.title || '解锁项' }}</h3>
      <div class="py-4">

        <div class="bg-base-200/30 p-4 rounded-2xl">
          <div class="flex items-center justify-between mb-2 text-sm">
            <span class="font-medium text-base-content/70">总解锁进度</span>
            <span class="font-bold text-primary">{{ getCombinedProgress(unlockModalData).percent || 0 }}%</span>
          </div>
          <progress
            class="progress progress-primary w-full h-2 bg-base-300"
            :value="getCombinedProgress(unlockModalData).percent || 0"
            max="100"
          ></progress>
        </div>

        <div class="tabs tabs-boxed bg-base-200/50 p-1 mb-4">
          <a
            v-if="unlockModalData.pointSize != null && unlockModalData.pointSize > 0"
            :class="['tab flex-1', unlockActiveTab === 'points' ? 'tab-active bg-base-100 shadow-sm' : '']"
            @click.prevent="unlockActiveTab = 'points'"
          >
            成就 {{ (unlockModalData.points || []).length }} / {{ unlockModalData.pointSize }}
          </a>
          <a
            v-if="unlockModalData.endSize != null && unlockModalData.endSize > 0"
            :class="['tab flex-1', unlockActiveTab === 'endings' ? 'tab-active bg-base-100 shadow-sm' : '']"
            @click.prevent="unlockActiveTab = 'endings'"
          >
            结局 {{ (unlockModalData.end || []).length }} / {{ unlockModalData.endSize }}
          </a>
        </div>
        <div class="py-3">
          <div v-if="unlockActiveTab === 'points'">
            <div v-if="!(unlockModalData.points||[]).length" class="text-center text-base-content/50 py-6">暂无已解锁成就</div>
            <div v-else class="grid gap-2">
              <div v-for="pt in unlockModalData.points" :key="pt.name" class="flex items-start gap-3 p-3 rounded-xl border border-base-200 bg-base-100 hover:border-primary/30 transition-colors">
                <div class="text-xl text-primary mt-0.5"><Icon icon="mdi:star" /></div>
                <div>
                  <div class="font-bold">{{ pt.name }}</div>
                  <div class="text-sm text-base-content/60">{{ pt.description }}</div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="unlockActiveTab === 'endings'">
            <div v-if="!(unlockModalData.end||[]).length" class="text-center text-base-content/50 py-6">暂无已解锁结局</div>
            <div v-else class="grid gap-2">
              <div v-for="en in unlockModalData.end" :key="en.name" class="flex items-start gap-3 p-3 rounded-xl border border-base-200 bg-base-100 hover:border-accent/30 transition-colors">
                <div class="text-xl text-accent mt-0.5"><Icon icon="boxicons:flag-chequered" /></div>
                <div>
                  <div class="font-bold">{{ en.name }}</div>
                  <div class="text-sm text-base-content/60">{{ en.description }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-action">
        <button class="btn btn-ghost" type="button" @click="closeUnlockModal">关闭</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button type="submit">close</button>
    </form>
  </dialog>

  <!-- 编辑资料弹窗 -->
  <dialog ref="editProfileModalRef" class="modal">
    <div class="modal-box max-w-120 w-full">
      <h3 class="text-lg font-bold mb-4">编辑个人资料</h3>

      <form @submit.prevent="handleSaveProfile" class="space-y-4">
        <div class="form-control">
          <label class="label">
            <span class="label-text font-medium">用户名</span>
          </label>
          <input
            :value="userInfo?.username"
            type="text"
            class="input input-bordered w-full bg-base-200 cursor-not-allowed opacity-75"
            disabled
          />
          <label class="label">
            <span class="px-1 label-text-alt text-xs text-base-content/50">* 用户名不可更改</span>
          </label>
        </div>

        <div class="form-control">
          <label class="label">
            <span class="label-text font-medium">昵称</span>
          </label>
          <input
            v-model="editForm.nickname"
            type="text"
            placeholder="请输入昵称"
            class="input input-bordered w-full"
            maxlength="30"
          />
        </div>

        <div class="form-control">
          <label class="label">
            <span class="label-text font-medium">邮箱地址</span>
          </label>
          <input
            v-model="editForm.email"
            type="email"
            placeholder="请输入邮箱地址"
            class="input input-bordered w-full"
          />
          <label class="label">
            <span class="label-text-alt text-warning">
              若修改邮箱，需重新验证；一小时内仅能发送一次验证邮件。
            </span>
          </label>
        </div>

        <div class="modal-action">
          <button class="btn btn-ghost" type="button" @click="closeEditModal">取消</button>
          <button class="btn btn-primary" type="submit" :disabled="savingProfile">
            <span v-if="savingProfile" class="loading loading-spinner loading-xs"></span>
            {{ savingProfile ? '保存中...' : '保存' }}
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button type="button" @click="closeEditModal">close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import md5 from "crypto-js/md5";
import { useRoute, useRouter } from "vue-router";
import { listStories, type IStory } from "@/api/stories";
import { getUserUnlocks, type IUserStoryProgress } from "@/api/play";
import { updateProfile } from "@/api/user";
import { storyRouteKey } from "@/lib/storyRoute";
import { useAuthStore } from "@/stores/modules/auth";
import { Icon } from "@iconify/vue";
import request from "@/utils/http";
import msg from "@/components/msg";
import { User } from "@/api/auth";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const paramFrom = computed(() => route.params.from as string | undefined);
const paramUsername = computed(() => route.params.username as string | undefined);
const stories = ref<IStory[]>([]);
const progress = ref<IUserStoryProgress[]>([]);
const activeTab = ref<"stories" | "progress">(
  stories.value.length > 0 ? "stories" : "progress"
);
const totalCount = ref(0);
const loading = ref(true);
const userInfo = ref<User>();

const isCurrentUser = computed(() => auth.getUser?.id === userInfo.value?.id);
const cravatarHash = computed(() => {
  const email = userInfo.value?.email;
  if (!email) return null;
  return md5(String(email).trim().toLowerCase()).toString();
});
const cravatarHome = "https://cravatar.cn/";

// Unlocks modal state
const unlockModalRef = ref<HTMLDialogElement | null>(null);
const unlockModalData = ref<{
  title?: string;
  points: { name: string; description: string }[];
  end: { name: string; description: string }[];
  pointSize?: number | null;
  endSize?: number | null;
}>({ points: [], end: [] });
const unlockActiveTab = ref<'points'|'endings'>('points');

function openUnlockModal(p: any, tab: 'points'|'endings' = 'points') {
  unlockModalData.value = {
    title: p.title,
    points: p.points || [],
    end: p.end || [],
    pointSize: p.pointSize ?? null,
    endSize: p.endSize ?? null,
  };
  unlockActiveTab.value = tab;
  const dlg = unlockModalRef.value;
  if (dlg && !dlg.open) dlg.showModal();
}

function closeUnlockModal() {
  const dlg = unlockModalRef.value;
  if (dlg && dlg.open) dlg.close();
}

function getCombinedProgress(p: any) {
  const unlocked = (p.points || []).length + (p.end || []).length;
  if (p.pointSize == null || p.endSize == null) return { unlocked, total: null, percent: null };
  const total = (Number(p.pointSize) || 0) + (Number(p.endSize) || 0);
  if (total <= 0) return { unlocked, total, percent: null };
  const percent = Math.round((unlocked / total) * 100);
  return { unlocked, total, percent };
}

const load = async () => {
  const currentUsername = paramUsername.value;
  const currentFrom = paramFrom.value;
  if (!currentUsername) return;

  loading.value = true;
  try {
    const userPath = currentFrom
      ? `/users/${currentFrom}/${currentUsername}`
      : `/users/${currentUsername}`;
    const user = await request.get<any>({ url: userPath });
    if (user) {
      userInfo.value = user;
      const [res, prog] = await Promise.all([
        listStories({ authorId: userInfo.value!.id }),
        getUserUnlocks(userInfo.value!.id),
      ]);
      const storiesRes = res.data || [];
      stories.value = storiesRes;
      progress.value = prog || [];
      totalCount.value = res.total || storiesRes.length;
      activeTab.value = storiesRes.length > 0 ? "stories" : "progress";
    }
  } finally {
    loading.value = false;
  }
};

const sendingVerify = ref(false);
async function resendVerification() {
  if (!userInfo.value?.email) return msg.error('用户无邮箱');
  sendingVerify.value = true;
  try {
    await request.post({ url: '/auth/resend-verification', data: { email: userInfo.value.email } });
    msg.success('已发送激活邮件，请查收');
  } catch (e: any) {
    msg.error(e?.response?.data?.message || e?.message || '发送失败');
  } finally {
    sendingVerify.value = false;
  }
}

// Edit Profile Modal
const editProfileModalRef = ref<HTMLDialogElement | null>(null);
const editForm = ref({
  nickname: "",
  email: "",
});
const savingProfile = ref(false);

function openEditModal() {
  editForm.value = {
    nickname: userInfo.value?.nickname || "",
    email: userInfo.value?.email || "",
  };
  editProfileModalRef.value?.showModal();
}

function closeEditModal() {
  editProfileModalRef.value?.close();
}

async function handleSaveProfile() {
  if (savingProfile.value) return;
  savingProfile.value = true;
  try {
    const originalEmail = (userInfo.value?.email || "").trim();
    const newEmail = (editForm.value.email || "").trim();
    const emailChanged = newEmail !== originalEmail;

    const res = await updateProfile({
      nickname: editForm.value.nickname,
      email: editForm.value.email,
    });

    if (res) {
      userInfo.value = {
        ...userInfo.value,
        ...res,
        isVerified: !!res.isVerified,
      } as User;
      auth.patchUser({
        nickname: res.nickname,
        email: res.email,
        isVerified: res.isVerified,
      });

      if (emailChanged && newEmail) {
        msg.success("资料更新成功！已向新邮箱发送验证邮件，请前往邮箱查收并激活。");
      } else {
        msg.success("资料更新成功");
      }
      closeEditModal();
    }
  } catch (e: any) {
    msg.error(e?.response?.data?.message || e?.message || "更新资料失败");
  } finally {
    savingProfile.value = false;
  }
}

const previewStory = (id: string, status?: string) => {
  if (!id) return;
  router.push({
    name: status == "published" ? "play" : "test",
    params: { storyId: id },
  });
};

/**
 * 阅读记录里的故事标识：有 shortname 用 shortname，否则用 storyId。
 * 注意不能用记录自身的 id——已上架故事的 id 是快照主键，路由解析不到。
 */
const progressRouteKey = (p: IUserStoryProgress) =>
  storyRouteKey({ shortname: p.shortname, id: p.storyId });
const editStory = (id: string) => {
  if (!id) return;
  router.push({ name: "story-editor", params: { storyId: id } });
};

watch(
  () => [route.params.from, route.params.username],
  ([newFrom, newUsername]) => {
    if (!newUsername) return;
    closeEditModal();
    closeUnlockModal();
    userInfo.value = undefined;
    stories.value = [];
    progress.value = [];
    totalCount.value = 0;
    load();
  },
  { immediate: true }
);

function statusLabel(status?: string) {
  switch (status) {
    case "draft":
      return "草稿";
    case "pending":
      return "待审核";
    case "published":
      return "已发布";
    case "rejected":
      return "已拒绝";
    default:
      return "未知";
  }
}

function statusClass(status?: string) {
  switch (status) {
    case "draft":
      return "badge-ghost";
    case "pending":
      return "badge-warning";
    case "published":
      return "badge-success";
    case "rejected":
      return "badge-error";
    default:
      return "badge-ghost";
  }
}

function logout() {
  auth.logout();
  router.push({ name: "home" });
}
</script>
