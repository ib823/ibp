#!/usr/bin/env python3
"""
ABeam T260002 Proposal Deck Generator
─────────────────────────────────────
Reads PROPOSAL.md slide-by-slide and appends slides 36-84 onto the
existing ABeam_PETROS_T260002_Final template, preserving the master
slides + brand identity (navy + taupe, Arial / Yu Gothic, footer).

Layout mapping per slide type:
  - Section divider     → layout 2 (中扉)
  - Section closing     → layout 1 (1_タイトルとコンテンツ)
  - Standard title+body → layout 12 (1_Title & Contents)
  - Title-only          → layout 8 (1_Title Only)

Tables in markdown are rendered as PowerPoint tables with brand styling.
Bullet hierarchies are rendered with proper indentation.
Speaker notes are populated into the Notes pane.

Re-runnable. Source-of-truth: petros-ips-poc/PROPOSAL.md.
"""

import re
import sys
from pathlib import Path
from copy import deepcopy
from pptx import Presentation
from pptx.util import Pt, Inches, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml.ns import qn
from lxml import etree

# ── Paths ────────────────────────────────────────────────────────────
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
TEMPLATE = ROOT / "ABeam_PETROS_T260002_Final  -  Repaired.pptx"
PROPOSAL_MD = ROOT / "PROPOSAL.md"
OUTPUT = ROOT / "ABeam_T260002_Proposal_Generated.pptx"

# ── Brand colours (from theme1.xml inspection) ───────────────────────
NAVY = RGBColor(0x00, 0x19, 0x64)
TAUPE = RGBColor(0x7D, 0x6E, 0x59)
TAUPE_LIGHT = RGBColor(0xC8, 0xBE, 0xAA)
TAUPE_BG = RGBColor(0xF0, 0xEB, 0xE3)
BLUE_MID = RGBColor(0x45, 0x89, 0xAF)
BLUE_LIGHT = RGBColor(0xD9, 0xE5, 0xEC)
TEXT_DARK = RGBColor(0x33, 0x33, 0x33)
TEXT_MUTED = RGBColor(0x66, 0x66, 0x66)
GREEN = RGBColor(0x2D, 0x8A, 0x4E)
RED = RGBColor(0xC0, 0x39, 0x2B)
AMBER = RGBColor(0xD4, 0xA8, 0x43)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)

# ── Layout indices in the existing template (slide_master[0]) ────────
LAYOUT_FRONT_COVER = 0      # 表紙
LAYOUT_TITLE_CONTENT_JP = 1 # 1_タイトルとコンテンツ
LAYOUT_SECTION_DIVIDER = 2  # 中扉
LAYOUT_BACK_COVER = 3       # 裏表紙
LAYOUT_TITLE_ONLY_BLANK = 4 # Title only (no placeholder, blank slide)
LAYOUT_TITLE_TEXT = 5       # Title and text
LAYOUT_TITLE_CONTENT = 6    # Title and Content
LAYOUT_CONTENTS1 = 7        # Contents1
LAYOUT_TITLE_ONLY = 8       # 1_Title Only
LAYOUT_TITLE_AND_CONTENTS = 12  # 1_Title & Contents


def parse_proposal_md(path: Path):
    """Parse PROPOSAL.md into a list of slide dicts."""
    text = path.read_text(encoding="utf-8")
    # Split by `## Slide N — Title` headings
    slide_pattern = re.compile(r"^## Slide (\d+)\s*[—–-]\s*(.+?)$", re.MULTILINE)
    slides = []
    matches = list(slide_pattern.finditer(text))
    for i, m in enumerate(matches):
        num = int(m.group(1))
        title = m.group(2).strip()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body_text = text[start:end].strip()
        slides.append({
            "num": num,
            "title": title,
            "raw": body_text,
        })
    return slides


def detect_slide_type(slide):
    """Classify slide for layout selection."""
    title = slide["title"].lower()
    if "section divider" in title:
        return "divider"
    return "content"


