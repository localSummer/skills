#!/usr/bin/env node

/**
 * Git Change Collector
 * 
 * 收集 Git 代码变更并生成结构化报告，用于 code-review 技能的阶段二。
 * 
 * 使用方法:
 *   node git-change-collector.js --mode <git-mode> [--source <path>] [--output <path>] [--filter <extensions>]
 * 
 * 参数:
 *   --mode     Git 模式 (必需): diff, staged, show:<hash>, diff:<c1>..<c2>, branch:<name>, last:<N>
 *   --source   源代码目录 (可选, 默认: 当前目录)
 *   --output   输出文件路径 (可选, 默认: stdout)
 *   --filter   文件扩展名过滤 (可选, 默认: ts,tsx,js,jsx,vue)
 * 
 * 示例:
 *   node git-change-collector.js --mode diff
 *   node git-change-collector.js --mode staged --output changes.json
 *   node git-change-collector.js --mode last:3 --source src/modules/user
 *   node git-change-collector.js --mode branch:main --filter ts,tsx
 * 
 * 输出格式:
 *   {
 *     "metadata": { ... },
 *     "summary": { ... },
 *     "files": [ ... ],
 *     "errors": [ ... ]
 *   }
 * 
 * 支持 Node.js 18+，无第三方依赖
 */

const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// 默认配置
const DEFAULT_EXTENSIONS = ['ts', 'tsx', 'js', 'jsx', 'vue'];
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * 解析命令行参数
 */
function parseArgs(args) {
  const result = {
    mode: null,
    source: process.cwd(),
    output: null,
    filter: DEFAULT_EXTENSIONS,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--mode':
      case '-m':
        result.mode = nextArg;
        i++;
        break;
      case '--source':
      case '-s':
        result.source = path.resolve(nextArg);
        i++;
        break;
      case '--output':
      case '-o':
        result.output = path.resolve(nextArg);
        i++;
        break;
      case '--filter':
      case '-f':
        result.filter = nextArg.split(',').map(ext => ext.trim().replace(/^\./, ''));
        i++;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
    }
  }

  return result;
}

/**
 * 打印使用说明
 */
function printUsage() {
  console.log(`
Git Change Collector - 收集 Git 代码变更并生成结构化报告

使用方法:
  node git-change-collector.js --mode <git-mode> [options]

参数:
  --mode, -m     Git 模式 (必需)
                 支持: diff, staged, show:<hash>, diff:<c1>..<c2>, branch:<name>, last:<N>
  --source, -s   源代码目录 (可选, 默认: 当前目录)
  --output, -o   输出文件路径 (可选, 默认: stdout)
  --filter, -f   文件扩展名过滤 (可选, 默认: ts,tsx,js,jsx,vue)
  --help, -h     显示帮助信息

Git 模式说明:
  diff           工作区未提交的变更
  staged         暂存区的变更
  show:<hash>    特定 commit 的变更
  diff:<c1>..<c2> 比较两个 commit
  branch:<name>  与指定分支比较
  last:<N>       最近 N 次提交的变更

示例:
  node git-change-collector.js --mode diff
  node git-change-collector.js --mode staged --output changes.json
  node git-change-collector.js --mode last:3 --source src/modules/user
  node git-change-collector.js --mode branch:main --filter ts,tsx
`);
}

/**
 * 执行 Git 命令（带重试机制）
 */
function execGit(args, options = {}) {
  const { cwd = process.cwd(), retries = MAX_RETRIES, silent = false } = options;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = spawnSync('git', args, {
        cwd,
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024, // 50MB
      });

      if (result.status === 0) {
        return { success: true, stdout: result.stdout, stderr: result.stderr };
      }

      if (attempt < retries) {
        if (!silent) {
          console.error(`Git command failed (attempt ${attempt}/${retries}): git ${args.join(' ')}`);
          console.error(`Error: ${result.stderr}`);
        }
        sleep(RETRY_DELAY_MS);
      } else {
        return { 
          success: false, 
          error: result.stderr || `Exit code: ${result.status}`,
          stdout: result.stdout,
          stderr: result.stderr
        };
      }
    } catch (err) {
      if (attempt === retries) {
        return { success: false, error: err.message };
      }
      sleep(RETRY_DELAY_MS);
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}

