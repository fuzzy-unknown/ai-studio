# TODO.md

> 项目全栈代码审查，按优先级分类。

---

## 🔴 P0 — 必须修复（Bug / 数据正确性）

### 1. `getPricePerSecond` 查询逻辑错误，视频任务 cost 可能为 0

`pricing/service.ts` 的 `getPricePerSecond(model, sr)` 将 `sr`（数字）转成字符串后与 `resolution` 列比较，但 resolution 列存的是 `'720P'`/`'1080P'`，不是数字。查询永远匹配不到，返回 0。

**解决**: 查询前将 `sr` 转为 `720P`/`1080P` 格式，或改用 `model + resolution` 组合查询。

### 2. `calculateImageCost` 忽略 `size`，多尺寸模型计费不可预测

`pricing/service.ts` 只按 `model` 查询，取第一条匹配行。如果同一模型有多种尺寸的定价行，结果取决于 SQLite 返回顺序。

**解决**: 查询时同时匹配 `model` 和 `resolution`（即图片的 size）。

### 3. `pollUntilDone` 无重试上限，可能无限循环

`video/service.ts` 和 `image/service.ts` 的 `pollUntilDone` 都是 `while (true)` 无限循环。如果 DashScope 持续返回 `RUNNING`，服务端永远轮询。

**解决**: 增加最大轮询次数（如 360 次 × 5s = 30 分钟）或总超时时间。

### 4. `QwenImageForm` 用 `useMemo` 执行副作用（重置 size/n）

`QwenImageForm.tsx` 在 `useMemo` 里调用 `setSize()`/`setN()`。React 文档明确 `useMemo` 不应有副作用。应改为 `useEffect`。

**解决**: 将 `useMemo(() => { setSize(...); setN(...) }, [model])` 改为 `useEffect`。

### 5. `Wan27I2vForm` 切换子任务模式时不重置媒体状态

用户在「首帧生视频」填了首帧图片和音频，切换到「视频续写」后提交，旧的 `imageUrl`/`drivingAudioUrl` 仍会随请求发送。

**解决**: 模式切换时 `setMode` 的回调中重置不相关的媒体字段。

### 6. 乐观更新卡片消失→重现的闪烁

`App.tsx` 先 `filter` 移除临时卡片，再 `await fetchTasks()` 拉取真实数据。两者之间有可见的空白间隙。

**解决**: 不移除临时卡片，而是用 `fetchTasks` 返回的数据直接替换整个列表；或在移除的同时用 API 响应中的真实任务数据插入。

---

## 🟠 P1 — 架构优化（DRY / 可维护性）

### 7. video 和 image service 大量重复代码

以下代码在两个 service 文件中几乎一字不差地重复：

| 重复项 | 文件 |
|--------|------|
| `ERROR_CODE_MAP` | video/service.ts, image/service.ts |
| `translateError()` | 同上 |
| `getApiKey()` | 同上 |
| `TERMINAL_STATES` | 同上 |
| `pollUntilDone()` | 同上（仅响应字段名不同） |
| `getAllTasks()` / `getTaskByTaskId()` / `isTerminal()` | 同上 |
| `getUsageStats()` | 同上 |

**解决**: 提取 `src/utils/dashscope.ts` 共享模块，包含错误码映射、API Key 获取、终端状态判断、通用轮询逻辑。两个 service 继承或调用共享方法。

### 8. SSE 端点实现完全重复

`video/index.ts` 和 `image/index.ts` 的 `/tasks/:taskId/events` 路由实现几乎相同（ReadableStream + 轮询 + 状态变更检测）。

**解决**: 提取 `createSSEStream(service, taskId)` 工厂函数。

### 9. `downloadVideo` / `downloadImage` 结构相同

`utils/storage.ts` 中两个函数仅目录和扩展名不同。

**解决**: 合并为 `downloadMedia(url, taskId, { dir, ext })`。

### 10. 客户端 `fileToBase64` 复制粘贴到 5 个表单文件

**解决**: 提取到 `shared/fileToBase64.ts`。

### 11. `TaskResponse` 和 `ImageTaskResponse` 95% 相同

`video/model.ts` 和 `image/model.ts` 的响应类型几乎完全一样。

**解决**: 提取共享的 `TaskResponse` 类型。

### 12. CSS 中 4 组几乎相同的 Tab 样式

`.filter-tab`、`.category-tab`、`.subtype-tab`、`.subtask-tab` 模式相同。

**解决**: 提取 `.tab-group` / `.tab-item` 基础类，通过修饰类区分变体。

### 13. 模型 ID 作为裸字符串散落在 7+ 个文件中

无单一来源，添加新模型需改 5+ 文件，无编译时保障。

**解决**: 服务端新增 `src/constants/models.ts`，集中定义所有模型 ID 及其属性。

---

## 🟡 P2 — 命名 / 语义问题

### 14. `videoUrl` DB 列存储图片 URL

`tasks` 表的 `videoUrl` 列在图片任务中存图片 URL，`localPath` 同理。对维护者造成困惑。

**解决**: 长期方案是重命名为 `resultUrl` / `resultLocalPath`；短期可在 schema 注释中说明。

### 15. `inputImageUrl` 存储格式不统一

- i2v：单个 URL 字符串
- wan2.7：JSON 数组混合图片/音频/视频 URL
- r2v/edit：JSON 数组（图片 URL）
- 图生图：单个或 JSON 数组

**解决**: 统一为 JSON 数组格式，增加 `inputMedia` 列替代，每项带 `{ type, url }` 结构。

### 16. 函数命名不当

