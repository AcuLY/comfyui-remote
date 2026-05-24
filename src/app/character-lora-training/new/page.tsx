import { PageHeader } from "@/components/page-header";
import { NewCharacterLoraTrainingClient } from "./new-character-lora-training-client";

export const dynamic = "force-dynamic";

export default function NewCharacterLoraTrainingPage() {
  return (
    <div className="mx-auto w-full max-w-4xl min-w-0 space-y-5 overflow-x-hidden [&_input]:min-w-0 [&_select]:min-w-0">
      <PageHeader
        title="新建 LoRA 训练项目"
        description="只填写外部 Agent 接手前必须的人类输入：项目名、触发词、参考图和训练基底 checkpoint。"
      />
      <NewCharacterLoraTrainingClient />
    </div>
  );
}