/**
 * 同步睡眠（非 busy-wait 实现）
 */
function sleep(ms) {
  // 使用 Atomics.wait 实现真正的阻塞等待，不占用 CPU
  // 需要 SharedArrayBuffer，Node.js 默认支持
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    // 降级方案：使用 execSync 调用系统 sleep
    // 适用于不支持 SharedArrayBuffer 的环境
    const seconds = Math.ceil(ms / 1000);
    try {
      require('child_process').execSync(
        process.platform === 'win32' ? `timeout /t ${seconds}` : `sleep ${seconds}`,
        { stdio: 'ignore' }
      );
    } catch {
      // 最后降级：busy wait（仅在其他方式都失败时）
      const end = Date.now() + ms;
      while (Date.now() < end) { /* fallback */ }
    }
  }
}

/**
 * 验证 Git 仓库环境
 */
function validateGitRepo(cwd) {
  const result = execGit(['rev-parse', '--is-inside-work-tree'], { cwd, silent: true });
  if (!result.success || result.stdout.trim() !== 'true') {
    return { valid: false, error: '当前目录不是 Git 仓库' };
  }

  // 获取仓库根目录
  const rootResult = execGit(['rev-parse', '--show-toplevel'], { cwd, silent: true });
  if (!rootResult.success) {
    return { valid: false, error: '无法获取 Git 仓库根目录' };
  }

  // 获取 Git 版本
  const versionResult = execGit(['--version'], { cwd, silent: true });
  const versionMatch = versionResult.stdout?.match(/git version (\d+\.\d+\.\d+)/);
  
  return {
    valid: true,
    repoRoot: rootResult.stdout.trim(),
    gitVersion: versionMatch ? versionMatch[1] : 'unknown'
  };
}

/**
 * 解析 Git 模式
 */
function parseGitMode(mode) {
  if (!mode) {
    return { valid: false, error: '未指定 Git 模式' };
  }

  // 简单模式
  if (mode === 'diff') {
    return { valid: true, type: 'diff' };
  }
  if (mode === 'staged') {
    return { valid: true, type: 'staged' };
  }

  // show:<hash>
  const showMatch = mode.match(/^show:(.+)$/);
  if (showMatch) {
    return { valid: true, type: 'show', commitHash: showMatch[1] };
  }

  // diff:<c1>..<c2>
  const diffRangeMatch = mode.match(/^diff:(.+)\.\.(.+)$/);
  if (diffRangeMatch) {
    return { valid: true, type: 'diff-range', from: diffRangeMatch[1], to: diffRangeMatch[2] };
  }

  // branch:<name>
  const branchMatch = mode.match(/^branch:(.+)$/);
  if (branchMatch) {
    return { valid: true, type: 'branch', branchName: branchMatch[1] };
  }

  // last:<N>
  const lastMatch = mode.match(/^last:(\d+)$/);
  if (lastMatch) {
    const count = parseInt(lastMatch[1], 10);
    if (count < 1 || count > 100) {
      return { valid: false, error: 'last:<N> 中 N 必须在 1-100 之间' };
    }
    return { valid: true, type: 'last', count };
  }

  return { 
    valid: false, 
    error: `无效的 Git 模式: ${mode}。支持: diff, staged, show:<hash>, diff:<c1>..<c2>, branch:<name>, last:<N>` 
  };
}

/**
 * 根据 Git 模式获取变更文件列表
 */
function getChangedFiles(parsedMode, cwd) {
  let args = [];
  
  switch (parsedMode.type) {
    case 'diff':
      args = ['diff', '--name-status'];
      break;
    case 'staged':
      args = ['diff', '--cached', '--name-status'];
      break;
    case 'show':
      args = ['show', '--name-status', '--format=', parsedMode.commitHash];
      break;
    case 'diff-range':
      args = ['diff', '--name-status', `${parsedMode.from}..${parsedMode.to}`];
      break;
    case 'branch':
      args = ['diff', '--name-status', `${parsedMode.branchName}...HEAD`];
      break;
    case 'last':
      // last:<N> 需要特殊处理：收集所有变更文件
      return getLastNChangedFiles(parsedMode.count, cwd);
  }

  const result = execGit(args, { cwd });
  if (!result.success) {
    return { success: false, error: result.error };
  }

  const files = parseNameStatus(result.stdout);
  return { success: true, files };
}