def parse_speaker_notes(raw):
    """Extract the speaker notes block if present."""
    m = re.search(r"\*\*Speaker notes\*\*:\s*\n((?:>.*\n?)+)", raw)
    if not m:
        return ""
    notes = m.group(1)
    # Strip leading "> " from each line
    cleaned = re.sub(r"^>\s?", "", notes, flags=re.MULTILINE).strip()
    # Remove quote markers in the middle
    cleaned = cleaned.replace('"', '"').replace('"', '"').replace("'", "'").replace("'", "'")
    # Strip extra quote characters at start/end of paragraphs
    cleaned = re.sub(r'^"(.+)"$', r'\1', cleaned, flags=re.MULTILINE)
    return cleaned


def parse_body_md(raw):
    """Extract the body content (between heading and Speaker notes)."""
    # Cut off speaker notes
    m = re.search(r"\*\*Speaker notes\*\*:", raw)
    body = raw[: m.start()] if m else raw
    # Cut off visual notes blocks (designer instructions, not slide content)
    body = re.sub(r"\*\*Visual notes\*\*[^\n]*\n", "", body)
    # Strip body section header — it's metadata for the markdown reader
    body = re.sub(r"\*\*Body\*\*[^\n]*\n+", "", body)
    return body.strip()


def strip_title_prefix(title):
    """Strip the slide-builder hint prefix like 'Section divider:'."""
    return re.sub(r"^Section divider:\s*", "", title).strip()


def extract_subtitle_for_divider(blocks):
    """For section dividers, the first quote block is the subtitle.
    Skip the first line if it's the heading (already shown as the title).
    Returns the remaining lines joined with newlines."""
    for b in blocks:
        if b["kind"] == "quote":
            lines = [l.strip() for l in b["lines"] if l.strip()]
            cleaned = []
            for line in lines:
                stripped = re.sub(r"^#+\s*", "", line)
                cleaned.append(stripped)
            # Skip the first heading line — it duplicates the slide title
            if cleaned and re.match(r"^[A-Z]", cleaned[0]) and len(cleaned) > 1:
                cleaned = cleaned[1:]
            return "\n".join(cleaned)
    return ""


def parse_markdown_tables(text):
    """Extract markdown tables from text. Returns list of (start_idx, end_idx, rows)."""
    tables = []
    lines = text.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        # Detect table: row with | followed by separator row | --- |
        if "|" in line and i + 1 < len(lines):
            sep = lines[i + 1].strip()
            if re.match(r"^\|?[\s:|-]+\|?$", sep) and "---" in sep:
                # Found a table
                start = i
                rows = []
                # Header row
                rows.append([c.strip() for c in line.strip().strip("|").split("|")])
                i += 2  # skip separator
                while i < len(lines) and "|" in lines[i] and lines[i].strip():
                    rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
                    i += 1
                tables.append({"start_line": start, "end_line": i, "rows": rows})
                continue
        i += 1
    return tables


