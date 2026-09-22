/**
 * 提取指定段落内容所引用的所有变量名（不带前缀 $）
 * 支持 $varName 格式、vars.varName / vars['varName'] 格式，以及 (display: "Other") 递归引用的子段落变量
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
    const targetName = (match[1] || '').trim();
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
  const systemVars = new Set(['passage', 'storyTitle', 'prevPassage']);
  return Array.from(vars).filter((v) => !systemVars.has(v));
}
