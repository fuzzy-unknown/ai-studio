# TODO.md

> 项目代码审查修复清单。当前已完成原 v3/v4/v5 中列出的功能与架构问题；保留下方"后续观察项"作为低优先级维护提醒。

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
| #39: 无分页/加载更多 | ✅ 已修复 | `/api/tasks` 支持 `limit`/`offset`/`type`，前端增加"加载更多" |
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

---

## 🚀 API 中转平台功能规划

> 将项目从"单用户生成工具"升级为"多用户 API 中转平台"。按阶段和优先级排列。

---

### ⚡ MVP 最小可行版本（当前要做）

> 只做 4 件事：用户能注册、能拿到 API Token 调用、任务归属到用户、用完扣钱。

| # | 功能 | 为什么必须 |
|---|------|-----------|
| 1 | 用户注册/登录 | 没有用户就无法归属任务和计费 |
| 2 | API Token | 用户是编程调用你的 API，不是用前端，需要 `Bearer sk-ai-xxx` 鉴权 |
| 3 | 任务绑定 userId | 隔离数据、统计用量、扣费 |
| 4 | 余额 + 完成后扣费 | 你是加价转售，必须能收钱、能欠费拒绝 |

**简化策略（降低复杂度）：**
- ~~预扣费~~ → 任务完成后直接扣实际费用，余额为负时下次提交拒绝（402）
- ~~Token scope 权限~~ → Token 全权限，不做细分
- ~~Admin 后台~~ → 初期手动用 SQL 改余额即可
- ~~前端改动~~ → 前端继续免登录使用，API Token 只给编程调用
- ~~密码修改/资料更新~~ → MVP 先不做，只做注册+登录

**MVP 涉及的数据库改动：**

```
新增表 users:
├── id            TEXT PRIMARY KEY (UUID)
├── email         TEXT UNIQUE NOT NULL
├── passwordHash  TEXT NOT NULL
├── role          TEXT DEFAULT 'user'  -- 'admin' | 'user'
├── balance       REAL DEFAULT 0
├── createdAt     TEXT
└── updatedAt     TEXT

新增表 api_tokens:
├── id            TEXT PRIMARY KEY (UUID)
├── userId        TEXT NOT NULL REFERENCES users(id)
├── name          TEXT
├── tokenHash     TEXT NOT NULL -- SHA-256(token 明文)
├── prefix        TEXT -- 前8位展示用，如 "sk-ai-xxxx"
├── status        TEXT DEFAULT 'active'
├── lastUsedAt    TEXT
└── createdAt     TEXT

新增表 transactions:
├── id            TEXT PRIMARY KEY (UUID)
├── userId        TEXT NOT NULL REFERENCES users(id)
├── type          TEXT NOT NULL -- 'topup' | 'consume'
├── amount        REAL NOT NULL -- 负数为消费
├── balanceAfter  REAL NOT NULL
├── taskId        TEXT REFERENCES tasks(id)
├── description   TEXT
└── createdAt     TEXT

tasks 表新增列: userId TEXT REFERENCES users(id)
```

**MVP 涉及的 API 端点：**

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| `POST` | `/api/auth/register` | 注册（email + password） | 无 |
| `POST` | `/api/auth/login` | 登录，返回 JWT | 无 |
| `POST` | `/api/tokens` | 创建 API Token（仅返回一次明文） | JWT |
| `GET` | `/api/tokens` | 列出我的 Token | JWT |
| `DELETE` | `/api/tokens/:id` | 吊销 Token | JWT |
| `GET` | `/api/billing/balance` | 查询余额 | JWT 或 Token |
| `GET` | `/api/billing/transactions` | 交易记录 | JWT 或 Token |
| 所有现有生成/任务接口 | — | 增加鉴权 + 绑定 userId + 余额检查 | JWT 或 Token |

**MVP 鉴权策略：**
- 前端请求：`Authorization: Bearer <jwt>` → 解析 JWT 获取 userId
- 编程调用：`Authorization: Bearer sk-ai-xxx` → 查 api_tokens 表获取 userId
- 通过前缀区分两者（`sk-ai-` 开头走 Token 查询，否则走 JWT）
- 前端 Web UI 暂时走**无鉴权旁路**（保持现有功能不受影响），后续再统一

