# Claude Skills Collection

A repository of specialized skills designed to enhance Claude's capabilities in development, code analysis, and agent orchestration.

## Overview

This project contains a set of high-quality, documented skills that follow structured workflows. Each skill is designed to solve specific problems while maintaining a clean separation of concerns.

## Available Skills

| Skill | Description | Directory |
| :--- | :--- | :--- |
| **Mapping Loader** | Queries mapping files for agents, commands, and skills from `~/.claude/mappings/`. | `mapping-loader/` |
| **Code Review** | Generates structured review reports with Mermaid diagrams using Git diffs. | `code-review/` |
| **Codex Subagent** | Spawns autonomous subagents to offload context-heavy tasks and research. | `codex-subagent/` |
| **Skill Review** | Analyzes session history to propose improvements or new skill ideas. | `skill-review/` |
| **Skill Validator** | Provides semantic validation of skill workflows and quality standards. | `skill-validator/` |

## Skill Details

### [Mapping Loader](./mapping-loader/SKILL.md)
Provides utilities for discovering and executing local or plugin-based assets. It handles the mapping between user requests and the actual file paths on the system.

### [Code Review](./code-review/SKILL.md)
A comprehensive workflow for analyzing code changes. It includes scripts for gathering Git changes, analyzing workflows, and generating visual impact reports to help developers understand code evolution.

### [Codex Subagent](./codex-subagent/SKILL.md)
An orchestration tool that allows Claude to delegate heavy-duty work to background subagents. It is recommended for tasks adding 3,000+ tokens to the current context, such as deep research or large-scale codebase exploration.

### [Skill Review](./skill-review/SKILL.md)
A meta-skill used to iterate on the developer's toolkit. It harvests feedback from conversations to suggest refinements to existing skills or identify the need for new ones.

### [Skill Validator](./skill-validator/SKILL.md)
A quality assurance tool that uses AI to perform semantic analysis on skill definitions. it ensures workflows are complete, transitions are logical, and best practices (like the inclusion of WHY/WHAT/HOW guidance) are followed.

## Project Structure

```text
skills/
├── code-review/       # Git-based code change analysis
├── codex-subagent/    # Background agent execution scripts
├── mapping-loader/    # Mapping file discovery utilities
├── skill-review/      # Dialogue feedback and iteration logic
└── skill-validator/   # Semantic quality assurance tool
```

## Development Principles

- **Single Responsibility**: Each skill focuses on one core workflow.
- **Standardized Documentation**: Every skill includes a `SKILL.md` with YAML frontmatter.
- **Validation Driven**: New skills should be verified using the `skill-validator`.
- **Incremental Progress**: Skills are iterated upon based on real-world usage feedback via `skill-review`.
