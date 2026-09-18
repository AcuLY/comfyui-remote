import type { ReactNode } from "react";
import { PrimeReactProvider, addLocale, locale } from "primereact/api";
import type { APIOptions } from "primereact/api";

addLocale("zh-CN", {
  aria: {
    close: "关闭",
    selectAll: "选择全部",
    unselectAll: "取消全选",
    selectRow: "选择记录",
    unselectRow: "取消选择记录",
    firstPageLabel: "第一页",
    lastPageLabel: "最后一页",
    nextPageLabel: "下一页",
    prevPageLabel: "上一页",
    pageLabel: "第 {page} 页",
    rowsPerPageLabel: "每页条数",
    moveUp: "上移",
    moveTop: "移至顶部",
    moveDown: "下移",
    moveBottom: "移至底部",
  },
});

// 组件语言需在 Provider 生效前设定，DataTable 等组件会直接读取全局 locale。
locale("zh-CN");

/**
 * 仅使用库文档化的全局配置；组件级例外放在公开的 `pt` 槽位。
 */
const prototypeConfig: APIOptions = {
  ripple: false,
  locale: "zh-CN",
  inputStyle: "outlined",
  hideOverlaysOnDocumentScrolling: true,
  pt: {
    toast: { root: { style: { width: "360px", maxWidth: "calc(100vw - 32px)" } } },
    // v10 的 Tag 与实心按钮共用颜色参数，这里用公开根槽位保留柔和语义色。
    tag: {
      root: ({ props }: { props: { severity?: string; style?: Record<string, string> } }) => {
        const severity = ["success", "info", "warning", "danger"].includes(props.severity ?? "")
          ? props.severity
          : null;
        return {
          style: {
            background: severity ? `var(--${severity}-soft)` : "var(--surface-secondary)",
            color: severity ? `var(--${severity})` : "var(--text-secondary)",
            ...props.style,
          },
        };
      },
    },
  },
};

export function PrototypeProvider({ children }: { children: ReactNode }) {
  return <PrimeReactProvider value={prototypeConfig}>{children}</PrimeReactProvider>;
}
