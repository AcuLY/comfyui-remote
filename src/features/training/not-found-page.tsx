import { Home } from "lucide-react";

import { ButtonLink } from "@/components/design-demo-ui/primitives/button";
import { PageHeader } from "@/components/design-demo-ui/primitives/page-header";
import { WORK_MODE_RESOURCE_TARGETS, buildWorkModeResourceTargetList } from "@/lib/work-mode-resources";
import s from "./not-found-page.module.css";

const TRAINING_MODULE_RESOURCES = buildWorkModeResourceTargetList("lora_training").filter(
  (entry) => entry.owner === "lora_training",
);

export function TrainingNotFoundPage({ route }: { route: string }) {
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="404"
        title="未匹配训练页面"
        subtitle={route}
        actions={<ButtonLink href={WORK_MODE_RESOURCE_TARGETS.lora_training.runs.href} icon={Home}>返回运行</ButtonLink>}
      />
      <section className={s.panel} aria-label="训练模块入口">
        {TRAINING_MODULE_RESOURCES.map((entry) => (
          <ButtonLink href={entry.href} key={entry.href} tone="subtle">
            {entry.label}
          </ButtonLink>
        ))}
      </section>
    </div>
  );
}
