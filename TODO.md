# TODO.md

> 项目代码审查 v4 — 架构设计合理性视角
>
> v3 覆盖：逻辑缺陷、功能完善性、数据流合理性。
> v4 聚焦：架构级问题（散弹式修改、代码重复、双重校验等）。
>
> **已实施的重构（v4 修复）:**
>
> | 问题 | 状态 | 实施内容 |
> |------|------|----------|
> | P0: `fileToBase64` 重复 5 次 | ✅ 已修复 | 提取到 `packages/client/src/utils/fileToBase64.ts` |
> | #33: 乐观卡片日期格式 | ✅ 已修复 | `App.tsx` 用 `toISOString()` 替代 `toLocaleString()` |
> | #40: 图片表单冗余 `resolution` | ✅ 已修复 | `QwenImageEditForm` 用条件对象替代 `''` |
> | #41: `fetchTasks` 误导注释 | ✅ 已修复 | 改用统一端点 `/api/tasks` |
> | #42: 内联类型与 `GenerateFormData` 不同步 | ✅ 已修复 | `App.tsx` import `GenerateFormData` 替代内联类型 |
> | #45: 乐观卡片 `as Task` 强转 | ✅ 已修复 | `Task` 接口添加 `id?: number` |
> | #46: `qwen-image-edit` 不应设置 `prompt_extend` | ✅ 已修复 | `image/service.ts` 添加模型判断跳过该参数 |
> | P1: ERROR_CODE_MAP 重复 | ✅ 已修复 | 合并到 `modules/task/errors.ts`（取并集 21 条） |
> | P1: `getAllTasks`/`getTaskByTaskId`/`getApiKey`/`isTerminal` 重复 | ✅ 已修复 | 提取到 `modules/task/shared.ts` |
> | #44: `getUsageStats()` 重复 + JS 遍历 | ✅ 已修复 | 合并到 `shared.ts`，用 SQL 聚合 `COUNT/SUM` |
> | P2: SSE 实现重复 ~100 行 | ✅ 已修复 | 提取到 `modules/task/sse.ts`（`createSSEStream`） |
> | P2: 客户端端点选择逻辑 | ✅ 已修复 | 新增统一 `GET /api/tasks` + `/api/tasks/:id/events` + `/api/usage/stats` |
> | #32: SSE 断开不重连 | ✅ 已修复 | `useTaskWatcher` 添加指数退避重连（最多 3 次）+ 兜底 fetch |
> | #34: 统计栏对纯图片用户显示 `0s` | ✅ 已修复 | `totalDuration > 0` 时才显示时长 |
> | #35: 无法删除失败任务 | ✅ 已修复 | `DELETE /api/tasks/:taskId` + `TaskCard` 删除按钮 |
> | #36: 无法取消进行中任务 | ✅ 已修复 | `POST /api/tasks/:taskId/cancel` + `TaskCard` 取消按钮 |
> | #38: 图片无法下载/放大 | ✅ 已修复 | `TaskCard` 添加 lightbox + 下载按钮 |
> | A3: 路由层+Service 层双重校验 | ✅ 已修复 | 校验归一到 Model Registry 的 `validate()`，路由层/Service 层共用 |
> | A1: Model Registry | ✅ 已修复 | 新建 `modules/task/model-registry.ts`，video/image 路由和 service 均已改用注册表 |
> | A4: DB 添加 `type` 列 | ✅ 已修复 | schema 添加 `type` 字段 + 自动迁移 + 客户端 filter 改用 `task.type` |
> | A5: `videoUrl` 统一为 JSON 数组 | ⏳ 待实施 | 风险较高，需数据迁移脚本，建议单独 PR |
>
> **新建文件清单：**
> - `packages/server/src/modules/task/errors.ts` — 统一错误码翻译
> - `packages/server/src/modules/task/shared.ts` — 共享任务工具函数（含 deleteTask/cancelTask）
> - `packages/server/src/modules/task/sse.ts` — 共享 SSE 流实现
> - `packages/server/src/modules/task/index.ts` — 统一 `/api/tasks` 路由
> - `packages/server/src/modules/task/model-registry.ts` — 模型注册表（12 个模型定义 + 工具函数）
> - `packages/client/src/utils/fileToBase64.ts` — 共享文件转 base64
>
> **修改文件清单：**
> - Server: `index.ts`, `video/service.ts`, `image/service.ts`, `image/index.ts`（import 改为共享模块）
> - Client: `App.tsx`, `TaskCard.tsx`, `TaskList.tsx`, `useTaskWatcher.ts`, `App.css`, `vite.config.ts`, `types/index.ts`, 5 个表单组件
>
> **验证结果：** client build ✅ | server tsc ✅（仅 5 个预存 Elysia 类型推断警告）| 26 tests pass ✅

