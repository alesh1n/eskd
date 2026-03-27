#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROTATION_FEATURE_CATALOG = {
    "is_sphere": {"question": "Это шар?"},
    "is_hollow_sphere": {"question": "Шар полый?"},
    "has_suspension_element": {"question": "Есть элемент для подвески?"},
    "has_hub_face_slots_or_lugs": {"question": "Есть пазы или выступы на торце ступицы?"},
    "is_ring_sector": {"question": "Это кольцевой сектор или сегмент?"},
    "has_center_hole": {"question": "Есть ли центральное отверстие?"},
    "has_face_ring_grooves": {"question": "Есть ли кольцевые пазы на торцах?"},
    "has_outer_slots_or_splines": {"question": "Есть ли пазы или шлицы на наружной поверхности?"},
    "has_off_axis_holes": {"question": "Есть ли отверстия вне оси детали?"},
    "is_blind_hole": {"question": "Центральное отверстие глухое?"},
    "has_thread_in_hole": {"question": "Есть ли резьба в центральном отверстии?"},
    "is_stepped_hole": {"question": "Центральное отверстие ступенчатое?"},
    "is_round_hole": {"question": "Центральное отверстие круглое?"},
}

GENERAL_FEATURE_CATALOG = {
    "has_local_bends": {"question": "Есть местные изгибы?"},
    "has_slots": {"question": "Есть пазы?"},
    "has_holes": {"question": "Есть отверстия?"},
    "has_cooling_ribs": {"question": "\u0415\u0441\u0442\u044c \u0440\u0435\u0431\u0440\u0430 \u043e\u0445\u043b\u0430\u0436\u0434\u0435\u043d\u0438\u044f \u043d\u0430 \u043d\u0430\u0440\u0443\u0436\u043d\u043e\u0439 \u043f\u043e\u0432\u0435\u0440\u0445\u043d\u043e\u0441\u0442\u0438?"},
    "base_hole_orientation_parallel": {"question": "\u0411\u0430\u0437\u043e\u0432\u044b\u0435 \u043e\u0442\u0432\u0435\u0440\u0441\u0442\u0438\u044f \u043f\u0430\u0440\u0430\u043b\u043b\u0435\u043b\u044c\u043d\u044b\u0435?"},
}

SERVICE_DESCRIPTION_PATTERNS = (
    'по двум и более видам норм',
    'свойства деталей',
    'маркировка',
    'консервация',
    'упаковка',
    'контроль',
    'приемка',
    'транспортирование',
    'хранение',
    'монтаж',
    'эксплуатация',
    'ремонт',
    'материалы',
    'технология производства',
    'прочие',
    'для деталей всего подкласса',
    'для деталей всего класса',
)


@dataclass
class Node:
    code: str
    description: str
    image: str | None
    children: list["Node"]


def canonicalize_signature_text(value: str) -> str:
    text = normalize_description_text(value)
    text = re.sub(r"\b\d+(?:\s*,\s*\d+)?\b", "<num>", text)
    text = re.sub(r"\b(?:вкл|включ|включительно)\b", "", text)
    text = re.sub(r"\bмм\b", "мм", text)
    text = re.sub(r"\s+", " ", text).strip(" ,.-")
    return text


def build_subset_signature(subset: list[Node]) -> str:
    parts = [canonicalize_signature_text(node.description) for node in subset]
    parts.sort()
    return " || ".join(parts)


def build_parent_signature(parent_description: str, subset: list[Node]) -> str:
    return f"{canonicalize_signature_text(parent_description)} => {build_subset_signature(subset)}"


