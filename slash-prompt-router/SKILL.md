---
name: slash-prompt-router
description: Discover, recommend, and execute local slash prompts stored in ~/.codex/prompts. Use when Codex needs to (1) list available slash prompts, (2) match a user request to the most relevant slash prompt candidates, or (3) load and run a user-selected slash prompt as the operating procedure for the current task.
---

# Slash Prompt Router

Use this skill as a router for local prompt assets under `~/.codex/prompts`.

## Workflow

1. Build a prompt inventory with `python3 ~/.codex/skills/slash-prompt-router/scripts/catalog_prompts.py`.
2. If the user asks for all slash prompts, list the catalog directly.
3. If the user gives a goal and wants a recommendation, run the ranking flow first and return a short candidate list.
4. After the user selects a prompt, read the prompt file and execute the task using that prompt's workflow.

## List Prompts

Run:

```bash
python3 ~/.codex/skills/slash-prompt-router/scripts/catalog_prompts.py --format markdown
```

The script scans `~/.codex/prompts/*.md` and extracts:

- prompt name and slash command
- absolute file path
- description
- argument hint
- allowed tools
- short preview

Represent prompts with their exact slash form, for example `/handover` or `/git:commit-push`.

## Recommend Prompts

Run:

```bash
python3 ~/.codex/skills/slash-prompt-router/scripts/catalog_prompts.py \
  --query "<user task>" \
  --limit 5 \
  --format markdown
```

Treat the ranking as coarse recall, not the final answer. Choose the final recommendation by checking:

- whether the prompt output matches the user's goal
- whether the prompt needs arguments like `$ARGUMENTS` or `$1`
- whether the prompt is analysis-only, generation-only, or expects direct execution
- whether the prompt relies on current conversation context or a concrete file path/module path

Return:

- 1 primary recommendation
- 2-4 alternatives
- one short reason per candidate
- argument requirements for each candidate

If no prompt is a strong fit, say so plainly instead of forcing a weak match.

Unless the user explicitly says to auto-pick, stop after recommendation and wait for prompt selection.

## Execute a Selected Prompt

After the user chooses a prompt:

1. Read `~/.codex/prompts/<selected-name>.md`.
2. Treat that file as the task-local operating procedure.
3. Keep higher-priority system, developer, and direct user instructions above the prompt.
4. Resolve prompt arguments before execution:
   - `$ARGUMENTS`: pass the user's task text as a whole.
   - `$1` to `$9`: map only explicit positional inputs. If required values are missing, ask only for the missing ones.
   - no placeholders: use the prompt as workflow guidance and execute against the current task/context.
5. Execute the prompt workflow directly. Do not stop at summarizing the prompt unless the user explicitly asks for an explanation.
6. State which slash prompt you selected before or while executing so the task remains auditable.

If the user says "直接选最合适的 prompt 并执行", you may auto-select the top recommendation, but still announce the chosen prompt and the reason briefly.

## Guardrails

- Do not edit prompt files unless the user explicitly asks for prompt maintenance.
- Do not invent prompt capabilities that are not present in the file.
- If the chosen prompt conflicts with the direct user goal, say the prompt is not a fit and proceed with the user goal.
- Keep prompt paths absolute when you need to reference them for later reuse.

## Quick Examples

- "列出所有可用的 slash prompt"
- "我想梳理 API 调用链，推荐几个合适的 prompt"
- "用 `/handover` 帮我生成当前仓库的交接文档"