**MVP 计费流程：**
```
1. 用户提交任务 → 检查余额 ≥ 0（非负即可提交）
2. 提交到 DashScope，任务正常运行
3. 任务完成 → 计算实际费用（actualPrice × markup）
4. 扣费：UPDATE users SET balance = balance - cost WHERE id = userId
5. 记录 transaction(type='consume', amount=-cost)
6. 下次提交时若 balance < 0 → 返回 402 Payment Required
```

**MVP 代码改动文件清单：**

| 文件 | 改动 |
|------|------|
| `packages/server/src/db/schema.ts` | 新增 users、api_tokens、transactions 表定义 |
| `packages/server/src/db/index.ts` | 迁移逻辑 + 创建默认 admin 用户 |
| 新增 `packages/server/src/modules/auth/` | 注册、登录、鉴权中间件 |
| 新增 `packages/server/src/modules/token/` | Token CRUD |
| 新增 `packages/server/src/modules/billing/` | 余额查询、交易记录 |
| `packages/server/src/modules/task/shared.ts` | 查询增加 userId 过滤 |
| `packages/server/src/modules/task/index.ts` | 路由加鉴权、传 userId |
| `packages/server/src/modules/video/service.ts` | createTask 写入 userId，完成后触发扣费 |
| `packages/server/src/modules/image/service.ts` | createTask 写入 userId，完成后触发扣费 |
| `packages/server/src/modules/task/sse.ts` | SSE 按 userId 过滤 |
| `packages/server/src/index.ts` | 注册新模块插件 |

---

### 阶段一完整版（P0 — MVP 之后的增强）

#### 1. 用户注册 & 登录

**数据库新增表 `users`：**

```
users
├── id            TEXT PRIMARY KEY (UUID)
├── email         TEXT UNIQUE NOT NULL
├── passwordHash  TEXT NOT NULL (bcrypt)
├── name          TEXT
├── role          TEXT DEFAULT 'user'  -- 'admin' | 'user'
├── status        TEXT DEFAULT 'active' -- 'active' | 'disabled'
├── balance       REAL DEFAULT 0       -- 账户余额（元）
├── createdAt     TEXT
└── updatedAt     TEXT
```

**API 端点：**

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/auth/register` | 用户注册（email + password） |
| `POST` | `/api/auth/login` | 登录，返回 JWT |
| `GET` | `/api/auth/me` | 获取当前用户信息 |
| `PUT` | `/api/auth/me` | 更新用户资料 |
| `PUT` | `/api/auth/password` | 修改密码 |

**实现要点：**
- 密码使用 `bcrypt` 哈希存储（Bun 内置 `Bun.password.hash/verify`）
- JWT Token 签发（`jsonwebtoken` 或 Bun 原生 crypto），payload 含 `{ userId, role }`
- 鉴权中间件：从 `Authorization: Bearer <token>` 解析用户身份，注入到 Elysia 的 `store`/`derive`
- Admin 角色可查看所有用户、管理余额、禁用账户

---

#### 2. API Token 管理（编程式访问）

**数据库新增表 `api_tokens`：**

```
api_tokens
├── id            TEXT PRIMARY KEY (UUID)
├── userId        TEXT NOT NULL REFERENCES users(id)
├── name          TEXT -- 用户自定义 token 名称，如"生产环境"
├── tokenHash     TEXT NOT NULL -- SHA-256(token 明文)，只存哈希
├── prefix        TEXT -- token 前8位用于展示，如 "sk-ai-xxxx"
├── scope         TEXT DEFAULT 'all' -- 'all' | 'video' | 'image'
├── status        TEXT DEFAULT 'active' -- 'active' | 'revoked'
├── lastUsedAt    TEXT
├── expiresAt     TEXT -- 可选过期时间
├── createdAt     TEXT
└── updatedAt     TEXT
```

**API 端点：**

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/tokens` | 创建 Token（仅返回一次明文） |
| `GET` | `/api/tokens` | 列出当前用户所有 Token |
| `DELETE` | `/api/tokens/:id` | 吊销 Token |