def summarize_pattern_groups(unresolved_entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[str, dict[str, Any]] = {}
    for entry in unresolved_entries:
        for subset in entry["unresolved"]:
            signature = build_parent_signature(
                entry["description"],
                [Node(code=item["code"], description=item["description"], image=None, children=[]) for item in subset],
            )
            bucket = groups.setdefault(
                signature,
                {
                    "signature": signature,
                    "count": 0,
                    "parents": [],
                    "used_questions": set(),
                    "example": {
                        "parent_code": entry["code"],
                        "parent_description": entry["description"],
                        "subset": subset,
                    },
                },
            )
            bucket["count"] += 1
            bucket["parents"].append(entry["code"])
            bucket["used_questions"].update(entry.get("used_questions", []))

    result = []
    for bucket in groups.values():
        result.append(
            {
                "signature": bucket["signature"],
                "count": bucket["count"],
                "parents": sorted(set(bucket["parents"])),
                "used_questions": sorted(bucket["used_questions"]),
                "example": bucket["example"],
            }
        )
    result.sort(key=lambda item: (-item["count"], item["signature"]))
    return result




def normalize_text(value: str) -> str:
    return (value or "").lower().replace("ё", "е")


def normalize_description_text(value: str) -> str:
    text = normalize_text(value)
    replacements = [
        ("отв.", "отверстие"),
        ("центр.", "центральное"),
        ("нар.", "наружной"),
        ("пов.", "поверхности"),
        ("поверхн.", "поверхности"),
        ("поверх.", "поверхности"),
        ("дет.", "детали"),
        ("кольц.", "кольцевыми"),
        ("торц.", "торцах"),
        ("круг.", "круглое"),
        ("некругл.", "некруглое"),
        ("конич.", "конической"),
        ("криволин.", "криволинейной"),
        ("комбинир.", "комбинированной"),
        ("закр.", "закрытыми"),
        ("резьб.", "резьбой"),
        ("пазами и/или шлицами", "пазами шлицами"),
        ("пазов и/или шлицев", "пазов шлицев"),
        ("шлицев", "шлицы"),
        ("шлицами", "шлицы"),
        ("шлицам", "шлицы"),
        ("паз.", "пазы"),
    ]
    for old, new in replacements:
        text = text.replace(old, new)

    text = re.sub(r"\bотв\b", "отверстие", text)
    text = re.sub(r"\bдет\b", "детали", text)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\s*([,;|])\s*", r" \1 ", text)
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
        "пол": "пол",
        "сплошн": "сплошн",
        "подвес": "подвеск",
        "эл": "элемент",
        "детал": "",
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

    if re.search("\bпол(?:ый|ая|ое|ые|ого|ой|ых)\w*", clause):
        set_feature_value(features, "is_hollow_sphere", True)

    if re.search("без эл-?т\w* для подвески", clause):
        set_feature_value(features, "has_suspension_element", False)

    if re.search("с эл-?т\w* для подвески", clause):
        set_feature_value(features, "has_suspension_element", True)

    if re.search("без местн\w* изгиб\w*", clause):
        set_feature_value(features, "has_local_bends", False)

    if re.search("с местн\w* изгиб\w*", clause):
        set_feature_value(features, "has_local_bends", True)

    if re.search("без паз\w*", clause) and not re.search("наружн\w* поверхност\w*|торц\w*|шлиц\w*", clause):
        set_feature_value(features, "has_slots", False)

    if re.search("с паз\w*", clause) and not re.search("наружн\w* поверхност\w*|торц\w*|шлиц\w*", clause):
        set_feature_value(features, "has_slots", True)

    if re.search("без отверст\w*", clause) and not re.search("центральн\w*|вне оси", clause):
        set_feature_value(features, "has_holes", False)

    if (re.search("с отверст\w*", clause) or re.search("и/или отверст\w*", clause)) and not re.search("центральн\w*|вне оси", clause):
        set_feature_value(features, "has_holes", True)

    if re.search("без паз\w* и выступ\w* на торц\w* ступиц\w*", clause):
        set_feature_value(features, "has_hub_face_slots_or_lugs", False)

    if re.search("с паз\w* и выступ\w* на торц\w* ступиц\w*", clause):
        set_feature_value(features, "has_hub_face_slots_or_lugs", True)

    if re.search("кроме кольцев\w*", clause):
        set_feature_value(features, "is_ring_sector", False)

    if re.search("кольцев\w*", clause) and not re.search("кроме кольцев\w*", clause):
        set_feature_value(features, "is_ring_sector", True)

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
        or re.search("с[о]?\s*шлиц\w* на наружн\w* поверхност", clause)
    ):
        set_feature_value(features, "has_outer_slots_or_splines", True)

    if re.search("без отверст\w* вне оси", clause):
        set_feature_value(features, "has_off_axis_holes", False)

    if re.search("с отверст\w* вне оси", clause):
        set_feature_value(features, "has_off_axis_holes", True)



