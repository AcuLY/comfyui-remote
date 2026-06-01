#!/usr/bin/env python3
"""
将 position_presets.md 每个三级标题下的列表项统一为六个标准字段：
  - 负面：
  - lora：
  - 视角：
  - 服饰范围：
  - 画幅：
  - 暴露：

已有值的保留，没有的补空行。
"""

import re
import sys

INPUT_FILE = "/Users/luca/dev/comfyui-remote/position_presets.md"

# 已知视角值（含"单人"）
KNOWN_VIEWPOINT = {
    "单人", "第一人称", "第一人称仅四肢", "第三人称", "第三人称男性身体",
}

# 已知服饰范围值
KNOWN_RANGE = {
    "全身", "大腿以上", "腰部以上", "上半身",
}

# 已知画幅值（竖屏/横屏 归一化为 竖屏/横屏）
KNOWN_ASPECT = {
    "竖屏", "横屏", "竖图", "横图",
}

# 已知暴露值（含 + 组合）
KNOWN_EXPOSURE = {
    "胸部", "内裤", "无内裤", "无",
    "胸部+内裤", "胸部+无内裤+脱鞋", "服饰",
    "内裤+胸部",
}


def classify_item(text: str):
    """
    将列表项文本分类，返回 (category_key, display_value) 或 None。
    支持两种格式：
      - 原始格式：`- 第三人称`、`- 竖屏`、`- lora：xxx`
      - 已处理格式：`- 视角：第三人称`、`- 画幅：竖屏`
    """
    t = text.strip().lstrip("-").strip()

    # 0. 已处理格式：- 标签名：值
    m = re.match(r'^(负面|lora|视角|服饰范围|画幅|暴露)[：:]\s*(.*)$', t)
    if m:
        label, val = m.group(1), m.group(2).strip()
        label_to_key = {
            "负面": "negative", "lora": "lora", "视角": "viewpoint",
            "服饰范围": "range", "画幅": "aspect", "暴露": "exposure",
        }
        return (label_to_key[label], val)

    # 1. 负面：xxx（无前缀，直接负面内容）
    m = re.match(r'^负面[：:]\s*(.*)$', t)
    if m:
        return ("negative", m.group(1).strip())

    # 2. lora：xxx（含大小写变体）
    m = re.match(r'^L?ora[：:]\s*(.*)$', t, re.IGNORECASE)
    if m:
        return ("lora", m.group(1).strip())

    # 裸 lora 名（纯小写英文+下划线/连字符，不在已知中文值里）
    if re.fullmatch(r'[a-z0-9_\-]+', t) and t not in KNOWN_VIEWPOINT and t not in KNOWN_RANGE and t not in KNOWN_ASPECT and t not in KNOWN_EXPOSURE:
        return ("lora", t)

    # 3. 视角
    if t in KNOWN_VIEWPOINT:
        return ("viewpoint", t)

    # 4. 服饰范围
    if t in KNOWN_RANGE:
        return ("range", t)

    # 5. 画幅（竖图→竖屏，横图→横屏）
    if t in KNOWN_ASPECT:
        normalized = t.replace("竖图", "竖屏").replace("横图", "横屏")
        return ("aspect", normalized)

    # 6. 暴露
    if t in KNOWN_EXPOSURE:
        return ("exposure", t)

    return None


def process_section(section_lines: list) -> str:
    """
    处理单个 ### 小节，输入是该小节的所有行（含标题行），
    返回处理后的小节字符串。
    """
    # 找到标题行
    title_idx = 0
    for i, ln in enumerate(section_lines):
        if ln.startswith("###"):
            title_idx = i
            break

    title_line = section_lines[title_idx]

    # 正文：标题行之后、第一个 "- " 列表项之前的非空行
    body_end = len(section_lines)
    first_list_idx = -1
    for i in range(title_idx + 1, len(section_lines)):
        stripped = section_lines[i].strip()
        if stripped.startswith("- "):
            first_list_idx = i
            break

    if first_list_idx == -1:
        # 没有列表项，正文一直到小节末尾
        body_lines = section_lines[title_idx + 1:]
        raw_items = []
    else:
        body_lines = section_lines[title_idx + 1:first_list_idx]
        # 收集列表项（直到下一个 ### 或文件末尾）
        raw_items = []
        for i in range(first_list_idx, len(section_lines)):
            stripped = section_lines[i].strip()
            if stripped.startswith("- "):
                raw_items.append(stripped)
            elif stripped == "":
                continue
            elif stripped.startswith("###"):
                break

    # 分类
    categorized = {
        "negative": "",
        "lora": "",
        "viewpoint": "",
        "range": "",
        "aspect": "",
        "exposure": "",
    }

    for raw in raw_items:
        result = classify_item(raw)
        if result:
            key, val = result
            # 每类只取第一个值
            if not categorized[key]:
                categorized[key] = val

    # 组装
    body_block = "\n".join(body_lines).rstrip()

    label_map = {
        "negative": "负面",
        "lora": "lora",
        "viewpoint": "视角",
        "range": "服饰范围",
        "aspect": "画幅",
        "exposure": "暴露",
    }

    list_lines = []
    for key in ["negative", "lora", "viewpoint", "range", "aspect", "exposure"]:
        val = categorized[key]
        if val:
            list_lines.append(f"- {label_map[key]}：{val}")
        else:
            list_lines.append(f"- {label_map[key]}：")

    # 拼接：标题 + 空行 + 正文(若有) + 空行 + 列表 + 尾部空行
    out = title_line + "\n\n"
    if body_block:
        out += body_block + "\n\n"
    out += "\n".join(list_lines) + "\n\n"
    return out


def main():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        content = f.read()

    # 按 ### 标题切分（保留标题行）
    pattern = re.compile(r'(?=^### +)', re.MULTILINE)
    parts = pattern.split(content)
    # parts[0] = 文件头（第一个 ### 之前）
    # parts[1:] = 每个 ### 小节

    if len(parts) <= 1:
        print("未找到 ### 三级标题")
        sys.exit(1)

    header = parts[0]
    sections_raw = parts[1:]

    # 每个小节按行处理
    processed_sections = []
    for sec in sections_raw:
        lines = sec.split("\n")
        processed = process_section(lines)
        processed_sections.append(processed)

    result = header + "\n".join(processed_sections)

    with open(INPUT_FILE, "w", encoding="utf-8") as f:
        f.write(result)

    print(f"处理完成，已写回 {INPUT_FILE}")


if __name__ == "__main__":
    main()
