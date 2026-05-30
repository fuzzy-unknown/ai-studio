# TODO.md

> 项目代码审查 v2 — 从最佳实践、功能完整度、过度设计警示角度出发。
>
> ⚠️ 标记为 **「不建议改」** 的条目是过度设计的陷阱——当前规模下改动收益 < 引入的复杂度。

---

## 🔴 必须修复 — 功能 Bug & 违反最佳实践

### 1. 💰 视频任务 cost 始终为 0（确认中的 P0）

`pricing/service.ts:getPricePerSecond(model, sr)` 把数字 `sr`（如 `720`）转字符串后与 `resolution` 列（存 `'720P'`）比较，永远匹配不到，返回 0。所有视频任务的 `cost` 字段都是 0。

**解决**: 查询前转换：`const resKey = sr <= 720 ? '720P' : '1080P'`。

### 2. 💰 图片计费忽略 `size`，可能算错钱

`calculateImageCost(model, imageCount)` 只按 `model` 查询取第一条。如果同一模型有多种尺寸定价，结果取决于 SQLite 返回顺序。

**解决**: 改为 `calculateImageCost(model, size, imageCount)`，同时匹配 `model + resolution`。

### 3. ♻️ 无限轮询：`pollUntilDone` 没有退出条件

`while (true)` + `Bun.sleep(5000)`。如果 DashScope API 一直返回 `RUNNING`（遇到过这种情况），服务端内存泄漏 + CPU 浪费。

**解决**: 加计数器 `let ticks = 0; while (ticks++ < 360)` 或绝对时间超时。

### 4. 🪝 React Hooks 误用：`useMemo` 做副作用

`QwenImageForm.tsx:34-38` 用 `useMemo(() => { setSize(...); setN(...) }, [model])` 重置表单。React 18 的 Strict Mode 会执行两次 `useMemo`，导致状态被重置两次，且语义不对。

**解决**: 改为 `useEffect(() => { setSize(...); setN(...) }, [model])`。这是 React 最基本的规则之一。

### 5. 🔄 乐观更新闪烁：任务消失再出现

`App.tsx:118-120` 先 `filter` 移除临时卡片 → `await fetchTasks()` 拉取。中间有可见的空白帧，用户看到任务"消失再出现"。

**解决**: 不要提前移除。让 `fetchTasks` 的结果直接 `setTasks` 覆盖整个列表（临时卡片的 `taskId` 不在真实数据中，自然被替换）。

### 6. 🎨 Wan27I2vForm 切换模式不重置旧字段

在「首帧生视频」填了首帧图片，切到「视频续写」后提交 → `imageUrl` 随请求发出，服务端会认为这是一个首帧模式请求。

**解决**: `setMode` 时同时重置 `imageUrl`、`lastFrameUrl`、`drivingAudioUrl`、`firstClipUrl`。

### 7. ❌ 请求失败用户无任何提示

`handleGenerate` 的 catch 只移除乐观卡片，用户不知道发生了什么。API 返回 400 错误码时也一样。

**解决**: 加一个 `const [error, setError] = useState<string | null>(null)`，失败时设置错误信息，在 UI 上展示。

### 8. 📊 Stats 只查 video 端点，图片用户看到空统计

`App.tsx:32` 写死 `/api/video/usage/stats`。如果只用过图片模型，统计栏永远是空的。

**解决**: `getUsageStats()` 已查询所有任务（包括图片），stats 应从任一端点获取即可。但当前 `fetchStats` 只调了 video 路由，而该路由的 `getUsageStats` 已涵盖所有模型的数据。验证一下 video 的 `getUsageStats` 确实遍历了所有 tasks → 是的，`db.select().from(tasks).all()` 取所有任务。所以只需确保 video 的 stats 端点不返回 NaN（已修复）。**当前实际是 OK 的**——只需确认 DB 里没残留 NaN cost。保留这条作为提醒。

---

## 🟠 应该修复 — 最佳实践违反

### 9. `as any` 到处都是（17+ 处）

