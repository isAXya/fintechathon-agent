# -*- coding: utf-8 -*-
"""把 Markdown 转成排好版的 Word 文档。

支持：# 文档标题（用于正文首行）、## 一级、### 二级、#### 三级、
段落、- 列表、1. 编号、| 表格 |、![图注](图片路径)、> 提示块、``` 代码块、[pagebreak] 分页。
"""

import os
import re
import sys
import argparse

from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING, WD_TAB_ALIGNMENT
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_SECTION
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

BODY_FONT = "宋体"
HEAD_FONT = "黑体"
MONO_FONT = "Consolas"
INK = RGBColor(0x1A, 0x1A, 0x1A)
GRAY = RGBColor(0x5E, 0x5E, 0x5E)
ACCENT = RGBColor(0x1F, 0x4E, 0x8C)


def set_run_font(run, name=BODY_FONT, size=10.5, bold=False, color=INK, italic=False):
    run.font.name = name
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = color
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    rfonts.set(qn("w:eastAsia"), name)
    rfonts.set(qn("w:ascii"), name)
    rfonts.set(qn("w:hAnsi"), name)


def shade(element, color):
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), color)
    element.append(shd)


def para_shading(paragraph, color):
    ppr = paragraph._p.get_or_add_pPr()
    shade(ppr, color)


def para_border_left(paragraph, color="1F4E8C", size=18):
    ppr = paragraph._p.get_or_add_pPr()
    borders = OxmlElement("w:pBdr")
    left = OxmlElement("w:left")
    left.set(qn("w:val"), "single")
    left.set(qn("w:sz"), str(size))
    left.set(qn("w:space"), "8")
    left.set(qn("w:color"), color)
    borders.append(left)
    ppr.append(borders)


def add_field(paragraph, instr):
    run = paragraph.add_run()
    fld_begin = OxmlElement("w:fldChar")
    fld_begin.set(qn("w:fldCharType"), "begin")
    instr_el = OxmlElement("w:instrText")
    instr_el.set(qn("xml:space"), "preserve")
    instr_el.text = instr
    fld_sep = OxmlElement("w:fldChar")
    fld_sep.set(qn("w:fldCharType"), "separate")
    txt = OxmlElement("w:t")
    txt.text = "1"
    fld_end = OxmlElement("w:fldChar")
    fld_end.set(qn("w:fldCharType"), "end")
    run._r.append(fld_begin)
    run._r.append(instr_el)
    run._r.append(fld_sep)
    run._r.append(txt)
    run._r.append(fld_end)
    run.font.name = BODY_FONT
    run.font.size = Pt(9)


