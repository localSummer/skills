#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path


DEFAULT_PROMPTS_DIR = Path.home() / ".codex" / "prompts"
METADATA_PATTERN = re.compile(r"^([a-z0-9-]+):\s*(.+?)\s*$")
WORD_PATTERN = re.compile(r"[a-z0-9][a-z0-9:-]*")
CJK_PATTERN = re.compile(r"[\u4e00-\u9fff]+")


@dataclass
class PromptRecord:
    name: str
    slash_command: str
    path: str
    title: str
    description: str
    argument_hint: str
    allowed_tools: str
    preview: str


def load_prompt(path: Path) -> PromptRecord:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    metadata = read_metadata(lines)
    title = read_title(lines, path.stem)
    description = metadata.get("description") or read_description(lines)
    argument_hint = metadata.get("argument-hint") or infer_argument_hint(text)
    allowed_tools = metadata.get("allowed-tools", "unspecified")
    preview = build_preview(lines, description)
    return PromptRecord(
        name=path.stem,
        slash_command=f"/{path.stem}",
        path=str(path.resolve()),
        title=title,
        description=description,
        argument_hint=argument_hint,
        allowed_tools=allowed_tools,
        preview=preview,
    )


def read_metadata(lines: list[str]) -> dict[str, str]:
    metadata: dict[str, str] = {}
    for raw_line in lines[:20]:
        line = raw_line.strip()
        if not line:
            continue
        if line == "---" or line.startswith("#"):
            break
        match = METADATA_PATTERN.match(line)
        if not match:
            break
        key, value = match.groups()
        metadata[key] = value
    return metadata


def read_title(lines: list[str], fallback: str) -> str:
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()
    return fallback


def read_description(lines: list[str]) -> str:
    preview_lines = []
    in_code_block = False
    for raw_line in lines:
        line = raw_line.strip()
        if line.startswith("```"):
            in_code_block = not in_code_block
            continue
        if in_code_block or not line:
            continue
        if line == "---":
            continue
        if line.startswith("#"):
            continue
        if METADATA_PATTERN.match(line):
            continue
        preview_lines.append(line)
        if len(preview_lines) >= 2:
            break
    return " ".join(preview_lines) if preview_lines else "No description available."


def infer_argument_hint(text: str) -> str:
    positional = sorted({int(value) for value in re.findall(r"\$(\d)", text)})
    if positional:
        return " ".join(f"${value}" for value in positional)
    if "$ARGUMENTS" in text:
        return "$ARGUMENTS"
    return "none"


def build_preview(lines: list[str], description: str) -> str:
    snippets = []
    in_code_block = False
    for raw_line in lines:
        line = raw_line.strip()
        if line.startswith("```"):
            in_code_block = not in_code_block
            continue
        if in_code_block or not line:
            continue
        if line == "---":
            continue
        if line.startswith("#"):
            continue
        if METADATA_PATTERN.match(line):
            continue
        snippets.append(line)
        if len(snippets) >= 3:
            break
    preview = " ".join(snippets) if snippets else description
    return squeeze(preview, 160)


def squeeze(text: str, limit: int) -> str:
    compact = re.sub(r"\s+", " ", text).strip()
    if len(compact) <= limit:
        return compact
    return compact[: limit - 3].rstrip() + "..."


def english_tokens(text: str) -> set[str]:
    return {token for token in WORD_PATTERN.findall(text.lower()) if len(token) >= 2}


def cjk_chunks(text: str) -> list[str]:
    return [chunk for chunk in CJK_PATTERN.findall(text) if len(chunk) >= 2]


def cjk_ngrams(text: str) -> set[str]:
    ngrams: set[str] = set()
    for chunk in cjk_chunks(text):
        if len(chunk) <= 3:
            ngrams.add(chunk)
            continue
        for size in (2, 3):
            for index in range(len(chunk) - size + 1):
                ngrams.add(chunk[index : index + size])
    return ngrams


