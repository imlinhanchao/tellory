import { describe, it, expect } from "vitest";
import {
  renderStoryText,
  applyPassageEntryEffects,
  createDefaultEvaluator,
} from "./renderer";
import { buildStandaloneExport } from "./standalone";
import type { StoryData, VariableMap } from "./types";

const EMPTY_STORY: StoryData = {
  title: "test",
  startPassage: "start",
  passages: [],
};

function makeCtx() {
  return { ...createDefaultEvaluator({}) };
}

// ---------------------------------------------------------------------------
// Core regression: top-level (set:) before (if:) in the same passage
// ---------------------------------------------------------------------------
describe("renderStoryText — set-before-if ordering", () => {
  it("(if:) sees value assigned by a preceding (set:) in the same passage", () => {
    const passage = `(set: $score to 90)
(if: $score >= 90)[ 传说级 ](else:)[ 普通 ]`;

    const vars: VariableMap = { score: 0 };
    const result = renderStoryText(passage, vars, EMPTY_STORY, makeCtx());

    expect(result).toContain("传说级");
    expect(result).not.toContain("普通");
  });

  it("(if:) sees correct branch when score is below threshold", () => {
    const passage = `(set: $score to 50)
(if: $score >= 90)[ 传说级 ](else-if: $score >= 50)[ 普通 ](else:)[ 很差 ]`;

    const vars: VariableMap = { score: 0 };
    const result = renderStoryText(passage, vars, EMPTY_STORY, makeCtx());

    expect(result).toContain("普通");
    expect(result).not.toContain("传说级");
    expect(result).not.toContain("很差");
  });

  it("multiple (set:) accumulate before (if:) condition is tested", () => {
    // Mirrors the 今天吃什么 pattern: $dishScore = $s1+$s2+...
    const passage = `(set: $s1 to 18)(set: $s2 to 18)(set: $s3 to 18)(set: $s4 to 18)(set: $s5 to 18)
(set: $dishScore to $s1 + $s2 + $s3 + $s4 + $s5)
(if: $dishScore >= 90)[ 传说级 ](else:)[ 普通 ]`;

    const vars: VariableMap = {};
    const result = renderStoryText(passage, vars, EMPTY_STORY, makeCtx());

    expect(result).toContain("传说级");
    expect(vars["dishScore"]).toBe(90);
  });

  it("(set:) inside a link action does not run as entry effect", () => {
    const passage = `[[继续|next]](set: $flag to 1)
(if: $flag is 1)[ 已触发 ](else:)[ 未触发 ]`;

    const vars: VariableMap = { flag: 0 };
    const result = renderStoryText(passage, vars, EMPTY_STORY, makeCtx());

    // The (set:) is attached to the link — not an entry effect
    expect(result).toContain("未触发");
    expect(vars["flag"]).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// applyPassageEntryEffects — sequential processing
// ---------------------------------------------------------------------------
describe("applyPassageEntryEffects — sequential set+if", () => {
  it("mutates variables in document order", () => {
    const content = `(set: $a to 5)
(if: $a >= 5)[(set: $b to 99)](else:)[(set: $b to 0)]`;

    const vars: VariableMap = { a: 0, b: 0 };
    applyPassageEntryEffects(content, vars, makeCtx());

    expect(vars["a"]).toBe(5);
    expect(vars["b"]).toBe(99);
  });

  it("(set:) inside non-selected branch is not applied", () => {
    const content = `(set: $a to 3)
(if: $a >= 5)[(set: $b to 99)](else:)[(set: $b to 42)]`;

    const vars: VariableMap = { a: 0, b: 0 };
    applyPassageEntryEffects(content, vars, makeCtx());

    expect(vars["a"]).toBe(3);
    expect(vars["b"]).toBe(42);
  });

  it("nested (if:) inside selected branch is processed recursively", () => {
    const content = `(set: $x to 10)
(if: $x >= 5)[
  (set: $y to 2)
  (if: $y >= 2)[(set: $z to 7)](else:)[(set: $z to 0)]
](else:)[(set: $z to 99)]`;

    const vars: VariableMap = {};
    applyPassageEntryEffects(content, vars, makeCtx());

    expect(vars["x"]).toBe(10);
    expect(vars["y"]).toBe(2);
    expect(vars["z"]).toBe(7);
  });

  it("link-attached (set:) is not applied as entry effect", () => {
    const content = `[[go|dest]](set: $clicked to 1)`;

    const vars: VariableMap = { clicked: 0 };
    applyPassageEntryEffects(content, vars, makeCtx());

    expect(vars["clicked"]).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Rendering: (set:) inside an (if:) branch does not pollute sibling branches
// ---------------------------------------------------------------------------
describe("renderStoryText — branch isolation", () => {
  it("(set:) inside true branch does not affect else branch evaluation", () => {
    // Two separate if chains; first one sets $x inside its branch.
    // Second if should still see $x = 0 from entry effects perspective,
    // but since the first branch runs its set, $x will be 1 in renderVariables —
    // the key is that conditionVariables used for the *second* if reflects entry state.
    const passage = `(set: $x to 0)
(if: $x is 0)[ 零 ](else:)[ 非零 ]`;

    const vars: VariableMap = {};
    const result = renderStoryText(passage, vars, EMPTY_STORY, makeCtx());

    expect(result).toContain("零");
    expect(result).not.toContain("非零");
  });
});

describe("renderStoryText — style tags and (display:) in (if:)", () => {
  it("does not insert <br /> into <style> when (display:) is inside (if:)", () => {
    const story: StoryData = {
      title: "未命名故事",
      startPassage: "Start",
      passages: [
        {
          name: "Start",
          content: `新故事开始了。\n(if: true)[\n(display: "Passage_2")\n]`,
        },
        {
          name: "Passage_2",
          content: `<style>\n.choice {\n  color: #2563eb;\n}\n</style>\n<span class="choice">123</span>`,
        },
      ],
    };

    const vars: VariableMap = {};
    const result = renderStoryText(
      story.passages[0].content,
      vars,
      story,
      makeCtx(),
    );

    expect(result).not.toMatch(/<style[^>]*>[\s\S]*?<br\s*\/?>/);
    expect(result).toContain(".choice {");
    expect(result).toContain("color: #2563eb;");
    expect(result).toContain('<span class="choice">123</span>');
    expect(result).not.toContain("<p><p>");
    expect(result).not.toContain("</p></p>");
  });

  it("does not insert <br /> into raw <style> tags", () => {
    const passage = `<style>\n.choice {\n  color: #2563eb;\n}\n</style>\n<span class="choice">123</span>`;
    const vars: VariableMap = {};
    const result = renderStoryText(passage, vars, EMPTY_STORY, makeCtx());

    expect(result).not.toMatch(/<style[^>]*>[\s\S]*?<br\s*\/?>/);
    expect(result).not.toContain("</style><br");
    expect(result).toContain('<span class="choice">123</span>');
  });

  it("handles inline (if:) without inserting nested <p>", () => {
    const passage = `你拿起了(if: true)[金币](else:)[石头]。`;
    const vars: VariableMap = {};
    const result = renderStoryText(passage, vars, EMPTY_STORY, makeCtx());

    expect(result).toBe("<p>你拿起了金币。</p>");
  });

  it("does not insert <br /> into <style> when (display:) is inside (else:)", () => {
    const story: StoryData = {
      title: "未命名故事",
      startPassage: "Start",
      passages: [
        {
          name: "Start",
          content: `新故事开始了。\n(if: false)[\n没有任何内容\n](else:)[\n(display: "Passage_2")\n]`,
        },
        {
          name: "Passage_2",
          content: `<style>\n.choice {\n  color: #2563eb;\n}\n</style>\n<span class="choice">123</span>`,
        },
      ],
    };

    const vars: VariableMap = {};
    const result = renderStoryText(
      story.passages[0].content,
      vars,
      story,
      makeCtx(),
    );

    expect(result).not.toMatch(/<style[^>]*>[\s\S]*?<br\s*\/?>/);
    expect(result).not.toContain("</style><br");
    expect(result).toContain(".choice {");
    expect(result).toContain("color: #2563eb;");
    expect(result).toContain('<span class="choice">123</span>');
    expect(result).not.toContain("<p><p>");
  });

  it("handles nested (if:) branches correctly", () => {
    const passage = `(if: true)[\n(if: false)[A](else:)[\n(if: true)[ nested success ]\n]\n]`;
    const vars: VariableMap = {};
    const result = renderStoryText(passage, vars, EMPTY_STORY, makeCtx());

    expect(result).toContain("nested success");
    expect(result).not.toContain("A");
  });

  it("produces valid standalone export with intact style helpers", () => {
    const story: StoryData = {
      title: "导出测试",
      startPassage: "Start",
      passages: [
        {
          name: "Start",
          content: `(if: true)[\n(display: "Passage_2")\n]`,
        },
        {
          name: "Passage_2",
          content: `<style>\n.choice {\n  color: #2563eb;\n}\n</style>\n<span class="choice">123</span>`,
        },
      ],
    };
    const standaloneHtml = buildStandaloneExport(story);
    expect(standaloneHtml).toContain("<!DOCTYPE html>");
    expect(standaloneHtml).toContain("MARKDOWN_RAW_HTML_BLOCK_TAGS");
    expect(standaloneHtml).toContain("replaceIfMacros");
    expect(standaloneHtml).toContain("expandDisplayPassages");
    expect(standaloneHtml).toContain(".choice");
  });
});

describe("renderStoryText — document-order sequential state and (display:)", () => {
  it("does not render (if:) branch that appears before (set:) on first entry, but renders after variable is set", () => {
    const story: StoryData = {
      title: "未命名故事",
      startPassage: "Start",
      passages: [
        {
          name: "Start",
          content: `(display: "panel")\n\n(if: $inited is 0)[\n(set: $inited to 1)\n]\n新故事开始了。[[链接名称|next]]`,
        },
        {
          name: "next",
          content: `(display: "panel")\n\nHi~\n\n[[链接名称|Start]]`,
        },
        {
          name: "panel",
          content: `(if: $inited is 1)[\n<style>\n.choice {\n  color: #2563eb;\n}\n</style>\n<span class="choice">123</span>\n]`,
        },
      ],
    };

    const vars: VariableMap = { inited: 0 };
    const ctx = makeCtx();

    // 1. First entry into Start:
    // panel is before (set: $inited to 1), so $inited is 0 at the point of panel.
    // panel's (if: $inited is 1) must NOT render on first entry.
    const startHtml1 = renderStoryText(
      story.passages[0].content,
      vars,
      story,
      ctx,
    );
    expect(startHtml1).not.toContain("123");
    expect(startHtml1).not.toContain(".choice");
    expect(startHtml1).toContain("新故事开始了。");
    // But after passage entry effects, $inited is now set to 1.
    expect(vars["inited"]).toBe(1);

    // 2. Entering next from Start:
    // $inited is 1, so panel's (if: $inited is 1) MUST render now.
    const nextHtml = renderStoryText(
      story.passages[1].content,
      vars,
      story,
      ctx,
    );
    expect(nextHtml).toContain("123");
    expect(nextHtml).toContain(".choice");
    expect(
      nextHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1],
    ).not.toContain("<br");
    expect(nextHtml).toContain("Hi~");

    // 3. Returning to Start from next:
    // $inited is still 1, so panel MUST render now.
    const startHtml2 = renderStoryText(
      story.passages[0].content,
      vars,
      story,
      ctx,
    );
    expect(startHtml2).toContain("123");
    expect(startHtml2).toContain(".choice");
    expect(
      startHtml2.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1],
    ).not.toContain("<br");
    expect(startHtml2).toContain("新故事开始了。");
  });

  it("evaluates (if:) against document-order variable state within the same passage", () => {
    const passage = `(if: $x is 1)[ 命中1 ]\n(set: $x to 1)\n(if: $x is 1)[ 命中2 ]`;
    const vars: VariableMap = { x: 0 };
    const result = renderStoryText(passage, vars, EMPTY_STORY, makeCtx());

    expect(result).not.toContain("命中1");
    expect(result).toContain("命中2");
    expect(vars["x"]).toBe(1);
  });

  it("applies (set:) inside transcluded passages in document order", () => {
    const story: StoryData = {
      title: "Transclusion Test",
      startPassage: "Start",
      passages: [
        {
          name: "Start",
          content: `(display: "Setter")\n(if: $flag is 1)[ Flag set! ]`,
        },
        {
          name: "Setter",
          content: `(set: $flag to 1)`,
        },
      ],
    };
    const vars: VariableMap = { flag: 0 };
    const result = renderStoryText(
      story.passages[0].content,
      vars,
      story,
      makeCtx(),
    );

    expect(result).toContain("Flag set!");
    expect(vars["flag"]).toBe(1);
  });

  it("handles circular (display:) gracefully without infinite loops", () => {
    const story: StoryData = {
      title: "Cycle Test",
      startPassage: "A",
      passages: [
        {
          name: "A",
          content: `In A\n(display: "B")`,
        },
        {
          name: "B",
          content: `In B\n(display: "A")`,
        },
      ],
    };
    const vars: VariableMap = {};
    const result = renderStoryText(
      story.passages[0].content,
      vars,
      story,
      makeCtx(),
    );

    expect(result).toContain("In A");
    expect(result).toContain("In B");
  });
});
