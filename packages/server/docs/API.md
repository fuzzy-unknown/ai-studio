# AI Studio API 对接文档

> Base URL: `http://localhost:4000`
> OpenAPI 交互文档: `http://localhost:4000/openapi`
> OpenAPI JSON 规范: `http://localhost:4000/openapi/json`

---

## 目录

- [通用约定](#通用约定)
- [模型与任务状态](#模型与任务状态)
- [1. 模型列表](#1-模型列表)
- [2. 视频生成](#2-视频生成)
- [3. 图片生成](#3-图片生成)
- [4. 统一任务管理](#4-统一任务管理)
- [5. 用量统计](#5-用量统计)
- [6. 定价管理](#6-定价管理)
- [7. 文件访问](#7-文件访问)
- [8. SSE 事件流对接](#8-sse-事件流对接)

---

## 通用约定

### 请求格式

- `POST` / `PUT` 请求体为 `application/json`
- `GET` / `DELETE` 参数通过 query string 或路径参数传递
- 所有响应体为 `application/json`（SSE 端点除外）

### 错误响应

所有错误返回统一格式：

```typescript
interface ErrorResponse {
  error: string  // 错误描述
}
```

| HTTP 状态码 | 含义 |
|------------|------|
| 400 | 请求参数校验失败 |
| 404 | 资源不存在 |
| 500 | 服务端内部错误 |

### CORS

服务端已启用 CORS，允许跨域请求。

---

## 模型与任务状态

### 任务状态流转

```
PENDING → RUNNING → SUCCEEDED
                  → FAILED
         → CANCELED
         → UNKNOWN
```

- **终态**：`SUCCEEDED`、`FAILED`、`CANCELED`、`UNKNOWN` — 任务结束，不再变化
- **非终态**：`PENDING`、`RUNNING` — 可通过 SSE 实时监听变化

### 模型调用模式

| apiMode | 说明 | 返回时机 |
|---------|------|---------|
| `async` | 异步模型 | 立即返回 `task_id`，需通过 SSE/轮询获取结果 |
| `sync` | 同步模型 | 请求阻塞直到生成完成，返回时 `status` 已为 `SUCCEEDED` |

---

## 1. 模型列表

### GET `/api/models`

获取当前支持的所有模型及其分类、能力与默认参数。

**响应** `200`：

```typescript
interface ModelItem {
  id: string              // 模型 ID，调用 generate 时使用
  category: 'video' | 'image'
  subType: string         // 细分类型（见下表）
  label: string           // 中文标签
  apiMode: 'sync' | 'async'
  capabilities: {
    hasRatio: boolean      // 是否支持 ratio 参数
    hasDuration: boolean   // 是否支持 duration 参数
    hasInputVideo: boolean // 是否需要输入视频
  }
  defaults: {
    resolution?: string    // 默认分辨率
    ratio?: string | null  // 默认宽高比
    duration?: number | null  // 默认时长（秒）
  }
}

// 响应为数组
type Response = ModelItem[]
```

### subType 枚举值

| subType | label | category | 说明 |
|---------|-------|----------|------|
| `t2v` | 文生视频 | video | 纯文本生成视频 |
| `i2v` | 图生视频 | video | 输入首帧图片生成视频 |
| `r2v` | 参考生视频 | video | 输入 1-9 张参考图生成视频 |
| `edit` | 视频编辑 | video | 输入视频进行编辑 |
| `wan27-i2v` | 万相2.7 图生视频 | video | 万相2.7 图生视频（支持尾帧/续写/音频） |
| `t2i` | 文生图 | image | 纯文本生成图片 |
| `i2i` | 图生图 | image | 输入图片进行编辑生成 |

### 示例

```bash
curl http://localhost:4000/api/models
```

```json
[
  {
    "id": "happyhorse-1.0-t2v",
    "category": "video",
    "subType": "t2v",
    "label": "文生视频",
    "apiMode": "async",
    "capabilities": { "hasRatio": true, "hasDuration": true, "hasInputVideo": false },
    "defaults": { "resolution": "720P", "ratio": "16:9", "duration": 5 }
  }
  // ... 共 13 个模型
]
```

---

## 2. 视频生成

### POST `/api/video/generate`

创建视频生成任务。所有视频模型均为 `async`，提交后需通过 SSE 监听结果。

**请求体**：

```typescript
interface VideoGenerateBody {
  /** 生成提示词（必填，1-5000 字符） */
  prompt: string

  /** 模型 ID（可选，默认 happyhorse-1.0-t2v） */
  model?: string

  /** ---- 输入媒体 ---- */

  /** 输入图片 URL（i2v 模式必填） */
  imageUrl?: string

  /** 参考图片 URL 数组（r2v 模式，1-9 张） */
  imageUrls?: string[]

  /** 输入视频 URL（edit 模式必填） */
  videoUrl?: string

  /** ---- 输出控制 ---- */

  /** 分辨率："720P" | "1080P" */
  resolution?: "720P" | "1080P"

  /** 宽高比："16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "4:5" | "5:4" | "9:21" | "21:9" */
  ratio?: string

  /** 视频时长（秒），2-15 */
  duration?: number

  /** ---- 高级参数 ---- */

  /** 是否添加水印 */
  watermark?: boolean

  /** 音频设置："auto"（自动生成）| "origin"（保留原声） */
  audioSetting?: "auto" | "origin"

  /** 随机种子（0-2147483647），相同种子 + 参数可复现结果 */
  seed?: number

  /** 反向提示词（最长 500 字符） */
  negativePrompt?: string

  /** 是否启用 AI 提示词扩展 */
  promptExtend?: boolean

  /** ---- 万相2.7 专属参数 ---- */

  /** 尾帧图片 URL（wan27-i2v first_last_frame 模式） */
  lastFrameUrl?: string

  /** 驱动音频 URL（wan27-i2v 口型同步） */
  drivingAudioUrl?: string

  /** 首段视频 URL（wan27-i2v video_continuation 续写模式） */
  firstClipUrl?: string
}
```

**响应** `200`：

```typescript
interface GenerateResponse {
  task_id: string   // 任务 ID
  status: string    // 初始状态，通常为 "PENDING"
}
```

**错误** `400`：

```typescript
{ error: string }  // 参数校验失败
```

### 各模型必填参数速查

| 模型 | model | 必填参数 | 可选参数 |
|------|-------|---------|---------|
| 文生视频 | `happyhorse-1.0-t2v` | prompt | duration, ratio, resolution, seed, watermark |
| 图生视频 | `happyhorse-1.0-i2v` | prompt, imageUrl | duration, resolution, seed, watermark |
| 参考生视频 | `happyhorse-1.0-r2v` | prompt, imageUrls (1-9) | duration, ratio, resolution, seed, watermark |
| 视频编辑 | `happyhorse-1.0-video-edit` | prompt, videoUrl | imageUrls (0-5), resolution, seed, watermark |
| 万相2.7 图生视频 | `wan2.7-i2v-2026-04-25` | prompt, imageUrl 或 firstClipUrl | duration, lastFrameUrl, drivingAudioUrl, resolution, seed, watermark |

### 示例

```bash
# 文生视频
curl -X POST http://localhost:4000/api/video/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"一只猫在草地上奔跑","duration":5}'

# 图生视频
curl -X POST http://localhost:4000/api/video/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"让图片中的场景动起来","model":"happyhorse-1.0-i2v","imageUrl":"https://example.com/cat.jpg"}'
```

### GET `/api/video/tasks`

获取所有视频生成任务列表。

**响应** `200`：`TaskResponse[]`（见 [任务对象](#任务对象-taskresponse)）

### GET `/api/video/tasks/:taskId`

获取单个视频任务详情。

**路径参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| taskId | string | 任务 ID |

**响应** `200`：`TaskResponse`

**错误** `404`：`{ error: "Task not found" }`

### GET `/api/video/tasks/:taskId/events`

订阅视频任务的 SSE 事件流。详见 [SSE 对接](#8-sse-事件流对接)。

### GET `/api/video/usage/stats`

获取视频任务用量统计。

**响应** `200`：

```typescript
interface UsageStatsResponse {
  totalDuration: number  // 总时长（秒）
  totalCost: number      // 总费用（元）
  taskCount: number      // 任务总数
}
```

---

## 3. 图片生成

### POST `/api/image/generate`

创建图片生成任务。

- **同步模型**（`apiMode: "sync"`）：请求阻塞直到生成完成，返回时 `status` 为 `SUCCEEDED`，`task_id` 以 `sync-` 开头
- **异步模型**（`apiMode: "async"`）：立即返回 `task_id`，需通过 SSE 监听结果

**请求体**：

```typescript
interface ImageGenerateBody {
  /** 生成提示词（必填，1-1300 字符） */
  prompt: string

  /** 模型 ID（可选，默认 qwen-image-2.0-pro） */
  model?: string

  /** 图片尺寸，格式 "宽*高"，如 "2048*2048"、"1024*1024" */
  size?: string

  /** 反向提示词（最长 500 字符） */
  negativePrompt?: string

  /** 生成图片数量（1-6），异步模型仅支持 1 */
  n?: number

  /** 是否启用 AI 提示词扩展 */
  promptExtend?: boolean

  /** 是否添加水印 */
  watermark?: boolean

  /** 随机种子（0-2147483647） */
  seed?: number

  /** 输入图片 URL 数组（i2i 编辑模式，1-3 张） */
  imageUrls?: string[]
}
```

**响应** `200`：

```typescript
interface ImageGenerateResponse {
  task_id: string   // 同步模型: "sync-xxx"，异步模型: DashScope 任务 ID
  status: string    // 同步模型: "SUCCEEDED"，异步模型: "PENDING"
}
```

**错误** `400`：

```typescript
{ error: string }
```

### 各模型参数差异

| 模型 | apiMode | size 规则 | n 范围 | imageUrls |
|------|---------|----------|--------|-----------|
| `qwen-image-2.0-pro` | sync | 像素 512×512 ~ 2048×2048 | 1-6 | 可选（支持编辑） |
| `qwen-image-2.0` | sync | 像素 512×512 ~ 2048×2048 | 1-6 | 可选（支持编辑） |
| `qwen-image-max` | async | 固定预设值 | 1 | 不支持 |
| `qwen-image-plus` | async | 固定预设值 | 1 | 不支持 |
| `qwen-image` | async | 固定预设值 | 1 | 不支持 |
| `qwen-image-edit-max` | sync | 宽高均 512-2048 | 1-6 | 必填（1-3 张） |
| `qwen-image-edit-plus` | sync | 宽高均 512-2048 | 1-6 | 必填（1-3 张） |
| `qwen-image-edit` | sync | 不支持 | 1 | 必填（1-3 张） |

> **async 模型的 size 预设值**：`1664*928`、`1472*1104`、`1328*1328`、`1104*1472`、`928*1664`

### 示例

```bash
# 文生图（同步，阻塞返回）
curl -X POST http://localhost:4000/api/image/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"一只可爱的猫咪","model":"qwen-image-2.0-pro","size":"1024*1024"}'

# 图片编辑（同步）
curl -X POST http://localhost:4000/api/image/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"将背景改为海边","model":"qwen-image-edit-max","imageUrls":["https://example.com/cat.jpg"]}'
```

### GET `/api/image/tasks`

获取所有图片生成任务列表。

**响应** `200`：`ImageTaskResponse[]`（见 [任务对象](#任务对象-imagetaskresponse)）

### GET `/api/image/tasks/:taskId`

获取单个图片任务详情。

**路径参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| taskId | string | 任务 ID |

**响应** `200`：`ImageTaskResponse`

**错误** `404`：`{ error: "Task not found" }`

### GET `/api/image/tasks/:taskId/events`

订阅图片任务的 SSE 事件流。详见 [SSE 对接](#8-sse-事件流对接)。

### GET `/api/image/usage/stats`

获取图片任务用量统计。

**响应** `200`：

```typescript
interface ImageUsageStatsResponse {
  totalDuration: number  // 总时长（秒）
  totalCost: number      // 总费用（元）
  taskCount: number      // 任务总数
}
```

---

## 4. 统一任务管理

以下端点不区分视频/图片，操作所有任务。

### GET `/api/tasks`

分页查询任务列表，支持按类型筛选。

**Query 参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| limit | string | 否 | 每页数量，默认 50 |
| offset | string | 否 | 偏移量，默认 0 |
| type | string | 否 | 筛选类型：`video` / `image` / `all`（默认 all） |

**响应** `200`：`TaskResponse[]`

### GET `/api/tasks/:taskId`

获取单个任务详情（不区分视频/图片）。

**响应** `200`：`TaskResponse`

**错误** `404`：`{ error: "Task not found" }`

### DELETE `/api/tasks/:taskId`

删除任务及其本地文件。

**响应** `200`：

```typescript
{ success: true }
```

**错误** `404`：`{ error: "Task not found" }`

### POST `/api/tasks/:taskId/cancel`

取消进行中的任务。仅非终态（`PENDING` / `RUNNING`）可取消。

**响应** `200`：`TaskResponse`（取消后的任务对象）

**错误** `400`：`{ error: "Task not found or already in terminal state" }`

---

## 5. 用量统计

### GET `/api/usage/stats`

获取所有任务（视频 + 图片）的汇总统计。

**响应** `200`：

```typescript
interface UsageStatsResponse {
  totalDuration: number  // 总时长（秒）
  totalCost: number      // 总费用（元）
  taskCount: number      // 任务总数
}
```

> 也可通过 `GET /api/video/usage/stats` 或 `GET /api/image/usage/stats` 分别获取各模块统计。

---

## 6. 定价管理

### GET `/api/pricing`

获取所有定价配置。

**响应** `200`：

```typescript
interface PricingResponse {
  id: number
  model: string         // 模型 ID
  resolution: string    // 分辨率
  officialPrice: number // 官方单价（元/秒 或 元/张）
  markup: number        // 加价倍率（≥ 1.0）
  actualPrice: number   // 实际价格 = officialPrice × markup
  createdAt: string | null
  updatedAt: string | null
}

type Response = PricingResponse[]
```

### GET `/api/pricing/:id`

按 ID 获取单条定价。

**路径参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| id | number | 定价记录 ID |

**响应** `200`：`PricingResponse`

**错误** `404`：`{ error: "Pricing not found" }`

### POST `/api/pricing`

新增或更新定价（按 `model + resolution` 组合 upsert）。

**请求体**：

```typescript
interface UpsertPricingBody {
  model: string          // 模型 ID（必填）
  resolution: string     // 分辨率（必填）
  officialPrice: number  // 官方单价，≥ 0（必填）
  markup: number         // 加价倍率，≥ 1（必填）
}
```

**响应** `200`（更新）或 `201`（新增）：`PricingResponse`

### POST `/api/pricing/batch`

批量 upsert 定价。

**请求体**：`UpsertPricingBody[]`

**响应** `200`：`PricingResponse[]`

### PUT `/api/pricing/:id`

按 ID 更新定价（部分更新）。

**路径参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| id | number | 定价记录 ID |

**请求体**：

```typescript
interface UpdatePricingBody {
  officialPrice?: number  // 官方单价，≥ 0
  markup?: number         // 加价倍率，≥ 1
}
```

**响应** `200`：`PricingResponse`

**错误** `404`：`{ error: "Pricing not found" }`

### DELETE `/api/pricing/:id`

按 ID 删除定价。

**响应** `200`：

```typescript
{ success: true }
```

**错误** `404`：`{ error: "Pricing not found" }`

---

## 7. 文件访问

视频和图片生成完成后，文件保存在服务端本地，通过以下端点访问。

### GET `/api/video/files/:filename`

获取视频文件。

### GET `/api/image/files/:filename`

获取图片文件。

**路径参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| filename | string | 文件名，来自任务详情的 `localPath` 字段 |

**响应** `200`：二进制文件（`video/mp4` 或 `image/jpeg` / `image/webp` / `image/png`）

**错误** `404`：`{ error: "File not found" }`

### 文件 URL 构建方式

```typescript
// 前端根据模型类型选择端点
function getFileUrl(task: TaskResponse): string | null {
  const filename = extractFilename(task.localPath)
  if (!filename) return null

  const isImage = task.model?.startsWith('qwen-image')
  return isImage
    ? `/api/image/files/${filename}`
    : `/api/video/files/${filename}`
}
```

---

## 8. SSE 事件流对接

SSE 端点用于实时监听任务状态变化，推荐使用 `EventSource` API。

### 端点

| 端点 | 适用场景 |
|------|---------|
| `GET /api/tasks/:taskId/events` | 统一端点（推荐） |
| `GET /api/video/tasks/:taskId/events` | 视频任务专用 |
| `GET /api/image/tasks/:taskId/events` | 图片任务专用 |

### 前端对接示例

```typescript
function watchTask(taskId: string, onUpdate: (data: SSEEvent) => void): EventSource {
  const es = new EventSource(`/api/tasks/${taskId}/events`)

  es.onmessage = (event) => {
    const data: SSEEvent = JSON.parse(event.data)

    if (data.status === 'DONE') {
      es.close()
      return
    }

    onUpdate(data)

    // 终态自动关闭
    if (['SUCCEEDED', 'FAILED', 'CANCELED', 'UNKNOWN'].includes(data.status)) {
      es.close()
    }
  }

  es.onerror = () => {
    es.close()
  }

  return es
}
```

### 事件数据格式

```typescript
interface SSEEvent {
  status: string       // 任务状态
  video_url: string | null  // 结果媒体 URL（成功时返回）
  error: string | null      // 错误信息（失败时返回）
}
```

### SSE 行为说明

- 每 2 秒轮询数据库检测状态变化
- 仅在状态变化时推送事件
- 任务进入终态后推送最终事件并关闭连接
- 最长连接时间约 10 分钟（300 次轮询）
- 超时后发送 `{ status: 'DONE' }` 关闭连接

---

## 附录

### 任务对象 TaskResponse

视频和图片任务共用同一数据结构：

```typescript
interface TaskResponse {
  id: number
  taskId: string
  model: string | null
  prompt: string
  status: string
  resolution: string | null
  ratio: string | null
  duration: number | null
  inputVideoUrl: string | null
  inputImageUrl: string | null   // JSON 格式: [{ type, url }]
  usage: string | null           // JSON 格式
  cost: number | null
  videoUrl: string | null        // 可能是 JSON 数组（多图结果）
  localPath: string | null       // 可能是 JSON 数组（多图结果）
  errorMessage: string | null
  size: string | null            // 图片模型专用
  negativePrompt: string | null
  n: number | null               // 图片数量
  promptExtend: number | null    // 1 = 启用
  createdAt: string | null
  updatedAt: string | null
}
```

### 任务对象 ImageTaskResponse

与 `TaskResponse` 字段完全一致，类型定义独立维护。

### videoUrl / localPath 的 JSON 数组格式

当图片模型生成多张图片时，这两个字段存储 JSON 数组：

```json
// 单结果
"videoUrl": "https://dashscope-result.com/image1.jpg"

// 多结果
"videoUrl": "[\"https://dashscope-result.com/image1.jpg\",\"https://dashscope-result.com/image2.jpg\"]"
```

前端解析建议：

```typescript
function parseMediaUrls(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : [raw]
  } catch {
    return [raw]
  }
}
```

### inputImageUrl 的 JSON 格式

```typescript
// 图生视频
[{ "type": "first_frame", "url": "https://..." }]

// 参考生视频
[{ "type": "reference_image", "url": "https://..." }, ...]

// 万相2.7
[{ "type": "first_frame", "url": "..." }, { "type": "last_frame", "url": "..." }]

// 图片编辑
[{ "type": "input_image", "url": "..." }]
```

### 前端路由分发

统一任务端点和模块端点都可以使用，推荐使用统一端点：

```typescript
// 推荐：统一端点
const BASE = '/api'

// 也可使用模块端点（功能等价）
const VIDEO_BASE = '/api/video'
const IMAGE_BASE = '/api/image'

// 根据 model 前缀选择 generate 端点
function getGenerateEndpoint(model: string): string {
  return model.startsWith('qwen-image')
    ? '/api/image/generate'
    : '/api/video/generate'
}
```

### 完整对接流程

```
1. GET  /api/models                    → 获取模型列表，展示给用户选择
2. POST /api/video/generate            → 用户提交生成请求
       或 /api/image/generate
3. GET  /api/tasks/:taskId/events      → 建立 SSE 连接，实时监听进度
4. （SSE 推送 SUCCEEDED）               → 生成完成
5. GET  /api/video/files/:filename     → 获取结果文件
       或 /api/image/files/:filename
```