def split_body_into_blocks(body):
    """Split body into ordered blocks: paragraphs, bullet groups, tables, code, headings.

    Returns a list of dicts: {kind: 'heading'|'para'|'bullets'|'table'|'code'|'quote', content}
    """
    blocks = []
    lines = body.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        # Skip empty lines
        if not stripped:
            i += 1
            continue
        # Heading (### or higher)
        if stripped.startswith("###"):
            level = len(stripped) - len(stripped.lstrip("#"))
            text = stripped.lstrip("#").strip()
            blocks.append({"kind": "heading", "level": level, "text": text})
            i += 1
            continue
        # Code fence
        if stripped.startswith("```"):
            code_lines = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            i += 1  # skip closing fence
            blocks.append({"kind": "code", "lines": code_lines})
            continue
        # Block quote (markdown >)
        if stripped.startswith(">"):
            quote_lines = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                quote_lines.append(re.sub(r"^>\s?", "", lines[i]))
                i += 1
            blocks.append({"kind": "quote", "lines": quote_lines})
            continue
        # Table?
        if "|" in line and i + 1 < len(lines):
            sep = lines[i + 1].strip()
            if re.match(r"^\|?[\s:|-]+\|?$", sep) and "---" in sep:
                rows = [[c.strip() for c in line.strip().strip("|").split("|")]]
                i += 2
                while i < len(lines) and "|" in lines[i] and lines[i].strip():
                    rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
                    i += 1
                blocks.append({"kind": "table", "rows": rows})
                continue
        # Bullet
        bullet_match = re.match(r"^(\s*)[-*]\s+(.*)$", line)
        if bullet_match:
            bullets = []
            while i < len(lines):
                bm = re.match(r"^(\s*)[-*]\s+(.*)$", lines[i])
                if bm:
                    indent = len(bm.group(1)) // 2
                    text = bm.group(2).strip()
                    bullets.append({"level": indent, "text": text})
                    i += 1
                elif lines[i].strip() == "":
                    break
                elif lines[i].startswith("  ") and bullets:
                    # continuation line — append to last bullet
                    bullets[-1]["text"] += " " + lines[i].strip()
                    i += 1
                else:
                    break
            blocks.append({"kind": "bullets", "items": bullets})
            continue
        # Numbered list
        num_match = re.match(r"^(\s*)\d+\.\s+(.*)$", line)
        if num_match:
            items = []
            while i < len(lines):
                nm = re.match(r"^(\s*)\d+\.\s+(.*)$", lines[i])
                if nm:
                    indent = len(nm.group(1)) // 2
                    text = nm.group(2).strip()
                    items.append({"level": indent, "text": text})
                    i += 1
                elif lines[i].strip() == "":
                    break
                else:
                    break
            blocks.append({"kind": "numbered", "items": items})
            continue
        # Paragraph
        para_lines = [line]
        i += 1
        while i < len(lines) and lines[i].strip() and not lines[i].strip().startswith(("#", ">", "-", "*", "```")) and "|" not in lines[i]:
            para_lines.append(lines[i])
            i += 1
        blocks.append({"kind": "para", "text": " ".join(p.strip() for p in para_lines)})
    return blocks


# ── Inline markdown rendering ────────────────────────────────────────

INLINE_BOLD = re.compile(r"\*\*(.+?)\*\*")
INLINE_CODE = re.compile(r"`([^`]+)`")
INLINE_ITALIC = re.compile(r"(?<!\*)\*([^*]+?)\*(?!\*)")


def render_runs_into_paragraph(p, text, base_size=11, base_color=TEXT_DARK):
    """Parse inline markdown (**bold**, `code`, *italic*) and add styled runs."""
    # Tokenise the text
    pos = 0
    tokens = []
    pattern = re.compile(r"(\*\*[^*]+?\*\*|`[^`]+`|\*[^*]+?\*)")
    for m in pattern.finditer(text):
        if m.start() > pos:
            tokens.append(("text", text[pos:m.start()]))
        seg = m.group(0)
        if seg.startswith("**"):
            tokens.append(("bold", seg[2:-2]))
        elif seg.startswith("`"):
            tokens.append(("code", seg[1:-1]))
        elif seg.startswith("*"):
            tokens.append(("italic", seg[1:-1]))
        pos = m.end()
    if pos < len(text):
        tokens.append(("text", text[pos:]))

    if not tokens:
        tokens = [("text", text)]

    for kind, t in tokens:
        run = p.add_run()
        run.text = t
        run.font.size = Pt(base_size)
        run.font.color.rgb = base_color
        if kind == "bold":
            run.font.bold = True
            run.font.color.rgb = NAVY
        elif kind == "code":
            run.font.name = "Consolas"
            run.font.size = Pt(base_size - 1)
            run.font.color.rgb = TAUPE
        elif kind == "italic":
            run.font.italic = True


# ── Slide builders ───────────────────────────────────────────────────