| 当前 | 问题 | 建议 |
|------|------|------|
| `getVideoSrc()` | 也返回图片 URL | `getResultSrc()` |
| `r2v-thumb` CSS 类 | 被非 r2v 模型使用 | `media-thumb` |
| `abstract class` | 只有 static 方法 | 改为普通导出函数或 plain class |

### 17. CLAUDE.md 缺少新增模型文档

未记录 `wan2.7-i2v`、`qwen-image-edit-*`、`Wan27I2vForm`、`QwenImageEditForm`。

**解决**: 更新 CLAUDE.md 的 Supported Models 和 Form Components 部分。

---

## 🔵 P3 — 健壮性 / 边界情况

### 18. SSE 流无法检测客户端断开

`ReadableStream.start()` 中无 `cancel` 回调或 `AbortSignal`。客户端关闭后服务端继续轮询最多 10 分钟。

**解决**: 使用 `ReadableStream` 的 `cancel` 回调停止轮询。

### 19. 服务端重启后轮询丢失，任务卡在 PENDING/RUNNING

`pollUntilDone` 是 fire-and-forget，服务重启后无恢复机制。

**解决**: 启动时扫描非终态任务并恢复轮询。

### 20. DashScope API 调用无超时

`fetch()` 调用无 `AbortSignal`，如果 API 挂起则请求无限等待。

**解决**: 添加 `AbortController` + 超时（如 120s）。

### 21. 文件服务路径未做目录穿越校验

`/files/:filename` 用 `resolve()` 拼接路径，虽然 Elysia 路由会提取路径段，但缺乏纵深防御。

**解决**: 校验 `resolvedPath.startsWith(storageDir)`。

### 22. 空的 `catch {}` 块吞掉所有错误

`db/index.ts` 的 9 个 `ALTER TABLE` catch、`App.tsx` 的 `fetchTasks` catch、`TaskCard` 的 `JSON.parse` catch。

**解决**: 至少添加 `console.error` 或 `logger.error`。

### 23. `JSON.parse(e.data)` 在 SSE handler 中未保护

`useTaskWatcher.ts` 中 `es.onmessage` 直接 `JSON.parse`，服务端发送畸形数据会抛异常断开连接。

**解决**: 包裹 try-catch。

### 24. `url.slice(0, 30) + i` 作为 React key

5 处使用此模式。对 base64 data URL，前 30 字符完全相同（`data:image/png;base64,...`），key 退化为纯索引，排序时 reconciliation 出错。

**解决**: 使用 `crypto.randomUUID()` 在插入时分配 ID，或用完整 URL hash。

### 25. 乐观任务含 `Task` 接口外字段

`App.tsx` 中 `id: -1`, `requestId: null` 不在 `Task` 接口中，通过 `as Task` 强转绕过。

**解决**: 在 `Task` 接口中声明 `id?: number`, `requestId?: string | null`，或移除多余字段。

### 26. 任务过滤逻辑依赖 `qwen-image` 前缀

`App.tsx` 的 `filteredTasks` 用 `model.startsWith('qwen-image')` 判断图片任务。如果未来引入非 qwen 前缀的图片模型会误分类。

**解决**: 从 `MODEL_GROUPS` 构建一个 `IMAGE_MODELS` Set，用它判断类别。

### 27. `fetchStats` 只查 video 端点

`App.tsx` 的 stats 只从 `/api/video/usage/stats` 获取。图片用户看到的统计为空。

**解决**: 统一为一个 stats 端点（如 `/api/stats`），或分别获取并合并。

### 28. 请求失败无用户反馈

`handleGenerate` 中 API 返回错误时，只移除乐观卡片，不提示用户。

**解决**: 增加 `toast` 或内联错误提示。

---

## ⚪ P4 — 代码质量 / 测试 / 文档

### 29. `as any` 类型断言 17+ 处

路由 handler 和 service 中大量 `body as any`、`res.json() as any` 绕过类型检查。

**解决**: 定义 DashScope API 的请求/响应接口，Elysia 的 `body` 类型已通过 `.model()` 声明，handler 中应直接使用。

### 30. `UsageData` 接口不匹配实际图片任务数据

`pricing/service.ts` 的 `UsageData` 定义 `duration`/`SR`，但图片任务存 `{ image_count, width, height }`。

**解决**: 定义 `VideoUsageData` 和 `ImageUsageData` 联合类型，或让 `UsageData` 包含两种字段。

### 31. 数据库用 `real` 存储金额

浮点精度可能导致分币级误差。

**解决**: 改用整数（分）存储，展示时转换。

### 32. 服务端端口硬编码 4000

`src/index.ts` 和 `vite.config.ts` 都硬编码。

**解决**: 用 `process.env.PORT || 4000`，vite 代理读取同源。

### 33. 测试覆盖不足

- 无 image 模块测试
- 无 wan2.7-i2v 验证测试
- 无 pricing 模块测试
- 无 SSE 端点测试
- 无客户端测试

### 34. 根目录无 `test` 脚本

必须 `bun run --cwd packages/server test`，根目录 `bun test` 无效。

**解决**: 根 package.json 添加 `"test": "bun run --cwd packages/server test"`。

### 35. tsconfig 中 `@/*` 路径别名从未使用

client 和 server 的 tsconfig 都配置了 `@/*` 别名，但所有 import 使用相对路径。

**解决**: 要么在代码中使用 `@/` 导入，要么移除配置。

### 36. 服务端 `abstract class` 只有 static 方法

无实例化场景，`abstract` 无意义。

**解决**: 改为导出一组普通函数，或移除 `abstract`。
