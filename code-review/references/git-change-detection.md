# Git 代码变更检测参考文档

本文档定义了使用 `git-change-collector.js` 脚本收集代码变更的方法和输出格式规范。

## 脚本使用

### 基本命令

```bash
node scripts/git-change-collector.js --mode <git-mode> [options]
```

### 参数说明

| 参数 | 简写 | 必需 | 说明 |
|------|------|------|------|
| `--mode` | `-m` | 是 | Git 模式 |
| `--source` | `-s` | 否 | 源代码目录（默认：当前目录） |
| `--output` | `-o` | 否 | 输出文件路径（默认：stdout） |
| `--filter` | `-f` | 否 | 文件扩展名过滤（默认：ts,tsx,js,jsx,vue） |
| `--help` | `-h` | 否 | 显示帮助信息 |

### Git 模式

| 模式 | 说明 | 使用场景 |
|------|------|---------|
| `diff` | 工作区未提交的变更 | 开发中的代码变更 |
| `staged` | 暂存区的变更 | 准备提交的代码 |
| `show:<hash>` | 特定 commit 的变更 | 分析特定提交 |
| `diff:<c1>..<c2>` | 比较两个 commit | 分析一段时间的变更 |
| `branch:<name>` | 与指定分支比较 | 分析分支差异 |
| `last:<N>` | 最近 N 次提交的变更 | 分析最近变更（N: 1-100） |

## 输出格式

脚本输出结构化 JSON 报告，包含以下字段：

### metadata（元数据）

```json
{
  "metadata": {
    "generatedAt": "2024-01-15T10:30:00.000Z",
    "tool": "git-change-collector",
    "version": "1.0.0",
    "gitMode": "diff",
    "sourcePath": "/path/to/source",
    "fileFilter": ["ts", "tsx", "js", "jsx", "vue"],
    "repoRoot": "/path/to/repo",
    "gitVersion": "2.39.0",
    "currentBranch": "feature-x",
    "currentCommit": "abc1234",
    "success": true,
    "duration": 1250,
    "message": "可选的状态消息",
    "warning": "可选的警告消息",
    "commits": ["hash1", "hash2"]  // 仅 last:<N> 模式
  }
}
```

### summary（摘要）

```json
{
  "summary": {
    "totalFiles": 10,
    "filteredFiles": 5,
    "byStatus": {
      "added": 2,
      "modified": 2,
      "deleted": 1,
      "renamed": 0
    },
    "totalAdditions": 120,
    "totalDeletions": 45
  }
}
```

### files（文件列表）

```json
{
  "files": [
    {
      "path": "src/components/Button.tsx",
      "status": "modified",
      "statusCode": "M",
      "oldPath": null,
      "diff": "@@ -1,5 +1,10 @@\n...",
      "stats": {
        "additions": 20,
        "deletions": 5,
        "hunks": 2
      }
    },
    {
      "path": "src/utils/helper.ts",
      "status": "added",
      "statusCode": "A",
      "oldPath": null,
      "diff": "@@ -0,0 +1,50 @@\n...",
      "stats": {
        "additions": 50,
        "deletions": 0,
        "hunks": 1
      }
    },
    {
      "path": "src/old/legacy.ts",
      "status": "deleted",
      "statusCode": "D",
      "oldPath": null,
      "diff": null,
      "stats": {
        "additions": 0,
        "deletions": 0,
        "hunks": 0
      },
      "note": "文件已删除"
    },
    {
      "path": "src/utils/newName.ts",
      "status": "renamed",
      "statusCode": "R",
      "oldPath": "src/utils/oldName.ts",
      "diff": "@@ -1,3 +1,5 @@\n...",
      "stats": {
        "additions": 2,
        "deletions": 0,
        "hunks": 1
      }
    }
  ]
}
```

### errors（错误列表）

```json
{
  "errors": [
    {
      "type": "validation",
      "message": "当前目录不是 Git 仓库"
    },
    {
      "type": "diff",
      "path": "src/problem.ts",
      "error": "获取 diff 失败"
    }
  ]
}
```

## 状态码说明

