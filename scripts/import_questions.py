"""Import the Manatee County question-bank Word document into data/questions.json."""
import json
import re
import zipfile
from xml.etree import ElementTree as ET

DOC = r"C:\Users\Blaine\Downloads\Manatee_County_Question_Bank_MC_Updated.docx"
OUT = r"C:\Users\Blaine\Downloads\manatee-county-game\manatee-game\data\questions.json"

NODES = [
    ("judicial-center", "Manatee County Judicial Center"),
    ("elections", "Manatee County Supervisor of Elections Office"),
    ("gt-bray", "G.T. Bray Park and Recreation Center"),
    ("school-district", "School District of Manatee County Administration Building"),
    ("sheriff", "Manatee County Sheriff's Office"),
    ("county-admin", "Manatee County Administration Building"),
    ("library", "Manatee County Central Library"),
    ("property-appraiser", "Manatee County Property Appraiser's Office"),
    ("animal-welfare", "Manatee County Animal Welfare"),
    ("public-works", "Manatee County Public Works / Stormwater Operations"),
]


def norm(text):
    return (
        text.replace("\u2019", "'")
        .replace("\u2018", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u00a0", " ")
        .strip()
    )


def paragraphs(path):
    root = ET.fromstring(zipfile.ZipFile(path).read("word/document.xml"))
    ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    lines = []
    for paragraph in root.iter(ns + "p"):
        line = norm("".join((node.text or "") for node in paragraph.iter(ns + "t")))
        if line:
            lines.append(line)
    return lines


def parse(lines):
    by_name = {name: node_id for node_id, name in NODES}
    choice_re = re.compile(r"^([A-D])\.\s+(.*)$")
    key_re = re.compile(r"(\d+)\.\s*([A-D])")
    start = next(i for i, line in enumerate(lines) if line.startswith("NODE "))
    key_at = next(i for i, line in enumerate(lines) if line == "ANSWER KEY")
    body = lines[start:key_at]
    keys = {}
    node_name = None
    for line in lines[key_at + 1 :]:
        if line.startswith("NODE "):
            node_name = norm(line.split(":", 1)[1])
            keys[node_name] = {}
            continue
        if node_name:
            for number, letter in key_re.findall(line):
                keys[node_name][int(number)] = letter

    bank = []
    current_name = None
    difficulty = None
    pending = None
    bucket = []

    def flush():
        nonlocal pending
        if not pending:
            return
        bucket.append(pending)
        pending = None

    for line in body:
        if line.startswith("NODE "):
            flush()
            if current_name:
                bank.append((current_name, bucket))
            current_name = norm(line.split(":", 1)[1])
            bucket = []
            difficulty = None
            pending = None
            continue
        if line.startswith("Focus:"):
            continue
        if line.startswith("EASY QUESTIONS"):
            flush()
            difficulty = "easy"
            continue
        if line.startswith("MEDIUM QUESTIONS"):
            flush()
            difficulty = "medium"
            continue
        if line.startswith("HARD QUESTIONS"):
            flush()
            difficulty = "hard"
            continue
        match = choice_re.match(line)
        if match and pending is not None:
            pending["choices"][match.group(1)] = match.group(2).strip()
            continue
        flush()
        pending = {"prompt": line, "choices": {}, "difficulty": difficulty}
    flush()
    if current_name:
        bank.append((current_name, bucket))

    output = []
    problems = []
    for name, questions in bank:
        node_id = by_name.get(name)
        if not node_id:
            problems.append("unknown node " + name)
            continue
        built = []
        for index, question in enumerate(questions, start=1):
            letter = keys.get(name, {}).get(index)
            choices = question["choices"]
            if len(choices) != 4 or letter not in "ABCD" or not question["difficulty"]:
                problems.append(f"{name} #{index}: choices={sorted(choices)} key={letter} difficulty={question['difficulty']}")
                continue
            built.append({
                "id": f"{node_id}-{question['difficulty']}-{index:03d}",
                "difficulty": question["difficulty"],
                "prompt": question["prompt"],
                "choices": {key: choices[key] for key in "ABCD"},
                "correctAnswer": letter,
            })
        output.append({"nodeId": node_id, "nodeName": name, "questions": built})
        if len(built) != 30:
            problems.append(f"{name}: {len(built)} questions")
    return output, problems


def main():
    output, problems = parse(paragraphs(DOC))
    if problems:
        raise SystemExit("\n".join(problems))
    with open(OUT, "w", encoding="utf-8", newline="\n") as handle:
        json.dump(output, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(f"Wrote {sum(len(node['questions']) for node in output)} questions to {OUT}")


if __name__ == "__main__":
    main()
