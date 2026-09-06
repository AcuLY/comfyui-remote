#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UI/UX Pro Max 搜索：用于检索 UI/UX 风格指南的 BM25 搜索引擎。
用法：python search.py "<查询>" [--domain <领域>] [--stack <技术栈>] [--max-results 3]
      python search.py "<查询>" --design-system [-p "项目名称"]
      python search.py "<查询>" --design-system --persist [-p "项目名称"] [--page "dashboard"]

领域：style、color、chart、landing、product、ux、typography、icons、react、web
技术栈：以 AVAILABLE_STACKS 为准。

持久化（主文件与页面覆盖模式）：
  --persist    保存到 design-system/<project-slug>/MASTER.md
  --page       同时创建 design-system/<project-slug>/pages/<page-slug>.md
"""

import argparse
import sys
import io
from core import CSV_CONFIG, AVAILABLE_STACKS, MAX_RESULTS, search, search_stack
from design_system import generate_design_system, persist_design_system

# Force UTF-8 for stdout/stderr to handle emojis on Windows (cp1252 default)
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
if sys.stderr.encoding and sys.stderr.encoding.lower() != 'utf-8':
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')


class ChineseHelpFormatter(argparse.HelpFormatter):
    """将 argparse 的固定用法前缀显示为中文。"""

    def _format_usage(self, *args, **kwargs):
        return super()._format_usage(*args, **kwargs).replace("usage: ", "用法：", 1)


def format_output(result):
    """Format results for Claude consumption (token-optimized)"""
    if "error" in result:
        return f"Error: {result['error']}"

    output = []
    if result.get("stack"):
        output.append(f"## UI Pro Max Stack Guidelines")
        output.append(f"**Stack:** {result['stack']} | **Query:** {result['query']}")
    else:
        output.append(f"## UI Pro Max Search Results")
        output.append(f"**Domain:** {result['domain']} | **Query:** {result['query']}")
    output.append(f"**Source:** {result['file']} | **Found:** {result['count']} results\n")

    for i, row in enumerate(result['results'], 1):
        output.append(f"### Result {i}")
        for key, value in row.items():
            value_str = str(value)
            if len(value_str) > 300:
                value_str = value_str[:300] + "..."
            output.append(f"- **{key}:** {value_str}")
        output.append("")

    return "\n".join(output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="搜索 UI/UX 指南或生成设计系统建议",
        add_help=False,
        formatter_class=ChineseHelpFormatter,
    )
    parser._positionals.title = "位置参数"
    parser._optionals.title = "选项"
    parser.add_argument("-h", "--help", action="help", help="显示此帮助信息并退出")
    parser.add_argument("query", help="搜索查询")
    parser.add_argument("--domain", "-d", choices=list(CSV_CONFIG.keys()), help="搜索领域")
    parser.add_argument("--stack", "-s", choices=AVAILABLE_STACKS, help="按技术栈搜索")
    parser.add_argument("--max-results", "-n", type=int, default=MAX_RESULTS, help="最大结果数（默认：3）")
    parser.add_argument("--json", action="store_true", help="以 JSON 格式输出")
    # Design system generation
    parser.add_argument("--design-system", "-ds", action="store_true", help="生成完整的设计系统建议")
    parser.add_argument("--project-name", "-p", type=str, default=None, help="设计系统输出所用的项目名称")
    parser.add_argument("--format", "-f", choices=["ascii", "markdown"], default="ascii", help="设计系统的输出格式")
    # Persistence (Master + Overrides pattern)
    parser.add_argument("--persist", action="store_true", help="保存到 design-system/<project-slug>/MASTER.md")
    parser.add_argument("--page", type=str, default=None, help="创建 design-system/<project-slug>/pages/<page-slug>.md 页面覆盖文件")
    parser.add_argument("--output-dir", "-o", type=str, default=None, help="持久化文件的输出目录（默认：当前目录）")

    args = parser.parse_args()

    # Design system takes priority
    if args.design_system:
        result = generate_design_system(
            args.query, 
            args.project_name, 
            args.format,
            persist=args.persist,
            page=args.page,
            output_dir=args.output_dir
        )
        print(result)
        
        # Print persistence confirmation
        if args.persist:
            project_slug = args.project_name.lower().replace(' ', '-') if args.project_name else "default"
            print("\n" + "=" * 60)
            print(f"✅ Design system persisted to design-system/{project_slug}/")
            print(f"   📄 design-system/{project_slug}/MASTER.md (Global Source of Truth)")
            if args.page:
                page_filename = args.page.lower().replace(' ', '-')
                print(f"   📄 design-system/{project_slug}/pages/{page_filename}.md (Page Overrides)")
            print("")
            print(f"📖 Usage: When building a page, check design-system/{project_slug}/pages/[page].md first.")
            print(f"   If exists, its rules override MASTER.md. Otherwise, use MASTER.md.")
            print("=" * 60)
    # Stack search
    elif args.stack:
        result = search_stack(args.query, args.stack, args.max_results)
        if args.json:
            import json
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print(format_output(result))
    # Domain search
    else:
        result = search(args.query, args.domain, args.max_results)
        if args.json:
            import json
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print(format_output(result))