| 状态码 | status | 说明 | 风险等级 |
|--------|--------|------|---------|
| A | added | 新增文件 | 低 |
| M | modified | 修改文件 | 中 |
| D | deleted | 删除文件 | 高 |
| R | renamed | 重命名文件 | 中 |
| C | copied | 复制文件 | 低 |

## 使用示例

### 收集工作区变更

```bash
node scripts/git-change-collector.js --mode diff --output changes.json
```

### 收集暂存区变更

```bash
node scripts/git-change-collector.js --mode staged --output changes.json
```

### 收集最近 3 次提交

```bash
node scripts/git-change-collector.js --mode last:3 --output changes.json
```

### 与 main 分支对比

```bash
node scripts/git-change-collector.js --mode branch:main --output changes.json
```

### 指定源目录和过滤器

```bash
node scripts/git-change-collector.js \
  --mode diff \
  --source src/modules/user \
  --filter ts,tsx \
  --output changes.json
```

## 脚本特性

### 自动处理

- **Git 仓库验证**：自动检查是否在 Git 仓库目录下
- **前端文件过滤**：默认只收集前端文件（可自定义）
- **重试机制**：Git 命令失败时自动重试（最多 3 次）
- **完整性验证**：验证实际处理文件数与预期文件数一致

### 边界情况处理

| 情况 | 处理方式 |
|------|---------|
| 非 Git 仓库 | 返回错误，`success: false` |
| 无代码变更 | 返回成功，`message: "未检测到代码变更"` |
| 无前端文件变更 | 返回成功，`message: "变更不包含前端文件，无需分析"` |
| 变更文件 > 50 | 返回警告，建议分批分析 |
| 变更文件 > 100 | 返回警告，强烈建议分批分析 |
| 删除的文件 | `diff: null`，包含说明 |
| 特殊字符路径 | 自动处理 |

### 错误类型

| 类型 | 说明 |
|------|------|
| `validation` | 仓库验证或完整性验证失败 |
| `mode` | Git 模式无效 |
| `git` | Git 命令执行失败 |
| `diff` | 获取单个文件 diff 失败 |

## 与阶段三集成

阶段三解析变更报告时应：

1. **检查 `metadata.success`**：确认报告生成成功
2. **检查 `errors` 数组**：处理或报告错误
3. **使用 `summary`**：快速了解变更概况
4. **遍历 `files`**：逐个分析变更文件
5. **根据 `status` 分类**：区分新增/修改/删除/重命名

### 解析示例

```javascript
const report = JSON.parse(fs.readFileSync('changes.json', 'utf-8'));

if (!report.metadata.success) {
  console.error('变更收集失败:', report.errors);
  return;
}

console.log(`共 ${report.summary.filteredFiles} 个前端文件变更`);
console.log(`新增: ${report.summary.byStatus.added}`);
console.log(`修改: ${report.summary.byStatus.modified}`);
console.log(`删除: ${report.summary.byStatus.deleted}`);

for (const file of report.files) {
  console.log(`[${file.status}] ${file.path}`);
  if (file.stats) {
    console.log(`  +${file.stats.additions} -${file.stats.deletions}`);
  }
}
```

## 注意事项

| 项目 | 说明 |
|------|------|
| Node.js 版本 | 要求 18 或更高版本 |
| 依赖 | 无第三方依赖 |
| 执行位置 | 必须在 Git 仓库目录下执行 |
| 未跟踪文件 | `diff` 模式不包含未跟踪文件 |
| 二进制文件 | 自动过滤 |
| 输出编码 | UTF-8 |

## 常见问题

| 问题症状 | 可能原因 | 解决方案 |
|---------|---------|---------|
| "当前目录不是 Git 仓库" | 不在 Git 目录下 | 使用 `--source` 指定正确路径 |
| "无效的 Git 模式" | 模式格式错误 | 检查模式语法 |
| "last:<N> 中 N 必须在 1-100 之间" | N 值超出范围 | 使用有效的 N 值 |
| `filteredFiles: 0` | 无前端文件变更 | 检查 `--filter` 或变更范围 |
| 输出为空 | 无代码变更 | 检查 Git 模式和变更范围 |
