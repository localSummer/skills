# Claude 技能集合

[English](./README.md) | **中文**

一个专为增强 Claude 在开发、代码分析和智能体编排方面能力而设计的技能仓库。

## 概述

本项目包含一系列高质量、文档完善的技能，遵循结构化工作流。每个技能专注于解决特定问题，同时保持清晰的职责分离。

## 可用技能

| 技能 | 描述 | 目录 |
| :--- | :--- | :--- |
| **Mapping Loader** | 从 `~/.claude/mappings/` 查询代理、命令和技能的映射文件 | `mapping-loader/` |
| **Code Review** | 基于 Git diff 生成带 Mermaid 图表的结构化评审报告 | `code-review/` |
| **Codex Subagent** | 派生自治子代理来分担高上下文任务和研究工作 | `codex-subagent/` |
| **Skill Review** | 分析会话历史以提出改进建议或新技能创意 | `skill-review/` |
| **Skill Validator** | 对技能工作流进行语义验证和质量保障 | `skill-validator/` |
| **Adversarial Review** | 三代理对抗式代码评审，过滤噪声并产出高价值工程洞察 | `adversarial-review/` |

## 技能详情

### [Mapping Loader](./mapping-loader/SKILL.md)
提供本地和插件资产的发现与执行工具。负责处理用户请求与系统实际文件路径之间的映射关系。

### [Code Review](./code-review/SKILL.md)
全面的代码变更分析工作流。包含 Git 变更收集、工作流分析和可视化影响报告生成等脚本，帮助开发者理解代码演进过程。

### [Codex Subagent](./codex-subagent/SKILL.md)
一个编排工具，允许 Claude 将重量级工作委托给后台子代理。推荐用于向当前上下文添加 3,000+ token 的任务，如深度研究或大规模代码库探索。

### [Skill Review](./skill-review/SKILL.md)
用于迭代开发者工具箱的元技能。从对话中收集反馈，提出现有技能的优化建议或识别新技能需求。

### [Skill Validator](./skill-validator/SKILL.md)
使用 AI 对技能定义进行语义分析的质量保障工具。确保工作流完整、状态转换合理，并遵循最佳实践（如包含 WHY/WHAT/HOW 指导）。

### [Adversarial Review](./adversarial-review/SKILL.md)
三代理对抗式流水线（Bug-finder、Defender、Referee），通过竞争性评分产出高信噪比的代码评审结果。对抗性张力过滤 AI 噪声，仅保留可操作的工程洞察，覆盖可访问性、性能、安全性和类型安全等领域的复杂审计。

## 项目结构

```text
skills/
├── adversarial-review/  # 多代理对抗式代码评审
├── code-review/         # 基于 Git 的代码变更分析
├── codex-subagent/      # 后台代理执行脚本
├── mapping-loader/      # 映射文件发现工具
├── skill-review/        # 对话反馈与迭代逻辑
└── skill-validator/     # 语义质量保障工具
```

## 开发原则

- **单一职责**：每个技能聚焦一个核心工作流。
- **标准化文档**：每个技能都包含带 YAML frontmatter 的 `SKILL.md`。
- **验证驱动**：新技能应使用 `skill-validator` 进行验证。
- **增量迭代**：技能基于真实使用反馈，通过 `skill-review` 持续迭代。
