#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


FEATURE_CATALOG_71 = {
    "is_sphere": {"question": "??? ????"},
    "is_sphere": {"question": "??? ????"},
    "is_hollow_sphere": {"question": "??? ??????"},
    "has_suspension_element": {"question": "???? ??????? ??? ?????????"},
    "has_center_hole": {"question": "Есть ли центральное отверстие?"},
    "has_face_ring_grooves": {"question": "Есть ли кольцевые пазы на торцах?"},
    "has_outer_slots_or_splines": {"question": "Есть ли пазы или шлицы на наружной поверхности?"},
    "has_off_axis_holes": {"question": "Есть ли отверстия вне оси детали?"},
    "is_blind_hole": {"question": "Центральное отверстие глухое?"},
    "has_thread_in_hole": {"question": "Есть ли резьба в центральном отверстии?"},
    "is_stepped_hole": {"question": "Центральное отверстие ступенчатое?"},
    "is_round_hole": {"question": "Центральное отверстие круглое?"},
}

SERVICE_DESCRIPTION_PATTERNS = (
    "по двум и более видам норм",
    "свойства деталей",
    "маркировка",
    "консервация",
    "упаковка",
    "контроль",
    "приемка",
    "транспортирование",
    "хранение",
    "монтаж",
    "эксплуатация",
    "ремонт",
    "материалы",
    "технология производства",
    "прочие",
    "для деталей всего подкласса",
    "для деталей всего класса",
)


@dataclass
class Node:
    code: str
    description: str
    image: str | None
    children: list["Node"]


def normalize_text(value: str) -> str:
    return (value or "").lower().replace("ё", "е")


def normalize_description_text(value: str) -> str:
    text = normalize_text(value)
    replacements = [
        (r"???\.", "?????????"),
        (r"???", "?????????"),
        (r"?????\.", "???????????"),
        (r"???\.", "????????"),
        (r"???\.", "???????????"),
        (r"????????\.", "???????????"),
        (r"???\.", "??????"),
        (r"???", "??????"),
        (r"?????\.", "??????????"),
        (r"????\.", "??????"),
        (r"????\.", "???????"),
        (r"???????\.", "?????????"),
        (r"?????\.", "??????????"),
        (r"????????\.", "?????????????"),
        (r"????????\.", "???????????????"),
        (r"????\.", "?????????"),
        (r"?????\.", "???????"),
        (r"?????? ?/??? ???????", "?????? ???????"),
        (r"????? ?/??? ??????", "????? ??????"),
        (r"??????|???????|??????|?????", "?????"),
        (r"???\.", "????"),
    ]
    for pattern, replacement in replacements:
        text = re.sub(pattern, replacement, text)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\s*([,;|])\s*", r"  ", text)
    return text.strip()


def parse_clauses(path_segments: list[str]) -> list[str]:
    clauses: list[str] = []
    seen: set[str] = set()
    polarity_boundary = re.compile(
        r"\s+(?=(?:без|с)\s+(?:отверст\w*|паз\w*|шлиц\w*|кольцев\w*|резьб\w*|центр\w*))"
    )

    for segment in path_segments:
        normalized_segment = normalize_description_text(segment)
        parts = [part.strip() for part in re.split(r"[,;]+", normalized_segment) if part.strip()]
        expanded_parts: list[str] = []

        for part in parts:
            split_parts = [item.strip() for item in polarity_boundary.split(part) if item.strip()]
            expanded_parts.extend(split_parts or [part])

        for clause in [normalized_segment, *expanded_parts]:
            if clause and clause not in seen:
                seen.add(clause)
                clauses.append(clause)

    return clauses


def normalize_clause_token(token: str) -> str:
    if not token:
        return ""

    clean = re.sub(r'[.,?()"]', "", token)
    if clean == "и/или":
        return ""

    starters = {
        "паз": "паз",
        "шлиц": "шлиц",
        "наружн": "наружн",
        "поверхност": "поверхност",
        "поверх": "поверхност",
        "отверст": "отверст",
        "отв": "отверст",
        "кольцев": "кольцев",
        "кольц": "кольцев",
        "торц": "торц",
        "центр": "центр",
        "глух": "глух",
        "сквоз": "сквоз",
        "резьб": "резьб",
        "ступенчат": "ступенчат",
        "гладк": "гладк",
        "кругл": "кругл",
        "некругл": "некругл",
        "шар": "шар",
        "дет": "",
        "одн": "",
        "сторон": "",
    }

    for prefix, value in starters.items():
        if clean.startswith(prefix):
            return value

    if clean in {"вне", "оси"}:
        return clean
    if clean == "двух":
        return ""

    return clean


