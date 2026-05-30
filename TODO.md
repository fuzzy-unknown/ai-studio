# TODO — 文档与代码差异修复清单

> 对比 `docs/` API 文档与项目实际代码发现的差异，按优先级排列。
> 以下所有项目已修复完成 ✅

## 🔴 高优先级

### 1. ~~t2v 默认分辨率与文档不符~~ — 跳过（用户确认不改）

### 2. ✅ `watermark` 参数仅对 video-edit 生效

- **文件**: `packages/server/src/modules/video/service.ts`、`packages/client/src/components/GenerateForm.tsx`
- **修复**: 将 `watermark` 参数的发送逻辑移到所有模型公共分支；客户端高级选项对所有模型显示

### 3. ✅ `seed` 参数仅对 video-edit 生效

- **文件**: `packages/server/src/modules/video/service.ts`、`packages/client/src/components/GenerateForm.tsx`
- **修复**: 将 `seed` 参数的发送逻辑移到所有模型公共分支；客户端高级选项对所有模型显示

### 4. ✅ `imageUrls` 数组缺少长度上限校验 + 模型必填字段返回 500

- **文件**: `packages/server/src/modules/video/index.ts`（路由层 `beforeHandle` 守卫）
- **修复**: r2v: 1-9 → 400，video-edit: 0-5 → 400；i2v 缺 imageUrl / r2v 缺 imageUrls / video-edit 缺 videoUrl 均返回 400

## 🟡 中优先级

### 5. ✅ 费用计算统一到后端

- **文件**: `packages/server/src/db/schema.ts`、`packages/server/src/modules/video/service.ts`、`packages/client/src/components/TaskCard.tsx`
- **修复**: DB 新增 `cost` 列，`updateTaskStatus` 存储计算后的费用，`getUsageStats` 使用存储值；客户端移除重复的定价逻辑，直接使用 `task.cost`

### 6. ✅ 客户端 `Task` 类型缺少 `updatedAt` 字段

- **文件**: `packages/client/src/types/index.ts`
- **修复**: 添加 `updatedAt: string | null` 和 `cost: number | null`

## 🟢 低优先级

### 7. ✅ `plugins/error.ts` 重构

- **文件**: `packages/server/src/plugins/error.ts`、`packages/server/src/index.ts`
- **修复**: 基于内联 handler 重写插件（Pino logger + 可选链），主入口使用 `errorPlugin` 替代内联 `onError`

### 8. ✅ 测试完善

- **文件**: `packages/server/tests/video.test.ts`
- **修复**: 同步生产 schema（添加 model、input_video_url、input_image_url、usage、cost 列）；新增 20 个测试用例覆盖模型必填字段、imageUrls 数量限制、seed/duration/audioSetting 边界值
