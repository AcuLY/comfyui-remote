import { Button } from "../../shared/primitives/button";
import s from "./custom-icon-demo.showcase.module.css";
import local from "./showcase-icons.module.css";

import { ComfyuiIcon, CUSTOM_ICONS, FlameIcon, HeartFilledIcon, HexagonIcon } from "./custom-icons";
import { IconList } from "./icon-list";

export function CustomIconDemo() {
  return (
    <div className={s.iconShowcaseCustom}>
      <h2 className={s.iconShowcaseHeading}>自定义 SVG 图标</h2>
      <p className={s.iconShowcaseDescription}>
        使用 <code>createSvgIcon</code> / <code>createSvgIconFromString</code> 创建的图标组件，遵循 Lucide 图标 API，可直接用于 Button 等组件的 <code>icon</code> 属性。
      </p>

      <IconList
        metaHeader="创建方式"
        entries={CUSTOM_ICONS.map(({ icon, name, desc, source }) => ({
          icon,
          name,
          desc,
          meta: [source],
        }))}
      />

      <div className={s.iconShowcaseControlRow}>
        <span className={s.iconShowcaseControlLabel}>在 Button 中使用：</span>
        <Button icon={ComfyuiIcon} tone="primary">ComfyUI</Button>
        <Button icon={HeartFilledIcon} tone="pink">收藏</Button>
        <Button icon={FlameIcon}>热门</Button>
        <Button icon={HexagonIcon} tone="subtle">六边形</Button>
        <span className={s.iconShowcaseControlLabel}>尺寸：</span>
        <ComfyuiIcon size={16} />
        <ComfyuiIcon size={20} />
        <ComfyuiIcon size={24} />
        <ComfyuiIcon size={32} />
        <HeartFilledIcon className={local.accentIcon} size={16} />
        <HeartFilledIcon className={local.accentIcon} size={20} />
        <HeartFilledIcon className={local.accentIcon} size={24} />
      </div>
    </div>
  );
}
