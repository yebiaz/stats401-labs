"""
Lab 8 — Part A: Corpus Preparation
Turns the DKU Undergraduate Bulletin PDF into a flat passage table.

    python parse_bulletin.py

Input : ../data/V2021-22_DKU_UG_Bulletin.pdf
Output: ../data/bulletin_passages.csv

How it works
------------
1. The PDF was exported from Word with a bookmark outline. That outline
   gives every heading with its depth and page, so the hierarchy
   (chapter / section / subsection) comes from the document itself
   rather than being guessed.
2. Each page is read line by line with font size, boldness and position.
3. A bold heading line that matches an outline entry updates the current
   chapter / section / subsection.
4. Body lines are grouped into paragraphs using vertical gaps: lines
   inside a paragraph are ~3.7pt apart, paragraph breaks are 11pt+.
5. Course descriptions are grouped one course per passage instead,
   because a course's title, description and prerequisites are separated
   by paragraph-sized gaps and would otherwise be split apart.
"""

import re
from pathlib import Path

import pandas as pd
import pdfplumber
from pypdf import PdfReader


BASE = Path(__file__).resolve().parent.parent
PDF_PATH = BASE / "data" / "V2021-22_DKU_UG_Bulletin.pdf"
OUT_PATH = BASE / "data" / "bulletin_passages.csv"

# pages 1–9 are the cover and table of contents; the outline starts on 10
FIRST_PAGE = 10

# Parts 11 and 12 are a date calendar and a contact directory, not prose
EXCLUDE_CHAPTERS = ("Part 11", "Part 12")

PARAGRAPH_GAP = 8.0       # points of vertical space that start a new paragraph
FOOTER_TOP = 735.0        # page numbers sit below this line
HEADING_MIN_SIZE = 11.9   # outline headings are bold 12pt or larger

COURSE_TITLE = re.compile(
    r"^[A-Z][A-Z/]{1,12}\s+\d{1,3}[A-Z]?\b.*\(\s*\d.*credits?\s*\)",
    re.IGNORECASE,
)


# ---------------------------------------------------------------- outline

def load_outline(pdf_path):
    """Return the bookmark tree flattened into document order."""

    reader = PdfReader(str(pdf_path))
    rows = []

    def walk(items, depth):
        for item in items:
            if isinstance(item, list):
                walk(item, depth + 1)
                continue
            try:
                page = reader.get_destination_page_number(item) + 1
            except Exception:
                continue
            rows.append({
                "depth": depth,
                "title": " ".join(item.title.split()),
                "page": page,
            })

    walk(reader.outline, 0)
    return rows


def norm(text):
    return re.sub(r"[^a-z0-9]", "", text.lower())


# ---------------------------------------------------------------- lines

def page_lines(page):
    """Lines on a page with the properties needed to classify them."""

    out = []
    for line in page.extract_text_lines(layout=False, strip=True):
        text = " ".join(line["text"].split())
        if not text:
            continue

        first = line["chars"][0]
        out.append({
            "text": text,
            "top": line["top"],
            "bottom": line["bottom"],
            "size": round(first["size"], 1),
            "bold": "Bold" in first["fontname"],
        })
    return out


def is_footer(line):
    return line["top"] > FOOTER_TOP and re.fullmatch(r"\d{1,3}", line["text"])


def is_heading(line):
    return line["bold"] and line["size"] >= HEADING_MIN_SIZE


# ---------------------------------------------------------------- parse

