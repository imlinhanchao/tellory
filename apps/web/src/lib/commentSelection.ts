import type { CommentItem } from "@/api/comments";

/**
 * 扫描指定段落内容所引用的所有变量名（不带前缀 $）
 * 支持 $varName 语法、(display: "Other") 递归引入的段落变量，以及 vars.varName 语法
 */
export function extractSceneReferencedVariables(
  passageContent: string,
  allPassages: Array<{ name: string; content: string }> = [],
  visitedPassages: Set<string> = new Set(),
): string[] {
  if (!passageContent) return [];
  const vars = new Set<string>();

  // 1. 匹配标准 $varName 格式
  const varRegex = /\$([A-Za-z_][A-Za-z0-9_]*)/g;
  let match: RegExpExecArray | null;
  while ((match = varRegex.exec(passageContent)) !== null) {
    vars.add(match[1]);
  }

  // 2. 匹配 vars.varName 或 vars['varName'] 格式
  const varsObjRegex =
    /\bvars(?:\.([A-Za-z_][A-Za-z0-9_]*)|\['([A-Za-z_][A-Za-z0-9_]*)'\]|\["([A-Za-z_][A-Za-z0-9_]*)"\])/g;
  while ((match = varsObjRegex.exec(passageContent)) !== null) {
    const v = match[1] || match[2] || match[3];
    if (v) vars.add(v);
  }

  // 3. 递归跟踪 (display: "PassageName") 引用的子段落
  const displayRegex = /\(display:\s*["']([^"']+)["']\s*\)/gi;
  while ((match = displayRegex.exec(passageContent)) !== null) {
    const targetName = (match[1] || "").trim();
    if (targetName && !visitedPassages.has(targetName)) {
      visitedPassages.add(targetName);
      const target = allPassages.find((p) => p.name === targetName);
      if (target && target.content) {
        const subVars = extractSceneReferencedVariables(
          target.content,
          allPassages,
          visitedPassages,
        );
        for (const sv of subVars) {
          vars.add(sv);
        }
      }
    }
  }

  // 4. 排除系统保留内置变量
  const systemVars = new Set(["passage", "storyTitle", "prevPassage"]);
  return Array.from(vars).filter((v) => !systemVars.has(v));
}

/**
 * 基于场景引用的变量列表与当前玩家运行时变量，生成该场景的变量快照
 */
export function createSceneVariableSnapshot(
  referencedVars: string[],
  currentVariables: Record<string, any> = {},
): Record<string, any> {
  const snapshot: Record<string, any> = {};
  for (const varName of referencedVars) {
    snapshot[varName] =
      currentVariables[varName] !== undefined ? currentVariables[varName] : 0;
  }
  return snapshot;
}

/**
 * 计算选区相对于容器纯文本内容的字符起止偏移量
 */
export function getSelectionOffsets(
  root: HTMLElement,
  range: Range,
): { start: number; end: number } {
  try {
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(root);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    const start = preCaretRange.toString().length;
    const end = start + range.toString().length;
    return { start, end };
  } catch (e) {
    return { start: 0, end: range.toString().length };
  }
}

/**
 * 清除容器内已有的划词评论高亮
 */
export function clearCommentMarks(container: HTMLElement) {
  if (!container) return;
  const marks = container.querySelectorAll("mark.tellory-comment-mark");
  marks.forEach((mark) => {
    const parent = mark.parentNode;
    if (parent) {
      // 移除徽章等附加元素
      const badges = mark.querySelectorAll(".tellory-mark-badge");
      badges.forEach((b) => b.remove());

      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      parent.removeChild(mark);
      parent.normalize();
    }
  });
}

/**
 * 在阅读正文容器内渲染划词评论高亮
 */
export function renderCommentMarks(
  container: HTMLElement,
  comments: CommentItem[],
  onMarkClick: (
    commentsOnThisQuote: CommentItem[],
    markElement: HTMLElement,
    event: MouseEvent,
  ) => void,
) {
  if (!container) return;
  clearCommentMarks(container);

  if (!comments || comments.length === 0) return;

  // 仅筛选具有选中文本的划词评论
  const selectionComments = comments.filter(
    (c) =>
      c.position?.selectedText &&
      c.position.selectedText.trim().length > 0 &&
      !c.isDeleted,
  );

  if (selectionComments.length === 0) return;

  // 按 selectedText 分组，便于合并同一引文的多条评论
  const grouped = new Map<string, CommentItem[]>();
  for (const c of selectionComments) {
    const text = c.position!.selectedText!.trim();
    if (!grouped.has(text)) {
      grouped.set(text, []);
    }
    grouped.get(text)!.push(c);
  }

  // 遍历所有引文分组，在容器中查找文本并包裹 <mark>
  for (const [quote, group] of grouped.entries()) {
    if (quote.length < 1) continue;

    // 搜索容器中的文本节点
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.textContent || !node.textContent.includes(quote)) {
            return NodeFilter.FILTER_SKIP;
          }
          // 避免在链接或交互按钮内部再次嵌套高亮
          const parent = node.parentElement;
          if (parent && parent.closest("mark.tellory-comment-mark")) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );

    const node = walker.nextNode() as Text | null;
    if (node && node.textContent) {
      const idx = node.textContent.indexOf(quote);
      if (idx !== -1) {
        const targetNode = idx > 0 ? node.splitText(idx) : node;
        if (
          targetNode.textContent &&
          targetNode.textContent.length > quote.length
        ) {
          targetNode.splitText(quote.length);
        }

        const mark = document.createElement("mark");
        mark.className = "tellory-comment-mark cursor-pointer text-inherit";
        mark.setAttribute("data-quote", quote);

        // 记录关联的全部评论与回复 ID，以便消息通知跳转时快速定位
        const commentIds = group
          .map((c) => c.id)
          .concat(group.flatMap((c) => (c.replies || []).map((r) => r.id)));
        mark.setAttribute("data-comment-ids", commentIds.join(","));

        mark.addEventListener("click", (e) => {
          e.stopPropagation();
          onMarkClick(group, mark, e);
        });

        targetNode.parentNode?.replaceChild(mark, targetNode);
        mark.appendChild(targetNode);

        // 统计该引文下的主评论数与回复数总和
        const totalCount = group.reduce((sum, c) => {
          const replyCount = Array.isArray(c.replies)
            ? c.replies.length
            : (c.replyCount || 0);
          return sum + 1 + replyCount;
        }, 0);

        // 附带数字小气泡徽章
        const badge = document.createElement("span");
        badge.className = "tellory-mark-badge";
        badge.textContent = `${totalCount > 99 ? "99+" : totalCount}`;
        badge.title = `${totalCount} 条讨论`;
        mark.appendChild(badge);
      }
    }
  }
}