---

## 🏗️ 架构级问题

### A1. 模型类型判断逻辑散弹式分布（最核心问题）

**现状**：判断"这是什么模型"的逻辑分散在至少 6 个位置：

| 位置 | 判断方式 | 用途 |
|------|----------|------|
| `video/service.ts:55-69` | `isI2v()`, `isR2v()`, `isVideoEdit()`, `isWan27I2v()` | 组装请求体、校验参数、存储 URL |
| `video/index.ts:38-41` | `model === 'happyhorse-1.0-i2v'` 等硬编码 | 路由层参数校验 |
| `image/service.ts:17-36` | `isSyncModel()`, `isEditModel()` + `startsWith()` | 选择同步/异步 API |
| `TaskCard.tsx:31-53` | `isImageModel()`, `isI2v()`, `isR2v()` 等 | 渲染 UI 组件 |
| `useTaskWatcher.ts:47` | `model?.startsWith('qwen-image')` | SSE 端点路由 |
| `App.tsx:83,110` | `data.model.startsWith('qwen-image')` | 选择 API 端点 |

**问题**：
1. 添加一个新模型（比如 `wan2.7-t2v`）需要在所有这些位置添加分支
2. Server 端和 Client 端各自维护一套判断函数，无法保证一致
3. `startsWith` 匹配不精确（比如 `qwen-image-2.0` 同时匹配 `qwen-image-2.0-pro`）
4. 判断逻辑是函数级别的（`isI2v` 返回 boolean），而非数据驱动的

**解决方案：引入「模型注册表 (Model Registry)」模式**

核心思想：把每个模型的元信息（类型、能力、端点、校验规则）集中声明为数据结构，用查询代替判断。

**Server 端** — 在 `src/modules/` 下新建 `model-registry.ts`：

```ts
// 模型能力声明
interface ModelDefinition {
  id: string                    // 'happyhorse-1.0-t2v'
  category: 'video' | 'image'  // 大类
  subType: string               // 't2v' | 'i2v' | 't2i' ...
  apiMode: 'async' | 'sync'    // 调用模式
  endpoint: string              // DashScope API 路径
  requiredInputs: string[]      // ['prompt', 'imageUrl']
  optionalInputs: string[]      // ['duration', 'ratio']
  defaults: Record<string, any> // { resolution: '720P', duration: 5 }
  costMode: 'duration' | 'count' // 计费方式
  mediaStorage: 'single' | 'array' // 结果存储方式
}

export const MODELS: Record<string, ModelDefinition> = {
  'happyhorse-1.0-t2v': {
    id: 'happyhorse-1.0-t2v',
    category: 'video',
    subType: 't2v',
    apiMode: 'async',
    endpoint: '/services/aigc/video-generation/video-synthesis',
    requiredInputs: ['prompt'],
    optionalInputs: ['resolution', 'ratio', 'duration', 'watermark', 'seed'],
    defaults: { resolution: '720P', ratio: '16:9', duration: 5 },
    costMode: 'duration',
    mediaStorage: 'single',
  },
  'happyhorse-1.0-i2v': {
    id: 'happyhorse-1.0-i2v',
    category: 'video',
    subType: 'i2v',
    apiMode: 'async',
    endpoint: '/services/aigc/video-generation/video-synthesis',
    requiredInputs: ['prompt', 'imageUrl'],
    optionalInputs: ['resolution', 'duration', 'watermark', 'seed'],
    defaults: { resolution: '1080P', duration: 5 },
    costMode: 'duration',
    mediaStorage: 'single',
  },
  // ... 其他模型
}

// 工具函数 — 替代散布各处的 is* 函数
export function getModel(id: string): ModelDefinition
export function isVideoModel(id: string): boolean
export function isImageModel(id: string): boolean
export function isSyncModel(id: string): boolean
export function isEditModel(id: string): boolean
```

