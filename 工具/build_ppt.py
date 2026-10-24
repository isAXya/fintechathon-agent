# -*- coding: utf-8 -*-
"""生成答辩 PPT。所有元素都是原生形状与文本框，指导老师可以直接改字改图。"""

import os
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.ns import qn
from lxml import etree

INK = RGBColor(0x17, 0x20, 0x2E)
GRAY = RGBColor(0x5C, 0x6B, 0x7F)
LIGHT = RGBColor(0x8B, 0x97, 0xA9)
BLUE = RGBColor(0x1F, 0x4E, 0x8C)
BLUE_SOFT = RGBColor(0xE9, 0xF0, 0xFA)
AMBER = RGBColor(0x8A, 0x5A, 0x12)
AMBER_SOFT = RGBColor(0xFB, 0xF1, 0xDE)
RED = RGBColor(0x9D, 0x2F, 0x2A)
RED_SOFT = RGBColor(0xFB, 0xE9, 0xE8)
GREEN = RGBColor(0x18, 0x6B, 0x4A)
GREEN_SOFT = RGBColor(0xE5, 0xF2, 0xEC)
LINE = RGBColor(0xDD, 0xE3, 0xEC)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
PAPER = RGBColor(0xF7, 0xF8, 0xFA)

FONT = "微软雅黑"
W, H = 13.333, 7.5

prs = Presentation()
prs.slide_width = Inches(W)
prs.slide_height = Inches(H)
prs.core_properties.author = "语行团队"
prs.core_properties.last_modified_by = "语行团队"
prs.core_properties.title = "语行 · 银行 AI 智能体 答辩"
prs.core_properties.subject = "2026 深圳国际金融科技大赛 人工智能赛道"
BLANK = prs.slide_layouts[6]

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOT = os.path.join(BASE, "素材", "截图")
FIG = os.path.join(BASE, "素材", "插图")


def set_font(run, size=16, bold=False, color=INK, italic=False):
    f = run.font
    f.name = FONT
    f.size = Pt(size)
    f.bold = bold
    f.italic = italic
    f.color.rgb = color
    rPr = run._r.get_or_add_rPr()
    ea = rPr.find(qn("a:ea"))
    if ea is None:
        ea = etree.SubElement(rPr, qn("a:ea"))
    ea.set("typeface", FONT)


def textbox(slide, x, y, w, h, text, size=16, bold=False, color=INK, align=PP_ALIGN.LEFT, line=1.5):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = 0
    tf.margin_right = 0
    tf.margin_top = 0
    tf.margin_bottom = 0
    lines = text.split("\n")
    for i, ln in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = line
        r = p.add_run()
        r.text = ln
        set_font(r, size, bold, color)
    return box


def rect(slide, x, y, w, h, fill=WHITE, line_color=LINE, line_w=0.75, radius=None, shape=MSO_SHAPE.RECTANGLE):
    shp = slide.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    shp.shadow.inherit = False
    if fill is None:
        shp.fill.background()
    else:
        shp.fill.solid()
        shp.fill.fore_color.rgb = fill
    if line_color is None:
        shp.line.fill.background()
    else:
        shp.line.color.rgb = line_color
        shp.line.width = Pt(line_w)
    shp.text_frame.text = ""
    return shp


def hairline(slide, x, y, w, color=LINE, width=0.75):
    shp = slide.shapes.add_connector(1, Inches(x), Inches(y), Inches(x + w), Inches(y))
    shp.line.color.rgb = color
    shp.line.width = Pt(width)


def kicker(slide, text, color=BLUE):
    textbox(slide, 0.9, 0.62, 8, 0.3, text, 11.5, True, color)


def headline(slide, text, y=0.98, size=30, w=11.6):
    textbox(slide, 0.9, y, w, 0.9, text, size, True, INK, line=1.25)


