import { Check, Square } from "lucide-react";

import { cx } from "../design-demo-utils";
import s from "./project-select-checkbox.module.css";

export function ProjectSelectCheckbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  const Icon = checked ? Check : Square;

  return (
    <label
      className={cx(s.projectSelectCheckbox, checked && s.projectSelectCheckboxChecked)}
      title={label}
    >
      <input
        aria-label={label}
        checked={checked}
        className={s.projectSelectCheckboxInput}
        onChange={onChange}
        type="checkbox"
      />
      <span aria-hidden="true" className={s.projectSelectCheckboxGlyph}>
        <Icon className={s.projectSelectCheckboxIcon} />
      </span>
    </label>
  );
}