def get_clause_descriptor(clause: str) -> tuple[bool, str] | None:
    trimmed = clause.strip()
    if trimmed.startswith("без "):
        return False, trimmed[4:].strip()
    if trimmed.startswith("с "):
        return True, trimmed[2:].strip()
    if trimmed.startswith("кроме "):
        return False, trimmed[6:].strip()
    return None


def build_clause_core(body: str) -> str:
    stop_words = {"и", "или", "и/или", "или/и", "на", "в", "по", "для", "от", "до", "со"}
    tokens = [
        token
        for token in (normalize_clause_token(part) for part in body.split())
        if token and token not in stop_words
    ]
    return (
        " ".join(tokens)
        .replace("пазов", "паз")
        .replace("пазами", "паз")
        .replace("шлицев", "шлиц")
        .replace("шлицами", "шлиц")
        .replace("кольцевых", "кольцев")
        .replace("кольцевыми", "кольцев")
    )


def set_feature_value(target: dict[str, bool], key: str, value: bool | None) -> None:
    if value is None:
        return
    target.setdefault(key, value)


def map_clause_to_features(clause: str, features: dict[str, bool]) -> None:
    if re.search("без центральн\w* отверст", clause):
        set_feature_value(features, "has_center_hole", False)

    if re.search("кроме шар\w*", clause):
        set_feature_value(features, "is_sphere", False)

    if re.search("шар\w*", clause) and not re.search("кроме шар\w*", clause):
        set_feature_value(features, "is_sphere", True)

    if re.search("сплошн\w*", clause):
        set_feature_value(features, "is_hollow_sphere", False)

    if re.search("пол\w*", clause):
        set_feature_value(features, "is_hollow_sphere", True)

    if re.search("без эл-?т\w* для подвески", clause):
        set_feature_value(features, "has_suspension_element", False)

    if re.search("с эл-?т\w* для подвески", clause):
        set_feature_value(features, "has_suspension_element", True)

    if re.search("центральн\w* глух\w* отверст", clause) or re.search("глух\w* отверст", clause):
        set_feature_value(features, "has_center_hole", True)
        set_feature_value(features, "is_blind_hole", True)

    if re.search("центральн\w* сквоз\w* отверст", clause) or re.search("сквоз\w* отверст", clause):
        set_feature_value(features, "has_center_hole", True)
        set_feature_value(features, "is_blind_hole", False)

    if re.search("центральн\w* отверст", clause) and not re.search("без центральн\w* отверст", clause):
        set_feature_value(features, "has_center_hole", True)

    if re.search("без резьб", clause):
        set_feature_value(features, "has_thread_in_hole", False)

    if re.search("с резьб", clause) or re.search("резьбов", clause):
        set_feature_value(features, "has_thread_in_hole", True)

    if re.search("ступенчат", clause):
        set_feature_value(features, "is_stepped_hole", True)

    if re.search("гладк", clause):
        set_feature_value(features, "is_stepped_hole", False)

    if re.search("некругл", clause):
        set_feature_value(features, "is_round_hole", False)

    if re.search("кругл", clause) and not re.search("некругл", clause):
        set_feature_value(features, "is_round_hole", True)

    if re.search("без кольцев\w* паз\w* на торц", clause):
        set_feature_value(features, "has_face_ring_grooves", False)

    if re.search("с кольцев\w* паз\w* на торц", clause):
        set_feature_value(features, "has_face_ring_grooves", True)

    if (
        re.search("без паз\w* и шлиц\w* на наружн\w* поверхност", clause)
        or re.search("без паз\w* шлиц\w* на наружн\w* поверхност", clause)
        or re.search("без паз\w* на наружн\w* поверхност", clause)
        or re.search("без шлиц\w* на наружн\w* поверхност", clause)
    ):
        set_feature_value(features, "has_outer_slots_or_splines", False)

    if (
        re.search("с паз\w*(?:,?\s*шлиц\w*| и/или шлиц\w*| шлиц\w*)? на наружн\w* поверхност", clause)
        or re.search("с шлиц\w* на наружн\w* поверхност", clause)
    ):
        set_feature_value(features, "has_outer_slots_or_splines", True)

    if re.search("без отверст\w* вне оси", clause):
        set_feature_value(features, "has_off_axis_holes", False)

    if re.search("с отверст\w* вне оси", clause):
        set_feature_value(features, "has_off_axis_holes", True)


def extract_71_features(path_segments: list[str]) -> dict[str, bool]:
    features: dict[str, bool] = {}
    for clause in parse_clauses(path_segments):
        map_clause_to_features(clause, features)
    return features


