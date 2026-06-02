#!/usr/bin/env python3
"""
将 position_presets.md 每个三级标题下的列表项统一为六个标准字段：
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

INPUT_FILE = "/Users/luca/dev/comfyui-remote/position_presets.md"

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


def classify_item(text: str):
    """返回 (category_key, value) 或 None。"""
    t = text.strip().lstrip("-").strip()

    # 已处理格式：- 标签名：值
    m = re.match(r'^(负面|lora|视角|服饰范围|画幅|暴露)[：:]\s*(.*)$', t)
    if m:
        label, val = m.group(1), m.group(2).strip()
        key = {"负面": "negative", "lora": "lora", "视角": "viewpoint",
               "服饰范围": "range", "画幅": "aspect", "暴露": "exposure"}[label]
        return (key, val) if val else None

    # 负面：xxx
    m = re.match(r'^负面[：:]\s*(.*)$', t)
    if m:
        return ("negative", m.group(1).strip())

    # lora：xxx（含大小写变体）
    m = re.match(r'^L?ora[：:]\s*(.*)$', t, re.IGNORECASE)
    if m:
        return ("lora", m.group(1).strip())

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


def render_section(title, body_lines, raw_items):
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
        out += f"- {label}：{v}\n" if v else f"- {label}：\n"
    # 未识别项原样保留，追加到小节最后
    for u in unknown:
        out += f"- {u}\n"
    return out


def main():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        content = f.read()

    lines = content.replace("\r\n", "\n").split("\n")

    head_lines = []      # 第一个标题之前的文件头
    blocks = []          # 输出块列表（字符串）
    seen_heading = False

    cur_title = None
    cur_body = []
    cur_items = []

    def flush():
        nonlocal cur_title, cur_body, cur_items
        if cur_title is not None:
            blocks.append(render_section(cur_title, cur_body, cur_items))
        cur_title, cur_body, cur_items = None, [], []

    for line in lines:
        if line.startswith("### "):
            flush()
            seen_heading = True
            cur_title = line
            cur_body, cur_items = [], []
        elif line.startswith("## "):
            flush()
            seen_heading = True
            blocks.append(line)  # 二级标题原样保留
        elif cur_title is not None:
            stripped = line.strip()
            if stripped.startswith("- "):
                cur_items.append(stripped)
            elif stripped == "":
                if not cur_items:
                    cur_body.append(line)
            else:
                if not cur_items:
                    cur_body.append(line)
        else:
            if not seen_heading:
                head_lines.append(line)

    flush()

    # 组装：文件头 + 空行 + 各块之间单空行
    head = "\n".join(head_lines).strip()
    body = "\n\n".join(b.rstrip() for b in blocks)
    result = (head + "\n\n" if head else "") + body + "\n"

    with open(INPUT_FILE, "w", encoding="utf-8") as f:
        f.write(result)

    print(f"处理完成，已写回 {INPUT_FILE}")


if __name__ == "__main__":
    main()