/**
 * 获取最近 N 次提交的变更文件
 * 返回 lastModeContext 供后续获取 diff 时复用，避免重复调用 git log
 */
function getLastNChangedFiles(count, cwd) {
  // 获取最近 N 个 commit hash
  const logResult = execGit(['log', `-n`, `${count}`, '--format=%H', '--reverse'], { cwd });
  if (!logResult.success) {
    return { success: false, error: logResult.error };
  }

  const commits = logResult.stdout.trim().split('\n').filter(Boolean);
  if (commits.length === 0) {
    return { success: false, error: '没有找到任何 commit' };
  }

  // 获取变更文件（对比最老 commit 的前一个状态和最新 commit）
  const oldestCommit = commits[0];
  const baseRef = `${oldestCommit}~1`;
  
  // 检查 baseRef 是否存在
  const baseCheck = execGit(['rev-parse', '--verify', baseRef], { cwd, silent: true });
  const hasBaseRef = baseCheck.success;
  
  let args;
  if (hasBaseRef) {
    args = ['diff', '--name-status', `${baseRef}..HEAD`];
  } else {
    // 如果是初始 commit，获取所有文件
    args = ['diff', '--name-status', '--root', oldestCommit, 'HEAD'];
  }

  const result = execGit(args, { cwd });
  if (!result.success) {
    // 回退方案：逐个收集
    return collectFilesFromCommits(commits, cwd);
  }

  const files = parseNameStatus(result.stdout);
  
  // 返回 lastModeContext 供后续复用
  return { 
    success: true, 
    files, 
    commits,
    lastModeContext: {
      commits,
      oldestCommit,
      baseRef,
      hasBaseRef,
    }
  };
}

/**
 * 从多个 commit 逐个收集变更文件（回退方案）
 */
function collectFilesFromCommits(commits, cwd) {
  const fileMap = new Map();
  
  for (const commit of commits) {
    const result = execGit(['show', '--name-status', '--format=', commit], { cwd });
    if (result.success) {
      const files = parseNameStatus(result.stdout);
      for (const file of files) {
        // 保留最后一次变更的状态
        fileMap.set(file.path, file);
      }
    }
  }

  return { 
    success: true, 
    files: Array.from(fileMap.values()),
    commits 
  };
}

/**
 * 解析 --name-status 输出
 */
function parseNameStatus(output) {
  const files = [];
  const lines = output.trim().split('\n').filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^([AMDRC])(?:\d*)\t(.+?)(?:\t(.+))?$/);
    if (match) {
      const [, status, filePath, newPath] = match;
      files.push({
        status: normalizeStatus(status),
        statusCode: status,
        path: newPath || filePath,
        oldPath: newPath ? filePath : null,
      });
    }
  }

  return files;
}

/**
 * 标准化状态码
 */
function normalizeStatus(status) {
  const statusMap = {
    'A': 'added',
    'M': 'modified',
    'D': 'deleted',
    'R': 'renamed',
    'C': 'copied',
  };
  return statusMap[status] || status;
}

/**
 * 过滤前端文件
 */
function filterFrontendFiles(files, extensions) {
  const extPattern = new RegExp(`\\.(${extensions.join('|')})$`, 'i');
  return files.filter(file => extPattern.test(file.path));
}

/**
 * 获取单个文件的 diff 内容
 * @param {Object} parsedMode - 解析后的 Git 模式
 * @param {string} filePath - 文件路径
 * @param {string} cwd - 工作目录
 * @param {Object} lastModeContext - 可选，last 模式的上下文信息
 */
function getFileDiff(parsedMode, filePath, cwd, lastModeContext = null) {
  let args = [];

  switch (parsedMode.type) {
    case 'diff':
      args = ['diff', '--', filePath];
      break;
    case 'staged':
      args = ['diff', '--cached', '--', filePath];
      break;
    case 'show':
      args = ['show', parsedMode.commitHash, '--', filePath];
      break;
    case 'diff-range':
      args = ['diff', `${parsedMode.from}..${parsedMode.to}`, '--', filePath];
      break;
    case 'branch':
      args = ['diff', `${parsedMode.branchName}...HEAD`, '--', filePath];
      break;
    case 'last':
      // 对于 last:<N>，获取累积 diff，传递 lastModeContext 避免重复调用 git log
      return getLastNFileDiff(parsedMode.count, filePath, cwd, lastModeContext);
  }

  const result = execGit(args, { cwd });
  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, diff: result.stdout };
}