class DocBuilder:
    def __init__(self, title, subtitle, doctype, meta_rows=None):
        self.doc = Document()
        self.title = title
        self.subtitle = subtitle
        self.doctype = doctype
        self.meta_rows = meta_rows or []
        self.headings = []
        self._setup()

    def _setup(self):
        section = self.doc.sections[0]
        section.page_width = Cm(21.0)
        section.page_height = Cm(29.7)
        section.top_margin = Cm(2.5)
        section.bottom_margin = Cm(2.4)
        section.left_margin = Cm(2.8)
        section.right_margin = Cm(2.6)
        section.different_first_page_header_footer = True
        section.header_distance = Cm(1.3)
        section.footer_distance = Cm(1.2)

        style = self.doc.styles["Normal"]
        style.font.name = BODY_FONT
        style.font.size = Pt(10.5)
        style.element.rPr.rFonts.set(qn("w:eastAsia"), BODY_FONT)
        style.paragraph_format.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
        style.paragraph_format.line_spacing = 1.45
        style.paragraph_format.space_after = Pt(6)

        cp = self.doc.core_properties
        cp.author = "语行团队"
        cp.last_modified_by = "语行团队"
        cp.title = self.title
        cp.subject = self.doctype

    # ---------- 页眉页脚 ----------
    def _decorate(self):
        section = self.doc.sections[0]
        header = section.header
        hp = header.paragraphs[0]
        hp.text = ""
        hp.paragraph_format.tab_stops.add_tab_stop(Cm(15.6), WD_TAB_ALIGNMENT.RIGHT)
        r1 = hp.add_run("语行 · 银行 AI 智能体")
        set_run_font(r1, BODY_FONT, 9, False, GRAY)
        r2 = hp.add_run("\t" + self.doctype)
        set_run_font(r2, BODY_FONT, 9, False, GRAY)
        ppr = hp._p.get_or_add_pPr()
        borders = OxmlElement("w:pBdr")
        bottom = OxmlElement("w:bottom")
        bottom.set(qn("w:val"), "single")
        bottom.set(qn("w:sz"), "6")
        bottom.set(qn("w:space"), "4")
        bottom.set(qn("w:color"), "C9D2E0")
        borders.append(bottom)
        ppr.append(borders)

        footer = section.footer
        fp = footer.paragraphs[0]
        fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = fp.add_run("第 ")
        set_run_font(r, BODY_FONT, 9, False, GRAY)
        add_field(fp, "PAGE")
        r2 = fp.add_run(" 页 · 共 ")
        set_run_font(r2, BODY_FONT, 9, False, GRAY)
        add_field(fp, "NUMPAGES")
        r3 = fp.add_run(" 页")
        set_run_font(r3, BODY_FONT, 9, False, GRAY)

    # ---------- 封面 ----------
    def cover(self):
        for _ in range(3):
            p = self.doc.add_paragraph()
            p.paragraph_format.space_after = Pt(0)

        p = self.doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        r = p.add_run("2026 深圳国际金融科技大赛 · 人工智能赛道")
        set_run_font(r, HEAD_FONT, 11, False, GRAY)

        p = self.doc.add_paragraph()
        p.paragraph_format.space_before = Pt(18)
        r = p.add_run(self.title)
        set_run_font(r, HEAD_FONT, 30, True, INK)

        p = self.doc.add_paragraph()
        p.paragraph_format.space_before = Pt(6)
        r = p.add_run(self.subtitle)
        set_run_font(r, BODY_FONT, 13, False, GRAY)

        p = self.doc.add_paragraph()
        p.paragraph_format.space_before = Pt(24)
        r = p.add_run("————" * 12)
        set_run_font(r, BODY_FONT, 10, False, RGBColor(0xC0, 0xC8, 0xD6))

        table = self.doc.add_table(rows=len(self.meta_rows), cols=2)
        table.alignment = WD_TABLE_ALIGNMENT.LEFT
        table.autofit = False
        for i, (k, v) in enumerate(self.meta_rows):
            row = table.rows[i]
            c0, c1 = row.cells
            c0.width = Cm(3.2)
            c1.width = Cm(9.5)
            p0 = c0.paragraphs[0]
            r0 = p0.add_run(k)
            set_run_font(r0, BODY_FONT, 10.5, False, GRAY)
            p1 = c1.paragraphs[0]
            r1 = p1.add_run(v)
            set_run_font(r1, BODY_FONT, 10.5, False, INK)
            for cell in (c0, c1):
                tcpr = cell._tc.get_or_add_tcPr()
                borders = OxmlElement("w:tcBorders")
                for edge in ("top", "left", "bottom", "right"):
                    el = OxmlElement(f"w:{edge}")
                    el.set(qn("w:val"), "nil")
                    borders.append(el)
                tcpr.append(borders)
        self.doc.add_paragraph()
        self.doc.add_page_break()

    # ---------- 目录 ----------
    def toc(self):
        p = self.doc.add_paragraph()
        r = p.add_run("目　录")
        set_run_font(r, HEAD_FONT, 16, True, INK)
        p.paragraph_format.space_after = Pt(12)

        entry = self.doc.add_paragraph()
        run = entry.add_run()
        fld_begin = OxmlElement("w:fldChar")
        fld_begin.set(qn("w:fldCharType"), "begin")
        instr = OxmlElement("w:instrText")
        instr.set(qn("xml:space"), "preserve")
        instr.text = 'TOC \\o "1-2" \\h \\z \\u'
        fld_sep = OxmlElement("w:fldChar")
        fld_sep.set(qn("w:fldCharType"), "separate")
        placeholder = OxmlElement("w:t")
        placeholder.text = "目录将在打开文档时自动更新"
        fld_end = OxmlElement("w:fldChar")
        fld_end.set(qn("w:fldCharType"), "end")
        run._r.append(fld_begin)
        run._r.append(instr)
        run._r.append(fld_sep)
        run._r.append(placeholder)
        run._r.append(fld_end)
        run.font.name = BODY_FONT
        run.font.size = Pt(10.5)

        # 让 Word 打开时自动刷新域，页码才不会停在占位文字上
        settings = self.doc.settings.element
        update = OxmlElement("w:updateFields")
        update.set(qn("w:val"), "true")
        settings.append(update)

        self.doc.add_page_break()

    # ---------- 标题 ----------
    def h1(self, text):
        p = self.doc.add_paragraph()
        p.paragraph_format.space_before = Pt(16)
        p.paragraph_format.space_after = Pt(8)
        p.paragraph_format.keep_with_next = True
        r = p.add_run(text)
        set_run_font(r, HEAD_FONT, 15, True, INK)
        ppr = p._p.get_or_add_pPr()
        borders = OxmlElement("w:pBdr")
        bottom = OxmlElement("w:bottom")
        bottom.set(qn("w:val"), "single")
        bottom.set(qn("w:sz"), "8")
        bottom.set(qn("w:space"), "6")
        bottom.set(qn("w:color"), "1F4E8C")
        borders.append(bottom)
        ppr.append(borders)
        outline = OxmlElement("w:outlineLvl")
        outline.set(qn("w:val"), "0")
        ppr.append(outline)
        self.headings.append((1, text, None))

    def h2(self, text):
        p = self.doc.add_paragraph()
        p.paragraph_format.space_before = Pt(12)
        p.paragraph_format.space_after = Pt(5)
        p.paragraph_format.keep_with_next = True
        r = p.add_run(text)
        set_run_font(r, HEAD_FONT, 12, True, RGBColor(0x1F, 0x4E, 0x8C))
        ppr = p._p.get_or_add_pPr()
        outline = OxmlElement("w:outlineLvl")
        outline.set(qn("w:val"), "1")
        ppr.append(outline)
        self.headings.append((2, text, None))

    def h3(self, text):
        p = self.doc.add_paragraph()
        p.paragraph_format.space_before = Pt(8)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.keep_with_next = True
        r = p.add_run(text)
        set_run_font(r, HEAD_FONT, 10.5, True, INK)

    # ---------- 正文 ----------
    def para(self, text, indent=True):
        p = self.doc.add_paragraph()
        if indent:
            p.paragraph_format.first_line_indent = Pt(21)
        self._rich(p, text)
        return p

    def _rich(self, p, text):
        parts = re.split(r"(\*\*.+?\*\*|`.+?`)", text)
        for part in parts:
            if not part:
                continue
            if part.startswith("**") and part.endswith("**"):
                r = p.add_run(part[2:-2])
                set_run_font(r, HEAD_FONT, 10.5, True, INK)
            elif part.startswith("`") and part.endswith("`"):
                r = p.add_run(part[1:-1])
                set_run_font(r, MONO_FONT, 9.5, False, RGBColor(0x8A, 0x2A, 0x2A))
            else:
                r = p.add_run(part)
                set_run_font(r, BODY_FONT, 10.5, False, INK)

    def bullet(self, text, level=0):
        p = self.doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(0.9 + level * 0.6)
        p.paragraph_format.first_line_indent = Cm(-0.45)
        p.paragraph_format.space_after = Pt(3)
        r = p.add_run("· " if level == 0 else "– ")
        set_run_font(r, BODY_FONT, 10.5, False, GRAY)
        self._rich(p, text)

    def numbered(self, text):
        p = self.doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(1.0)
        p.paragraph_format.first_line_indent = Cm(-0.55)
        p.paragraph_format.space_after = Pt(3)
        self._rich(p, text)

    def callout(self, text):
        p = self.doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(0.3)
        p.paragraph_format.space_before = Pt(4)
        p.paragraph_format.space_after = Pt(8)
        para_shading(p, "F2F6FB")
        para_border_left(p, "1F4E8C", 18)
        self._rich(p, text)

    def code(self, lines):
        for line in lines:
            p = self.doc.add_paragraph()
            p.paragraph_format.left_indent = Cm(0.6)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.05
            para_shading(p, "F5F5F3")
            r = p.add_run(line if line else " ")
            set_run_font(r, MONO_FONT, 8.8, False, RGBColor(0x33, 0x33, 0x33))
        spacer = self.doc.add_paragraph()
        spacer.paragraph_format.space_after = Pt(4)

    def table(self, header, rows, widths=None, font_size=9.5):
        table = self.doc.add_table(rows=len(rows) + 1, cols=len(header))
        table.style = "Table Grid"
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        table.autofit = True

        def fill(cell, text, bold=False, head=False):
            cell.text = ""
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.line_spacing = 1.15
            r = p.add_run(text)
            set_run_font(r, HEAD_FONT if bold else BODY_FONT, font_size, bold, INK)
            if head:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                shade(cell._tc.get_or_add_tcPr(), "E8EEF7")

        for j, h in enumerate(header):
            fill(table.rows[0].cells[j], h, bold=True, head=True)

        # 表头跨页重复，行不拆开
        head_tr = table.rows[0]._tr
        trpr = head_tr.get_or_add_trPr()
        th = OxmlElement("w:tblHeader")
        th.set(qn("w:val"), "true")
        trpr.append(th)
        for row in table.rows:
            rpr = row._tr.get_or_add_trPr()
            cant = OxmlElement("w:cantSplit")
            rpr.append(cant)
        for i, row in enumerate(rows, start=1):
            for j, val in enumerate(row):
                fill(table.rows[i].cells[j], str(val))
        if widths is None:
            def cw(t):
                t = str(t)
                return sum(2 if ord(ch) > 127 else 1 for ch in t)
            lens = []
            for j in range(len(header)):
                longest = max([cw(r[j]) for r in rows] + [cw(header[j])] + [6])
                lens.append(longest)
            avail = 15.4
            total = sum(lens)
            widths = [avail * l / total for l in lens]
            # 过窄的列给个下限，再整体缩回可用宽度
            widths = [max(1.35, w) for w in widths]
            scale = avail / sum(widths)
            widths = [w * scale for w in widths]
        for j, w in enumerate(widths):
            for row in table.rows:
                row.cells[j].width = Cm(w)
        spacer = self.doc.add_paragraph()
        spacer.paragraph_format.space_after = Pt(6)

    def figure(self, path, caption, width_cm=15.0):
        p = self.doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(6)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.keep_with_next = True
        run = p.add_run()
        run.add_picture(path, width=Cm(width_cm))
        cap = self.doc.add_paragraph()
        cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        cap.paragraph_format.space_after = Pt(10)
        r = cap.add_run(caption)
        set_run_font(r, BODY_FONT, 9, False, GRAY)