改造后的 `callDashScopeCreate` 不再需要 4 个 boolean flag 和多层 if-else：

```ts
// 改造前（video/service.ts 当前代码）
const i2v = isI2v(model)
const r2v = isR2v(model)
const videoEdit = isVideoEdit(model)
const wan27 = isWan27I2v(model)
if (wan27) { ... }
else if (videoEdit) { ... }
else if (i2v) { ... }
else if (r2v) { ... }

// 改造后
const modelDef = getModel(params.model)
const body = modelDef.buildRequestBody(params)  // 每个模型定义自己的构建逻辑
```

**Client 端** — 共享同一个注册表（或从 API 获取）：

```ts
// 从 constants.ts 的 MODEL_GROUPS 演化
// 每个模型条目不仅包含 label，还包含 UI 行为声明
const models = {
  'happyhorse-1.0-t2v': {
    label: '文生视频',
    formType: 't2v',
    category: 'video',
    apiEndpoint: '/api/video/generate',   // ← 消除 App.tsx 的端点选择逻辑
    ssePrefix: '/api/video',              // ← 消除 useTaskWatcher 的端点路由逻辑
  },
  'qwen-image-2.0-pro': {
    label: '文生图 Pro',
    formType: 't2i',
    category: 'image',
    apiEndpoint: '/api/image/generate',
    ssePrefix: '/api/image',
  },
}
```

**收益**：
- 新增模型 = 新增一条数据声明，不需要改任何 if/else
- 消除 Server/Client 两套判断函数
- 校验逻辑可从 `requiredInputs` 自动生成

---

### A2. Video 和 Image 模块大量代码重复

**现状**：`video/service.ts`（372 行）和 `image/service.ts`（460 行）的结构几乎完全对称：

| 重复内容 | video/service.ts | image/service.ts |
|----------|-----------------|-----------------|
| `ERROR_CODE_MAP` | 18 条错误码 | 13 条（子集 + 2 条独有） |
| `translateError()` | 相同实现 | 相同实现 |
| `getApiKey()` | 相同实现 | 相同实现 |
| `getAllTasks()` | 相同 SQL | 相同 SQL |
| `getTaskByTaskId()` | 相同 SQL | 相同 SQL |
| `pollUntilDone()` | 相同循环逻辑 | 相同循环逻辑 |
| `getUsageStats()` | 相同 JS 遍历 | 相同 JS 遍历 |
| SSE 端点实现 | ~50 行 ReadableStream | ~50 行 ReadableStream（几乎相同） |
| `isTerminal()` | 相同实现 | 相同实现 |

**问题**：
1. 修一个 bug（比如 SSE 重连逻辑）要改两个地方
2. `getAllTasks()` 在两个模块中查同一张表，客户端却要选调用哪个
3. `ERROR_CODE_MAP` 的 video 版本比 image 多了几条（`IPInfringementSuspect`, `InvalidURL` 等），但大部分重复

**解决方案：抽取共享 TaskService 基层**

```
src/modules/
├── task/                     ← 新增：共享任务逻辑
│   ├── service.ts            ← getAllTasks, getTaskByTaskId, getUsageStats, isTerminal
│   ├── sse.ts                ← createSSEStream(taskId, service) 统一 SSE 实现
│   ├── errors.ts             ← 统一 ERROR_CODE_MAP + translateError
│   └── index.ts              ← GET /api/tasks (统一端点), GET /api/tasks/:taskId
├── video/
│   └── service.ts            ← 只保留 video 特有逻辑（DashScope 调用、视频下载）
├── image/
│   └── service.ts            ← 只保留 image 特有逻辑（同步/异步分支、图片下载）
└── pricing/
    └── service.ts            ← 不变
```