/**
 * 获取最近 N 次提交中文件的累积 diff
 * @param {number} count - 提交数量
 * @param {string} filePath - 文件路径
 * @param {string} cwd - 工作目录
 * @param {Object} lastModeContext - 可选，复用已获取的 commits 信息避免重复调用 git log
 */
function getLastNFileDiff(count, filePath, cwd, lastModeContext = null) {
  let baseRef, hasBaseRef, oldestCommit;
  
  if (lastModeContext) {
    // 复用已有的 context，避免重复调用 git log
    ({ baseRef, hasBaseRef, oldestCommit } = lastModeContext);
  } else {
    // 降级：重新获取（仅在未传入 context 时）
    const logResult = execGit(['log', `-n`, `${count}`, '--format=%H', '--reverse'], { cwd });
    if (!logResult.success) {
      return { success: false, error: logResult.error };
    }

    const commits = logResult.stdout.trim().split('\n').filter(Boolean);
    if (commits.length === 0) {
      return { success: false, error: '没有找到任何 commit' };
    }

    oldestCommit = commits[0];
    baseRef = `${oldestCommit}~1`;
    const baseCheck = execGit(['rev-parse', '--verify', baseRef], { cwd, silent: true });
    hasBaseRef = baseCheck.success;
  }

  let args;
  if (hasBaseRef) {
    args = ['diff', `${baseRef}..HEAD`, '--', filePath];
  } else {
    args = ['diff', '--root', oldestCommit, 'HEAD', '--', filePath];
  }

  const result = execGit(args, { cwd });
  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, diff: result.stdout };
}

/**
 * 解析 diff 内容，提取变更统计
 */
function parseDiffStats(diff) {
  if (!diff) {
    return { additions: 0, deletions: 0, hunks: 0 };
  }

  const lines = diff.split('\n');
  let additions = 0;
  let deletions = 0;
  let hunks = 0;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      hunks++;
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      additions++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      deletions++;
    }
  }

  return { additions, deletions, hunks };
}

/**
 * 获取当前分支名
 */
function getCurrentBranch(cwd) {
  const result = execGit(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, silent: true });
  return result.success ? result.stdout.trim() : 'unknown';
}

/**
 * 获取当前 HEAD commit
 */
function getCurrentCommit(cwd) {
  const result = execGit(['rev-parse', '--short', 'HEAD'], { cwd, silent: true });
  return result.success ? result.stdout.trim() : 'unknown';
}

/**
 * 批量获取文件 diff
 * @param {Object} parsedMode - 解析后的 Git 模式
 * @param {Array} files - 文件列表
 * @param {string} cwd - 工作目录
 * @param {Object} lastModeContext - 可选，last 模式的上下文信息
 */
function batchGetFileDiffs(parsedMode, files, cwd, lastModeContext = null) {
  const results = [];
  const errors = [];
  const total = files.length;

  // 尝试批量获取所有文件的 diff（一次 git 调用）
  const batchResult = tryBatchDiff(parsedMode, files, cwd, lastModeContext);
  if (batchResult.success) {
    return batchResult;
  }

  // 批量获取失败，降级为逐个获取
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    // 删除的文件不需要获取 diff 内容
    if (file.statusCode === 'D') {
      results.push({
        ...file,
        diff: null,
        stats: { additions: 0, deletions: 0, hunks: 0 },
        note: '文件已删除'
      });
      continue;
    }

    const diffResult = getFileDiff(parsedMode, file.path, cwd, lastModeContext);
    
    if (diffResult.success) {
      const stats = parseDiffStats(diffResult.diff);
      results.push({
        ...file,
        diff: diffResult.diff,
        stats,
      });
    } else {
      errors.push({
        path: file.path,
        error: diffResult.error
      });
      results.push({
        ...file,
        diff: null,
        stats: { additions: 0, deletions: 0, hunks: 0 },
        error: diffResult.error
      });
    }
  }

  return { files: results, errors };
}

/**
 * 尝试批量获取所有文件的 diff（一次 git 调用）
 * @returns {Object} { success: boolean, files?: Array, errors?: Array }
 */
