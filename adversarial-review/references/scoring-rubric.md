# Scoring Rubric

## Design Philosophy

The scoring system leverages AI agents' tendency toward instruction-following optimization. By giving each agent a different scoring incentive, we create productive tension:

- **Bug-finder** is incentivized to **over-report** (more bugs = more points)
- **Adversarial Defender** is incentivized to **carefully refute** (wrong rebuttals = elevated penalty)
- **Referee** is incentivized to be **maximally precise** (symmetric penalty for wrong verdicts)

This three-way tension naturally filters noise and converges on truth.

## Severity Definitions

### High Severity (+10 points)
Issues that cause user-facing failures or security risks:
- Application crash or unhandled exception
- Data loss or corruption
- Security vulnerability (XSS, injection, data exposure)
- Complete accessibility barrier (unusable for assistive technology users)
- Critical performance degradation (page freeze, infinite loop)

### Medium Severity (+5 points)
Issues that degrade quality but don't cause failures:
- Potential runtime error under specific conditions
- Missing edge case handling
- Accessibility issue that degrades but doesn't block usage
- Performance issue (unnecessary re-renders, missing memoization)
- Type safety gap that could cause bugs downstream

### Low Severity (+1 point)
Issues that affect maintainability or style:
- Code style inconsistency
- Missing or incorrect comments
- Suboptimal naming
- Minor code duplication
- Unused imports or variables

## Agent-Specific Scoring

### Bug-finder Scoring
```
Total Score = sum(severity_score for each reported bug) - sum(1 for each item ruled invalid by Referee)
```
A small penalty (-1) for false positives discourages padding while still encouraging thorough scanning.

### Adversarial Defender Scoring
```
Successful rebuttal:  +N (where N = bug's original score)
Failed rebuttal:      -1.5N (elevated penalty)
Skipped/confirmed:     0 (no score change)
```
The 1.5x penalty ratio forces conservative, evidence-based rebuttals.

> **Note**: These scores are behavioral framing to shape agent output quality. They are not computed at runtime -- the scoring exists as prompt incentive, not as a real-time scoring engine.

### Referee Scoring
```
Correct verdict:   +10
Incorrect verdict: -10
```
Symmetric penalty forces balanced judgment without bias toward either side.

## False Positive Rate Target

Aspirational targets (not empirically validated -- actual results will vary by codebase):
- Bug-finder raw report: 50-150 items (intentionally noisy)
- After adversarial filtering: 30-50% confirmed as real
- After referee adjudication: final false-positive rate < 10%

## Quality Metrics (Final Report)

> These metrics are prompt-level framing to guide the Referee's summary output. They are computed from the Referee's verdicts, not from an external scoring engine.

| Metric | Formula |
|--------|---------|
| Raw findings | Total Bug-finder items |
| False positive rate | Invalid / Total * 100% |
| Noise reduction | (Raw - Valid) / Raw * 100% |
| Code health score | Referee's 1-10 assessment (calibration: 1-3 critical issues present, 4-6 significant issues, 7-9 minor issues only, 10 clean) |
