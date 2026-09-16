import type { TourStep } from "@/components/Tour/src/types";

/**
 * 编辑器使用引导的步骤定义。
 *
 * 是否已经引导过记在用户表（user.isToured）上，首次打开编辑器的用户会自动看到；
 * 目标用 `data-tour="..."` 标记，这样不用给工具栏按钮起 id，
 * 移动端/只读模式下缺失的元素会被 `availableTourSteps` 过滤掉。
 */
export const EDITOR_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="story-info"]',
    title: "故事信息",
    description:
      "标题会出现在列表和详情页；描述、标签用于被读者搜到；短名可以生成 /play/短名 这样的短链接；起始章节决定读者从哪一段开始读。",
    placement: "bottom",
  },
  {
    target: '[data-tour="btn-tour"]',
    title: "编辑器引导",
    description: "随时点这个问号，可以再看一遍这份引导。",
    placement: "bottom",
  },
  {
    target: '[data-tour="btn-paste"]',
    title: "粘贴导入",
    description:
      "从剪贴板读入整份故事源码。源码以 :: 开头时可以选择覆盖或追加到当前故事。",
    placement: "bottom",
  },
  {
    target: '[data-tour="btn-copy"]',
    title: "复制源码",
    description: "把整份故事导出成 Tellory 文本源码，方便备份、粘贴到别处或存档。",
    placement: "bottom",
  },
  {
    target: '[data-tour="btn-build"]',
    title: "编译导出 HTML",
    description:
      "打包成单文件 HTML，双击就能玩。发给别人时不需要服务器，也不需要本平台。",
    placement: "bottom",
  },
  {
    target: '[data-tour="btn-graph"]',
    title: "段落关系图",
    description:
      "用图谱看段落之间的跳转关系，死链和孤立段落一眼就能发现，点节点即可切换编辑目标。",
    placement: "bottom",
  },
  {
    target: '[data-tour="btn-test"]',
    title: "试玩故事",
    description: "以读者视角从头跑一遍，右侧的变量面板会同步显示状态。",
    placement: "bottom",
  },
  {
    target: '[data-tour="btn-save"]',
    title: "保存到服务器（Ctrl/⌘ + S）",
    description:
      "保存前会自动做一次语法检查。发现死链、孤立段落之类的问题会先列出来，由你决定是否继续保存。",
    placement: "bottom",
  },
  {
    target: '[data-tour="btn-submit"]',
    title: "提交审核",
    description: "草稿保存后点这里提交审核，通过之后其他读者就能看到了。",
    placement: "bottom",
  },
  {
    target: '[data-tour="passage-list"]',
    title: "段落列表",
    description:
      "左侧管理所有段落，支持按名称或标签搜索。段落名右侧的小图标可以复制名字，粘贴到 (display:) 或链接里很方便。",
    placement: "right",
  },
  {
    target: '[data-tour="editor-tools"]',
    title: "编辑工具条",
    description:
      "常用语法一键插入：链接、条件分支、变量、成就、结局、粗体斜体、嵌入段落、样式块。不确定写法时当参考也行。",
    placement: "bottom",
  },
  {
    target: '[data-tour="tool-link"]',
    title: "插入链接",
    description:
      "[[目标段落|显示文字]] 会生成一条跳转链接，省略显示文字就直接用段落名。这是分支剧情最基本的写法。",
    placement: "bottom",
  },
  {
    target: '[data-tour="tool-if"]',
    title: "条件分支",
    description: "(if: 条件)[ 分支一 ](else:)[ 分支二 ] 按变量的值走不同剧情。",
    placement: "bottom",
  },
  {
    target: '[data-tour="tool-set"]',
    title: "变量赋值",
    description:
      "(set: $变量 to 值) 用来记录玩家的选择、好感度、道具。变量名以 $ 开头。",
    placement: "bottom",
  },
  {
    target: '[data-tour="tool-print"]',
    title: "输出文本",
    description: "(print: ) 用来在故事中输出文本内容。",
    placement: "bottom",
  },
  {
    target: '[data-tour="tool-point"]',
    title: "成就标记",
    description: "(point: ) 用来在故事中标记成就，玩家达成条件后会触发相应的成就。可以直接放在段落中，也可以放在条件分支里。",
    placement: "bottom",
  },
  {
    target: '[data-tour="tool-end"]',
    title: "故事结局",
    description: "(end: ) 用来标记故事的结局，玩家到达该段落时触发。没有出口的段落若不用于嵌入都应加上结局标记。",
    placement: "bottom",
  },
  {
    target: '[data-tour="tool-display"]',
    title: "嵌入段落",
    description: "(display:) 将某个段落嵌入到当前段落中，也可以根据条件决定是否嵌入该段落。",
    placement: "bottom",
  },
  {
    target: '[data-tour="tool-fn"]',
    title: "JS 函数",
    description:
      "(fn:) 定义函数、(call:) 调用它。掷骰子、随机数、复杂计算都可以交给 JavaScript。",
    placement: "bottom",
  },
  {
    target: '[data-tour="tool-style"]',
    title: "样式块",
    description: "可以插入 <style> 标签用来定义样式块，可以在段落中嵌入自定义样式。同时也支持写常规的 html 代码(不包含表单)。",
    placement: "bottom",
  },
  {
    target: '[data-tour="tool-manual"]',
    title: "语法说明书",
    description: "完整的宏语法和示例都在这里，忘了写法随时翻开看。",
    placement: "bottom",
  },
  {
    target: '[data-tour="passage-editor"]',
    title: "正文编辑区",
    description:
      "用 Tellory 语法书写正文，下方可以给当前段落打标签，方便在列表里搜索。",
    placement: "right",
  },
  {
    target: '[data-tour="right-panel"]',
    title: "预览与变量",
    description:
      "右侧实时渲染当前段落，切换标签页可以查看变量、已获得的成就和已达成的结局。",
    placement: "left",
  },
  {
    title: "可以开始了",
    description:
      "写到一半卡住，就回到这里点问号再看一遍引导。祝你把故事讲完。",
  },
];

/**
 * 过滤掉当前布局下不存在或不可见的目标（比如移动端隐藏的侧栏、
 * 只读模式下不渲染的按钮），避免气泡指向一个空位置。
 */
export function availableTourSteps(steps: TourStep[] = EDITOR_TOUR_STEPS) {
  return steps.filter((step) => {
    if (typeof step.target !== "string") return true;
    const el = document.querySelector<HTMLElement>(step.target);
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}