function tryBatchDiff(parsedMode, files, cwd, lastModeContext) {
  // 过滤掉删除的文件
  const nonDeletedFiles = files.filter(f => f.statusCode !== 'D');
  const deletedFiles = files.filter(f => f.statusCode === 'D');
  
  if (nonDeletedFiles.length === 0) {
    // 所有文件都是删除的
    return {
      success: true,
      files: deletedFiles.map(file => ({
        ...file,
        diff: null,
        stats: { additions: 0, deletions: 0, hunks: 0 },
        note: '文件已删除'
      })),
      errors: []
    };
  }

  // 构建批量 diff 命令
  let args = [];
  switch (parsedMode.type) {
    case 'diff':
      args = ['diff', '--'];
      break;
    case 'staged':
      args = ['diff', '--cached', '--'];
      break;
    case 'show':
      // show 不支持多文件批量，降级
      return { success: false };
    case 'diff-range':
      args = ['diff', `${parsedMode.from}..${parsedMode.to}`, '--'];
      break;
    case 'branch':
      args = ['diff', `${parsedMode.branchName}...HEAD`, '--'];
      break;
    case 'last':
      if (!lastModeContext) {
        return { success: false };
      }
      if (lastModeContext.hasBaseRef) {
        args = ['diff', `${lastModeContext.baseRef}..HEAD`, '--'];
      } else {
        args = ['diff', '--root', lastModeContext.oldestCommit, 'HEAD', '--'];
      }
      break;
    default:
      return { success: false };
  }

  // 添加所有非删除文件的路径
  args.push(...nonDeletedFiles.map(f => f.path));

  const result = execGit(args, { cwd });
  if (!result.success) {
    return { success: false };
  }

  // 解析批量 diff 输出，按文件拆分
  const diffMap = parseBatchDiff(result.stdout);
  
  const results = [];
  const errors = [];

  // 处理非删除文件
  for (const file of nonDeletedFiles) {
    const diff = diffMap.get(file.path) || '';
    const stats = parseDiffStats(diff);
    results.push({
      ...file,
      diff: diff || null,
      stats,
    });
  }

  // 处理删除的文件
  for (const file of deletedFiles) {
    results.push({
      ...file,
      diff: null,
      stats: { additions: 0, deletions: 0, hunks: 0 },
      note: '文件已删除'
    });
  }

  // 按原始顺序排序
  const pathOrder = new Map(files.map((f, i) => [f.path, i]));
  results.sort((a, b) => (pathOrder.get(a.path) || 0) - (pathOrder.get(b.path) || 0));

  return { success: true, files: results, errors };
}

/**
 * 解析批量 diff 输出，按文件拆分
 * @param {string} output - git diff 的完整输出
 * @returns {Map<string, string>} 文件路径 -> diff 内容
 */
function parseBatchDiff(output) {
  const diffMap = new Map();
  const lines = output.split('\n');
  
  let currentFile = null;
  let currentDiff = [];
  
  for (const line of lines) {
    // 匹配 diff --git a/path b/path
    const diffMatch = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (diffMatch) {
      // 保存上一个文件的 diff
      if (currentFile !== null) {
        diffMap.set(currentFile, currentDiff.join('\n'));
      }
      // 开始新文件（使用 b/ 后面的路径，因为可能是重命名）
      currentFile = diffMatch[2];
      currentDiff = [line];
    } else if (currentFile !== null) {
      currentDiff.push(line);
    }
  }
  
  // 保存最后一个文件的 diff
  if (currentFile !== null) {
    diffMap.set(currentFile, currentDiff.join('\n'));
  }
  
  return diffMap;
}

/**
 * 生成变更报告
 */
