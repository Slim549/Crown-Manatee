"""Import the fact-checked Manatee County question bank into data/questions.json.

The Word document gives the correct choice as full text, not a letter, so the
stored letter is only the choice that matches that text. The game shuffles
the letters again each time a question is shown.
"""
import json
import re
import zipfile
from xml.etree import ElementTree as ET

DOC = r"C:\Users\Blaine\Downloads\Manatee_County_Question_Bank_Answer_Choices_Revised (1).docx"
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
        .replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\u00a0", " ")
        .strip()
    )


def same(text):
    return re.sub(r"\s+", " ", norm(text)).casefold()


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
    by_name = {same(name): (node_id, name) for node_id, name in NODES}
    number_re = re.compile(r"^(\d+)\.\s+(.*)$")
    choice_re = re.compile(r"^([A-D])\.\s+(.*)$")
    key_at = next(i for i, line in enumerate(lines) if line.startswith("ANSWER KEY"))
    answers = {}
    for line in lines[key_at + 1 :]:
        if line.startswith("NODE "):
            continue
        match = number_re.match(line)
        if match:
            answers[int(match.group(1))] = match.group(2).strip()

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

    for line in lines[:key_at]:
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
        choice = choice_re.match(line)
        if choice and pending is not None:
            pending["choices"][choice.group(1)] = choice.group(2).strip()
            continue
        numbered = number_re.match(line)
        if numbered and difficulty:
            flush()
            pending = {
                "number": int(numbered.group(1)),
                "prompt": numbered.group(2).strip(),
                "choices": {},
                "difficulty": difficulty,
            }
    flush()
    if current_name:
        bank.append((current_name, bucket))

    output = []
    problems = []
    seen_numbers = set()
    for name, questions in bank:
        found = by_name.get(same(name))
        if not found:
            problems.append("unknown node " + name)
            continue
        node_id, canonical = found
        built = []
        counts = {"easy": 0, "medium": 0, "hard": 0}
        for question in questions:
            number = question["number"]
            if number in seen_numbers:
                problems.append(f"{name} question {number} is duplicated")
            seen_numbers.add(number)
            choices = question["choices"]
            answer = answers.get(number)
            if len(choices) != 4 or not question["difficulty"] or not answer:
                problems.append(
                    f"{name} #{number}: choices={sorted(choices)} difficulty={question['difficulty']} answer={bool(answer)}"
                )
                continue
            matches = [letter for letter in "ABCD" if same(choices[letter]) == same(answer)]
            if len(matches) != 1:
                problems.append(f"{name} #{number}: answer text matched {matches or 'nothing'}: {answer}")
                continue
            counts[question["difficulty"]] += 1
            built.append({
                "id": f"{node_id}-{question['difficulty']}-{counts[question['difficulty']]:03d}",
                "difficulty": question["difficulty"],
                "prompt": question["prompt"],
                "choices": {key: choices[key] for key in "ABCD"},
                "correctAnswer": matches[0],
            })
        order = {"easy": 0, "medium": 1, "hard": 2}
        built.sort(key=lambda item: (order[item["difficulty"]], item["id"]))
        output.append({"nodeId": node_id, "nodeName": canonical, "questions": built})
        if [counts[level] for level in ("easy", "medium", "hard")] != [10, 10, 10]:
            problems.append(f"{name}: {counts}")
    missing = [number for number in range(1, 301) if number not in seen_numbers]
    if missing:
        problems.append("missing question numbers " + ", ".join(map(str, missing[:20])))
    extra = sorted(number for number in answers if number not in seen_numbers)
    if extra:
        problems.append("answer key has no question for " + ", ".join(map(str, extra[:20])))
    return output, problems


def main():
    output, problems = parse(paragraphs(DOC))
    if problems:
        raise SystemExit("\n".join(problems))
    with open(OUT, "w", encoding="utf-8", newline="\n") as handle:
        json.dump(output, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(f"Wrote {sum(len(node['questions']) for node in output)} questions across {len(output)} buildings")


if __name__ == "__main__":
    main()