def extract_rotation_features(path_segments: list[str]) -> dict[str, bool]:
    features: dict[str, bool] = {}
    for clause in parse_clauses(path_segments):
        map_clause_to_features(clause, features)
    return features


def extract_general_features(path_segments: list[str]) -> dict[str, Any]:
    features: dict[str, Any] = {}
    for clause in parse_clauses(path_segments):
        map_clause_to_features(clause, features)

    leaf_segment = normalize_description_text(path_segments[-1] if path_segments else "")
    if re.search("\u043a\u043e\u043c\u0431\u0438\u043d\u0438\u0440", leaf_segment):
        features["base_hole_kind"] = "combined"
    elif re.search("\u0441\u043a\u0432\u043e\u0437", leaf_segment):
        features["base_hole_kind"] = "through"
    elif re.search("\u0433\u043b\u0443\u0445", leaf_segment):
        features["base_hole_kind"] = "blind"

    if re.search("\u0431\u0435\u0437 \u0440\u0435\u0431\u0435\u0440 \u043e\u0445\u043b\u0430\u0436\u0434\u0435\u043d\u0438\u044f", leaf_segment):
        features["has_cooling_ribs"] = False
    elif re.search("\u0441 \u0440\u0435\u0431\u0440\u0430\u043c\u0438 \u043e\u0445\u043b\u0430\u0436\u0434\u0435\u043d\u0438\u044f", leaf_segment):
        features["has_cooling_ribs"] = True

    if re.search("\u043d\u0435\u043f\u0430\u0440\u0430\u043b", leaf_segment):
        features["base_hole_orientation_parallel"] = False
    elif re.search("\u043f\u0430\u0440\u0430\u043b", leaf_segment) and not re.search(r"\u043f\u0430\u0440\u0430\u043b\.\s*\u0438\s*\u043d\u0435\u043f\u0430\u0440\u0430\u043b", leaf_segment):
        features["base_hole_orientation_parallel"] = True

    return features


def extract_module_range(path_segments: list[str]) -> dict[str, float] | None:
    text = normalize_description_text(" ".join(path_segments))
    number_pattern = r"([0-9]+(?:\s*,\s*[0-9]+)?)"
    def find_last(pattern: str):
        matches = list(re.finditer(pattern, text, re.IGNORECASE))
        return matches[-1] if matches else None

    match = find_last(rf"с модулем до\s*{number_pattern}\s*мм")
    if match:
        return {"min": float("-inf"), "max": float(match.group(1).replace(" ", "").replace(",", "."))}

    match = find_last(rf"с модулем св\.?\s*{number_pattern}\s*до\s*{number_pattern}\s*мм")
    if match:
        return {
            "min": float(match.group(1).replace(" ", "").replace(",", ".")),
            "max": float(match.group(2).replace(" ", "").replace(",", ".")),
        }

    match = find_last(rf"с модулем св\.?\s*{number_pattern}\s*мм")
    if match:
        return {"min": float(match.group(1).replace(" ", "").replace(",", ".")), "max": float("inf")}

    return None


def load_tree(path: Path) -> tuple[list[Node], dict[str, Node], dict[str, str | None], dict[str, list[str]]]:
    with path.open(encoding="utf-8-sig") as fh:
        raw = json.load(fh)

    node_index: dict[str, Node] = {}
    parent_index: dict[str, str | None] = {}
    path_index: dict[str, list[str]] = {}

    def build(node_data: dict[str, Any], parent_code: str | None = None, current_path: list[str] | None = None) -> Node:
        current_path = (current_path or []) + [node_data.get("description") or ""]
        children = [build(child, str(node_data["code"]), current_path) for child in (node_data.get("children") or {}).values()]
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

            group = clause_groups.setdefault(core, {"values": {}})
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
            "question": f"dynamic:{core}",
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


