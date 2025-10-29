import json
import csv
from pathlib import Path


def map_index_to_column_letter(index: int) -> str:
    base_column_ord = ord("F")  # Answers start at column F
    return chr(base_column_ord + index) if 0 <= index <= 3 else ""


def extract_rows_from_10th_json(data: dict) -> list[list[str]]:
    rows: list[list[str]] = []

    course_sections = data.get("sections", [])
    for section in course_sections:
        units = section.get("units", [])
        for unit in units:
            unit_name = unit.get("name", "")
            tasks = unit.get("tasks", [])
            for task in tasks:
                task_name = task.get("name", "")
                questions = task.get("questions", [])
                for q in questions:
                    prompt = q.get("prompt", "")
                    answers = q.get("answers", [])
                    correct_index = q.get("correctIndex", None)

                    q_type = "Multiple Choice"
                    correct_row = ""
                    if isinstance(correct_index, int):
                        correct_row = map_index_to_column_letter(correct_index)

                    # Ensure exactly 4 answer columns (pad or trim)
                    a = list(answers[:4]) + [""] * (4 - len(answers[:4]))

                    rows.append([
                        unit_name,
                        task_name,
                        prompt,
                        q_type,
                        correct_row,
                        a[0], a[1], a[2], a[3],
                    ])

    return rows


def main():
    root = Path(__file__).parent
    input_path = root / "10th.json"
    output_path = root / "testsheet.csv"

    with input_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    rows = extract_rows_from_10th_json(data)

    headers = [
        "Unit",
        "Task",
        "Question",
        "Type",
        "Correct Row",
        "Answer",
        "Answer",
        "Answer",
        "Answer",
    ]

    with output_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows to {output_path}")


if __name__ == "__main__":
    main()


