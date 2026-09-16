<template>
  <div class="rounded-xl border border-base-300 bg-base-200/50">
    <div class="tools px-3 pt-3 z-100 sticky top-17.5 mb-4 flex flex-wrap items-center bg-base-200 rounded-xl border border-base-200" data-tour="editor-tools">
      <div class="md:tooltip tooltip-bottom" data-tip="插入链接 [[显示|段落]]" data-tour="tool-link">
        <button class="btn btn-sm btn-ghost btn-square" type="button" @click="openSyntaxBuilder('link')">
          <Icon icon="mdi:link-variant" class="text-lg" />
        </button>
      </div>

      <div class="md:tooltip tooltip-bottom" data-tip="插入条件分支 (if:)" data-tour="tool-if">
        <button class="btn btn-sm btn-ghost btn-square" type="button" @click="openSyntaxBuilder('if')">
          <Icon icon="mdi:source-branch" class="text-lg" />
        </button>
      </div>

      <div class="md:tooltip tooltip-bottom" data-tip="变量赋值 (set:)" data-tour="tool-set">
        <button class="btn btn-sm btn-ghost btn-square" type="button" @click="openSyntaxBuilder('set')">
          <Icon icon="mdi:plus-box-outline" class="text-lg" />
        </button>
      </div>

      <div class="md:tooltip tooltip-bottom" data-tip="打印变量 (print:)" data-tour="tool-print">
        <button class="btn btn-sm btn-ghost btn-square" type="button" @click="openSyntaxBuilder('print')">
          <Icon icon="mdi:code-json" class="text-lg" />
        </button>
      </div>

      <div class="md:tooltip tooltip-bottom" data-tip="插入成就 (point: 名称|描述)" data-tour="tool-point">
        <button class="btn btn-sm btn-ghost btn-square" type="button" @click="openSyntaxBuilder('point')">
          <Icon icon="mdi:star-circle" class="text-lg" />
        </button>
      </div>

      <div class="md:tooltip tooltip-bottom" data-tip="插入结局 (end: 名称|描述)" data-tour="tool-end">
        <button class="btn btn-sm btn-ghost btn-square" type="button" @click="openSyntaxBuilder('end')">
          <Icon icon="mdi:flag-checkered" class="text-lg" />
        </button>
      </div>

      <div class="divider divider-horizontal my-1 mx-0.5"></div>

      <div class="md:tooltip tooltip-bottom" data-tip="粗体 ''文字''" data-tour="tool-format">
        <button class="btn btn-sm btn-ghost btn-square" type="button" @click="wrapSelection(`''`, `''`)">
          <Icon icon="mdi:format-bold" class="text-lg" />
        </button>
      </div>

      <div class="md:tooltip tooltip-bottom" data-tip="斜体 //文字//">
        <button class="btn btn-sm btn-ghost btn-square" type="button" @click="wrapSelection(`//`, `//`)">
          <Icon icon="mdi:format-italic" class="text-lg" />
        </button>
      </div>

      <div class="md:tooltip tooltip-bottom" data-tip="删除线 ~~文字~~">
        <button class="btn btn-sm btn-ghost btn-square" type="button" @click="wrapSelection(`~~`, `~~`)">
          <Icon icon="mdi:format-strikethrough" class="text-lg" />
        </button>
      </div>

      <div class="md:tooltip tooltip-bottom" data-tip="上标 ^^文字^^">
        <button class="btn btn-sm btn-ghost btn-square" type="button" @click="wrapSelection(`^^`, `^^`)">
          <Icon icon="mdi:format-superscript" class="text-lg" />
        </button>
      </div>

      <div class="md:tooltip tooltip-bottom" data-tip="下标 ,,文字,,">
        <button class="btn btn-sm btn-ghost btn-square" type="button" @click="wrapSelection(',,', ',,')">
          <Icon icon="mdi:format-subscript" class="text-lg" />
        </button>
      </div>

      <div class="divider divider-horizontal my-1 mx-0.5"></div>

      <div class="md:tooltip tooltip-bottom" data-tip="嵌入段落 (display:)" data-tour="tool-display">
        <button class="btn btn-sm btn-ghost btn-square" type="button" @click="openSyntaxBuilder('display')">
          <Icon icon="mdi:file-replace-outline" class="text-lg" />
        </button>
      </div>

      <div class="md:tooltip tooltip-bottom" data-tip="插入全局 JS 函数 (fn:)" data-tour="tool-fn">
        <button class="btn btn-sm btn-ghost btn-square" type="button" @click="openSyntaxBuilder('fn')">
          <Icon icon="mdi:code-braces" class="text-lg" />
        </button>
      </div>

      <div class="md:tooltip tooltip-bottom" data-tip="调用 JS 函数 (call:)" data-tour="tool-call">
        <button class="btn btn-sm btn-ghost btn-square" type="button" @click="openSyntaxBuilder('call')">
          <Icon icon="mdi:play-circle-outline" class="text-lg" />
        </button>
      </div>

      <div class="md:tooltip tooltip-bottom" data-tip="插入 CSS 样式块 <style>" data-tour="tool-style">
        <button class="btn btn-sm btn-ghost btn-square" type="button" @click="openSyntaxBuilder('style')">
          <Icon icon="mdi:language-css3" class="text-lg" />
        </button>
      </div>
      <div class="md:tooltip tooltip-bottom" data-tip="显示语法说明书" data-tour="tool-manual">
        <button class="btn btn-sm btn-ghost btn-square" type="button" @click="$emit('show-manual')">
          <Icon icon="mdi:book-open-variant" class="text-lg" />
        </button>
      </div>
      <div class="divider divider-horizontal my-1 mx-0.5"></div>
      <div class="md:tooltip tooltip-bottom" data-tip="初始化语法示例" data-tour="tool-init">
        <button class="btn btn-sm btn-ghost btn-square" type="button" @click="$emit('init-default')">
          <Icon icon="mdi:play-circle-outline" class="text-lg" />
        </button>
      </div>
    </div>

    <div class="mb-2 flex items-center justify-between px-3">
      <div class="flex items-center gap-2">
        <label class="text-sm font-bold flex items-center gap-1">
          <Icon icon="mdi:square-edit-outline" class="text-base text-primary" />
          <span>段落编辑</span>
        </label>
        <span class="badge badge-neutral badge-sm font-mono">{{ selectedPassage }}</span>
      </div>
      <div class="flex items-center gap-1">
        <div class="md:tooltip tooltip-bottom" data-tip="重命名当前段落">
          <button
            v-if="!readOnly"
            class="btn btn-xs btn-ghost btn-square"
            type="button"
            @click="$emit('rename-passage')"
          >
            <Icon icon="mdi:pencil-outline" class="text-base" />
          </button>
        </div>
        <div class="md:tooltip tooltip-bottom" data-tip="删除当前段落">
          <button
            v-if="!readOnly"
            class="btn btn-xs btn-ghost btn-square text-error"
            type="button"
            @click="$emit('delete-passage')"
          >
            <Icon icon="mdi:trash-can-outline" class="text-base" />
          </button>
        </div>
      </div>
    </div>
    <section class="px-3" data-tour="passage-editor">
      <textarea
        ref="storyCmTextarea"
        data-cm="story"
        :readonly="readOnly"
        class="h-105 w-full resize-none rounded-xl border border-base-300 bg-base-100 p-0 font-mono text-sm outline-none transition"
        spellcheck="false"
      />
    </section>
    <div class="mt-3 flex items-center gap-2 px-3 pb-3">
      <label class="text-xs text-base-content/70 flex items-center gap-1">
        <Icon icon="mdi:tag-multiple-outline" class="text-sm" />
        <span>Tags：</span>
      </label>
      <input
        v-model="localTagEdit"
        :readonly="readOnly"
        class="input input-sm flex-1 input-bordered"
        placeholder="逗号分隔段落标签"
      />
      <button
        v-if="!readOnly"
        class="btn btn-xs btn-primary gap-1"
        type="button"
        @click="$emit('save-tags', localTagEdit)"
      >
        <Icon icon="mdi:check" class="text-sm" />
        <span>保存标签</span>
      </button>
    </div>

    <dialog ref="syntaxBuilderRef" class="modal">
      <div class="modal-box w-11/12 max-w-2xl">
        <h3 class="flex items-center gap-2 text-lg font-bold">
          <Icon icon="mdi:auto-fix" class="text-primary" />
          <span>{{ syntaxBuilderTitle }}</span>
        </h3>
        <p class="mt-1 text-sm text-base-content/70">填写参数后将自动生成语法并插入到当前光标位置。</p>

        <div class="mt-4 space-y-5">
          <template v-if="activeSyntaxTool === 'link'">
            <div class="grid grid-cols-2 gap-4">
              <label class="form-control w-full gap-1.5">
                <span class="label-text text-xs font-semibold uppercase tracking-wider opacity-70">显示文本</span>
                <input v-model="syntaxForm.linkLabel" class="input input-bordered w-full" placeholder="点击显示的文字" />
              </label>
              <label class="form-control w-full gap-1.5">
                <span class="label-text text-xs font-semibold uppercase tracking-wider opacity-70">跳转段落</span>
                <select v-model="syntaxForm.linkTarget" class="select select-bordered w-full">
                  <option v-for="p in props.story.passages" :key="p.name" :value="p.name">
                    {{ p.name }}
                  </option>
                </select>
              </label>
            </div>
          </template>

          <template v-else-if="activeSyntaxTool === 'if'">
            <div class="flex flex-col md:flex-row gap-4 items-center">
              <span class="w-20 shrink-0 text-xs font-semibold uppercase tracking-wider opacity-70 md:text-right">判断条件</span>
              <div class="grid grid-cols-3 gap-3 flex-1 w-full">
                <input v-model="syntaxForm.ifVar" class="input input-bordered w-full" placeholder="变量名 (如 score)" />
                <select v-model="syntaxForm.ifOperator" class="select select-bordered w-full">
                  <option value=">">></option>
                  <option value=">=">>=</option>
                  <option value="<">&lt;</option>
                  <option value="<=">&lt;=</option>
                  <option value="is">is</option>
                  <option value="is not">is not</option>
                </select>
                <input v-model="syntaxForm.ifRight" class="input input-bordered w-full" placeholder="比较值 (如 0)" />
              </div>
            </div>
            <div class="flex flex-col md:flex-row gap-4 items-start">
              <span class="w-20 shrink-0 text-xs font-semibold uppercase tracking-wider opacity-70 md:text-right pt-3">成立时</span>
              <textarea v-model="syntaxForm.ifTrueText" class="textarea textarea-bordered h-20 flex-1 w-full" placeholder="输入条件成立时显示的文本"></textarea>
            </div>
            <div class="flex flex-col md:flex-row gap-4 items-center">
              <span class="w-20 shrink-0 hidden md:block"></span>
              <label class="flex items-center gap-3 cursor-pointer flex-1">
                <input v-model="syntaxForm.ifIncludeElse" type="checkbox" class="checkbox checkbox-primary checkbox-sm" />
                <span class="label-text text-sm font-medium">包含 else 分支</span>
              </label>
            </div>
            <div v-if="syntaxForm.ifIncludeElse" class="flex flex-col md:flex-row gap-4 items-start">
              <span class="w-20 shrink-0 text-xs font-semibold uppercase tracking-wider opacity-70 md:text-right pt-3">不成立时</span>
              <textarea v-model="syntaxForm.ifFalseText" class="textarea textarea-bordered h-20 flex-1 w-full" placeholder="输入条件不成立时显示的文本"></textarea>
            </div>
          </template>

          <template v-else-if="activeSyntaxTool === 'set'">
            <div class="grid grid-cols-2 gap-4">
              <label class="form-control gap-1.5">
                <span class="label-text text-xs font-semibold uppercase tracking-wider opacity-70">变量名</span>
                <input v-model="syntaxForm.setVar" class="input input-bordered" placeholder="score" />
              </label>
              <label class="form-control gap-1.5">
                <span class="label-text text-xs font-semibold uppercase tracking-wider opacity-70">赋值表达式</span>
                <input v-model="syntaxForm.setValue" class="input input-bordered" placeholder="1" />
              </label>
            </div>
          </template>

          <template v-else-if="activeSyntaxTool === 'print'">
            <label class="form-control w-full gap-1.5">
              <span class="label-text text-xs font-semibold uppercase tracking-wider opacity-70">打印表达式</span>
              <input v-model="syntaxForm.printExpr" class="input input-bordered w-full" placeholder="$score" />
            </label>
          </template>

          <template v-else-if="activeSyntaxTool === 'display'">
            <label class="form-control w-full gap-1.5">
              <span class="label-text text-xs font-semibold uppercase tracking-wider opacity-70">嵌入段落</span>
              <select v-model="syntaxForm.displayPassage" class="select select-bordered w-full">
                <option v-for="p in props.story.passages" :key="p.name" :value="p.name">
                  {{ p.name }}
                </option>
              </select>
            </label>
          </template>

          <template v-else-if="activeSyntaxTool === 'point'">
            <div class="grid grid-cols-2 gap-4">
              <label class="form-control gap-1.5">
                <span class="label-text text-xs font-semibold uppercase tracking-wider opacity-70">成就名称</span>
                <input v-model="syntaxForm.pointName" class="input input-bordered" placeholder="Achievement" />
              </label>
              <label class="form-control gap-1.5">
                <span class="label-text text-xs font-semibold uppercase tracking-wider opacity-70">成就描述</span>
                <input v-model="syntaxForm.pointDesc" class="input input-bordered" placeholder="描述" />
              </label>
            </div>
          </template>

          <template v-else-if="activeSyntaxTool === 'end'">
            <div class="grid grid-cols-2 gap-4">
              <label class="form-control gap-1.5">
                <span class="label-text text-xs font-semibold uppercase tracking-wider opacity-70">结局名称</span>
                <input v-model="syntaxForm.endName" class="input input-bordered" placeholder="Ending" />
              </label>
              <label class="form-control gap-1.5">
                <span class="label-text text-xs font-semibold uppercase tracking-wider opacity-70">结局描述</span>
                <input v-model="syntaxForm.endDesc" class="input input-bordered" placeholder="描述" />
              </label>
            </div>
          </template>

          <template v-else-if="activeSyntaxTool === 'call'">
            <label class="form-control w-full gap-1.5">
              <span class="label-text text-xs font-semibold uppercase tracking-wider opacity-70">函数名</span>
              <input v-model="syntaxForm.callName" class="input input-bordered w-full" placeholder="myFunc" />
            </label>
          </template>

          <template v-else-if="activeSyntaxTool === 'fn'">
            <div class="flex flex-col md:flex-row gap-4 items-center">
              <span class="w-20 shrink-0 text-xs font-semibold uppercase tracking-wider opacity-70 md:text-right">函数名</span>
              <input v-model="syntaxForm.fnName" class="input input-bordered flex-1 w-full" placeholder="myFunc" />
            </div>
            <div class="flex flex-col md:flex-row gap-4 items-start">
              <span class="w-20 shrink-0 text-xs font-semibold uppercase tracking-wider opacity-70 md:text-right pt-3">函数体</span>
              <textarea v-model="syntaxForm.fnBody" class="textarea textarea-bordered h-28 font-mono text-xs flex-1 w-full" placeholder="$var += 1;\nreturn 123;"></textarea>
            </div>
          </template>

          <template v-else-if="activeSyntaxTool === 'style'">
            <div class="flex flex-col md:flex-row gap-4 items-start">
              <span class="w-20 shrink-0 text-xs font-semibold uppercase tracking-wider opacity-70 md:text-right pt-3">CSS 内容</span>
              <textarea v-model="syntaxForm.styleBody" class="textarea textarea-bordered h-28 font-mono text-xs flex-1 w-full" placeholder=".choice { color: #2563eb; }"></textarea>
            </div>
          </template>

          <div class="rounded-xl border border-base-300 bg-base-200/50 p-4">
            <p class="mb-2 text-xs font-bold uppercase tracking-wider opacity-50">生成预览</p>
            <pre class="whitespace-pre-wrap break-all font-mono text-sm text-primary">{{ syntaxPreview }}</pre>
          </div>
        </div>

        <div class="modal-action border-t border-base-300 pt-4 mt-4">
          <button class="btn btn-ghost" type="button" @click="closeSyntaxBuilder">取消</button>
          <button class="btn btn-primary px-8" type="button" @click="insertGeneratedSyntax">插入代码</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="submit" @click="closeSyntaxBuilder">close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onBeforeUnmount } from 'vue';
