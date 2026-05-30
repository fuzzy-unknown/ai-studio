# TODO.md

> 项目代码审查修复清单。当前已完成原 v3/v4/v5 中列出的功能与架构问题；保留下方“后续观察项”作为低优先级维护提醒。

## 已完成

| 问题 | 状态 | 实施内容 |
|------|------|----------|
| P0: `fileToBase64` 重复 5 次 | ✅ 已修复 | 提取到 `packages/client/src/utils/fileToBase64.ts` |
| P1: 错误码和共享任务工具重复 | ✅ 已修复 | 合并到 `packages/server/src/modules/task/errors.ts` 与 `shared.ts` |
| P2: 任务列表、统计和 SSE 端点分散 | ✅ 已修复 | 新增统一 `/api/tasks`、`/api/tasks/:id/events`、`/api/usage/stats` |
| P3: Server Model Registry | ✅ 已修复 | 新增 `packages/server/src/modules/task/model-registry.ts`，路由和服务层共用校验 |
| P4: Client Model Registry | ✅ 已修复 | 新增 `packages/client/src/modelRegistry.ts`，消除客户端业务层 `qwen-image` 前缀分支 |
| P5: DB `type` 列 | ✅ 已修复 | schema + 自动迁移 + 客户端筛选改用任务类型 |
| P6: `videoUrl`/`localPath` 格式混乱 | ✅ 已修复 | 统一 JSON 数组存储，旧数据由启动迁移转换 |
| #32: SSE 断开不重连 | ✅ 已修复 | `useTaskWatcher` 增加指数退避重连、兜底 fetch 和 timer 清理 |
| #33: 乐观卡片日期格式不一致 | ✅ 已修复 | 使用服务端一致的 `YYYY-MM-DD HH:mm:ss` 形式 |
| #34: 纯图片统计显示 `0s` | ✅ 已修复 | 仅当总时长大于 0 时显示时长 |
| #35: 无法删除失败任务 | ✅ 已修复 | `DELETE /api/tasks/:taskId` 删除 DB 记录和本地文件 |
| #36: 无法取消进行中任务 | ✅ 已修复 | `POST /api/tasks/:taskId/cancel` 设置 `CANCELED` |
| #37: 无法重试失败任务 | ✅ 已修复 | `GenerateForm` 支持 `retryData`，表单回填失败任务参数 |
| #38: 图片无法下载/放大 | ✅ 已修复 | `TaskCard` 增加 lightbox 和下载按钮 |
| #39: 无分页/加载更多 | ✅ 已修复 | `/api/tasks` 支持 `limit`/`offset`/`type`，前端增加“加载更多” |
| #40: 图片表单发送冗余 `resolution` | ✅ 已修复 | 图像编辑表单按模型能力条件提交字段 |
| #41: `fetchTasks` 注释和端点语义误导 | ✅ 已修复 | 改用统一 `/api/tasks` |
| #42: `GenerateFormData` 类型重复 | ✅ 已修复 | `App.tsx` 直接复用共享类型 |
| #43: Wan2.7 输入媒体混存 URL | ✅ 已修复 | 新任务的 `inputImageUrl` 存 `{ type, url }[]`，旧数据由启动迁移转换 |
| #44: `getUsageStats()` 重复全表扫描 | ✅ 已修复 | 合并到 `task/shared.ts`，用 SQL 聚合成本/数量 |
| #45: 乐观卡片类型强转字段缺失 | ✅ 已修复 | `Task` 类型补充服务端和乐观 UI 字段 |
| #46: `qwen-image-edit` 不应设置 `prompt_extend` | ✅ 已修复 | 同步调用时跳过不支持的参数 |
| #47: 图片扩展名硬编码 `.png` | ✅ 已修复 | `downloadImage()` 从 URL/Content-Type 推断 `.png/.jpg/.webp` |
| #48: Wan27 表单提交后清空状态 | ✅ 已确认 | 属于合理 UX，保留现状 |

## 后续观察项

| 项目 | 状态 | 说明 |
|------|------|------|
| 表单组件进一步抽象 | 暂不处理 | 已提取安全重复逻辑；7 个表单差异较大，强行统一会降低可读性 |
| 旧任务数据迁移 | ✅ 已处理 | 启动时迁移旧裸字符串/旧数组格式；运行时代码按新结构读取 |
| 官方文档参数边界 | ✅ 已处理 | 按 `docs/` 对齐 HappyHorse、万相2.7、Qwen-Image 的模型级参数限制 |

## 验证

- `bun run --cwd packages/server test` ✅ 53 pass
- `bun run lint` ✅
- `bunx tsc -p packages/server/tsconfig.json --noEmit` ✅
- `bun run build` ✅