Elysia 的 `.model()` + `body:` 已经提供了类型安全的 body，但路由 handler 里全部 `body as any` 丢掉了。DashScope API 响应也全是 `res.json() as any`。

**解决**: 不需要一步到位。分两步：
1. 路由 handler 中用 Elysia 的类型推导（`{ body }` 已经有类型了，去掉 `as any`）
2. DashScope 响应定义接口（`DashScopeCreateResult` 已有，扩展到 query 和 image 响应即可）

### 10. 空的 `catch {}` 吞掉所有错误

`App.tsx` 的 `fetchTasks` catch、`fetchStats` catch、`TaskCard` 的 JSON.parse catch。生产环境出错后用户看到空白页，开发者也无法排查。

**解决**: 加 `console.error`。这是最低成本的改进。

### 11. SSE 的 `JSON.parse(e.data)` 未保护

`useTaskWatcher.ts:56` 直接 parse，服务端发畸形数据会崩溃断连。

**解决**: 包一层 try-catch，解析失败时 `console.error` + 跳过该事件。

### 12. `fetchTasks` 降级逻辑不检查 `fallback.ok`

`App.tsx:24-25`: image 端点失败后降级到 video 端点，但不检查 video 响应的 `res.ok`。如果两个都挂了，`fallback.json()` 解析 HTML 5xx 页面会抛异常，被空 catch 吞掉。

**解决**: `if (!fallback.ok) throw new Error('Failed to fetch tasks')`，让外层 catch 处理。

### 13. `url.slice(0, 30) + i` 作 React key

base64 data URL 的前 30 字符全部相同（`data:image/png;base64,`），key 退化为纯索引 `i`。图片增删时 React reconciliation 会出错，可能导致图片显示错乱。

**解决**: 在状态中维护时用 index 做 key（因为数组本身就是稳定的），或给每个 URL 附带插入时的 `crypto.randomUUID()`。简单方案：直接用 `i` 做 key（因为当前场景中列表不会重排，只是在末尾追加）。

### 14. `getUsageStats()` 查全表

`db.select().from(tasks).all()` 每次调用都拉取全部任务到内存，然后 JS 层遍历计算。任务量增长后会变慢。

**解决**: 用 SQL 聚合：`SELECT COUNT(*), SUM(cost) FROM tasks WHERE status = 'SUCCEEDED' AND cost IS NOT NULL`。一条 SQL 搞定，不需要加载全部数据到内存。

### 15. 服务端重启后轮询丢失

`pollUntilDone` 是 fire-and-forget Promise。服务重启后，所有 `RUNNING` 状态的任务永远卡住。

**解决**: 在 `src/index.ts` 启动时扫描 `status IN ('PENDING', 'RUNNING')` 的任务，重新启动轮询。10 行代码即可。

---

## 🟡 可以改善 — 代码清晰度

### 16. `handleGenerate` 参数类型内联了 20 个字段

`App.tsx:78` 用了一个巨大的内联对象类型，和 `GenerateFormData` 几乎一样但不完全一样。以后改了 `GenerateFormData` 这里不会跟着变。

**解决**: 直接用 `GenerateFormData` 类型。从 `types.ts` 导入即可。

### 17. `videoUrl` 列存图片 URL

`tasks` 表的 `videoUrl` 在图片任务中存图片结果，`localPath` 同理。对新人来说很困惑。

**解决**: ⚠️ **不建议现在改**。重命名列需要写迁移脚本、改 service + client 多处代码，收益 < 成本。加一行注释即可：
```ts
videoUrl: text('video_url'), // 视频/图片结果的 URL（图片任务也用此字段）
```

### 18. `inputImageUrl` 存多种格式

不同模型存不同格式（单 URL / JSON 数组 / 混合 media URL），客户端需要 try-catch 解析。

**解决**: ⚠️ **不建议改为 `{ type, url }[]`**。这需要改 schema + 所有 service 的写入逻辑 + 客户端的读取逻辑，是大规模重构。当前统一先 `JSON.parse` + fallback 到单字符串的方案已经够用。**建议**: 统一所有写入为 JSON 数组格式（不区分模型），读取端只需一套逻辑。