def build_section_divider(prs, slide_num, title, blocks):
    """Section divider slide — uses 中扉 layout."""
    layout = prs.slide_layouts[LAYOUT_SECTION_DIVIDER]
    slide = prs.slides.add_slide(layout)

    clean_title = strip_title_prefix(title)
    subtitle = extract_subtitle_for_divider(blocks)

    for ph in slide.placeholders:
        if ph.placeholder_format.idx == 0:
            ph.text = clean_title
            for p in ph.text_frame.paragraphs:
                for r in p.runs:
                    r.font.size = Pt(36)
                    r.font.bold = True
                    r.font.color.rgb = NAVY
        elif ph.placeholder_format.idx == 1:
            ph.text = subtitle
            for p in ph.text_frame.paragraphs:
                for r in p.runs:
                    r.font.size = Pt(14)
                    r.font.color.rgb = TAUPE

    return slide


def build_content_slide(prs, slide_num, title, blocks):
    """Standard content slide — uses 1_Title Only layout + manual body textbox.
    The title-only layout gives us a clean canvas with just the title placeholder
    populated; body content goes into a fresh textbox we control fully."""
    layout = prs.slide_layouts[LAYOUT_TITLE_ONLY]  # '1_Title Only' — single TITLE placeholder
    slide = prs.slides.add_slide(layout)

    # Title placeholder
    for ph in slide.placeholders:
        if ph.placeholder_format.idx == 0:
            ph.text = title
            for p in ph.text_frame.paragraphs:
                for r in p.runs:
                    r.font.size = Pt(18)
                    r.font.bold = True
                    r.font.color.rgb = NAVY

    # Body — fresh textbox below the title.  Slide is 720x405pt.
    # Title typically occupies top ~75pt; footer occupies bottom ~15pt.
    body_left = Pt(36)
    body_top = Pt(78)
    body_width = Pt(720 - 72)
    body_height = Pt(405 - 78 - 25)
    content_box = slide.shapes.add_textbox(body_left, body_top, body_width, body_height)
    tf = content_box.text_frame
    tf.word_wrap = True
    tf.margin_left = Pt(0)
    tf.margin_right = Pt(0)
    tf.margin_top = Pt(0)

    first = True

    for block in blocks:
        if block["kind"] == "para":
            p = tf.paragraphs[0] if first else tf.add_paragraph()
            first = False
            render_runs_into_paragraph(p, block["text"], base_size=11)
            p.space_after = Pt(6)
        elif block["kind"] == "heading":
            p = tf.paragraphs[0] if first else tf.add_paragraph()
            first = False
            run = p.add_run()
            run.text = block["text"]
            run.font.size = Pt(13)
            run.font.bold = True
            run.font.color.rgb = NAVY
            p.space_after = Pt(4)
        elif block["kind"] == "bullets":
            for item in block["items"]:
                p = tf.paragraphs[0] if first else tf.add_paragraph()
                first = False
                p.level = min(item["level"], 4)
                # Add "• " prefix because clearing the placeholder strips bullet styling
                bullet_run = p.add_run()
                bullet_run.text = "•  "
                bullet_run.font.size = Pt(11)
                bullet_run.font.color.rgb = TAUPE
                render_runs_into_paragraph(p, item["text"], base_size=11)
                p.space_after = Pt(2)
        elif block["kind"] == "numbered":
            for n, item in enumerate(block["items"], start=1):
                p = tf.paragraphs[0] if first else tf.add_paragraph()
                first = False
                p.level = min(item["level"], 4)
                bullet_run = p.add_run()
                bullet_run.text = f"{n}.  "
                bullet_run.font.size = Pt(11)
                bullet_run.font.bold = True
                bullet_run.font.color.rgb = NAVY
                render_runs_into_paragraph(p, item["text"], base_size=11)
                p.space_after = Pt(2)
        elif block["kind"] == "code":
            for line in block["lines"]:
                p = tf.paragraphs[0] if first else tf.add_paragraph()
                first = False
                run = p.add_run()
                run.text = line
                run.font.name = "Consolas"
                run.font.size = Pt(9)
                run.font.color.rgb = TAUPE
                p.space_after = Pt(0)
        elif block["kind"] == "quote":
            for line in block["lines"]:
                if not line.strip():
                    continue
                p = tf.paragraphs[0] if first else tf.add_paragraph()
                first = False
                run = p.add_run()
                run.text = line.strip()
                run.font.size = Pt(11)
                run.font.italic = True
                run.font.color.rgb = TAUPE
                p.space_after = Pt(3)

    # Tables — render as separate shapes below the content textbox
    table_blocks = [b for b in blocks if b["kind"] == "table"]
    if table_blocks:
        from pptx.util import Inches
        # Stack tables in the lower portion of the slide. If text content was
        # rendered above, push tables further down. Heuristic: 40% body if
        # text + tables; bottom 60% for table-dominant slides.
        non_table_count = sum(1 for b in blocks if b["kind"] != "table")
        table_top = Inches(2.4) if non_table_count > 0 else Inches(1.1)
        for ti, tbl_block in enumerate(table_blocks):
            rows = tbl_block["rows"]
            n_rows = len(rows)
            n_cols = len(rows[0]) if rows else 0
            if n_rows < 2 or n_cols < 1:
                continue
            tbl_left = Inches(0.4)
            tbl_width = Inches(9.2)
            tbl_height = Inches(min(0.32 * n_rows + 0.05, 3.0))
            try:
                gfx = slide.shapes.add_table(n_rows, n_cols, tbl_left, table_top, tbl_width, tbl_height)
                table = gfx.table
                # Style header row
                for ci, cell_text in enumerate(rows[0]):
                    cell = table.cell(0, ci)
                    cell.fill.solid()
                    cell.fill.fore_color.rgb = NAVY
                    tfc = cell.text_frame
                    tfc.clear()
                    p = tfc.paragraphs[0]
                    run = p.add_run()
                    run.text = cell_text.replace("**", "")
                    run.font.size = Pt(9)
                    run.font.bold = True
                    run.font.color.rgb = WHITE
                # Body rows with alternating fill
                for ri in range(1, n_rows):
                    row_data = rows[ri]
                    for ci in range(n_cols):
                        cell = table.cell(ri, min(ci, len(row_data) - 1)) if row_data else table.cell(ri, ci)
                        cell.fill.solid()
                        cell.fill.fore_color.rgb = TAUPE_BG if ri % 2 == 1 else WHITE
                        tfc = cell.text_frame
                        tfc.clear()
                        p = tfc.paragraphs[0]
                        cell_text = row_data[ci] if ci < len(row_data) else ""
                        # Strip markdown formatting for table cells
                        clean = cell_text.replace("**", "").replace("`", "")
                        run = p.add_run()
                        run.text = clean
                        run.font.size = Pt(9)
                        run.font.color.rgb = TEXT_DARK
                table_top = Inches(table_top.inches + tbl_height.inches + 0.08)
            except Exception as e:
                print(f"  Warning: failed to render table on slide {slide_num}: {e}")
                continue

    return slide