GENERAL_ENUM_FEATURE_CATALOG = {
    "base_hole_kind": {
        "question": "\u041a\u0430\u043a\u0438\u043c \u044f\u0432\u043b\u044f\u0435\u0442\u0441\u044f \u0431\u0430\u0437\u043e\u0432\u043e\u0435 \u043e\u0442\u0432\u0435\u0440\u0441\u0442\u0438\u0435?",
        "order": ["blind", "through", "combined"],
        "values": {
            "blind": {"label": "\u0413\u043b\u0443\u0445\u043e\u0435"},
            "through": {"label": "\u0421\u043a\u0432\u043e\u0437\u043d\u043e\u0435"},
            "combined": {"label": "\u041a\u043e\u043c\u0431\u0438\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u043e\u0435"},
        },
    }
}

def build_enum_option_split(items: dict[str, dict[str, Any]], candidate_codes: list[str], feature_key: str, definition: dict[str, Any]) -> dict[str, Any] | None:
    buckets: dict[str, list[str]] = {}
    for code in candidate_codes:
        value = items.get(code, {}).get(feature_key)
        if not value or value not in definition["values"]:
            return None
        buckets.setdefault(value, []).append(code)

    if len(buckets) < 2 or len(buckets) > 4:
        return None

    ordered_values = [value for value in definition["order"] if value in buckets]
    return {
        "feature_key": feature_key,
        "question": definition["question"],
        "mode": "options",
        "options": [
            {"label": definition["values"][value]["label"], "codes": buckets[value]}
            for value in ordered_values
        ],
    }

def format_module_value(value: float) -> str:
    return str(value).replace('.', ',')


def get_module_range_label(value: dict[str, float]) -> str | None:
    if value["min"] == float("-inf") and value["max"] != float("inf"):
        return f"?? {format_module_value(value['max'])} ??"
    if value["min"] != float("-inf") and value["max"] == float("inf"):
        return f"????? {format_module_value(value['min'])} ??"
    if value["min"] != float("-inf") and value["max"] != float("inf"):
        return f"?? {format_module_value(value['min'])} ?? {format_module_value(value['max'])} ??"
    return None


def build_module_buckets(items: list[tuple[str, dict[str, float]]]) -> list[list[tuple[str, dict[str, float]]]]:
    ordered = sorted(
        items,
        key=lambda item: (
            item[1]["min"] if item[1]["min"] != float("-inf") else -1,
            item[1]["max"] if item[1]["max"] != float("inf") else float("inf"),
        ),
    )
    chunk_size = math.ceil(len(ordered) / 6)
    return [ordered[index:index + chunk_size] for index in range(0, len(ordered), chunk_size)]


def get_module_split(nodes: list[Node], path_index: dict[str, list[str]]) -> dict[str, Any] | None:
    items = []
    for node in nodes:
        module_range = extract_module_range(path_index[node.code])
        if not module_range:
            return None
        items.append((node.code, module_range))

    if len(items) < 2:
        return None

    buckets = build_module_buckets(items)
    if len(buckets) < 2 or len(buckets) > 6:
        return None

    return {
        "feature_key": "module_range_options",
        "question": "????? ???????? ?????? ?????????",
        "mode": "options",
        "options": [
            {
                "label": get_module_range_label({"min": bucket[0][1]["min"], "max": bucket[-1][1]["max"]}),
                "codes": [code for code, _ in bucket],
            }
            for bucket in buckets
        ],
    }

    return None


def get_feature_split_rotation(nodes: list[Node], path_index: dict[str, list[str]]) -> dict[str, Any] | None:
    if not all(node.code.startswith("71") or node.code.startswith("72") for node in nodes):
        return None

    candidate_codes = [node.code for node in nodes]
    items = {node.code: extract_rotation_features(path_index[node.code]) for node in nodes}
    return evaluate_split(ROTATION_FEATURE_CATALOG, items, candidate_codes)


