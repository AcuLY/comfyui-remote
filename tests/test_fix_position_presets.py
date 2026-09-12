import importlib.util
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = REPO_ROOT / "scripts" / "fix-position-presets.py"


def load_formatter_module():
    spec = importlib.util.spec_from_file_location("fix_position_presets", SCRIPT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load {SCRIPT_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class PositionPresetFormatterRegressionTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.formatter = load_formatter_module()

    def test_preserves_h2_preamble_and_prose_after_normalized_list(self):
        source = """# 目录

目录说明。

## 分组

首个姿势前的分组说明必须保留。

### 姿势

正向提示词

- lora: pose_adapter

字段列表后的编辑说明必须保留。
"""

        result = self.formatter.format_document(source)

        self.assertIn("首个姿势前的分组说明必须保留。", result)
        self.assertIn("字段列表后的编辑说明必须保留。", result)
        self.assertLess(result.index("## 分组"), result.index("首个姿势前的分组说明"))
        self.assertLess(result.index("首个姿势前的分组说明"), result.index("### 姿势"))
        self.assertLess(result.index("pose_adapter"), result.index("字段列表后的编辑说明"))
        self.assertIn("- lora：`pose_adapter`", result)
        self.assertEqual(self.formatter.format_document(result), result)

    def test_explicit_catalog_path_keeps_repairs_off_the_repository_default(self):
        source = """# 目录

## 分组

分组说明。

### 姿势

提示词

- lora: adapter

末尾说明。
"""
        with tempfile.TemporaryDirectory() as directory:
            catalog = Path(directory) / "catalog.md"
            catalog.write_text(source, encoding="utf-8")

            self.formatter.main([str(catalog)])

            result = catalog.read_text(encoding="utf-8")
            self.assertIn("分组说明。", result)
            self.assertIn("末尾说明。", result)
            self.assertIn("adapter", result)


if __name__ == "__main__":
    unittest.main()