function generateReport(options) {
  const { mode, source, filter } = options;
  const startTime = Date.now();
  const report = {
    metadata: {
      generatedAt: new Date().toISOString(),
      tool: 'git-change-collector',
      version: '1.0.0',
      gitMode: mode,
      sourcePath: source,
      fileFilter: filter,
    },
    summary: {
      totalFiles: 0,
      filteredFiles: 0,
      byStatus: {
        added: 0,
        modified: 0,
        deleted: 0,
        renamed: 0,
      },
      totalAdditions: 0,
      totalDeletions: 0,
    },
    files: [],
    errors: [],
  };

  // 验证 Git 仓库
  const repoValidation = validateGitRepo(source);
  if (!repoValidation.valid) {
    report.errors.push({ type: 'validation', message: repoValidation.error });
    report.metadata.success = false;
    return report;
  }

  report.metadata.repoRoot = repoValidation.repoRoot;
  report.metadata.gitVersion = repoValidation.gitVersion;
  report.metadata.currentBranch = getCurrentBranch(source);
  report.metadata.currentCommit = getCurrentCommit(source);

  // 解析 Git 模式
  const parsedMode = parseGitMode(mode);
  if (!parsedMode.valid) {
    report.errors.push({ type: 'mode', message: parsedMode.error });
    report.metadata.success = false;
    return report;
  }

  // 获取变更文件列表
  const changedFiles = getChangedFiles(parsedMode, source);
  if (!changedFiles.success) {
    report.errors.push({ type: 'git', message: changedFiles.error });
    report.metadata.success = false;
    return report;
  }

  report.summary.totalFiles = changedFiles.files.length;

  // 如果是 last:<N> 模式，记录 commits
  if (changedFiles.commits) {
    report.metadata.commits = changedFiles.commits;
  }

  // 检查是否有变更
  if (changedFiles.files.length === 0) {
    report.metadata.success = true;
    report.metadata.message = '未检测到代码变更';
    report.metadata.duration = Date.now() - startTime;
    return report;
  }

  // 过滤前端文件
  const frontendFiles = filterFrontendFiles(changedFiles.files, filter);
  report.summary.filteredFiles = frontendFiles.length;

  // 检查是否有前端文件变更
  if (frontendFiles.length === 0) {
    report.metadata.success = true;
    report.metadata.message = '变更不包含前端文件，无需分析';
    report.metadata.duration = Date.now() - startTime;
    return report;
  }

  // 大量文件警告
  if (frontendFiles.length > 50) {
    report.metadata.warning = `变更文件数 (${frontendFiles.length}) 较多，建议分批分析`;
  }
  if (frontendFiles.length > 100) {
    report.metadata.warning = `变更文件数 (${frontendFiles.length}) 过多，强烈建议分批分析`;
  }

  // 批量获取 diff（传递 lastModeContext 以优化 last 模式性能）
  const lastModeContext = changedFiles.lastModeContext || null;
  const diffResults = batchGetFileDiffs(parsedMode, frontendFiles, source, lastModeContext);
  report.files = diffResults.files;
  
  if (diffResults.errors.length > 0) {
    report.errors.push(...diffResults.errors.map(e => ({ type: 'diff', ...e })));
  }

  // 计算统计信息
  for (const file of report.files) {
    const status = file.status;
    if (report.summary.byStatus[status] !== undefined) {
      report.summary.byStatus[status]++;
    }
    if (file.stats) {
      report.summary.totalAdditions += file.stats.additions;
      report.summary.totalDeletions += file.stats.deletions;
    }
  }

  // 完成报告
  report.metadata.success = true;
  report.metadata.duration = Date.now() - startTime;

  // 验证完整性
  const expectedCount = frontendFiles.length;
  const actualCount = report.files.length;
  if (expectedCount !== actualCount) {
    report.errors.push({
      type: 'validation',
      message: `完整性验证失败：期望 ${expectedCount} 个文件，实际处理 ${actualCount} 个`
    });
  }

  return report;
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const options = parseArgs(args);

  // 验证必需参数
  if (!options.mode) {
    console.error('错误: 必须指定 --mode 参数');
    console.error('使用 --help 查看帮助信息');
    process.exit(1);
  }

  // 生成报告
  const report = generateReport(options);

  // 输出报告
  const output = JSON.stringify(report, null, 2);

  if (options.output) {
    try {
      // 确保输出目录存在
      const outputDir = path.dirname(options.output);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.writeFileSync(options.output, output, 'utf-8');
      console.log(`报告已保存到: ${options.output}`);
    } catch (err) {
      console.error(`保存报告失败: ${err.message}`);
      process.exit(1);
    }
  } else {
    console.log(output);
  }

  // 根据报告状态设置退出码
  if (!report.metadata.success) {
    process.exit(1);
  }
}

// 运行主函数
main();
