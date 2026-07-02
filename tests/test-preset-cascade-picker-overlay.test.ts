import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pickerSource = readFileSync("src/components/preset-cascade-picker.tsx", "utf8");
const replacementDialogSource = readFileSync("src/components/preset-section-replacement-dialog.tsx", "utf8");

test("preset cascade picker portals its modal outside clipped ancestors", () => {
  assert.match(pickerSource, /import \{ createPortal \} from "react-dom"/);
  assert.match(pickerSource, /const \[portalTarget, setPortalTarget\]/);
  assert.match(pickerSource, /setPortalTarget\(document\.body\)/);
  assert.match(pickerSource, /createPortal\(/);
  assert.match(pickerSource, /portalTarget/);
  assert.match(pickerSource, /z-\[300\]/);
});

test("replacement dialog picker selects default variant and closes on preset click", () => {
  assert.match(pickerSource, /selectDefaultVariantOnPresetClick/);
  assert.match(
    pickerSource,
    /if \(selectDefaultVariantOnPresetClick\)[\s\S]*onChange\(\{ presetId: preset\.id[\s\S]*variantId: v\.id[\s\S]*setOpen\(false\)/,
  );
  assert.match(
    replacementDialogSource,
    /<PresetCascadePicker[\s\S]*fromPresetId[\s\S]*selectDefaultVariantOnPresetClick/,
  );
  assert.match(
    replacementDialogSource,
    /<PresetCascadePicker[\s\S]*toPresetId[\s\S]*selectDefaultVariantOnPresetClick/,
  );
});
