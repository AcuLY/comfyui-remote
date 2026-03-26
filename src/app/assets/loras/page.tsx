import { SectionCard } from "@/components/section-card";
import { LoraFileManager } from "./lora-file-manager";

export default function LorasPage() {
  return (
    <div className="space-y-4">
      <SectionCard
        title="LoRA 文件管理"
        subtitle="浏览、上传和管理本地 LoRA 文件。支持按文件夹组织。"
      >
        <LoraFileManager />
      </SectionCard>
    </div>
  );
}
