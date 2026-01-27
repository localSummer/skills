---
name: code-review
description: 代码变更审查技能，通过对比变更前后的代码工作流生成结构化的审查报告。当用户需要审查代码变更、分析代码提交影响、或对比分析代码变更前后的工作流差异时，应使用此技能。支持 Git 模式获取变更（git:diff、git:staged、git:last:N 等）。
---

# Code Review

本技能提供结构化的代码变更审查工作流，通过生成变更前后的代码工作流对比报告，帮助开发者清晰理解代码变更的影响范围。

## 核心价值

- **可视化对比**：通过 Mermaid 图表直观展示变更前后的工作流差异
- **变更标注**：清晰标注新增、修改、删除的代码流程
- **影响分析**：评估变更对系统的影响范围和风险等级
- **可引用编号**：所有节点和步骤都有唯一编号，便于讨论和引用

## 工作流程

### 阶段一：获取代码变更

使用 `scripts/git-change-collector.js` 脚本收集代码变更，生成结构化的变更报告。此阶段必须首先执行，因为 diff 信息中包含了变更前后的代码差异，是后续分析的基础。

**执行命令**：

```bash
node scripts/git-change-collector.js --mode <git-mode> [--source <path>] [--output <path>]
```

**支持的 Git 模式**：

| 模式 | 说明 | 示例命令 |
|------|------|---------|
| `diff` | 工作区未提交的变更 | `--mode diff` |
| `staged` | 暂存区的变更 | `--mode staged` |
| `show:<hash>` | 特定 commit 的变更 | `--mode show:abc123` |
| `diff:<c1>..<c2>` | 比较两个 commit | `--mode diff:main..feature` |
| `branch:<name>` | 与指定分支比较 | `--mode branch:main` |
| `last:<N>` | 最近 N 次提交 | `--mode last:3` |

**输出格式**（JSON）：

```json
{
  "metadata": {
    "gitMode": "diff",
    "currentBranch": "feature-x",
    "success": true
  },
  "summary": {
    "filteredFiles": 5,
    "byStatus": { "added": 2, "modified": 2, "deleted": 1 },
    "totalAdditions": 120,
    "totalDeletions": 45
  },
  "files": [
    {
      "path": "src/components/Button.tsx",
      "status": "modified",
      "diff": "...",
      "stats": { "additions": 20, "deletions": 5 }
    }
  ]
}
```

**参考文档**：`references/git-change-detection.md`

### 阶段二：分析变更后的工作流

基于当前本地代码（即变更后的代码）分析工作流，生成当前状态的工作流报告。

**输入参数**：
- `source_path`：要分析的代码目录路径
- `output_path`：报告输出路径（可选，默认为 `v6/docs/code-review` 目录下）

**执行步骤**：
1. 扫描 source_path 目录下的所有组件和 Store 文件
2. 识别初始化阶段的 API 调用
3. 构建带编号的 API 调用时序图（S1, S2, S3...）
4. 构建带编号的 API 依赖关系图（D1, D2, D3...）
5. 生成依赖关系总结（R1, R2, R3...）
6. 按照参考文档 `references/analyze-codeflow.md` 中的报告输出规范输出当前工作流报告

**参考文档**：`references/analyze-codeflow.md`

### 阶段三：生成变更对比报告

结合阶段一的 diff 信息和阶段二的工作流分析，推导出变更前的工作流状态，生成完整的变更对比报告。

**输入参数**：
- `change_report`：阶段一的变更报告（包含 diff 信息）
- `current_workflow`：阶段二生成的当前工作流报告
- `output_path`：报告输出路径（可选，默认为 `v6/docs/code-review` 目录下）

**执行步骤**：
1. 解析阶段二的当前工作流报告（时序图和依赖图）
2. 利用阶段一的 diff 信息逆向推导变更前的工作流状态：
   - 删除行（`-` 前缀）代表变更前存在的代码
   - 新增行（`+` 前缀）代表变更后新增的代码
   - 通过移除新增内容、恢复删除内容，推导出变更前的工作流
3. 构建变更前后的对比时序图，标注 [NEW]/[MODIFIED]/[DELETED]
4. 构建变更前后的对比依赖图，使用颜色区分变更类型
5. 生成依赖关系变更总结（新增/修改/删除的依赖链）
6. 评估变更影响等级（高/中/低）
7. 生成风险评估和验证建议
8. 按照参考文档 `references/change-report-format.md` 中的报告输出规范输出完整的变更审查报告

**参考文档**：`references/change-report-format.md`

## 使用示例

### 示例1：审查工作区变更（直接输出）

```bash
# 直接执行脚本，输出到 stdout
node scripts/git-change-collector.js --mode diff --source src/modules/user

# Claude 可直接读取 stdout 输出进行审查
```

### 示例2：审查工作区变更（保存报告）

```bash
# 收集变更并保存到文件
node scripts/git-change-collector.js --mode diff --source src/modules/user --output changes.json

# 请求审查
请基于 changes.json 审查代码变更
```

### 示例3：审查特定提交

```bash
# 收集最近3次提交的变更
node scripts/git-change-collector.js --mode last:3 --source src/pages/dashboard --output changes.json

# 请求审查
请审查最近3次提交的变更影响
```

### 示例4：分支对比审查

```bash
# 收集与 main 分支的差异
node scripts/git-change-collector.js --mode branch:main --output changes.json

# 请求审查
请对比分析 feature 分支与 main 分支的代码差异
```

## 参考文档

- `references/git-change-detection.md` - Git 变更检测方法论
- `references/analyze-codeflow.md` - 代码工作流分析方法论
- `references/change-report-format.md` - 变更报告格式规范