**实现要点：**
- Token 格式：`sk-ai-{32位随机hex}`
- 创建时只返回明文一次，数据库只存 `SHA-256` 哈希
- 鉴权中间件同时支持 JWT（前端）和 API Token（编程调用），通过前缀区分
- Token 鉴权：`Authorization: Bearer sk-ai-...` → 查 `api_tokens` 表匹配 → 更新 `lastUsedAt`
- scope 校验：调用视频接口时检查 scope 包含 `video`，图片同理

---

#### 3. 多租户数据隔离

**数据库改动：**

- `tasks` 表新增 `userId TEXT NOT NULL REFERENCES users(id)` 列
- 迁移：已有任务归属到默认 admin 用户

**代码改动范围：**

| 文件 | 改动 |
|------|------|
| `packages/server/src/db/schema.ts` | `tasks` 表增加 `userId` |
| `packages/server/src/db/index.ts` | 迁移逻辑：`ALTER TABLE tasks ADD COLUMN userId` |
| `packages/server/src/modules/task/shared.ts` | 所有查询函数增加 `userId` 过滤 |
| `packages/server/src/modules/task/index.ts` | 路由中从鉴权中间件获取 `userId` 传给服务层 |
| `packages/server/src/modules/video/service.ts` | `createTask` 写入 `userId` |
| `packages/server/src/modules/image/service.ts` | `createTask` 写入 `userId` |
| `packages/server/src/modules/task/sse.ts` | SSE 连接只推送该用户的任务事件 |
| `packages/server/src/modules/pricing/index.ts` | Pricing 端点保持全局（不限用户） |

**原则：**
- 用户只能看到/操作自己的任务
- Admin 可以看到所有任务（通过 query 参数 `?userId=all`）
- 统计接口按 `userId` 分组

---

#### 4. 计费 & 余额系统

**数据库新增表 `transactions`：**

```
transactions
├── id            TEXT PRIMARY KEY (UUID)
├── userId        TEXT NOT NULL REFERENCES users(id)
├── type          TEXT NOT NULL -- 'topup' | 'consume' | 'refund' | 'admin_adjust'
├── amount        REAL NOT NULL -- 正数为充值/退款，负数为消费
├── balanceAfter  REAL NOT NULL -- 操作后余额
├── taskId        TEXT REFERENCES tasks(id) -- 关联任务（消费/退款时）
├── description   TEXT -- 备注说明
├── operatorId    TEXT -- 操作人（admin_adjust 时记录管理员 ID）
├── createdAt     TEXT
```

**计费流程：**

```
用户提交任务
  ↓
1. 预估费用 = 预估成本（按模型默认参数计算）
2. 检查余额 ≥ 预估费用 → 不足则拒绝（402 Payment Required）
3. 预扣费 → 扣除预估费用，记录 transaction(type='consume')
4. 提交到 DashScope
5. 任务完成后：
   a. 计算实际费用 = 实际参数 × 单价 × 加价率
   b. 差额退补 → 若实际 < 预估，退还差额(transaction type='refund')
                 若实际 > 预估，补扣差额(transaction type='consume')
6. 更新 task.cost = 实际费用
```