`task/errors.ts` 合并两个 ERROR_CODE_MAP（取并集），image 模块的独有条目（如果有的话）自然包含在内。

`task/sse.ts` 提取 SSE ReadableStream 为独立函数：

```ts
// 改造前：video/index.ts 和 image/index.ts 各有 ~50 行几乎相同的 SSE 实现
// 改造后：
export function createSSEStream(
  taskId: string,
  getTask: (id: string) => Promise<Task | undefined>,
  isTerminal: (status: string) => boolean,
  resolveMediaUrl: (task: Task) => string | null,
): Response { ... }
```

**收益**：
- SSE bug 修一处即全局生效
- 新增 `GET /api/tasks` 统一端点，消除客户端的端点选择问题
- `getUsageStats()` 合并为一处，不会出现双重全表扫描

---

### A3. 路由层和 Service 层的双重校验

**现状**：模型参数校验存在两层：

1. **路由层**（`video/index.ts:34-69`）— 在 `beforeHandle` 中做业务校验（如 "i2v 必须有 imageUrl"）
2. **Service 层**（`video/service.ts:218-225`）— 在 `createTask()` 中做同样的校验

```ts
// video/index.ts beforeHandle
if (isI2v && !b.imageUrl) {
  set.status = 400
  return { error: 'imageUrl is required...' }
}

// video/service.ts createTask
if (i2v && !params.imageUrl)
  throw new Error('imageUrl is required...')
```

**问题**：
1. 同一规则写两遍，可能不一致
2. 路由层的错误返回 `{ error }` JSON + 400 状态码，Service 层抛 `Error` 被全局处理器捕获返回 500 — 错误码不一致
3. 校验逻辑与模型判断深度耦合，新增模型需要同步更新两层

**解决方案：校验逻辑归一到 Model Registry**

```ts
// model-registry.ts
const MODELS = {
  'happyhorse-1.0-i2v': {
    requiredInputs: ['prompt', 'imageUrl'],
    validate(params) {
      if (!params.imageUrl) return 'imageUrl is required for image-to-video model'
    },
  },
}

// 统一校验中间件
function validateModelParams(body: any) {
  const model = getModel(body.model)
  return model.validate(body)
}
```

路由层只保留类型校验（Elysia type-box），业务校验全部下沉到 Model Registry 的 `validate` 方法。Service 层不再重复校验。

---

### A4. 数据库 `tasks` 表缺少任务类型字段

**现状**：`tasks` 表用 `model` 列来区分视频任务和图片任务。所有按类型筛选的逻辑都依赖字符串匹配：

```ts
// App.tsx
tasks.filter(t => t.model?.startsWith('qwen-image'))  // 客户端
// useTaskWatcher.ts
model?.startsWith('qwen-image')  // SSE 路由
// TaskCard.tsx
!!model?.startsWith('qwen-image')  // UI 渲染
```

**问题**：
1. `model.startsWith('qwen-image')` 不够精确，可能匹配到未来不期望的模型
2. 无法用 SQL `WHERE type = 'image'` 高效过滤
3. 客户端的类型判断逻辑与数据库无关，纯靠约定

**解决方案：添加 `type` 列**

```sql
ALTER TABLE tasks ADD COLUMN type TEXT DEFAULT 'video';
-- 迁移: UPDATE tasks SET type = 'image' WHERE model LIKE 'qwen-image%';
```

Service 层在 `createTask` 时根据 Model Registry 设置 `type`。客户端直接读 `type` 字段而非解析 `model` 字符串。

**收益**：
- SQL 层面可以直接 `WHERE type = 'image'`
- 客户端不再需要 `model.startsWith()` 判断
- 与 Model Registry 的 `category` 字段对应

---

### A5. `videoUrl` / `localPath` 语义混乱

**现状**：`tasks` 表的 `videoUrl` 和 `localPath` 列同时用于存储视频和图片：

| 场景 | `videoUrl` 存的内容 | `localPath` 存的内容 |
|------|---------------------|---------------------|
| 单个视频 | `"https://..."` (字符串) | `"storage/videos/xxx.mp4"` |
| 单张图片 | `"https://..."` (字符串) | `"storage/images/xxx.png"` |
| 多张图片 | `"[\"https://...\", ...]"` (JSON) | `"[\"storage/...\", ...]"` (JSON) |