def footnote(slide, idx, total=12):
    hairline(slide, 0.9, 6.95, 11.53, RGBColor(0xE8, 0xEC, 0xF2), 0.5)
    textbox(slide, 0.9, 7.02, 6, 0.25, "语行 · 2026 深圳国际金融科技大赛", 9.5, False, LIGHT)
    textbox(slide, 11.4, 7.02, 1.03, 0.25, f"{idx:02d} / {total:02d}", 9.5, False, LIGHT, PP_ALIGN.RIGHT)


def picture(slide, path, x, y, w=None, h=None, border=True):
    kw = {}
    if w:
        kw["width"] = Inches(w)
    if h:
        kw["height"] = Inches(h)
    pic = slide.shapes.add_picture(path, Inches(x), Inches(y), **kw)
    if border:
        pic.line.color.rgb = LINE
        pic.line.width = Pt(0.75)
    return pic


def fit_picture(slide, path, x, y, max_w, max_h, border=True):
    from PIL import Image
    with Image.open(path) as im:
        iw, ih = im.size
    ratio = iw / ih
    w = max_w
    h = w / ratio
    if h > max_h:
        h = max_h
        w = h * ratio
    pic = slide.shapes.add_picture(path, Inches(x + (max_w - w) / 2), Inches(y), width=Inches(w))
    if border:
        pic.line.color.rgb = LINE
        pic.line.width = Pt(0.75)
    return pic, w, h


def notes(slide, text):
    slide.notes_slide.notes_text_frame.text = text


def new_slide():
    return prs.slides.add_slide(BLANK)


# ---------------------------------------------------------------- 01 封面
s = new_slide()
rect(s, 0, 0, W, H, PAPER, None)
rect(s, 0, 0, 0.16, H, BLUE, None)
textbox(s, 0.95, 1.55, 9, 0.35, "2026 深圳国际金融科技大赛 · 人工智能赛道", 13, False, GRAY)
textbox(s, 0.95, 2.05, 6, 1.2, "语行", 74, True, INK, line=1.0)
textbox(s, 0.98, 3.42, 7.6, 0.9, "让「说话办事」真正落到银行", 26, True, BLUE, line=1.3)
textbox(s, 0.98, 4.34, 7.4, 0.7, "一个把权限边界写进策略表的银行 AI 智能体", 16, False, GRAY, line=1.5)
# 右侧对话示意
card_x, card_y, card_w, card_h = 8.45, 1.5, 4.0, 4.15
rect(s, card_x, card_y, card_w, card_h, WHITE, RGBColor(0xDD, 0xE3, 0xEC), 0.75)
rect(s, card_x + 0.24, card_y + 0.26, 0.52, 0.52, BLUE_SOFT, None, shape=MSO_SHAPE.OVAL)
textbox(s, card_x + 0.24, card_y + 0.38, 0.52, 0.3, "语", 12, True, BLUE, PP_ALIGN.CENTER)