**API 端点：**

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/billing/balance` | 查询当前余额 |
| `GET` | `/api/billing/transactions` | 交易记录（分页） |
| `POST` | `/api/admin/users/:userId/balance` | 管理员调整余额 |
| `GET` | `/api/admin/users` | 管理员查看所有用户及余额 |
| `POST` | `/api/tasks/estimate` | 任务提交前费用预估 |

**实现要点：**
- 预估逻辑复用 `pricing/service.ts` 的 `calculateCost` / `calculateImageCost`，用默认参数或用户传入参数
- 使用 SQLite 事务确保余额扣减和 transaction 记录的原子性
- 同步图片模型（2.0 系列）是阻塞调用，可以在返回结果后直接计算实际费用，无需预扣/退补
- 异步模型（视频、max/plus）需要预扣费 → 完成后退补
- Admin 充值接口记录 `operatorId`

---

### 阶段二：平台可用性 & 安全（P1）

#### 5. 额度管控 & 限速

**数据库新增表 `user_quotas`：**

```
user_quotas
├── userId        TEXT PRIMARY KEY REFERENCES users(id)
├── dailyLimit    INTEGER -- 每日任务上限（NULL = 不限）
├── monthlyLimit  INTEGER -- 每月任务上限（NULL = 不限）
├── maxConcurrent INTEGER -- 最大并发任务数（NULL = 不限）
├── rateLimit     INTEGER -- 每分钟请求数上限（NULL = 不限）
├── maxDuration   INTEGER -- 单次视频最大时长秒数（NULL = 不限）
├── maxImages     INTEGER -- 单次图片最大张数（NULL = 不限）
└── updatedAt     TEXT
```

**限速方案：**
- 使用内存计数器（Map<userId, {count, resetAt}>），每分钟窗口重置
- 并发任务数：查询 `tasks` 表 `WHERE userId = ? AND status IN ('PENDING','RUNNING')`
- 日/月用量：查询 `tasks` 表按 `createdAt` 范围统计
- 所有检查在任务提交前执行，任一超限返回 `429 Too Many Requests`

**API 端点：**

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/quotas` | 用户查看自己的额度 |
| `GET` | `/api/quotas/usage` | 当前周期已用额度 |
| `PUT` | `/api/admin/users/:userId/quotas` | 管理员设置用户额度 |

---

#### 6. Webhook 回调

**数据库新增表 `webhooks`：**

```
webhooks
├── id            TEXT PRIMARY KEY (UUID)
├── userId        TEXT NOT NULL REFERENCES users(id)
├── url           TEXT NOT NULL -- 回调 URL
├── secret        TEXT NOT NULL -- HMAC 签名密钥
├── events        TEXT NOT NULL -- JSON 数组: ['task.completed','task.failed']
├── status        TEXT DEFAULT 'active' -- 'active' | 'disabled'
├── lastTriggeredAt TEXT
├── failureCount  INTEGER DEFAULT 0
├── createdAt     TEXT
└── updatedAt     TEXT
```

**回调逻辑：**
- 任务到达终态（SUCCEEDED / FAILED / CANCELED）时触发
- POST 请求体：`{ event, task: { id, model, status, cost, videoUrl, localPath, ... } }`
- 请求头：`X-Webhook-Signature: sha256={HMAC-SHA256(body, secret)}`
- 失败重试：3次，间隔 1min / 5min / 15min（指数退避）
- 连续失败 5 次自动禁用 webhook

**API 端点：**

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/webhooks` | 注册 Webhook |
| `GET` | `/api/webhooks` | 列出 Webhook |
| `PUT` | `/api/webhooks/:id` | 更新 Webhook |
| `DELETE` | `/api/webhooks/:id` | 删除 Webhook |
| `POST` | `/api/webhooks/:id/test` | 测试发送 |

---

#### 7. 丰富用量统计

**新增统计 API：**

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/usage/stats` | 扩展：支持 `?groupBy=model\|day\|week\|month` |
| `GET` | `/api/usage/trend` | 时序数据（最近 7/30 天每日用量） |
| `GET` | `/api/usage/by-model` | 按模型统计调用量和费用 |
| `GET` | `/api/admin/usage/stats` | 全平台统计（Admin） |
| `GET` | `/api/admin/usage/by-user` | 按用户统计（Admin） |

**返回格式扩展：**
```typescript
interface UsageStats {
  totalCost: number
  totalTasks: number
  totalDuration: number
  byModel: Record<string, { count: number; cost: number; duration: number }>
  byDay: Array<{ date: string; count: number; cost: number }>
  period: { from: string; to: string }
}
```