def score_prompt(record: PromptRecord, query: str) -> tuple[int, list[str]]:
    if not query.strip():
        return 0, []

    name_text = record.name.lower()
    body_text = " ".join(
        [record.title, record.description, record.preview, record.argument_hint]
    ).lower()
    query_text = query.strip().lower()
    reasons: list[str] = []
    score = 0

    if query_text in name_text:
        score += 50
        reasons.append("命令名直接命中")
    elif query_text in body_text:
        score += 28
        reasons.append("说明文本直接命中")

    matched_terms: list[str] = []
    matched_grams: list[str] = []
    for token in sorted(english_tokens(query_text)):
        if token in name_text:
            score += 12
            matched_terms.append(token)
            continue
        if token in body_text:
            score += 6
            matched_terms.append(token)

    for chunk in cjk_chunks(query):
        if chunk in record.name or chunk in record.title or chunk in record.description:
            score += min(18, len(chunk) * 4)
            matched_terms.append(chunk)
            continue
        if chunk in record.preview:
            score += min(12, len(chunk) * 3)
            matched_terms.append(chunk)

    for gram in cjk_ngrams(query):
        if gram in record.description or gram in record.preview:
            score += 1
            matched_grams.append(gram)

    if matched_terms:
        unique_terms = []
        for term in matched_terms:
            if term not in unique_terms:
                unique_terms.append(term)
        reasons.append("匹配词: " + ", ".join(unique_terms[:5]))
    elif matched_grams:
        unique_grams = []
        for gram in matched_grams:
            if gram not in unique_grams:
                unique_grams.append(gram)
        reasons.append("片段命中: " + ", ".join(unique_grams[:5]))

    return score, reasons


def format_markdown(records: list[dict[str, object]], show_score: bool) -> str:
    if not records:
        return "No prompts found."

    if show_score:
        header = "| slash prompt | 简介 | 参数 | score | 说明 | 路径 |\n| --- | --- | --- | ---: | --- | --- |"
        rows = [
            "| {slash_command} | {description} | {argument_hint} | {score} | {reason} | {path} |".format(
                slash_command=record["slash_command"],
                description=escape_cell(record["description"]),
                argument_hint=escape_cell(record["argument_hint"]),
                score=record["score"],
                reason=escape_cell("; ".join(record["reasons"]) or "无明显命中"),
                path=escape_cell(record["path"]),
            )
            for record in records
        ]
        return "\n".join([header, *rows])

    header = "| slash prompt | 简介 | 参数 | 路径 |\n| --- | --- | --- | --- |"
    rows = [
        "| {slash_command} | {description} | {argument_hint} | {path} |".format(
            slash_command=record["slash_command"],
            description=escape_cell(record["description"]),
            argument_hint=escape_cell(record["argument_hint"]),
            path=escape_cell(record["path"]),
        )
        for record in records
    ]
    return "\n".join([header, *rows])


def escape_cell(value: object) -> str:
    return str(value).replace("|", "\\|")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Catalog local slash prompts and rank them for a task.",
    )
    parser.add_argument(
        "--prompts-dir",
        default=str(DEFAULT_PROMPTS_DIR),
        help="Prompt directory to scan. Defaults to ~/.codex/prompts",
    )
    parser.add_argument(
        "--query",
        default="",
        help="Task description used to rank likely prompt matches.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=50,
        help="Maximum number of prompt records to print.",
    )
    parser.add_argument(
        "--format",
        choices=("markdown", "json"),
        default="markdown",
        help="Output format.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    prompts_dir = Path(args.prompts_dir).expanduser().resolve()
    if not prompts_dir.exists():
        raise SystemExit(f"Prompt directory not found: {prompts_dir}")

    records = [load_prompt(path) for path in sorted(prompts_dir.glob("*.md"))]
    ranked: list[dict[str, object]] = []
    for record in records:
        score, reasons = score_prompt(record, args.query)
        payload = asdict(record)
        payload["score"] = score
        payload["reasons"] = reasons
        ranked.append(payload)

    if args.query.strip():
        ranked.sort(key=lambda item: (-int(item["score"]), str(item["name"])))
        positive_hits = [item for item in ranked if int(item["score"]) > 0]
        display_records = positive_hits[: args.limit] or ranked[: args.limit]
    else:
        ranked.sort(key=lambda item: str(item["name"]))
        display_records = ranked[: args.limit]

    if args.format == "json":
        print(json.dumps(display_records, ensure_ascii=False, indent=2))
    else:
        print(format_markdown(display_records, show_score=bool(args.query.strip())))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