客户端需要到处用 `parseUrls()` 来处理这种不一致：

```ts
// TaskCard.tsx
function parseUrls(value: string | null): string[] {
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed
  } catch {}
  return [value]
}
```

**问题**：
1. 列名 `videoUrl` 对图片任务有误导性
2. 单图和图集的存储格式不统一（string vs JSON array）
3. 客户端每个消费处都需要 try/catch JSON.parse

**解决方案：统一为 JSON 数组**

```sql
-- 迁移: 将所有单值转为 JSON 数组
UPDATE tasks SET video_url = json_array(video_url) WHERE video_url NOT LIKE '[%';
UPDATE tasks SET local_path = json_array(local_path) WHERE local_path IS NOT NULL AND local_path NOT LIKE '[%';
```

之后所有代码都假设 `videoUrl` / `localPath` 是 JSON 数组（可以是 `[]`, `["url1"]`, `["url1", "url2"]`），消除 `parseUrls()` 的必要性：

```ts
// 改造前
const urls = parseUrls(task.videoUrl)  // try/catch + 类型判断
// 改造后
const urls: string[] = JSON.parse(task.videoUrl || '[]')
```

> 注意：这是一个较大的迁移，可以等到做 A2（统一模块）时一起实施。短期可以不改。

---

### A6. 客户端 7 个表单组件重复的样板代码

**现状**：7 个表单组件（`HappyHorseT2vForm`, `HappyHorseI2vForm`, `Wan27I2vForm`, `HappyHorseR2vForm`, `HappyHorseEditForm`, `QwenImageForm`, `QwenImageEditForm`）都遵循相同模式：

1. 声明 state（prompt + 各种选项）
2. `canSubmit` 校验
3. `handleSubmit` 构建 `GenerateFormData` 对象
4. 提交后重置 state
5. 渲染：PromptEditor → 特定输入组件 → 选项 → AdvancedOptions → 提交按钮

其中至少 5 个组件重复了 `fileToBase64()` 函数。

**问题**：
1. 添加新模型 = 复制一个表单组件 + 调整细节
2. 修一个通用 bug（比如提交后重置逻辑）要改 7 个文件
3. `fileToBase64` 出现 5 次

**解决方案：提取共享逻辑到 hooks/utils**

```ts
// utils/fileToBase64.ts — 提取到共享位置
export function fileToBase64(file: File): Promise<string> { ... }

// hooks/useModelForm.ts — 表单通用逻辑
export function useModelForm(options: {
  model: string
  onSubmit: (data: GenerateFormData) => void
  requiredFields: string[]      // 校验规则
  defaultValues?: Partial<GenerateFormData>
}) {
  const [loading, setLoading] = useState(false)
  const [formState, setFormState] = useState({ ...options.defaultValues })

  const canSubmit = useMemo(() => {
    return options.requiredFields.every(f => !!formState[f]) && !loading
  }, [formState, loading])

  const submit = useCallback(() => {
    if (!canSubmit) return
    options.onSubmit(formState)
    // 重置
  }, [canSubmit, formState])

  return { formState, setFormState, canSubmit, submit }
}
```

表单组件变得只负责 UI 布局，不再管理状态和校验逻辑。

> 注意：**不建议过度抽象**。当前的 7 个表单差异较大（Wan27I2v 有 3 种子模式，QwenImageEdit 有 limited 模式），强行统一成一个组件反而更复杂。但 `fileToBase64` 和「提交+重置」模式可以安全提取。

---

### A7. 客户端的端点选择逻辑

**现状**：客户端在 3 个位置需要根据模型选择 API 端点：

```ts
// App.tsx:110 — 提交任务
const endpoint = isImageModel ? '/api/image/generate' : '/api/video/generate'

// App.tsx:18 — 获取任务列表
const res = await fetch('/api/image/tasks')  // 为什么是 image？
// fallback: const res = await fetch('/api/video/tasks')

// useTaskWatcher.ts:48-49 — SSE 端点
const endpoint = isImage
  ? `/api/image/tasks/${id}/events`
  : `/api/video/tasks/${id}/events`
```

