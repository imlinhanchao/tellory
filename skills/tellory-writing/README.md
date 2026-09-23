# Tellory Writing

这是一个用于创作 [Tellory（织言）](https://story.adventext.fun) 互动故事的 AI 创作辅助 Skill。它集成了语法规范、叙事技艺指导、成稿自查清单以及结构与渲染验证工具，旨在帮助你创作出高质量、逻辑严密且符合 Tellory 语法的互动小说。

## 核心功能

- **语法与技艺指导**：提供 Tellory 宏语法速查与互动叙事设计原则。
- **成稿自查**：内置禁用词清单与 prose 检查脚本，确保文本自然、无模型腔。
- **结构与渲染验证**：
  - `audit.py`：审计故事结构（死链、孤立段、未初始化变量）。
  - `smoke.cjs`：基于真实 SDK 的多配置渲染测试，确保无渲染错误。
- **AI 创作 Prompt**：提供标准化的创作提示词，确保 AI 输出符合 Tellory 规范。

## 安装

```bash
npx skills add imlinhanchao/tellory
```

## 如何使用

- 安装本 Skill：参见上方的安装说明。
- 在你的 AI 工具中输入 /tellory-writing <你的故事设定>。
- 完成后复制生成的 Tellory 源码。
- 打开 [故事编辑器](https://story.adventext.fun/#/story-editor) 点击工具栏的 📋 粘贴生成的 Tellory 源码。

## AI 创作 Prompt

你也可以直接复制 [Prompt.md](Prompt.md) 的提示词直接在 AI 对话中创作你的故事。这种方式支持网页的 AI 聊天，不过缺少语法检查与校验，可能需要根据实际输出进行调整。推荐使用 SKILL 进行创作。

## 参考

- 本 SKILL 参考于 @KKKKhazix 的 [human-writing](https://github.com/KKKKhazix/human-writing/) 进行制作。