def load_tree(path: Path) -> tuple[list[Node], dict[str, Node], dict[str, str | None], dict[str, list[str]]]:
    with path.open(encoding="utf-8-sig") as fh:
        raw = json.load(fh)

    node_index: dict[str, Node] = {}
    parent_index: dict[str, str | None] = {}
    path_index: dict[str, list[str]] = {}

    def build(node_data: dict[str, Any], parent_code: str | None = None, current_path: list[str] | None = None) -> Node:
        current_path = (current_path or []) + [node_data.get("description") or ""]
        children = [build(child, node_data["code"], current_path) for child in (node_data.get("children") or {}).values()]
        node = Node(
            code=str(node_data["code"]),
            description=node_data.get("description") or "",
            image=node_data.get("image"),
            children=children,
        )
        node_index[node.code] = node
        parent_index[node.code] = parent_code
        path_index[node.code] = current_path
        return node

    roots = [build(value) for value in raw.values()]
    return roots, node_index, parent_index, path_index


def load_adaptive_rules(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8-sig") as fh:
        return json.load(fh)


def evaluate_split(
    features: dict[str, dict[str, str]],
    items: dict[str, dict[str, bool | None]],
    candidate_codes: list[str],
    blocked_features: set[str] | None = None,
) -> dict[str, Any] | None:
    blocked_features = blocked_features or set()
    best_split = None
    infer_false_when_missing = {"has_face_ring_grooves"}

    for feature_key, feature_meta in features.items():
        if feature_key in blocked_features:
            continue

        values = [items.get(code, {}).get(feature_key) for code in candidate_codes]
        true_codes = [code for code in candidate_codes if items[code].get(feature_key) is True]
        false_codes = [code for code in candidate_codes if items[code].get(feature_key) is False]

        if any(value is None for value in values):
            if feature_key in infer_false_when_missing and true_codes and not false_codes:
                false_codes = [code for code in candidate_codes if items[code].get(feature_key) is not True]
            else:
                continue

        if not true_codes or not false_codes:
            continue

        split = {
            "feature_key": feature_key,
            "question": feature_meta["question"],
            "true_codes": true_codes,
            "false_codes": false_codes,
            "balance": abs(len(true_codes) - len(false_codes)),
        }

        if best_split is None or split["balance"] < best_split["balance"]:
            best_split = split

    return best_split


def get_dynamic_clause_split(nodes: list[Node], path_index: dict[str, list[str]]) -> dict[str, Any] | None:
    candidate_codes = [node.code for node in nodes]
    clause_groups: dict[str, dict[str, Any]] = {}

    for node in nodes:
        for clause in parse_clauses(path_index[node.code]):
            descriptor = get_clause_descriptor(clause)
            if descriptor is None:
                continue
            polarity, body = descriptor
            core = build_clause_core(body)
            if not core:
                continue

            group = clause_groups.setdefault(core, {"values": {}, "question": f"dynamic:{core}"})
            group["values"][node.code] = polarity

    best_split = None

    for core, group in clause_groups.items():
        values = [group["values"].get(code) for code in candidate_codes]
        if any(value is None for value in values):
            continue

        true_codes = [code for code in candidate_codes if group["values"][code] is True]
        false_codes = [code for code in candidate_codes if group["values"][code] is False]
        if not true_codes or not false_codes:
            continue

        split = {
            "feature_key": f"dynamic:{core}",
            "question": group["question"],
            "true_codes": true_codes,
            "false_codes": false_codes,
            "balance": abs(len(true_codes) - len(false_codes)),
        }
        if best_split is None or split["balance"] < best_split["balance"]:
            best_split = split

    return best_split


def get_explicit_split(nodes: list[Node], parent_code: str, adaptive_rules: dict[str, Any]) -> dict[str, Any] | None:
    rule = adaptive_rules.get(parent_code)
    if not rule:
        return None

    candidate_codes = [node.code for node in nodes]
    if not all(code in rule.get("items", {}) for code in candidate_codes):
        return None

    return evaluate_split(rule["features"], rule["items"], candidate_codes)


def get_feature_split_71(nodes: list[Node], path_index: dict[str, list[str]]) -> dict[str, Any] | None:
    if not all(node.code.startswith("71") for node in nodes):
        return None

    candidate_codes = [node.code for node in nodes]
    items = {node.code: extract_71_features(path_index[node.code]) for node in nodes}
    return evaluate_split(FEATURE_CATALOG_71, items, candidate_codes)


def resolve_group(
    nodes: list[Node],
    parent_code: str,
    adaptive_rules: dict[str, Any],
    path_index: dict[str, list[str]],
) -> dict[str, Any]:
    queue = [nodes]
    unresolved: list[list[Node]] = []
    used_questions: list[str] = []

    while queue:
        subset = queue.pop()
        if len(subset) <= 1:
            continue

        dynamic_split = get_dynamic_clause_split(subset, path_index)
        explicit_split = get_explicit_split(subset, parent_code, adaptive_rules)
        heuristic_split = get_feature_split_71(subset, path_index)

        split = dynamic_split or explicit_split or heuristic_split
        if not split:
            unresolved.append(subset)
            continue

        used_questions.append(split["feature_key"])
        code_to_node = {node.code: node for node in subset}
        queue.append([code_to_node[code] for code in split["true_codes"]])
        queue.append([code_to_node[code] for code in split["false_codes"]])

    return {
        "resolved": len(unresolved) == 0,
        "used_questions": used_questions,
        "unresolved": unresolved,
    }


def collect_leaf_choice_points(node: Node) -> list[Node]:
    result: list[Node] = []
    if node.children and all(not child.children for child in node.children) and len(node.children) > 1:
        result.append(node)
    for child in node.children:
        result.extend(collect_leaf_choice_points(child))
    return result


def is_service_branch(node: Node) -> bool:
    description = normalize_text(node.description)
    if any(pattern in description for pattern in SERVICE_DESCRIPTION_PATTERNS):
        return True

    if not node.children:
        return False

    child_descriptions = [normalize_text(child.description) for child in node.children]
    service_children = [
        child_description
        for child_description in child_descriptions
        if any(pattern in child_description for pattern in SERVICE_DESCRIPTION_PATTERNS)
    ]

    return len(service_children) == len(child_descriptions)


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze unresolved manual code choice points in ESKD adaptive logic.")
    parser.add_argument("--root", default="71", help="Code prefix to analyze, default: 71")
    parser.add_argument(
        "--limit",
        type=int,
        default=50,
        help="Maximum number of unresolved groups to print, default: 50",
    )
    parser.add_argument(
        "--json",
        dest="json_output",
        default="",
        help="Optional path to write full JSON report",
    )
    parser.add_argument(
        "--include-service",
        action="store_true",
        help="Include service/normative branches in the report",
    )
    args = parser.parse_args()

    base_dir = Path(__file__).resolve().parent.parent
    _, node_index, _, path_index = load_tree(base_dir / "eskd_tree.json")
    adaptive_rules = load_adaptive_rules(base_dir / "adaptive_rules.json")

    roots = [node for code, node in node_index.items() if code.startswith(args.root)]
    top_level = [node for node in roots if len(node.code) == len(args.root)]
    if not top_level:
        raise SystemExit(f"No nodes found for root prefix {args.root!r}")

    choice_points: list[Node] = []
    for node in top_level:
        choice_points.extend(collect_leaf_choice_points(node))

    unresolved_report: list[dict[str, Any]] = []
    resolved_count = 0
    skipped_service = 0

    for parent in sorted(choice_points, key=lambda item: item.code):
        if not args.include_service and is_service_branch(parent):
            skipped_service += 1
            continue

        outcome = resolve_group(parent.children, parent.code, adaptive_rules, path_index)
        if outcome["resolved"]:
            resolved_count += 1
            continue

        unresolved_groups = [
            [{"code": node.code, "description": node.description} for node in subset]
            for subset in outcome["unresolved"]
        ]
        unresolved_report.append(
            {
                "parent_code": parent.code,
                "parent_description": parent.description,
                "child_count": len(parent.children),
                "used_questions": outcome["used_questions"],
                "unresolved_groups": unresolved_groups,
            }
        )

    total = len(choice_points)
    print(f"Analyzed choice points: {total}")
    if not args.include_service:
        print(f"Skipped service/normative points: {skipped_service}")
    print(f"Resolved automatically: {resolved_count}")
    print(f"Unresolved manual-choice points: {len(unresolved_report)}")
    print()

    for item in unresolved_report[: args.limit]:
        print(f"{item['parent_code']} | {item['parent_description']}")
        if item["used_questions"]:
            print(f"  used: {', '.join(item['used_questions'])}")
        for group in item["unresolved_groups"]:
            codes = ", ".join(f"{row['code']} ({row['description']})" for row in group)
            print(f"  unresolved: {codes}")
        print()

    if args.json_output:
        output_path = Path(args.json_output)
        output_path.write_text(
            json.dumps(
                {
                    "root": args.root,
                    "total_choice_points": total,
                    "skipped_service": skipped_service,
                    "resolved_count": resolved_count,
                    "unresolved_count": len(unresolved_report),
                    "unresolved": unresolved_report,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        print(f"JSON report written to {output_path}")


if __name__ == "__main__":
    main()