**问题**：
1. 提交、列表、SSE 三个端点选择逻辑各自独立实现
2. `fetchTasks` 选 `/api/image/tasks` 的原因只是"因为它存在"，没有语义上的理由
3. 新增一种任务类型（假设未来有音频生成）需要修改 3 处端点选择

**解决方案**：

短期（配合 A2）：新增 `GET /api/tasks` 统一端点，客户端不再选择。

```ts
// App.tsx — 改造后
const res = await fetch('/api/tasks')  // 不再需要端点选择
```

长期（配合 A1 Model Registry）：端点信息写在模型定义中。

```ts
// Model Registry
const MODELS = {
  'happyhorse-1.0-t2v': {
    apiEndpoint: '/api/video/generate',
    ssePrefix: '/api/video',
  },
}

// App.tsx
const endpoint = MODELS[data.model].apiEndpoint  // 查表代替判断
```

---

## 📋 架构重构优先级与实施路径

### 推荐分阶段实施

| 阶段 | 内容 | 改动范围 | 风险 | 收益 |
|------|------|----------|------|------|
| **P0** | 提取 `fileToBase64` 到 utils | Client 1 文件新增 + 5 文件删除重复 | 极低 | 消除 DRY 警告 |
| **P1** | 合并 `ERROR_CODE_MAP` + 共享函数 | Server 1 文件新增 + 2 文件精简 | 低 | 修 bug 只改一处 |
| **P2** | 统一 `GET /api/tasks` 端点 + SSE 提取 | Server 新增路由 + Client 简化 | 低 | 消除客户端端点选择 |
| **P3** | Model Registry (Server) | Server 新增文件 + 重构 service | 中 | 新增模型改动量减半 |
| **P4** | Model Registry (Client) + 消除 `startsWith` | Client 新增文件 + 重构 | 中 | 与 Server 保持一致 |
| **P5** | DB 添加 `type` 列 + 迁移 | Server schema + 迁移脚本 | 中 | 查询和过滤更可靠 |
| **P6** | 统一 `videoUrl`/`localPath` 为 JSON 数组 | Server + Client + 数据迁移 | 高 | 消除 parseUrls |

### P3（Model Registry）的详细实施步骤

1. 新建 `src/modules/model-registry.ts`，声明所有模型的元信息
2. `video/service.ts` 的 `callDashScopeCreate` 改为从 Registry 查询 `buildRequestBody`
3. `image/service.ts` 的 `isSyncModel` / `isEditModel` 改为从 Registry 查询 `apiMode`
4. 路由层的模型校验改为调用 `getModel(id).validate(params)`
5. Service 层去掉重复校验
6. 测试：确保所有现有模型的请求体与重构前完全一致

### 风险控制

- 每个阶段独立可交付，不依赖后续阶段
- P3/P4 的 Model Registry 可以与现有代码共存（渐进式替换）
- P5/P6 涉及数据迁移，需在开发环境验证后再上线

---

## 🔴 v3 内容保留 — 逻辑缺陷

### 32. SSE 连接断开后任务永远卡在 loading

`useTaskWatcher.ts` 的 `onerror` 回调关闭 EventSource 并从 Map 中删除，但不会重连。`useEffect` 只在 `taskIds` 变化时重建连接。如果网络闪断（WiFi 切换、标签页后台休眠、代理超时），任务状态停留在 `PENDING`/`RUNNING`，永远无法恢复。

**复现**: 提交一个视频任务 → 在生成期间切换到其他标签页 30 秒 → 回来发现任务仍在"生成中"但已停止更新。

**解决**: `onerror` 中加指数退避重连（最多 3 次），或直接 `fetchTasks()` 刷新数据作为兜底：
```ts
es.onerror = () => {
  es.close()
  current.delete(id)
  // 兜底：直接从服务端拉最新状态
  fetch(`/api/${isImage ? 'image' : 'video'}/tasks/${id}`)
    .then(r => r.json())
    .then(task => onUpdateRef.current(id, { status: task.status, ... }))
    .catch(() => {})
}
```

