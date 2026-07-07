"use client";

import { useState } from "react";

type ProjectCreateForm = {
  baseModel: string;
  captionStrategy: string;
  detailPrompt: string;
  perSectionImageCount: string;
  templateContextId: string;
  templateTitle: string;
  title: string;
  trainingSteps: string;
  usagePrompt: string;
};

export function useProjectCreateForm(projectTemplateContextId: string, templateTitle: string, baseModelOptions: string[]) {
  const defaultProjectForm: ProjectCreateForm = {
    baseModel: baseModelOptions[0] ?? "继承训练默认模型",
    captionStrategy: "先触发词后描述",
    detailPrompt: "发型、眼睛、服装材质、常见构图和需要避免的变化。",
    perSectionImageCount: "4",
    templateContextId: projectTemplateContextId,
    templateTitle,
    title: "新角色 LoRA 项目",
    trainingSteps: "2400",
    usagePrompt: "角色触发词、服装和稳定身份描述。",
  };
  const [projectFormState, setProjectFormState] = useState(defaultProjectForm);
  const projectForm = projectFormState.templateContextId === projectTemplateContextId ? projectFormState : defaultProjectForm;

  function setProjectForm(updater: (current: ProjectCreateForm) => ProjectCreateForm) {
    setProjectFormState((current) => updater(current.templateContextId === projectTemplateContextId ? current : projectForm));
  }

  function handleUpdateProjectForm(field: keyof ProjectCreateForm, value: string) {
    setProjectForm((current) => ({ ...current, [field]: value }));
  }

  return {
    handleUpdateProjectForm,
    projectForm,
  };
}
