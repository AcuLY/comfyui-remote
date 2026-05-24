import { PageHeader } from "@/components/page-header";
import { listCharacterLoraTrainingJobs } from "@/lib/actions/character-lora-training";
import { CharacterLoraTrainingClient } from "./character-lora-training-client";

export const dynamic = "force-dynamic";

export default async function CharacterLoraTrainingPage() {
  const [jobList, archivedJobList] = await Promise.all([
    listCharacterLoraTrainingJobs({ pageSize: 100 }),
    listCharacterLoraTrainingJobs({ status: "archived", pageSize: 100 }),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-5 overflow-x-hidden [&_input]:min-w-0 [&_select]:min-w-0 [&_textarea]:min-w-0">
      <PageHeader
        title="角色 LoRA 训练"
        description="训练项目列表。新建项目、提示词、训练集和训练执行拆分到独立页面。"
      />
      <CharacterLoraTrainingClient jobList={jobList} archivedJobList={archivedJobList} />
    </div>
  );
}