b1 = rect(s, card_x + 0.28, card_y + 1.02, 2.55, 0.62, RGBColor(0xF2, 0xF5, 0xF9), None, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
b1.adjustments[0] = 0.18
textbox(s, card_x + 0.44, card_y + 1.16, 2.2, 0.3, "本月支出 9,067.40 元", 10.5, False, RGBColor(0x38, 0x44, 0x5A))

b2 = rect(s, card_x + 1.22, card_y + 1.82, 2.5, 0.62, BLUE, None, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
b2.adjustments[0] = 0.18
textbox(s, card_x + 1.38, card_y + 1.96, 2.2, 0.3, "给王琪转 800，备注聚餐", 10.5, True, WHITE)

b3 = rect(s, card_x + 0.28, card_y + 2.62, 2.85, 0.62, RGBColor(0xF2, 0xF5, 0xF9), None, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
b3.adjustments[0] = 0.18
textbox(s, card_x + 0.44, card_y + 2.76, 2.55, 0.3, "已转出，凭证 T2026…8135", 10.5, False, RGBColor(0x38, 0x44, 0x5A))

rect(s, card_x + 0.28, card_y + 3.44, 1.72, 0.34, AMBER_SOFT, None)
textbox(s, card_x + 0.4, card_y + 3.5, 1.55, 0.25, "黄色 · 用户确认", 9.5, True, AMBER)

hairline(s, 0.98, 5.9, 5.2, RGBColor(0xC9, 0xD2, 0xE0), 1)
textbox(s, 0.98, 6.08, 6, 0.3, "参赛作品原型 · 可运行 · 可复现 · 可扩展", 11.5, False, LIGHT)
notes(s, "开场 20 秒：各位评委好，我们是语行团队。今天不讲概念，直接给大家看一句话是怎么变成一笔安全交易的。")

# ---------------------------------------------------------------- 02 问题
s = new_slide()
kicker(s, "01 / 问题")
headline(s, "用户要的不是更多功能，是更短的路")
# 左：路径对比
rect(s, 0.9, 2.15, 5.55, 3.9, WHITE, LINE)
textbox(s, 1.2, 2.38, 5, 0.3, "现在的手机银行", 12.5, True, GRAY)
steps = ["打开 APP", "找到「转账」", "选收款人", "填金额与备注", "输入密码", "等待回单"]
for i, st in enumerate(steps):
    y = 2.8 + i * 0.52
    rect(s, 1.2, y, 0.28, 0.28, BLUE_SOFT, None, shape=MSO_SHAPE.OVAL)
    textbox(s, 1.2, y + 0.02, 0.28, 0.24, str(i + 1), 9.5, True, BLUE, PP_ALIGN.CENTER)
    textbox(s, 1.62, y - 0.01, 3.6, 0.3, st, 14, False, RGBColor(0x38, 0x44, 0x5A))
textbox(s, 4.05, 5.55, 2.2, 0.3, "平均 6 步", 13, True, RED, PP_ALIGN.RIGHT)

# 右：三句话
rect(s, 6.75, 2.15, 5.65, 3.9, WHITE, LINE)
textbox(s, 7.05, 2.38, 5, 0.3, "我们真正要解决的", 12.5, True, GRAY)
items = [
    ("说得清", "一句话里金额、对象、时间可能缺一半"),
    ("办得对", "同一个意思有十几种说法，识别错了要赔钱"),
    ("敢放手", "查询可以自动，转账不行，界线在哪"),
]
for i, (t, d) in enumerate(items):
    y = 2.85 + i * 1.02
    textbox(s, 7.05, y, 1.3, 0.35, t, 17, True, INK)
    textbox(s, 8.35, y + 0.04, 3.8, 0.7, d, 13, False, GRAY, line=1.4)

textbox(s, 0.9, 6.25, 11.5, 0.4, "所以这道题表面上是「自然语言交互」，实际上考的是两件事：理解得准，以及边界划得清。", 14, False, RGBColor(0x38, 0x44, 0x5A))
footnote(s, 2)
notes(s, "40 秒。不要念屏，指一下左边六步，再说右边三个难点。落点是最后那句：表面考交互，实际考边界。")

# ---------------------------------------------------------------- 03 判断
s = new_slide()
kicker(s, "02 / 我们的判断")
headline(s, "把「快」和「稳」拆成两层，各管各的")
textbox(s, 0.9, 1.85, 11.4, 0.5, "很多方案想让一个模型同时负责理解、决策和执行，结果两头都不牢。我们把它劈开：", 14, False, GRAY)

rect(s, 0.9, 2.55, 5.55, 3.55, WHITE, LINE)
textbox(s, 1.2, 2.78, 4.8, 0.35, "理解层　求快", 18, True, BLUE)
textbox(s, 1.2, 3.24, 4.9, 2.6,
        "规则识别为主，大模型兜底\n\n覆盖 20 类意图、24 个受控动作\n\n单句解析 0.008 毫秒，可回归测试\n\n断网可用，不依赖外部接口", 13.5, False, RGBColor(0x38, 0x44, 0x5A), line=1.55)

rect(s, 6.9, 2.55, 5.55, 3.55, WHITE, LINE)
textbox(s, 7.2, 2.78, 4.8, 0.35, "决策层　求稳", 18, True, AMBER)
textbox(s, 7.2, 3.24, 4.9, 2.6,
        "策略表写死每个动作的下限\n\n风险评分只能往上抬，不能往下压\n\n硬规则覆盖金额与账户安全操作\n\n对话内容改变不了档位", 13.5, False, RGBColor(0x38, 0x44, 0x5A), line=1.55)

textbox(s, 0.9, 6.4, 11.5, 0.4, "两层之间的接口只有一样东西：结构化的意图和槽位。谁也别越界。", 14, True, INK)
footnote(s, 3)
notes(s, "50 秒。这是全场最重要的一页。强调「接口只有结构化意图」，所以模型再怎么说，也改不了权限。")

# ---------------------------------------------------------------- 04 产品
s = new_slide()
kicker(s, "03 / 产品")
headline(s, "左边说话，右边看它怎么想")
fit_picture(s, f"{SHOT}/09-bill.png", 0.9, 1.72, 11.53, 4.35)
textbox(s, 0.9, 6.35, 11.5, 0.4, "界面三件套：对话流、任务图、审计链。任何一步都能复盘到「为什么这么判」。", 13.5, False, GRAY)
footnote(s, 4)
notes(s, "40 秒。这张图是真实运行截图，不是设计稿。指一下右侧：执行图、权限与风险、审计链三个标签。")

# ---------------------------------------------------------------- 05 DAG
s = new_slide()
kicker(s, "04 / 任务规划")
headline(s, "「安排妈妈的生日」不是一个动作，是四个")
textbox(s, 0.9, 1.8, 5.3, 0.55, "赛题的跨场景例子，我们做成了可执行的依赖图：", 13.5, False, GRAY)

nodes = [
    ("查询联系人与纪念日", "只读　绿色", GREEN, GREEN_SOFT),
    ("冻结 1000 元专项款", "资金占用　黄色", AMBER, AMBER_SOFT),
    ("预约鲜花与蛋糕", "支出 426 元　黄色", AMBER, AMBER_SOFT),
    ("设置送达提醒", "只读　绿色", GREEN, GREEN_SOFT),
]
rail_x = 0.95
rect(s, rail_x - 0.01, 2.7, 0.03, 3.15, RGBColor(0xD8, 0xDF, 0xE9), None)
for i, (name, tag, color, soft) in enumerate(nodes):
    y = 2.35 + i * 1.04
    rect(s, 1.28, y, 4.35, 0.76, soft, color, 0.75)
    textbox(s, 1.52, y + 0.11, 3.3, 0.3, name, 13.5, True, INK)
    textbox(s, 1.52, y + 0.42, 3.3, 0.25, tag, 10.5, False, color)
    rect(s, rail_x - 0.09, y + 0.28, 0.19, 0.19, WHITE, color, 1.25, shape=MSO_SHAPE.OVAL)

rect(s, 6.0, 2.35, 6.42, 3.15, PAPER, LINE)
textbox(s, 6.3, 2.56, 5.8, 0.3, "如果两个写操作并行，会怎样", 12, True, GRAY)
textbox(s, 6.3, 2.92, 5.85, 0.85,
        "两笔 3000 元同时发起，余额校验都看到 3486.30 元，都通过；\n合计扣 6000 元，账户透支 2513.70 元。",
        12.5, False, RGBColor(0x38, 0x44, 0x5A), line=1.55)
hairline(s, 6.3, 3.82, 5.82, RGBColor(0xDD, 0xE3, 0xEC), 0.75)
textbox(s, 6.3, 3.96, 5.85, 0.85,
        "改成串行：第二笔看到的是扣减后的余额，校验直接失败，\n任务终止并回滚第一笔。",
        12.5, False, RGBColor(0x38, 0x44, 0x5A), line=1.55)
textbox(s, 6.3, 4.98, 5.85, 0.3, "规则：读并行，写串行。", 12.5, True, BLUE)

textbox(s, 0.9, 6.55, 11.5, 0.35, "四个节点串成一条链，用户只需要确认两次，剩下的自动完成。", 13.5, True, INK)
footnote(s, 5)
notes(s, "50 秒。先讲四个节点，再讲为什么写操作要串行——用「两条分支都通过余额校验，合起来透支」这个反例。")

# ---------------------------------------------------------------- 06 权限
s = new_slide()
kicker(s, "05 / 权限分级")
headline(s, "权限写在表里，不写在提示词里")

tiers = [
    ("绿色", "自动执行", "10 个动作", "余额、明细、账单、持仓、订阅扫描", GREEN, GREEN_SOFT),
    ("黄色", "用户确认", "9 个动作", "小额转账、定时转账、取消订阅、理财赎回", AMBER, AMBER_SOFT),
    ("红色", "强验证", "5 个动作", "大额转账、理财申购、挂失、解锁、额度调整", RED, RED_SOFT),
]
examples = ["例：还有多少钱？", "例：给王琪转 800", "例：给李明转 5000"]
for i, (name, policy, count, scope, color, soft) in enumerate(tiers):
    x = 0.9 + i * 3.92
    rect(s, x, 2.05, 3.6, 2.85, WHITE, LINE)
    rect(s, x, 2.05, 3.6, 0.1, color, None)
    textbox(s, x + 0.28, 2.32, 1.4, 0.4, name, 24, True, color)
    textbox(s, x + 0.3, 2.9, 3, 0.3, policy, 14, True, INK)
    textbox(s, x + 0.3, 3.28, 3, 0.28, count, 11.5, False, GRAY)
    textbox(s, x + 0.3, 3.66, 3.0, 0.7, scope, 11.5, False, RGBColor(0x38, 0x44, 0x5A), line=1.45)
    textbox(s, x + 0.3, 4.42, 3.0, 0.3, examples[i], 11, False, color)

textbox(s, 0.9, 5.22, 11.5, 0.75,
        "判定顺序固定三步：风险评分给基础档 → 与策略下限取最大值 → 硬规则直接覆盖。\n任何一步都不会把红色降成黄色。", 13.5, False, RGBColor(0x38, 0x44, 0x5A), line=1.6)
rect(s, 0.9, 6.18, 11.53, 0.5, BLUE_SOFT, None)
textbox(s, 1.12, 6.29, 11, 0.3, "一句话总结：模型可以理解错，但不能越过红线。", 13, True, BLUE)
footnote(s, 6)
notes(s, "60 秒。重点讲第三步「硬规则直接覆盖」，并举 5000 元的例子：评分只有 32，本该黄色，硬规则把它拉红。")

# ---------------------------------------------------------------- 07 算例
s = new_slide()
kicker(s, "06 / 同一句话，两个结果")
headline(s, "800 元和 5000 元，差的不只是数字")

cards = [
    (0.9, "给王琪转 800", "14", "黄色 · 用户确认", "历史收款人，无额外加分", "确认后执行", BLUE, BLUE_SOFT),
    (6.85, "给李明转 5000", "32", "红色 · 强验证", "金额档位 32，未触发频次", "短信动态码", RED, RED_SOFT),
]
for x, title, score, tier, reason, action, color, soft in cards:
    rect(s, x, 1.95, 5.55, 3.55, WHITE, LINE)
    textbox(s, x + 0.32, 2.18, 4.6, 0.4, title, 18, True, INK)
    textbox(s, x + 0.32, 2.72, 1.4, 0.8, score, 46, True, color)
    textbox(s, x + 1.55, 3.05, 3.6, 0.35, "/ 100 分", 12, False, LIGHT)
    rect(s, x + 0.32, 3.72, 4.9, 0.06, RGBColor(0xEE, 0xF1, 0xF6), None)
    rect(s, x + 0.32, 3.72, 4.9 * int(score) / 100, 0.06, color, None)
    textbox(s, x + 0.32, 3.95, 4.9, 0.3, tier, 13, True, color)
    textbox(s, x + 0.32, 4.35, 4.9, 0.3, reason, 11.5, False, GRAY)
    textbox(s, x + 0.32, 4.78, 4.9, 0.3, "处置：" + action, 12, False, RGBColor(0x38, 0x44, 0x5A))

textbox(s, 0.9, 5.75, 11.5, 0.85,
        "第二张卡值得多说一句：评分 32 分按分段本该是黄色，但「单笔超过 1000 元」这条硬规则把它拉到红色。\n评分可能因为数据缺失而低估风险，硬规则不会。", 13, False, RGBColor(0x38, 0x44, 0x5A), line=1.6)
footnote(s, 7)
notes(s, "50 秒。这页回答「你们的评分会不会被绕过」。答案是：评分可以被质疑，硬规则不会。")

# ---------------------------------------------------------------- 08 五道防线
s = new_slide()
kicker(s, "07 / 安全机制")
headline(s, "赛题要的五件事，逐条对上")

rows = [
    ("幻觉防护", "回复只由结构化结果拼装，逐数字溯源，对不上就删", "6 条用例"),
    ("注入防御", "9 条规则覆盖指令覆盖、角色劫持、权限绕过等六类", "12 条用例"),
    ("操作审计", "节点级 SHA-256 哈希链，可校验、可导出", "7 条实测"),
    ("异常熔断", "连续失败 3 次或拦截 5 次，锁定 10 分钟", "4 条用例"),
    ("沙箱边界", "只执行注册表内 24 个动作，用户语句不进执行器", "全量覆盖"),
]
for i, (name, desc, tag) in enumerate(rows):
    y = 1.92 + i * 0.95
    textbox(s, 0.9, y, 1.9, 0.35, name, 15, True, INK)
    textbox(s, 2.9, y + 0.02, 7.1, 0.4, desc, 12.5, False, RGBColor(0x38, 0x44, 0x5A))
    rect(s, 10.35, y, 2.05, 0.34, PAPER, None)
    textbox(s, 10.45, y + 0.05, 1.9, 0.25, tag, 10, False, GRAY)
    if i < 4:
        hairline(s, 0.9, y + 0.78, 11.53, RGBColor(0xEC, 0xF0, 0xF5), 0.5)

textbox(s, 0.9, 6.65, 11.5, 0.3, "43 条安全用例全部通过，8 条正常话术零误报。", 13, True, GREEN)
footnote(s, 8)
notes(s, "55 秒。逐条点名，每条约 8 秒。重点留时间给「沙箱是逻辑隔离不是容器」，主动说局限比被问出来好。")

# ---------------------------------------------------------------- 09 审计
s = new_slide()
kicker(s, "08 / 可追责")
headline(s, "改一条记录，整条链就对不上")
fit_picture(s, f"{SHOT}/12-audit-verified.png", 0.9, 1.85, 7.55, 3.55)

rect(s, 8.75, 1.95, 3.68, 3.1, PAPER, LINE)
textbox(s, 9.0, 2.15, 3.2, 0.3, "链式结构", 12, True, GRAY)
chain = [
    ("#1", "0x9f3c…", 2.55),
    ("#2", "0x41ae…", 3.22),
    ("#3", "0x7bd0…", 3.89),
    ("#4", "0x2c18…", 4.56),
]
for label, h, y in chain:
    rect(s, 9.0, y, 0.62, 0.44, WHITE, LINE)
    textbox(s, 9.0, y + 0.1, 0.62, 0.25, label, 11, True, BLUE, PP_ALIGN.CENTER)
    textbox(s, 9.75, y + 0.11, 2.4, 0.25, h, 11, False, GRAY)
    if y < 4.5:
        textbox(s, 9.24, y + 0.46, 0.3, 0.2, "↓", 10, True, LIGHT)

textbox(s, 8.75, 5.25, 3.7, 1.3, "每条记录的 hash\n= SHA-256(前一条 hash + 本条内容)", 11.5, False, RGBColor(0x38, 0x44, 0x5A), line=1.5)
textbox(s, 0.9, 5.55, 7.55, 1.0,
        "粒度是节点级，不是对话级：四个节点的计划，会留下四次执行、两次确认、一次汇总。\n事后复盘时，能还原「当时为什么这么判」。", 12.5, False, RGBColor(0x38, 0x44, 0x5A), line=1.55)
footnote(s, 9)
notes(s, "45 秒。现场演示时可以直接改一条记录再点校验，报出断在第几条，这个演示比讲原理有效。")

# ---------------------------------------------------------------- 10 实测
s = new_slide()
kicker(s, "09 / 工程验证")
headline(s, "不讲感觉，讲跑出来的数")

metrics = [
    ("0.29", "毫秒", "完整链路耗时", "解析 → 评分 → 确认 → 执行 → 审计"),
    ("83", "项", "自动化用例", "40 功能 + 43 安全，全部通过"),
    ("24", "个", "受控动作", "10 绿 / 9 黄 / 5 红"),
    ("0", "个", "第三方依赖", "node server.js 即可运行"),
]
for i, (num, unit, label, sub) in enumerate(metrics):
    x = 0.9 + i * 2.95
    textbox(s, x, 2.05, 2.6, 0.85, num, 44, True, BLUE, line=1.0)
    textbox(s, x + 0.02, 2.92, 1.2, 0.3, unit, 12, False, GRAY)
    textbox(s, x, 3.35, 2.6, 0.3, label, 13, True, INK)
    textbox(s, x, 3.7, 2.55, 0.7, sub, 10.5, False, GRAY, line=1.4)

hairline(s, 0.9, 4.62, 11.53, RGBColor(0xE8, 0xEC, 0xF2), 1)
textbox(s, 0.9, 4.82, 2.4, 0.3, "单环节耗时", 11.5, True, GRAY)
perf = [
    ("意图解析", "0.008 ms"), ("任务图构建", "0.008 ms"), ("风险评分", "0.039 ms"),
    ("注入扫描", "0.0004 ms"), ("数字溯源", "0.046 ms"), ("审计写入", "0.12 ms"),
]
for i, (k, v) in enumerate(perf):
    x = 0.9 + (i % 3) * 3.95
    y = 5.22 + (i // 3) * 0.62
    textbox(s, x, y, 1.8, 0.3, k, 12, False, GRAY)
    textbox(s, x + 1.85, y, 1.4, 0.3, v, 12, True, INK)

textbox(s, 0.9, 6.48, 11.5, 0.3, "测试环境：Windows 11 / Node.js 22.22 / 单线程，未做缓存优化。", 10.5, False, LIGHT)
footnote(s, 10)
notes(s, "40 秒。数字都是 tests/bench.js 跑出来的，评委可以现场复跑。强调「含确认等待」不算——0.29 毫秒不含人工确认。")

# ---------------------------------------------------------------- 11 对比
s = new_slide()
kicker(s, "10 / 方案对比")
headline(s, "为什么不直接用一个大模型")

hdr = ["对比项", "纯大模型 Agent", "菜单式银行", "语行"]
col_x = [0.9, 3.55, 7.05, 10.25]
col_w = [2.55, 3.4, 3.1, 3.15]
rows = [
    ("结果稳定性", "同一句话两次可能不同", "稳定", "稳定，可回归"),
    ("可解释性", "难以说明为何这样判", "无判定过程", "策略表可查"),
    ("权限边界", "靠提示词约束", "靠流程约束", "写死在表里"),
    ("离线可用", "依赖外部接口", "可用", "完全可用"),
    ("跨场景", "强", "弱", "中，覆盖六类"),
]
textbox(s, col_x[0], 1.95, col_w[0], 0.35, hdr[0], 11.5, True, GRAY)
textbox(s, col_x[1], 1.95, col_w[1], 0.35, hdr[1], 11.5, True, GRAY)
textbox(s, col_x[2], 1.95, col_w[2], 0.35, hdr[2], 11.5, True, GRAY)
textbox(s, col_x[3], 1.95, col_w[3], 0.35, hdr[3], 11.5, True, BLUE)
hairline(s, 0.9, 2.32, 11.53, RGBColor(0xD8, 0xDF, 0xE9), 1)

for i, row in enumerate(rows):
    y = 2.48 + i * 0.82
    if i % 2 == 0:
        rect(s, 0.9, y - 0.1, 11.53, 0.78, PAPER, None)
    textbox(s, col_x[0], y, col_w[0], 0.3, row[0], 12.5, True, INK)
    textbox(s, col_x[1], y, col_w[1], 0.3, row[1], 12, False, GRAY)
    textbox(s, col_x[2], y, col_w[2], 0.3, row[2], 12, False, GRAY)
    textbox(s, col_x[3], y, col_w[3], 0.3, row[3], 12, True, BLUE)

textbox(s, 0.9, 6.55, 11.5, 0.35, "我们不是反对大模型，是把它的位置放对：理解层兜底，不进决策层。", 13, True, INK)
footnote(s, 11)
notes(s, "45 秒。别踩竞品，讲取舍。最后一句是立场：不是反大模型，是分层。")

# ---------------------------------------------------------------- 12 收尾
s = new_slide()
rect(s, 0, 0, W, H, PAPER, None)
rect(s, 0, 0, 0.16, H, BLUE, None)
kicker(s, "11 / 还差什么")
textbox(s, 0.95, 1.05, 11, 0.9, "清楚的边界，比漂亮的功能更重要", 30, True, INK)

left = [
    ("现在还没做到的", ["动态码是固定值，接真实网关才能上线",
                    "并发与幂等未验证，需要账户级锁",
                    "审计链头没有外部锚定"]),
]
textbox(s, 0.95, 2.15, 5.3, 0.35, "现在还没做到的", 12.5, True, GRAY)
for i, item in enumerate(left[0][1]):
    y = 2.6 + i * 0.72
    rect(s, 0.97, y + 0.1, 0.14, 0.14, RED, None, shape=MSO_SHAPE.OVAL)
    textbox(s, 1.3, y, 5.0, 0.35, item, 12.5, False, RGBColor(0x38, 0x44, 0x5A))

textbox(s, 6.95, 2.15, 5.3, 0.35, "接下来三个月", 12.5, True, GRAY)
for i, item in enumerate(["会话上下文栈，支持「再转 200」", "策略表外置成配置，业务自己调档位", "补并发压测与幂等键"]):
    y = 2.6 + i * 0.72
    rect(s, 6.97, y + 0.1, 0.14, 0.14, BLUE, None, shape=MSO_SHAPE.OVAL)
    textbox(s, 7.3, y, 5.0, 0.35, item, 12.5, False, RGBColor(0x38, 0x44, 0x5A))

hairline(s, 0.95, 5.35, 11.4, RGBColor(0xC9, 0xD2, 0xE0), 1)
textbox(s, 0.95, 5.55, 11, 1.2, "语行 · 让每一句「帮我转一下」，\n都落在一条看得见的规则上。", 22, True, BLUE, line=1.5)
textbox(s, 0.95, 6.75, 8, 0.3, "2026 深圳国际金融科技大赛 · 人工智能赛道", 10.5, False, LIGHT)
notes(s, "30 秒。收尾不要喊口号，把局限说完整，反而更有说服力。然后停下来等提问。")

out = os.path.join(BASE, "docs", "语行-答辩PPT.pptx")
prs.save(out)
print("saved", out, "slides", len(prs.slides.__iter__.__self__._sldIdLst))