def add_speaker_notes(slide, notes_text):
    """Populate Notes pane. Robust against templates whose notes master
    doesn't expose `notes_text_frame` directly — fall back to body
    placeholder lookup, and if even that is absent, append a body
    placeholder shape inline."""
    if not notes_text:
        return
    try:
        notes_slide = slide.notes_slide
    except Exception:
        return  # template doesn't support notes — skip silently

    cleaned = notes_text.strip().replace('"', "").replace('"', "").replace('"', "")
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", cleaned) if p.strip()]
    if not paragraphs:
        return

    # First, try the body placeholder route (works on most templates)
    body_ph = None
    for ph in notes_slide.placeholders:
        if ph.placeholder_format.idx == 1:  # BODY
            body_ph = ph
            break

    if body_ph is not None and hasattr(body_ph, "text_frame") and body_ph.text_frame is not None:
        tf = body_ph.text_frame
        tf.text = paragraphs[0]
        for p in tf.paragraphs:
            for r in p.runs:
                r.font.size = Pt(10)
        for extra in paragraphs[1:]:
            new_p = tf.add_paragraph()
            run = new_p.add_run()
            run.text = extra
            run.font.size = Pt(10)
        return

    # Fall back to notes_text_frame property (some templates)
    try:
        ntf = notes_slide.notes_text_frame
        if ntf is not None:
            ntf.text = "\n\n".join(paragraphs)
            return
    except Exception:
        pass

    # Final fallback: append a textbox in notes slide (rare)
    try:
        from pptx.util import Inches as _I
        tb = notes_slide.shapes.add_textbox(_I(0.5), _I(0.5), _I(7), _I(5))
        tb.text_frame.text = "\n\n".join(paragraphs)
    except Exception:
        pass


