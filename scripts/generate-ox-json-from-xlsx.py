import json
import sys
from pathlib import Path

import openpyxl


def clean(value):
    if value is None:
        return ""
    return str(value).strip()


def main():
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python scripts/generate-ox-json-from-xlsx.py <xlsx-path>")

    xlsx_path = Path(sys.argv[1]).expanduser()
    output_path = Path(__file__).with_name("ox-import-data.json")

    wb = openpyxl.load_workbook(xlsx_path, data_only=True, read_only=False)
    ws = wb.active

    order = []
    groups = {}
    current_middle = ""

    for row in ws.iter_rows(values_only=True):
        middle = clean(row[0] if len(row) > 0 else None)
        section = clean(row[1] if len(row) > 1 else None)
        question = clean(row[2] if len(row) > 2 else None)
        answer = clean(row[3] if len(row) > 3 else None).upper()
        explanation = clean(row[4] if len(row) > 4 else None)

        if middle:
            current_middle = middle
            if current_middle not in groups:
                order.append(current_middle)
                groups[current_middle] = []

        if not current_middle or not question:
            continue

        if answer not in {"O", "X"}:
            raise ValueError(f"Invalid answer at row {len(groups[current_middle]) + 1} in {current_middle}: {answer!r}")

        groups[current_middle].append({
            "q": question,
            "a": answer,
            "e": explanation,
            "s": section or None,
        })

    payload = {"order": order, "groups": groups}
    output_path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ": ")), encoding="utf-8")

    total = sum(len(groups[title]) for title in order)
    print(f"generated {output_path}: {len(order)} groups, {total} questions")
    for title in order:
        sections = {item["s"] for item in groups[title] if item["s"]}
        print(f"- {title}: {len(groups[title])} questions, {len(sections)} sections")


if __name__ == "__main__":
    main()