**前端对应改动：**
- 新增"用量统计"页面/面板
- 图表展示趋势（可用轻量图表库如 `lightweight-charts` 或纯 CSS 柱状图）

---

### 阶段三：平台竞争力（P2）

#### 8. OpenAI 兼容 API 层

**目标：** 让已支持 OpenAI 接口的工具可以直接通过本平台调用。

**兼容端点：**

| OpenAI 格式 | 映射到 |
|-------------|--------|
| `POST /v1/images/generations` | → qwen-image 模型生成 |
| `GET /v1/images/:id` | → 查询任务状态 |
| `POST /v1/images/variations` | → qwen-image-edit 图像编辑 |
| `GET /v1/models` | → 返回平台支持的模型列表 |

**请求格式适配：**
```json
// OpenAI 格式请求
POST /v1/images/generations
{
  "model": "dall-e-3",           // 映射到 qwen-image-2.0-pro
  "prompt": "一只猫",
  "n": 1,
  "size": "1024x1024"
}

// 内部转换后调用
→ POST /api/image/generate
  { model: "qwen-image-2.0-pro", prompt: "一只猫", size: "1024*1024", n: 1 }
```

**模型映射表（可配置）：**
```typescript
const OPENAI_MODEL_MAP = {
  'dall-e-3': 'qwen-image-2.0-pro',
  'dall-e-2': 'qwen-image-2.0',
  'stable-diffusion': 'qwen-image-plus',
}
```

---

#### 9. 多上游供应商

**架构设计：**

```
用户请求 → 路由层 → 供应商适配器
                    ├── DashScopeAdapter (现有)
                    ├── ReplicateAdapter (新增)
                    └── StabilityAIAdapter (新增)
```

**数据库新增表 `providers`：**

```
providers
├── id            TEXT PRIMARY KEY
├── name          TEXT -- 'dashscope' | 'replicate' | 'stability'
├── apiBaseUrl    TEXT
├── apiKey        TEXT -- 加密存储
├── status        TEXT DEFAULT 'active'
├── priority      INTEGER -- 路由优先级（越小越优先）
├── config        TEXT -- JSON，供应商特有配置
└── updatedAt     TEXT
```

**路由策略：**
- 优先级路由：按 `priority` 排序选可用供应商
- 成本路由：自动选最便宜的
- 故障转移：主供应商失败自动切到备用

---

#### 10. 批量操作

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/tasks/batch` | 批量提交（最多 10 个） |
| `POST` | `/api/tasks/batch/status` | 批量查询状态 |
| `POST` | `/api/tasks/batch/cancel` | 批量取消 |

---

#### 11. 审计日志

**数据库新增表 `audit_logs`：**

```
audit_logs
├── id            TEXT PRIMARY KEY (UUID)
├── userId        TEXT
├── action        TEXT -- 'task.create' | 'task.cancel' | 'token.create' | 'user.login' ...
├── resource      TEXT -- 资源类型: 'task' | 'token' | 'user' | 'webhook'
├── resourceId    TEXT -- 资源 ID
├── detail        TEXT -- JSON 详情
├── ip            TEXT
├── userAgent     TEXT
└── createdAt     TEXT
```

- 所有敏感操作自动记录（登录、创建/吊销 Token、提交/取消任务、余额变动）
- Admin 可查询审计日志
- 定期清理（保留 90 天）

---

### 数据库新增表汇总

按阶段需要新增的数据库表：

| 阶段 | 表名 | 用途 |
|------|------|------|
| 一 | `users` | 用户账号 |
| 一 | `api_tokens` | API Token |
| 一 | `transactions` | 交易记录 |
| 二 | `user_quotas` | 用户额度 |
| 二 | `webhooks` | Webhook 回调 |
| 三 | `providers` | 多供应商 |
| 三 | `audit_logs` | 审计日志 |

`tasks` 表需要新增 `userId` 列实现多租户隔离。

---

## 验证

- `bun run --cwd packages/server test` ✅ 53 pass
- `bun run lint` ✅
- `bunx tsc -p packages/server/tsconfig.json --noEmit` ✅
- `bun run build` ✅
