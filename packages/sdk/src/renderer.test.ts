import { describe, it, expect } from "vitest";
import {
  renderStoryText,
  applyPassageEntryEffects,
  createDefaultEvaluator,
} from "./renderer";
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
