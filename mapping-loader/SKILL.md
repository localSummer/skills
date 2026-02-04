---
name: mapping-loader
description: Load and query mappings from ~/.claude/mappings/output/ for agents, commands, skills, and plugins. Matches mapping files by user request and loads specific entries for execution.
---

# Mapping Loader Skill

This skill provides utilities for loading and querying the 6 mapping files in `~/.claude/mappings/output/`. Use when users need to look up, read, or execute commands, agents, skills, or plugins from the mapping tables.

## Mapping Files Overview

| File                          | Type            | Source Directory           |
| ----------------------------- | --------------- | -------------------------- |
| `agents-mapping.md`           | Local Agents    | `~/.claude/agents/`        |
| `commands-mapping.md`         | Local Commands  | `~/.claude/commands/`      |
| `skills-mapping.md`           | Local Skills    | `~/.claude/skills/`        |
| `plugins-agents-mapping.md`   | Plugin Agents   | `~/.claude/plugins/cache/` |
| `plugins-commands-mapping.md` | Plugin Commands | `~/.claude/plugins/cache/` |
| `plugins-skills-mapping.md`   | Plugin Skills   | `~/.claude/plugins/cache/` |

## Usage Patterns

### Pattern 1: Load Mapping File by Type

When user requests to load a specific type of mapping:

```
User: "Load the skills mapping" / "Show me commands mapping" / "List all agents"
```

**Action:**

1. Identify which mapping file to load based on type keywords
2. Use Read tool to load the entire mapping file from `~/.claude/mappings/output/`
3. Present relevant entries to user

**Mapping Type Detection:**

- `agent` → `agents-mapping.md`
- `command` → `commands-mapping.md` (local) or `plugins-commands-mapping.md` (plugin)
- `skill` → `skills-mapping.md` (local) or `plugins-skills-mapping.md` (plugin)
- `plugin` → Check all plugin mappings

### Pattern 2: Query Specific Entry

When user requests a specific command, agent, skill, or plugin:

```
User: "Find the code-review agent" / "Show me the git:commit-push command" / "What is the prompt-optimizer skill"
```

**Action:**

1. Determine which mapping file contains the entry
2. Use Grep to search for the entry name in the appropriate mapping file(s)
3. Extract the full path from the "完整路径" column
4. Load the target file using Read tool

**Search Strategy:**

- Extract key terms from user request (e.g., "code-review", "git:commit-push", "prompt-optimizer")
- Search in relevant mapping file(s) using Grep
- Priority: exact match > partial match > keyword match

### Pattern 3: Execute Command/Agent/Skill

When user wants to execute something from the mapping:

```
User: "Run the git:commit-push command" / "Activate the claudeception skill" / "Use the code-reviewer agent"
```

**Action:**

1. Query the mapping to find the full path
2. Load the target file using Read tool
3. Execute according to the file's instructions and frontmatter

**Execution Types:**

- **Commands**: Check frontmatter for `allowed-tools`, execute specified workflow
- **Agents**: Load agent definition, invoke using Task tool with agent's role
- **Skills**: Load SKILL.md, apply skill rules to current session

### Pattern 4: List Entries by Category

When user wants to see all entries in a category:

```
User: "List all development-team agents" / "Show me Git commands" / "What skills are in AI & Prompt"
```

**Action:**

1. Load the appropriate mapping file
2. Find the section matching the category
3. Present the table or entries in that section

## Step-by-Step Workflow

### Step 1: Identify Target Mapping File

Parse user request to determine which mapping file(s) to search:

```
User Request → Type Detection → Target Mapping File(s)

Examples:
- "codeagent skill" → skills-mapping.md
- "/git:commit-push" → commands-mapping.md (local) or plugins-commands-mapping.md (plugin)
- "react-developer agent" → agents-mapping.md
- "octo debate" → plugins-commands-mapping.md (for Claude Octopus commands)
- "flow-discover skill" → plugins-skills-mapping.md
```

### Step 2: Load Mapping File

Read the mapping file with appropriate offset/limit:

```bash
# Always use offset and limit for large files
Read: file_path="~/.claude/mappings/output/{mapping-file}.md", offset=0, limit=100
```

### Step 3: Search for Entry

Use Grep to find specific entries:

```bash
# Search for entry name in mapping file
Grep: pattern="{entry_name}", path="~/.claude/mappings/output/{mapping-file}.md", output_mode="content"
```

### Step 4: Extract Full Path

Parse the Grep result to extract the "完整路径" column value:

- Format: `| 名称/快捷方式 | ... | `完整路径` |
- Path is in backticks: `\`~/.claude/.../file.md\``

### Step 5: Load Target File

Read the target file using the extracted path:

```bash
Read: file_path="{extracted_path}", offset=0, limit=100
```

### Step 6: Execute or Present

Based on the target file type:

- **Commands**: Display allowed tools, execute workflow
- **Agents**: Invoke via Task tool with agent role
- **Skills**: Apply skill rules to session

## Common Queries

| Query Type     | Example               | Target Mapping              |
| -------------- | --------------------- | --------------------------- |
| Local agent    | "code-analyzer agent" | agents-mapping.md           |
| Local command  | "/git:sync"           | commands-mapping.md         |
| Local skill    | "claudeception skill" | skills-mapping.md           |
| Plugin command | "/octo:review"        | plugins-commands-mapping.md |
| Plugin skill   | "skill-debug"         | plugins-skills-mapping.md   |
| Plugin agent   | "react-developer"     | agents-mapping.md           |

## Notes

- Mapping files are auto-generated from `~/.claude/agents/`, `~/.claude/commands/`, `~/.claude/skills/`, and `~/.claude/plugins/cache/`
- Each mapping file has a `lastUpdated` field in frontmatter
- Plugin mappings automatically select the latest version of each item
- Full paths in mappings use `~` expansion (resolve to user's home directory)