import Icon from '@/components/Icon/src/Icon.vue';
import CodeMirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/dracula.css';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/addon/mode/simple';
// register the simple mode for our story syntax here so syntax highlighting
// is available when this component initializes the editor.
(CodeMirror as any).defineSimpleMode &&
  (CodeMirror as any).defineSimpleMode("haideStory", {
    start: [
      { regex: /::\s*[^\n]+/, token: "header" },
      {
        regex: /\(set:|\(if:|\(print:|\(display:|\(call:|\(fn:|\(link:|\(point:|\(end:/,
        token: "keyword",
      },
      { regex: /\[\[[^\]]+\]\]/, token: "link" },
      { regex: /<style>[\s\S]*?<\/style>/, token: "style-tag" },
      { regex: /"(?:[^"\\]|\\.)*"/, token: "string" },
      { regex: /'(?:[^'\\]|\\.)*'/, token: "string" },
      { regex: /\$[A-Za-z0-9_]+/, token: "variable-2" },
      { regex: /\/\/.*$/, token: "comment" },
      { regex: /\/.+?\//, token: "string" },
    ],
    meta: {
      dontIndentStates: ["comment"],
      lineComment: "//",
    },
  });

const props = defineProps<{
  readOnly?: boolean;
  story: any;
  selectedPassage: string;
  content: string;
  tagEditValue: string;
  variables: Record<string, unknown>;
}>();

const emits = defineEmits([
  'update:content',
  'update:selectedPassage',
  'update:tagEditValue',
  'update:variables',
  'paste-import',
  'import-story',
  'export-story',
  'build-story',
  'save-to-server',
  'submit-for-review',
  'refresh-preview',
  'reset-preview-vars',
  'save-tags',
  'rename-passage',
  'delete-passage',
  'copy-passage-name',
  // UI events
  'show-manual',
  'init-default',
  'insert-display',
  'insert-style',
]);

const storyCmTextarea = ref<HTMLTextAreaElement | null>(null);
let storyCmInstance: any = null;
const syntaxBuilderRef = ref<HTMLDialogElement | null>(null);

type SyntaxToolKind =
  | 'link'
  | 'if'
  | 'set'
  | 'print'
  | 'display'
  | 'point'
  | 'end'
  | 'call'
  | 'fn'
  | 'style';

const activeSyntaxTool = ref<SyntaxToolKind | null>(null);
const syntaxForm = ref({
  linkTarget: '',
  linkLabel: '',
  ifVar: 'var',
  ifOperator: '>',
  ifRight: '0',
  ifTrueText: '文本1',
  ifIncludeElse: true,
  ifFalseText: '文本2',
  setVar: 'var',
  setValue: '1',
  printExpr: '$var',
  displayPassage: '',
  pointName: 'Achievement',
  pointDesc: '描述',
  endName: 'Ending',
  endDesc: '描述',
  callName: 'myFunc',
  fnName: 'myFunc',
  fnBody: '$var += 1;\nreturn 123;',
  styleBody: '.choice {\n  color: #2563eb;\n}',
});

const localTagEdit = ref(props.tagEditValue || '');

const syntaxBuilderTitle = computed(() => {
  const map: Record<SyntaxToolKind, string> = {
    link: '插入链接',
    if: '插入条件分支',
    set: '插入变量赋值',
    print: '插入变量打印',
    display: '插入嵌入段落',
    point: '插入成就',
    end: '插入结局',
    call: '插入函数调用',
    fn: '插入全局函数',
    style: '插入 CSS 样式块',
  };
  const kind = activeSyntaxTool.value;
  return kind ? map[kind] : '语法助手';
});

const syntaxPreview = computed(() => {
  const kind = activeSyntaxTool.value;
  if (!kind) return '';
  return buildSyntaxSnippet(kind, false);
});

watch(
  () => props.tagEditValue,
  (v) => {
    localTagEdit.value = v || '';
  },
);

watch(
  () => props.content,
  (v) => {
    if (!storyCmInstance) return;
    const cur = storyCmInstance.getValue();
    if (cur !== (v || '')) storyCmInstance.setValue(v || '');
  },
);

watch(
  () => props.selectedPassage,
  async () => {
    await nextTick();
    if (!storyCmInstance) return;
    const expected = props.content || '';
    const cur = storyCmInstance.getValue();
    if (cur !== expected) storyCmInstance.setValue(expected);
  },
);

watch(
  () => props.readOnly,
  (r) => {
    if (storyCmInstance) storyCmInstance.setOption('readOnly', r ? 'nocursor' : false);
  },
);

onBeforeUnmount(() => {
  if (storyCmInstance) {
    try {
      storyCmInstance.toTextArea();
    } catch {}
    storyCmInstance = null;
  }
});

// initialize CodeMirror when mounted/updated
watch(
  () => [props.readOnly, props.story && props.selectedPassage],
  async () => {
    await nextTick();
    const ta = storyCmTextarea.value || (document.querySelector('textarea[data-cm="story"]') as HTMLTextAreaElement | null);
    if (!ta) return;
    const theme = 'dracula';
    if (!storyCmInstance) {
      ta.value = props.content || '';
      storyCmInstance = CodeMirror.fromTextArea(ta, {
        mode: 'haideStory',
        theme,
        lineNumbers: true,
        lineWrapping: true,
        tabSize: 2,
        extraKeys: { Tab: (cm: any) => cm.replaceSelection('  ', 'end') },
        readOnly: props.readOnly ? 'nocursor' : false,
      });
      storyCmInstance.setSize('100%', '420px');
      storyCmInstance.on('change', (cm: any) => {
        const v = cm.getValue();
        emits('update:content', v);
      });
      storyCmInstance.setOption('readOnly', props.readOnly ? 'nocursor' : false);
    } else {
      storyCmInstance.setOption('theme', theme);
      storyCmInstance.setOption('readOnly', props.readOnly ? 'nocursor' : false);
    }
  },
  { immediate: true },
);

function insertSnippet(snippet: string) {
  if (props.readOnly) return;
  if (storyCmInstance) {
    const doc = storyCmInstance.getDoc();
    const sel = doc.getSelection();
    doc.replaceSelection(snippet);
    storyCmInstance.focus();
    return;
  }
  const textarea = document.querySelector('textarea') as HTMLTextAreaElement | null;
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const content = textarea.value;
  textarea.value = `${content.slice(0, start)}${snippet}${content.slice(end)}`;
  textarea.selectionStart = textarea.selectionEnd = start + snippet.length;
  textarea.focus();
}

function getDefaultPassageName() {
  return props.selectedPassage || props.story?.startPassage || props.story?.passages?.[0]?.name || 'Start';
}

function normalizeVarName(raw: string, fallback = 'var') {
  const trimmed = (raw || '').trim().replace(/^\$+/, '');
  return `$${trimmed || fallback}`;
}

function escapeDoubleQuote(text: string) {
  return String(text || '').replace(/"/g, '\\"');
}

function openSyntaxBuilder(kind: SyntaxToolKind) {
  if (props.readOnly) return;
  const passage = getDefaultPassageName();
  activeSyntaxTool.value = kind;
  if (kind === 'link') {
    syntaxForm.value.linkTarget = passage;
    syntaxForm.value.linkLabel = '链接名称';
  }
  if (kind === 'display') {
    syntaxForm.value.displayPassage = passage;
  }
  if (kind === 'if') {
    syntaxForm.value.ifVar = 'var';
    syntaxForm.value.ifOperator = '>';
    syntaxForm.value.ifRight = '0';
    syntaxForm.value.ifTrueText = '文本1';
    syntaxForm.value.ifIncludeElse = true;
    syntaxForm.value.ifFalseText = '文本2';
  }
  if (kind === 'set') {
    syntaxForm.value.setVar = 'var';
    syntaxForm.value.setValue = '1';
  }
  if (kind === 'print') {
    syntaxForm.value.printExpr = '$var';
  }
  if (kind === 'point') {
    syntaxForm.value.pointName = 'Achievement';
    syntaxForm.value.pointDesc = '描述';
  }
  if (kind === 'end') {
    syntaxForm.value.endName = 'Ending';
    syntaxForm.value.endDesc = '描述';
  }
  if (kind === 'call') {
    syntaxForm.value.callName = 'myFunc';
  }
  if (kind === 'fn') {
    syntaxForm.value.fnName = 'myFunc';
    syntaxForm.value.fnBody = '$var += 1;\nreturn 123;';
  }
  if (kind === 'style') {
    syntaxForm.value.styleBody = '.choice {\n  color: #2563eb;\n}';
  }
  nextTick(() => {
    syntaxBuilderRef.value?.showModal();
  });
}

function closeSyntaxBuilder() {
  if (syntaxBuilderRef.value?.open) {
    syntaxBuilderRef.value.close();
  }
  activeSyntaxTool.value = null;
}

function buildSyntaxSnippet(kind: SyntaxToolKind, strict = true) {
  if (kind === 'link') {
    const target = (syntaxForm.value.linkTarget || getDefaultPassageName()).trim();
    const label = (syntaxForm.value.linkLabel || '').trim();
    if (!target && strict) return '';
    if (!label) return `[[${target}|${target}]]`;
    return `[[${label}|${target}]]`;
  }

  if (kind === 'if') {
    const left = normalizeVarName(syntaxForm.value.ifVar, 'var');
    const operator = (syntaxForm.value.ifOperator || 'is').trim();
    const right = (syntaxForm.value.ifRight || '0').trim();
    const passText = syntaxForm.value.ifTrueText || '文本1';
    const failText = syntaxForm.value.ifFalseText || '文本2';
    if (syntaxForm.value.ifIncludeElse) {
      return `(if: ${left} ${operator} ${right})[ ${passText} ](else:)[ ${failText} ]`;
    }
    return `(if: ${left} ${operator} ${right})[ ${passText} ]`;
  }

  if (kind === 'set') {
    const left = normalizeVarName(syntaxForm.value.setVar, 'var');
    const right = (syntaxForm.value.setValue || '1').trim();
    return `(set: ${left} to ${right})`;
  }

  if (kind === 'print') {
    const expr = (syntaxForm.value.printExpr || '$var').trim();
    return `(print: ${expr})`;
  }

  if (kind === 'display') {
    const name = escapeDoubleQuote(syntaxForm.value.displayPassage || getDefaultPassageName());
    return `(display: "${name}")`;
  }

  if (kind === 'point') {
    const name = (syntaxForm.value.pointName || 'Achievement').trim();
    const desc = (syntaxForm.value.pointDesc || '描述').trim();
    return `(point: ${name}|${desc})`;
  }

  if (kind === 'end') {
    const name = (syntaxForm.value.endName || 'Ending').trim();
    const desc = (syntaxForm.value.endDesc || '描述').trim();
    return `(end: ${name}|${desc})`;
  }

  if (kind === 'call') {
    const fnName = escapeDoubleQuote((syntaxForm.value.callName || 'myFunc').trim());
    return `(call:"${fnName}")`;
  }

  if (kind === 'fn') {
    const fnName = escapeDoubleQuote((syntaxForm.value.fnName || 'myFunc').trim());
    const body = (syntaxForm.value.fnBody || '$var += 1;\nreturn 123;').trim();
    return `(fn:"${fnName}")[\n${body}\n]\n`;
  }

  const css = (syntaxForm.value.styleBody || '').trim();
  return `<style>\n${css}\n</style>`;
}

function insertGeneratedSyntax() {
  const kind = activeSyntaxTool.value;
  if (!kind) return;
  const snippet = buildSyntaxSnippet(kind, true);
  if (!snippet) return;
  insertSnippet(snippet);
  closeSyntaxBuilder();
}

function wrapSelection(before: string, after?: string) {
  const a = after ?? before;
  if (props.readOnly) return;
  if (storyCmInstance) {
    const doc = storyCmInstance.getDoc();
    const sel = doc.getSelection();
    if (sel && sel.length > 0) {
      doc.replaceSelection(before + sel + a);
      storyCmInstance.focus();
    } else {
      doc.replaceSelection(before + a);
      const cursor = doc.getCursor();
      doc.setCursor({ line: cursor.line, ch: cursor.ch - a.length });
      storyCmInstance.focus();
    }
    return;
  }
  const textarea = document.querySelector('textarea') as HTMLTextAreaElement | null;
  if (!textarea) {
    insertSnippet(before + a);
    return;
  }
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const content = textarea.value;
  if (start !== end) {
    const selected = content.slice(start, end);
    const replaced = before + selected + a;
    textarea.value = content.slice(0, start) + replaced + content.slice(end);
    textarea.selectionStart = start;
    textarea.selectionEnd = start + replaced.length;
    textarea.focus();
  } else {
    const inserted = before + a;
    textarea.value = `${content.slice(0, start)}${inserted}${content.slice(end)}`;
    const cursorPos = start + before.length;
    textarea.selectionStart = textarea.selectionEnd = cursorPos;
    textarea.focus();
  }
}

// expose helper methods to parent via defineExpose so parent can call them
defineExpose({ insertSnippet, wrapSelection });
// expose events list (already declared above)
emits;
</script>

<style scoped>
.cm-s-default .cm-header {
  color: #0f172a;
  font-weight: 600;
}
.cm-s-dracula .cm-header {
  color: #8be9fd;
  font-weight: 600;
}
.cm-header {
  font-weight: 600;
}
.cm-keyword {
  color: #7c3aed;
}
.cm-link {
  color: #0366d6;
  text-decoration: underline;
}
.cm-style-tag {
  color: #b58900;
}
.cm-variable-2 {
  color: #b85252;
}
.cm-string {
  color: #16a34a;
}
.cm-comment {
  color: #6b7280;
  font-style: italic;
}
</style>