def parse(pdf_path):

    outline = load_outline(pdf_path)

    # outline entries grouped by page, in order, for heading matching
    by_page = {}
    for i, entry in enumerate(outline):
        entry["order"] = i
        by_page.setdefault(entry["page"], []).append(entry)

    path = {}              # depth -> current heading title
    used = set()           # outline entries already matched

    passages = []
    buffer = []            # lines of the paragraph being built
    buffer_page = None
    buffer_path = None

    def current_labels():
        return {
            "chapter": path.get(0, ""),
            "section": path.get(1, ""),
            "subsection": " / ".join(
                path[d] for d in sorted(path) if d >= 2
            ),
        }

    def flush():
        nonlocal buffer, buffer_page, buffer_path
        if buffer:
            text = " ".join(buffer)
            text = re.sub(r"\s+", " ", text).strip()
            passages.append({**buffer_path, "page": buffer_page, "text": text})
        buffer, buffer_page, buffer_path = [], None, None

    def start(line_text, page_no):
        nonlocal buffer, buffer_page, buffer_path
        flush()
        buffer = [line_text]
        buffer_page = page_no
        buffer_path = current_labels()

    def in_course_descriptions():
        return path.get(1, "").startswith("Course Descriptions")

    with pdfplumber.open(str(pdf_path)) as pdf:

        for page_no in range(FIRST_PAGE, len(pdf.pages) + 1):

            lines = [
                ln for ln in page_lines(pdf.pages[page_no - 1])
                if not is_footer(ln)
            ]

            candidates = [
                e for e in by_page.get(page_no, [])
                if e["order"] not in used
            ]

            prev_bottom = None
            i = 0

            while i < len(lines):

                line = lines[i]

                # ---- headings: merge wrapped bold lines, then match outline
                if is_heading(line):

                    heading = line["text"]
                    j = i + 1
                    while (
                        j < len(lines)
                        and is_heading(lines[j])
                        and lines[j]["top"] - lines[j - 1]["bottom"] < PARAGRAPH_GAP
                    ):
                        heading += " " + lines[j]["text"]
                        j += 1

                    key = norm(heading)[:28]
                    match = next(
                        (
                            e for e in candidates
                            if norm(e["title"])[:28] == key
                            or (len(key) >= 8 and norm(e["title"]).startswith(key))
                        ),
                        None,
                    )

                    if match:
                        flush()
                        used.add(match["order"])
                        candidates = [c for c in candidates if c is not match]

                        depth = match["depth"]
                        for d in [d for d in path if d >= depth]:
                            del path[d]
                        path[depth] = match["title"]

                        prev_bottom = lines[j - 1]["bottom"]
                        i = j
                        continue

                # ---- skip the excluded chapters entirely
                if path.get(0, "").startswith(EXCLUDE_CHAPTERS):
                    i += 1
                    continue

                text = line["text"]

                # ---- course descriptions: one course = one passage
                if in_course_descriptions():
                    if line["bold"] and COURSE_TITLE.match(text):
                        start(text, page_no)
                    elif buffer:
                        buffer.append(text)
                    prev_bottom = line["bottom"]
                    i += 1
                    continue

                # ---- ordinary prose: split on vertical gaps
                gap = (
                    None if prev_bottom is None
                    else line["top"] - prev_bottom
                )

                bullet = text.startswith(("•", "▪", "◦", "\uf0b7"))

                if buffer and (gap is None or gap < PARAGRAPH_GAP or bullet):
                    # first line on a new page continues the paragraph only
                    # if the previous page stopped mid-sentence
                    if gap is None and re.search(r'[.!?:;"”)]$', buffer[-1]):
                        start(text, page_no)
                    else:
                        buffer.append(text)
                else:
                    start(text, page_no)

                prev_bottom = line["bottom"]
                i += 1

    flush()

    return pd.DataFrame(passages), outline


# ---------------------------------------------------------------- clean

def clean(df):
    """Remove fragments that are not meaningful stand-alone passages."""

    raw_count = len(df)

    df["text"] = (
        df["text"]
        .str.replace("\u00ad", "", regex=False)        # soft hyphens
        .str.replace(r"\s+", " ", regex=True)
        .str.strip()
    )

    df["word_count"] = df["text"].str.split().str.len()

    # table rows such as "COMPSCI 201 Introduction to Programming 4"
    table_row = df["text"].str.match(
        r"^[A-Z][A-Z/]{1,12}\s+\d{1,3}[A-Z]?\b.{0,90}\s\d{1,2}$"
    )

    # table headers and column labels
    table_header = df["text"].str.contains(
        r"^Course Code|^Course Name|^Credit$", regex=True
    )

    too_short = df["word_count"] < 15

    df = df[~(table_row | table_header | too_short)].copy()

    df = df.dropna(subset=["text"])
    df = df.drop_duplicates(subset=["text"])

    df["text_clean"] = df["text"]

    df = df.reset_index(drop=True)
    df.insert(
        0, "passage_id",
        [f"p{i + 1:04d}" for i in range(len(df))]
    )

    return df, raw_count


def formal_group(row):
    """
    One matrix row per Part, except Part 10, which is split into its
    three sub-parts. Part 10 covers ~310 of 400 pages, so leaving it
    whole would make one enormous row and hide its internal structure.
    """

    chapter = re.sub(r"^Part \d+:\s*", "", row["chapter"])

    if row["chapter"].startswith("Part 10"):
        section = row["section"]
        if section.startswith("Course Descriptions"):
            return "Course Descriptions"
        if section.startswith("Majors"):
            return "Major Programs"
        return "Requirements for All Majors"

    return chapter


# ---------------------------------------------------------------- main

if __name__ == "__main__":

    df, outline = parse(PDF_PATH)
    df, raw_count = clean(df)

    df["formal_group"] = df.apply(formal_group, axis=1)

    df = df[[
        "passage_id", "chapter", "section", "subsection",
        "formal_group", "page", "text", "text_clean", "word_count",
    ]]

    df.to_csv(OUT_PATH, index=False, encoding="utf-8")

    import json
    with open(OUT_PATH.parent / "bulletin_parse_stats.json", "w") as f:
        json.dump({
            "outline_headings": len(outline),
            "raw_passages": int(raw_count),
            "clean_passages": int(len(df)),
            "excluded": "cover and table of contents (pp. 1-9), "
                        "Part 11 academic calendar, Part 12 contacts",
        }, f, indent=2)

    print("Bulletin: Bulletin of Duke Kunshan University, Undergraduate "
          "Instruction, 2021-2022 (V2021-22)")
    print()
    print(f"Outline headings found     : {len(outline)}")
    print(f"Raw passages (before clean): {raw_count}")
    print(f"Passages after cleaning    : {len(df)}")
    print(f"Average passage length     : {df['word_count'].mean():.1f} words")
    print(f"Chapters                   : {df['chapter'].nunique()}")
    print(f"Formal sections            : {df['section'].nunique()}")
    print(f"Matrix row groups          : {df['formal_group'].nunique()}")
    print()
    print(df["formal_group"].value_counts().to_string())
    print()
    print(f"Saved {OUT_PATH}")