def add_footer(slide, slide_num, section_label):
    """Add the brand footer bar matching slide 35."""
    # Slide is 720x405pt — footer at bottom
    from pptx.util import Pt as P
    left = Pt(0)
    top = Pt(390)
    width = Pt(720)
    height = Pt(15)
    box = slide.shapes.add_textbox(left, top, width, height)
    tf = box.text_frame
    tf.margin_left = Pt(20)
    tf.margin_right = Pt(20)
    tf.margin_top = Pt(2)
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.LEFT
    r1 = p.add_run()
    r1.text = f"{slide_num}    "
    r1.font.size = Pt(8)
    r1.font.color.rgb = TEXT_MUTED
    r2 = p.add_run()
    r2.text = "TENDER NO: T260002 Integrated Planning System Implementation Proposal"
    r2.font.size = Pt(8)
    r2.font.color.rgb = TEXT_MUTED
    r3 = p.add_run()
    r3.text = "          confidential   ©2026 ABeam Consulting (Malaysia)"
    r3.font.size = Pt(8)
    r3.font.color.rgb = TEXT_MUTED


# ── Section labels per slide range ───────────────────────────────────

def section_label_for_slide(num):
    if 36 <= num <= 42:
        return "§4 Target Architecture"
    if 43 <= num <= 52:
        return "§5 Functional Coverage"
    if 53 <= num <= 59:
        return "§6 PETROS-Sarawak Differentiators"
    if 60 <= num <= 71:
        return "§7 POC Walkthrough"
    if 72 <= num <= 76:
        return "§8 Integration Design"
    if 77 <= num <= 84:
        return "§9 Methodology & Phase Plan"
    return ""


# ── Main pipeline ─────────────────────────────────────────────────────

def main():
    print(f"→ Reading template: {TEMPLATE.name}")
    if not TEMPLATE.exists():
        print(f"  ERROR: template not found at {TEMPLATE}")
        sys.exit(1)
    print(f"→ Reading proposal: {PROPOSAL_MD.name}")
    if not PROPOSAL_MD.exists():
        print(f"  ERROR: PROPOSAL.md not found at {PROPOSAL_MD}")
        sys.exit(1)

    slides_data = parse_proposal_md(PROPOSAL_MD)
    print(f"  parsed {len(slides_data)} slide sections from PROPOSAL.md")

    prs = Presentation(str(TEMPLATE))
    print(f"  template has {len(prs.slides)} existing slides + {len(prs.slide_layouts)} layouts")

    print(f"→ Generating slides 36–84")
    built = 0
    for s in slides_data:
        if s["num"] < 36 or s["num"] > 84:
            continue
        body = parse_body_md(s["raw"])
        notes = parse_speaker_notes(s["raw"])
        blocks = split_body_into_blocks(body)
        kind = detect_slide_type(s)

        try:
            if kind == "divider":
                slide = build_section_divider(prs, s["num"], s["title"], blocks)
            else:
                slide = build_content_slide(prs, s["num"], s["title"], blocks)
            add_speaker_notes(slide, notes)
            add_footer(slide, s["num"], section_label_for_slide(s["num"]))
            built += 1
            if built % 10 == 0:
                print(f"  built {built}…")
        except Exception as e:
            print(f"  WARN slide {s['num']!r}: {e}")
            import traceback; traceback.print_exc()

    print(f"  built {built} slides total")

    print(f"→ Saving to {OUTPUT.name}")
    prs.save(str(OUTPUT))
    print(f"  ✓ saved ({OUTPUT.stat().st_size // 1024}KB)")


if __name__ == "__main__":
    main()
