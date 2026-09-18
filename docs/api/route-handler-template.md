---
schemaVersion: 1
document:
  type: api
  status: current
  owner: api-contracts
  authority:
    subject: json-route-handler-pattern
    kind: reference
  readWhen:
    - 新增或迁移普通 JSON 路由处理器时
    - 检查路由的请求解析与错误响应封装时
  sources:
    - src/lib/api-response.ts
    - src/server/http/request-json.ts
  verifiedBy:
    - node --import tsx --test tests/test-api-request-json.test.ts tests/test-documentation-governance.test.ts
---

# API 路由处理器模板

新增或迁移普通 JSON 处理器时使用本模式。流式路由或兼容端点只有在其调用方已经验证后才能改写，不能仅为套用模板而迁移。

## 实现模式

1. 用 `readJsonObject` 解析必需的 JSON 对象；如果请求契约更窄，则使用与之匹配的共享解析器。
2. 调用应用行为前，先校验路由层字段。
3. 只调用一个聚焦服务、由仓储支持的动作或服务端工作流函数。
4. 成功时返回 `ok(data, init?)`；只有明确的本地校验分支才直接调用 `fail(...)`。
5. 在 `catch` 中调用 `failFromError(...)`，让受控解析错误与服务错误保留状态码和 `details`。

```ts
import { fail, failFromError, ok } from "@/lib/api-response";
import { readJsonObject } from "@/server/http/request-json";

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    const name = body.name;

    if (typeof name !== "string" || !name.trim()) {
      return fail("name 为必填项", 400);
    }

    const result = await runServiceAction({ name });
    return ok(result, { status: 201 });
  } catch (error) {
    return failFromError(error);
  }
}
```

聚焦的源码契约测试会直接从源码发现当前采用者；不要把易变的采用者文件清单复制到本文档。

## 受控兼容例外

- `src/app/api/logs/route.ts` 仅在解析 JSONL 日志行时于路由内调用 `JSON.parse`，不会用它解析 HTTP 请求体。
- `src/app/api/queue-data/route.ts` 保留由调用方约束的原始 JSON 响应结构，是受控的路由内 `NextResponse.json(...)` 例外。流式处理器可以为非 JSON 载荷返回 `new NextResponse(stream, ...)`，同时仍用共享辅助函数生成 JSON 错误响应。

这些例外只是窄范围源码契约，不授权新处理器绕过共享解析器或响应封装辅助函数。

## 上级入口

- [API 文档](README.md)