def get_feature_split_general(nodes: list[Node], path_index: dict[str, list[str]]) -> dict[str, Any] | None:
    candidate_codes = [node.code for node in nodes]
    items = {node.code: extract_general_features(path_index[node.code]) for node in nodes}
    enum_split = build_enum_option_split(items, candidate_codes, "base_hole_kind", GENERAL_ENUM_FEATURE_CATALOG["base_hole_kind"])
    if enum_split:
        return enum_split
    return evaluate_split(GENERAL_FEATURE_CATALOG, items, candidate_codes)


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
        module_split = get_module_split(subset, path_index)
        heuristic_split = get_feature_split_rotation(subset, path_index)
        general_split = get_feature_split_general(subset, path_index)
        split = dynamic_split or explicit_split or module_split or heuristic_split or general_split

        if not split:
            unresolved.append(subset)
            continue

        used_questions.append(split["feature_key"])
        code_to_node = {node.code: node for node in subset}
        if split.get("mode") == "options":
            for option in split["options"]:
                queue.append([code_to_node[code] for code in option["codes"]])
            continue
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
    parser.add_argument("--limit", type=int, default=20, help="How many unresolved entries to print")
    parser.add_argument("--json", dest="json_path", help="Optional path for JSON report")
    parser.add_argument("--pattern-limit", type=int, default=10, help="How many repeated unresolved patterns to print")
    parser.add_argument("--include-service", action="store_true", help="Keep service/normative branches in output")
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parent.parent
    roots, node_index, _, path_index = load_tree(project_root / "eskd_tree.json")

    with (project_root / "adaptive_rules.json").open(encoding="utf-8-sig") as fh:
        adaptive_rules = json.load(fh)

    choice_points = []
    for root in roots:
        choice_points.extend(collect_leaf_choice_points(root))

    analyzed = 0
    skipped = 0
    resolved = 0
    unresolved_entries: list[dict[str, Any]] = []

    for parent in choice_points:
        if not parent.code.startswith(args.root):
            continue

        analyzed += 1
        if not args.include_service and is_service_branch(parent):
            skipped += 1
            continue

        outcome = resolve_group(parent.children, parent.code, adaptive_rules, path_index)
        if outcome["resolved"]:
            resolved += 1
            continue

        unresolved_entries.append(
            {
                "code": parent.code,
                "description": parent.description,
                "used_questions": outcome["used_questions"],
                "unresolved": [
                    [{"code": node.code, "description": node.description} for node in subset]
                    for subset in outcome["unresolved"]
                ],
            }
        )

    print(f"Analyzed choice points: {analyzed}")
    print(f"Skipped service/normative points: {skipped}")
    print(f"Resolved automatically: {resolved}")
    print(f"Unresolved manual-choice points: {len(unresolved_entries)}")
    print()

    pattern_groups = summarize_pattern_groups(unresolved_entries)
    print(f"Repeated unresolved patterns: {len(pattern_groups)}")
    for pattern in pattern_groups[: args.pattern_limit]:
        print(f"PATTERN x{pattern['count']}: {pattern['signature']}")
        if pattern["used_questions"]:
            print(f"  used: {', '.join(pattern['used_questions'])}")
        print(f"  parents: {', '.join(pattern['parents'][:6])}")
        if len(pattern['parents']) > 6:
            print(f"  ... and {len(pattern['parents']) - 6} more")
        example_subset = ", ".join(f"{item['code']} ({item['description']})" for item in pattern['example']['subset'])
        print(f"  example: {pattern['example']['parent_code']} -> {example_subset}")
        print()

    for entry in unresolved_entries[: args.limit]:
        print(f"{entry['code']} | {entry['description']}")
        if entry["used_questions"]:
            print(f"  used: {', '.join(entry['used_questions'])}")
        for subset in entry["unresolved"]:
            formatted = ", ".join(f"{item['code']} ({item['description']})" for item in subset)
            print(f"  unresolved: {formatted}")
        print()

    if args.json_path:
        report_path = Path(args.json_path)
        report_path.write_text(json.dumps({"unresolved_entries": unresolved_entries, "pattern_groups": pattern_groups}, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