def parse_markdown(path):
    with open(path, encoding="utf-8") as f:
        return f.read().split("\n")


def build(md_path, out_path, title, subtitle, doctype, meta_rows):
    lines = parse_markdown(md_path)
    b = DocBuilder(title, subtitle, doctype, meta_rows)
    b.cover()
    b.toc()
    b._decorate()

    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        stripped = line.strip()

        if not stripped:
            i += 1
            continue

        if stripped == "[pagebreak]":
            b.doc.add_page_break()
            i += 1
            continue

        if stripped.startswith("```"):
            block = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                block.append(lines[i].rstrip())
                i += 1
            i += 1
            b.code(block)
            continue

        if stripped.startswith("|"):
            header = [c.strip() for c in stripped.strip("|").split("|")]
            rows = []
            i += 1
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if all(re.fullmatch(r":?-{2,}:?", c) for c in cells if c):
                    i += 1
                    continue
                rows.append(cells)
                i += 1
            b.table(header, rows)
            continue

        m = re.match(r"!\[(.*?)\]\((.*?)\)", stripped)
        if m:
            img = m.group(2)
            if not os.path.isabs(img):
                img = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(md_path)), img))
            b.figure(img, m.group(1))
            i += 1
            continue

        if stripped.startswith("## "):
            b.h1(stripped[3:])
            i += 1
            continue
        if stripped.startswith("### "):
            b.h2(stripped[4:])
            i += 1
            continue
        if stripped.startswith("#### "):
            b.h3(stripped[5:])
            i += 1
            continue
        if stripped.startswith("# "):
            i += 1
            continue

        if stripped.startswith("> "):
            b.callout(stripped[2:])
            i += 1
            continue

        if re.match(r"^[-*] ", stripped):
            b.bullet(stripped[2:])
            i += 1
            continue

        if re.match(r"^\d+\. ", stripped):
            b.numbered(stripped)
            i += 1
            continue

        b.para(stripped)
        i += 1

    b.doc.save(out_path)
    return out_path


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--md", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--title", required=True)
    ap.add_argument("--subtitle", default="")
    ap.add_argument("--doctype", required=True)
    args = ap.parse_args()

    meta = [
        ("参赛赛道", "人工智能赛道（国内）"),
        ("赛题方向", "银行 AI 智能体"),
        ("文档版本", "v1.0"),
        ("完成日期", "2026 年 10 月"),
    ]
    build(args.md, args.out, args.title, args.subtitle, args.doctype, meta)
    print("saved:", args.out)