### 33. 乐观卡片的日期格式与服务端不一致

`App.tsx:100` 用 `new Date().toLocaleString()` 生成临时卡片的 `createdAt`，产出如 `5/30/2026, 10:30:00 AM`（取决于浏览器 locale）。服务端 SQLite 的 `datetime('now')` 产出 `2026-05-30 10:30:00`。用户看到卡片出现时是 US 格式，API 返回后变成 ISO 格式。

**解决**: 统一用 `new Date().toISOString().replace('T', ' ').split('.')[0]` 生成与服务端一致的格式。

### 34. 统计栏显示 `0s` 对纯图片用户毫无意义

`App.tsx:147` 显示 `{stats.totalDuration}s`。如果用户只生成过图片，`totalDuration` 为 0，显示 "已生成 3 个任务 · 0s · 1.50 元"。`0s` 让人困惑——图片任务没有时长概念。

**解决**: 按模型类型条件渲染：图片任务显示张数，视频任务显示时长。或只显示 `任务数 + 总费用`，去掉 duration。

---

## 🟠 v3 内容保留 — 功能完善性

### 35. 无法删除失败的任务

失败的任务永久显示在列表中，用户无法清理。只能通过清空数据库删除。

**解决**: 添加删除按钮（仅对 FAILED/UNKNOWN 状态显示），调 `DELETE /api/{video|image}/tasks/:taskId`。实现简单：删 DB 行 + 删本地文件。

### 36. 无法取消进行中的任务

视频生成需要 1-5 分钟，用户无法中途取消。服务端也持续轮询浪费资源。

**解决**: 添加取消按钮（仅 PENDING/RUNNING 状态显示）。DashScope 支持取消任务，但当前服务端没有实现。最简方案：直接将状态设为 `CANCELED`，`pollUntilDone` 检测到后停止轮询。

### 37. 无法重试失败的任务

失败的任务有 prompt 和参数，但用户必须手动重新填写所有内容。

**解决**: 在失败任务的卡片上添加"重试"按钮，点击后将任务的参数回填到表单。需要让 `GenerateForm` 暴露一个 `fillForm(data)` 方法，或者将表单状态提升到 App 层。

### 38. 图片结果无法下载/放大查看

图片缩略图在卡片中显示，但没有点击放大或下载功能。用户无法获取原始分辨率的图片。

**解决**: 点击图片时打开全屏 lightbox（CSS modal + `<img>` 即可，不需要引入库）。加一个下载按钮用 `<a download>` 标签。

### 39. 没有分页/虚拟滚动

所有任务一次加载（`db.select().from(tasks).all()`）。前端也一次性渲染全部。生成几百个任务后会变慢。

**解决**: 当前规模（个人工具）不是问题。**当任务数 > 200 时再添加**。简单方案：前端 `limit 50` + "加载更多" 按钮，不需要完整的虚拟滚动。

---

## 🟡 v3 内容保留 — 数据流合理性

### 40. 图片表单发送冗余的 `resolution: ''` 字段

`QwenImageEditForm.tsx:71` 对 limited 模型（`qwen-image-edit`）发送 `resolution: ''`。服务端的 `ImageGenerateBody` 不包含 `resolution` 字段，Elysia 会静默丢弃。但 `size: undefined` 不会被 JSON.stringify 出来，所以实际发送的是 `"resolution": ""` — 无害但不干净。

**解决**: 条件判断改为 `resolution: limited ? undefined : size`。`undefined` 值在 JSON.stringify 时会被省略。

### 41. `fetchTasks` 的注释具有误导性

`App.tsx:17` 注释说"使用 image 模块的统一端点获取所有任务"。但实际上 video 和 image 的 `getAllTasks()` 查的是同一张 `tasks` 表、同一条 SQL。没有哪个端点更"统一"。

**解决**: 改用任意一个端点（选 `/api/video/tasks` 更直觉），去掉降级逻辑和误导注释。或者更好的方案：在根级别新增 `GET /api/tasks` 路由。（即上方 A2 方案）

### 42. `handleGenerate` 的内联参数类型与 `GenerateFormData` 不同步

