from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    ROOT / "index.html",
    ROOT / "app.js",
    ROOT / "classifier-engine.js",
    ROOT / "question_flow.json",
    ROOT / "adaptive_rules.json",
    ROOT / "README.md",
]
JSON_TEXT_KEYS = {"text", "label", "userText", "question", "trueLabel", "falseLabel", "trueUserText", "falseUserText"}
UNICODE_REPLACEMENT_CHAR = "\ufffd"
MOJIBAKE_SEQUENCES = [
    "??", "??", "??", "??", "??", "??", "??", "??", "??",
    "??", "??", "??", "??", "??", "??", "??", "??", "??",
    "??", "??", "??", "??", "??", "??", "??", "??", "??",
    "?", "?",
]


def has_mojibake(text: str) -> bool:
    if not text:
        return False
    if UNICODE_REPLACEMENT_CHAR in text:
        return True
    if "???" in text:
        return True
    return any(seq in text for seq in MOJIBAKE_SEQUENCES)


def collect_json_strings(value, path: str = "$"):
    found: list[tuple[str, str]] = []
    if isinstance(value, dict):
        for key, item in value.items():
            next_path = f"{path}.{key}"
            if key in JSON_TEXT_KEYS and isinstance(item, str):
                found.append((next_path, item))
            found.extend(collect_json_strings(item, next_path))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            found.extend(collect_json_strings(item, f"{path}[{index}]"))
    return found


def check_json_file(path: Path):
    issues: list[tuple[str, str]] = []
    data = json.loads(path.read_text(encoding="utf-8"))
    for key_path, text in collect_json_strings(data):
        if has_mojibake(text):
            issues.append((f"{path}:{key_path}", text))
    return issues


def check_text_file(path: Path):
    issues: list[tuple[str, str]] = []
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if has_mojibake(line):
            issues.append((f"{path}:{line_no}", line.strip()))
    return issues


def main() -> int:
    issues: list[tuple[str, str]] = []
    for path in FILES:
        if not path.exists():
            continue
        if path.suffix == ".json":
            issues.extend(check_json_file(path))
        else:
            issues.extend(check_text_file(path))

    if not issues:
        print("OK: suspicious encoding artifacts not found")
        return 0

    print("Potential encoding issues found:")
    for location, snippet in issues:
        safe_snippet = snippet.encode("unicode_escape").decode("ascii")
        print(f"- {location}: {safe_snippet}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