### 19. `abstract class` 只有 static 方法

`VideoService`、`ImageService`、`PricingService` 都声明为 `abstract class` 但只有 static 方法。

**解决**: ⚠️ **不建议改**。这是一种常见的"命名空间类"模式，在 TypeScript 中广泛使用（甚至 Node.js 的 `console` 也是这种模式）。改不改纯属风格偏好，改动收益为零。

### 20. `fileToBase64` 复制到 5 个文件

5 个表单组件都有相同的 `fileToBase64` 函数。

**解决**: 提取到 `shared/fileToBase64.ts`。这是 **值得做** 的提取——3 行代码，没有复杂度增加，但有实际收益。

### 21. CSS 有 4 组几乎相同的 Tab 样式

`.filter-tab`、`.category-tab`、`.subtype-tab`、`.subtask-tab`。

**解决**: ⚠️ **不建议抽象为通用组件**。这些 Tab 的间距、字号、圆角有细微差异，强行统一反而需要更多 CSS 变量。当前 CSS 总量很小（~600 行），重复不构成维护负担。**如果新增第 5 组时再考虑合并**。

### 22. 模型 ID 散落在 7+ 文件

**解决**: ⚠️ **不建议现在抽 `constants/models.ts`**。当前只有 13 个模型，每个文件的引用点都很少。抽象一个 central registry 的收益要在 20+ 模型时才能体现。**在添加下一个模型时顺便考虑**。

### 23. 共享类型包 `packages/shared/`

**解决**: ⚠️ **不建议做**。当前客户端和服务端的类型只有 `Task` 一个重叠。为了一个类型建一个 workspace package 是典型的过度设计。在 `packages/server/src/types/` 里定义一次，客户端手动维护即可。**如果未来有 5+ 共享类型再做**。

---

## 🔵 安全 / 生产就绪

### 24. DashScope API 调用无超时

`fetch()` 没有 `AbortSignal`。如果 DashScope API 挂起，请求永远阻塞。

**解决**: 统一封装 `fetchWithTimeout(url, options, timeoutMs = 120_000)` 工具函数。

### 25. SSE 流无法感知客户端断开

客户端关闭标签页后，服务端继续轮询 DB 最多 10 分钟。

**解决**: 用 `ReadableStream` 的 `cancel` 回调或 `AbortSignal`：
```ts
const stream = new ReadableStream({
  start(controller) { /* 轮询逻辑 */ },
  cancel() { aborted = true } // 客户端断开时触发
})
```

### 26. `/files/:filename` 未校验路径穿越

虽然 Elysia 路由会提取路径段阻止 `../`，但缺少纵深防御。

**解决**: 3 行代码：
```ts
if (filename.includes('..')) { set.status = 400; return { error: 'Invalid filename' } }
const resolved = resolve(storageDir, filename)
if (!resolved.startsWith(storageDir)) { set.status = 403; return { error: 'Forbidden' } }
```

### 27. 端口硬编码

`src/index.ts:15` 和 `vite.config.ts:16` 都硬编码 4000。

**解决**: `const port = Number(process.env.PORT) || 4000`，vite 用环境变量或保持 4000。

---

## ⚪ 测试 / 文档

### 28. 测试只覆盖 video 模块

无 image 模块、pricing 模块、wan2.7 模型、SSE 端点测试。

**解决**: 优先补充 image 模块测试（sync/async 双模式、imageUrls 验证、编辑模型验证）和 pricing 的 `getPricePerSecond` 测试（直接验证 #1 的修复）。

### 29. 根目录缺 `test` 脚本

**解决**: package.json 加 `"test": "bun run --cwd packages/server test"`。

### 30. CLAUDE.md 缺少新增模型

未记录 `wan2.7-i2v`、`qwen-image-edit-*`、`Wan27I2vForm`、`QwenImageEditForm`。

**解决**: 更新 Supported Models 和 Form Components 部分。

### 31. `@/*` 路径别名配置了但没用

两个 tsconfig 都配了 `@/*` 别名，所有 import 用相对路径。

**解决**: 移除未使用的配置，减少认知负担。