`App.tsx:78` 的内联类型和 `GenerateFormData` 是两个独立的类型定义，以后改一个忘改另一个就会出 bug。

**解决**: 直接 `import type { GenerateFormData }` 并用它。一行改动消除维护风险。

### 43. 视频服务对 `wan2.7` 的 `storedImageUrl` 混存了不同类型的 URL

`video/service.ts:230` 将 `[imageUrl, lastFrameUrl, drivingAudioUrl, firstClipUrl]` 全部 filter(Boolean) 后存为一个 JSON 数组。客户端需要用 `isAudioUrl`/`isVideoUrl` 正则来区分类型。

**解决**: 当前风险很低（图片 URL 不会以 `.mp3` 或 `.mp4` 结尾）。**不需要改**，但如果未来出 bug 可以考虑存 `{ type, url }[]`。

### 44. `getUsageStats()` 在两个模块中都遍历全表

`video/service.ts:324` 和 `image/service.ts:346` 各自 `db.select().from(tasks).all()` 全量加载。如果两个都被调用（目前只有 video 的被调用），会有两次全表扫描。

**解决**: 合并为一个 `getUsageStats()` 函数，放在共享位置或 pricing 模块。用 SQL 聚合替代 JS 遍历：
```sql
SELECT COUNT(*) as task_count, SUM(cost) as total_cost FROM tasks WHERE status='SUCCEEDED' AND cost IS NOT NULL
```

---

## 🔵 v3 内容保留 — 边界情况 & 潜在问题

### 45. 乐观卡片的 `id: -1` 和 `requestId: null` 不在 `Task` 接口中

通过 `as Task` 强转绕过了类型检查。如果未来 `Task` 接口添加了 `id` 必填字段，这里会编译报错但语义不明。

**解决**: 要么在 `Task` 接口中声明 `id?: number`（因为服务端响应包含 id），要么从乐观对象中去掉多余字段。

### 46. `qwen-image-edit` 不支持 `prompt_extend` 但表单可能发送

`QwenImageEditForm` 在 `limited` 时设置 `promptExtend: undefined`，正确。但服务端 `callDashScopeSync` 在未设置时默认 `prompt_extend: true`。`qwen-image-edit` 不支持此参数，API 会忽略它。无害但不够精确。

**解决**: 服务端加判断：如果是 `qwen-image-edit` 模型，不设置 `prompt_extend`。

### 47. 图片下载文件扩展名硬编码 `.png`

`storage.ts` 的 `downloadImage` 和 `getVideoSrc` 都硬编码 `.png`。DashScope 当前总是返回 PNG，但如果未来模型返回 JPEG/WebP，文件名和实际内容不匹配。

**解决**: `downloadImage` 从响应头或 URL 路径推断扩展名。短期的简单方案：保持 `.png`（浏览器 `<img>` 不关心扩展名）。

### 48. `Wan27I2vForm` 提交成功后重置了所有模式的状态

`handleSubmit` 的末尾（lines 193-200）无条件重置 `imageUrl`、`lastFrameUrl`、`drivingAudioUrl`、`firstClipUrl`。这意味着在「首帧生视频」模式下提交后，即使用户下次想用同样的图片，也需要重新上传。

**解决**: 这是合理的行为（提交后清空表单是标准 UX），不需要改。但可以考虑保留首帧图片（只清空 prompt）。

---

## ⚪ v3 内容保留 — 已确认无需改动

| 问题 | 验证结果 |
|------|----------|
| `getRefImages` 对非 JSON 字符串的处理 | ✅ `JSON.parse` 对纯 URL 字符串会抛异常，catch 正确回退 |
| `qwen-image-2.0-pro` 的 t2i/i2i 双用 | ✅ `edit` 变量正确判断是否包含图片，DB `inputImageUrl` 正确存 null |
| DB `model` 默认值 `happyhorse-1.0-t2v` | ✅ 所有代码路径都显式设置 model，默认值永远不会生效 |
| `Wan27I2vForm` 模式切换时数据泄漏 | ✅ `handleSubmit` 按分支赋值，不会泄漏其他模式的字段 |
