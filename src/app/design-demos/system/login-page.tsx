import { Lock, X } from "lucide-react";

import s from "./login-page.shell.module.css";
import { Button } from "../ui/button";
import { Field } from "../ui/field";
import { OperationStateStrip } from "../ui/operation-state-strip";
import { PageHeader } from "../ui/page-header";
import { Panel } from "../ui/panel";

export function LoginPage() {
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="登录"
        title="登录"
        subtitle="使用本地访问令牌进入工作台。"
      />
      <Panel title="访问令牌">
        <div className={s.contentGrid}>
          <Field label="Token" value="本地访问令牌" />
          <div className={s.toolbar}>
            <Button tone="primary" icon={Lock} feedback={{ title: "登录验证已通过" }}>登录</Button>
            <Button icon={X} feedback={{ title: "输入已清除" }}>清除</Button>
          </div>
          <OperationStateStrip
            items={[
              { label: "验证", value: "待输入", tone: "info" },
              { label: "返回", value: "任务工作台", tone: "success" },
              { label: "错误", value: "0", tone: "success" },
            ]}
          />
        </div>
      </Panel>
    </div>
  );
}
