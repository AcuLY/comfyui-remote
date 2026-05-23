import { PageHeader } from "@/components/page-header";
import { getCharacterLoraGpuTaskLock, listCharacterLoraTrainingJobs, listCharacterLoraTrainingTemplates } from "@/lib/actions/character-lora-training";
import { CharacterLoraTrainingClient } from "./character-lora-training-client";

export const dynamic = "force-dynamic";

export default async function CharacterLoraTrainingPage() {
  const [jobList, gpuLock, trainingTemplates] = await Promise.all([
    listCharacterLoraTrainingJobs({ pageSize: 100 }),
    getCharacterLoraGpuTaskLock(),
    listCharacterLoraTrainingTemplates(),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-5 overflow-x-hidden [&_input]:min-w-0 [&_select]:min-w-0 [&_textarea]:min-w-0">
      <PageHeader
        title="LoRA 训练"
        description="角色 LoRA 数据集、训练、基准测试和发布工作台。"
      />
      <CharacterLoraTrainingClient jobList={jobList} gpuLock={gpuLock} trainingTemplates={trainingTemplates} />
    </div>
  );
}
