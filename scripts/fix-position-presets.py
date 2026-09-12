#!/usr/bin/env python3
"""
将 docs/product/shared-resources/position-presets.md 每个三级标题下的列表项统一为六个标准字段：
  - 负面：
  - lora：
  - 视角：
  - 服饰范围：
  - 画幅：
  - 暴露：

规则：
- 已有值保留，没有的留空（但保留列表项）。
- 暴露字段的多个独立项用 + 连接（如 胸部 + 内裤 → 胸部+内裤）。
- 画幅 竖图→竖屏、横图→横屏 归一化。
- ## 二级标题原样保留，不生成字段。
"""

import re
import sys
from pathlib import Path

INPUT_FILE = Path(__file__).resolve().parents[1] / "docs" / "product" / "shared-resources" / "position-presets.md"

KNOWN_VIEWPOINT = {
    "单人", "第一人称", "第一人称仅四肢", "第三人称", "第三人称男性身体",
}
KNOWN_RANGE = {
    "全身", "大腿以上", "腰部以上", "上半身", "脚以上",
}
KNOWN_ASPECT = {
    "竖屏", "横屏", "竖图", "横图",
}
KNOWN_EXPOSURE = {
    "胸部", "内裤", "无内裤", "无", "脱鞋", "服饰",
    "胸部+内裤", "胸部+无内裤+脱鞋", "内裤+胸部",
}

LABELS = [
    ("negative", "负面"),
    ("lora", "lora"),
    ("viewpoint", "视角"),
    ("range", "服饰范围"),
    ("aspect", "画幅"),
    ("exposure", "暴露"),
]


def unwrap_inline_code(value: str) -> str:
    """移除格式化器为数据载荷添加的单层 Markdown 行内代码标记。"""
    stripped = value.strip()
    if len(stripped) >= 2 and stripped.startswith("`") and stripped.endswith("`"):
        return stripped[1:-1].strip()
    return stripped


def classify_item(text: str):
    """返回 (category_key, value) 或 None。"""
    t = text.strip().lstrip("-").strip()

    # 已处理格式：- 标签名：值
    m = re.match(r'^(负面|lora|视角|服饰范围|画幅|暴露)[：:]\s*(.*)$', t)
    if m:
        label, val = m.group(1), unwrap_inline_code(m.group(2))
        key = {"负面": "negative", "lora": "lora", "视角": "viewpoint",
               "服饰范围": "range", "画幅": "aspect", "暴露": "exposure"}[label]
        return (key, val) if val else None

    # 负面：xxx
    m = re.match(r'^负面[：:]\s*(.*)$', t)
    if m:
        return ("negative", unwrap_inline_code(m.group(1)))

    # lora：xxx（含大小写变体）
    m = re.match(r'^L?ora[：:]\s*(.*)$', t, re.IGNORECASE)
    if m:
        return ("lora", unwrap_inline_code(m.group(1)))

    # 裸 lora 名（纯英文+下划线/连字符，不在已知中文值里）
    if re.fullmatch(r'[A-Za-z0-9_\-]+', t) and t not in (
        KNOWN_VIEWPOINT | KNOWN_RANGE | KNOWN_ASPECT | KNOWN_EXPOSURE):
        return ("lora", t)

    if t in KNOWN_VIEWPOINT:
        return ("viewpoint", t)
    if t in KNOWN_RANGE:
        return ("range", t)
    if t in KNOWN_ASPECT:
        return ("aspect", t.replace("竖图", "竖屏").replace("横图", "横屏"))
    if t in KNOWN_EXPOSURE:
        return ("exposure", t)

    return None


STD_LABEL_RE = re.compile(r'^(负面|lora|视角|服饰范围|画幅|暴露)[：:]', re.IGNORECASE)


def render_section(title, body_lines, raw_items, trailing_lines):
    """渲染一个 ### 小节为字符串。"""
    collected = {k: [] for k, _ in LABELS}
    unknown = []   # 未识别的列表项，原样保留放到小节最后
    for raw in raw_items:
        res = classify_item(raw)
        if res:
            key, val = res
            if val and val not in collected[key]:
                collected[key].append(val)
        else:
            t = raw.strip().lstrip("-").strip()
            # 标准标签的空行（如 - 视角：）跳过，不当作未识别项
            if STD_LABEL_RE.match(t):
                continue
            if t and t not in unknown:
                unknown.append(t)

    def join(key):
        vals = collected[key]
        if not vals:
            return ""
        if key == "exposure":
            return "+".join(vals)
        # 其他字段一般单值，多值时用顿号兜底
        return "、".join(vals)

    body = "\n".join(body_lines).strip()
    out = title + "\n\n"
    if body:
        out += body + "\n\n"
    for key, label in LABELS:
        v = join(key)
        if v and key in {"negative", "lora"}:
            v = f"`{v}`"
        out += f"- {label}：{v}\n" if v else f"- {label}：\n"
    # 未识别项原样保留，追加到小节最后
    for u in unknown:
        out += f"- {u}\n"
    trailing = "\n".join(trailing_lines).strip()
    if trailing:
        out += "\n" + trailing + "\n"
    return out


def format_document(content: str) -> str:
    lines = content.replace("\r\n", "\n").split("\n")

    head_lines = []      # 第一个标题之前的文件头
    blocks = []          # 输出块列表（字符串）
    seen_heading = False
    outside_lines = []   # 二级标题以及首个三级标题前的正文

    cur_title = None
    cur_body = []
    cur_items = []
    cur_trailing = []
    seen_items = False

    def flush_outside():
        nonlocal outside_lines
        raw = "\n".join(outside_lines).strip()
        if raw:
            blocks.append(raw)
        outside_lines = []

    def flush_section():
        nonlocal cur_title, cur_body, cur_items, cur_trailing, seen_items
        if cur_title is not None:
            blocks.append(render_section(cur_title, cur_body, cur_items, cur_trailing))
        cur_title, cur_body, cur_items, cur_trailing = None, [], [], []
        seen_items = False

    for line in lines:
        if line.startswith("### "):
            flush_section()
            flush_outside()
            seen_heading = True
            cur_title = line
            cur_body, cur_items, cur_trailing = [], [], []
            seen_items = False
        elif line.startswith("## "):
            flush_section()
            flush_outside()
            seen_heading = True
            outside_lines.append(line)
        elif cur_title is not None:
            stripped = line.strip()
            if stripped.startswith("- "):
                cur_items.append(stripped)
                seen_items = True
            elif seen_items:
                cur_trailing.append(line)
            else:
                cur_body.append(line)
        elif seen_heading:
            outside_lines.append(line)
        else:
            head_lines.append(line)

    flush_section()
    flush_outside()

    # 组装：文件头 + 空行 + 各块之间单空行
    head = "\n".join(head_lines).strip()
    body = "\n\n".join(b.rstrip() for b in blocks)
    return (head + "\n\n" if head else "") + body + "\n"


def main(argv=None):
    args = list(sys.argv[1:] if argv is None else argv)
    if len(args) > 1:
        raise SystemExit("usage: fix-position-presets.py [catalog-path]")

    input_file = Path(args[0]).resolve() if args else INPUT_FILE
    with open(input_file, "r", encoding="utf-8") as f:
        content = f.read()

    result = format_document(content)

    with open(input_file, "w", encoding="utf-8") as f:
        f.write(result)

    print(f"处理完成，已写回 {input_file}")


if __name__ == "__main__":
    main()
