---
name: adversarial-review
description: Multi-agent adversarial code review using three competing agents (Bug-finder, Defender, Referee) to filter noise and surface high-value engineering insights.
---

# Adversarial Review

Three-agent pipeline that exploits competitive scoring to produce high-signal code review results:

1. **Bug-finder** - Exhaustive defect scanning with incentivized over-reporting
2. **Adversarial Defender** - Rigorous rebuttal of false positives with asymmetric penalty
3. **Referee** - Independent adjudication producing the final verdict

This adversarial tension is designed to filter the majority of AI noise, leaving actionable engineering insights.

## When to Use

- Complex projects (frontend migrations, backend service refactors, large library updates)
- Deep accessibility (a11y), performance, security, or type safety audits
- When single-agent review produces too many false positives
- Pre-merge review of high-risk changes

## Parameters

| Param | Required | Description |
|-------|----------|-------------|
| `target_path` | Yes | File or directory to review |
| `focus` | No | Focus area: `a11y`, `performance`, `type-safety`, `security`, `all` (default: `all`) |
| `severity_threshold` | No | Minimum severity to report: `low`, `medium`, `high` (default: `low`) |

> **Note on schemas**: The JSON schemas defined in each phase below are canonical. Persona reference files may include example snippets but SKILL.md is the source of truth for field names and structure.

## Workflow

### Phase 1: Bug-finder Scan

Launch a subagent with the Bug-finder persona. See [references/bug-finder-persona.md](references/bug-finder-persona.md) for the full role definition.

**Subagent configuration:**
- `subagent_type`: `general-purpose`
- Provide the Bug-finder persona prompt from the reference file
- Input: target code path + focus area
- Output: scored bug report (JSON-structured object)

**Expected output format:**
```
{
  "findings": [
    {
      "bug_id": "BF-001",
      "severity": "high|medium|low",
      "score": 10|5|1,
      "category": "a11y|performance|type-safety|security|logic|code-quality",
      "location": "file:line",
      "description": "...",
      "evidence": "code snippet or reasoning"
    }
  ],
  "summary": { "total": 0, "by_category": {}, "by_severity": {} }
}
```

### Phase 2: Adversarial Rebuttal

Launch a second subagent with the Adversarial Defender persona. See [references/adversarial-persona.md](references/adversarial-persona.md) for the full role definition.

**Subagent configuration:**
- `subagent_type`: `general-purpose`
- Provide the Adversarial Defender persona prompt from the reference file
- Input: Bug-finder's JSON output + target code path (each subagent runs in isolated context; only the structured JSON report is passed, not the Bug-finder's internal reasoning)
- Output: rebuttal report with verdicts per bug

**Expected output format:**
```
{
  "rebuttals": [
    {
      "bug_id": "BF-001",
      "verdict": "confirmed|false-positive|disputed",
      "rebuttal": "reasoning why this is/isn't a real issue",
      "evidence": "code reference, dependency check, or runtime analysis",
      "confidence": "high|medium|low"
    }
  ],
  "summary": { "confirmed": 0, "false_positives": 0, "disputed": 0 }
}
```

### Phase 3: Referee Adjudication

Launch a third subagent with the Referee persona. See [references/referee-persona.md](references/referee-persona.md) for the full role definition.

**Subagent configuration:**
- `subagent_type`: `general-purpose`
- Provide the Referee persona prompt from the reference file
- Input: Bug-finder report + Adversarial rebuttal (both sides' arguments)
- Output: final verdict with actionable recommendations

**Expected output format:**
```
{
  "verdicts": [
    {
      "bug_id": "BF-001",
      "final_verdict": "valid|invalid|needs-investigation",
      "severity": "high|medium|low",
      "reasoning": "which side's argument is stronger and why",
      "recommendation": "specific fix or next step"
    }
  ],
  "stats": { "valid": 0, "invalid": 0, "needs_investigation": 0 },
  "health_score": 0,
  "top_3_fixes": ["...", "...", "..."]
}
```

### Phase 4: Result Synthesis

After receiving the Referee's verdict, synthesize the final report:

1. Filter results by `severity_threshold` (note: `needs-investigation` items are always included regardless of threshold)
2. Group by category
3. Sort by severity (high > medium > low)
4. Present to user with:
   - Summary statistics (total found / confirmed / false-positive rate)
   - Confirmed issues (`valid`) with fix recommendations
   - Items requiring investigation (`needs-investigation`) with suggested next steps
   - Excluded false positives (`invalid`) -- listed as a count with optional detail toggle
   - Key takeaways: 2-3 sentences summarizing recurring patterns and systemic issues found across the codebase

## Scoring System

Each agent has an asymmetric incentive: Bug-finder earns points for findings (with a small penalty for false positives), Defender earns points for successful rebuttals (with an elevated penalty for wrong rebuttals), and Referee earns points only for correct verdicts. See [references/scoring-rubric.md](references/scoring-rubric.md) for the complete scoring mechanics.

## Error Handling

- If `target_path` does not exist or contains no readable files, abort with a clear error message before launching any subagent.
- If any subagent fails to produce valid JSON output, retry once. If it fails again, report the phase that failed and any partial results from earlier phases.
- If the target path is a single file, proceed normally. If it is a directory, recursively include all supported source files.

## Example Usage

```
User: "adversarial review src/components/checkout"
User: "multi-agent audit src/pages, focus on a11y"
User: "deep bug hunt src/store/cart.ts, severity medium and above"
```
