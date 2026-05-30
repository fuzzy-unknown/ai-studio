# TODO.md

> 项目代码审查 v3 — 代码合理性 & 完善性
>
> 前两轮已覆盖：P0 Bug（#1-6）、DRY 架构、命名、过度设计警示。
> 本轮聚焦：**逻辑是否自洽、数据流是否正确、功能是否完整、是否有漏掉的场景。**

---

## 🔴 本轮新发现 — 逻辑缺陷

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

## 🟠 功能完善性 — 缺失的功能

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

## 🟡 数据流合理性

### 40. 图片表单发送冗余的 `resolution: ''` 字段

`QwenImageEditForm.tsx:71` 对 limited 模型（`qwen-image-edit`）发送 `resolution: ''`。服务端的 `ImageGenerateBody` 不包含 `resolution` 字段，Elysia 会静默丢弃。但 `size: undefined` 不会被 JSON.stringify 出来，所以实际发送的是 `"resolution": ""` — 无害但不干净。

**解决**: 条件判断改为 `resolution: limited ? undefined : size`。`undefined` 值在 JSON.stringify 时会被省略。

### 41. `fetchTasks` 的注释具有误导性

`App.tsx:17` 注释说"使用 image 模块的统一端点获取所有任务"。但实际上 video 和 image 的 `getAllTasks()` 查的是同一张 `tasks` 表、同一条 SQL。没有哪个端点更"统一"。

**解决**: 改用任意一个端点（选 `/api/video/tasks` 更直觉），去掉降级逻辑和误导注释。或者更好的方案：在根级别新增 `GET /api/tasks` 路由。

### 42. `handleGenerate` 的内联参数类型与 `GenerateFormData` 不同步

`App.tsx:78` 的内联类型缺少 `firstClipUrl` 字段吗？不，已包含。但它和 `GenerateFormData` 是两个独立的类型定义，以后改一个忘改另一个就会出 bug。

**解决**: 直接 `import type { GenerateFormData }` 并用它。一行改动消除维护风险。

### 43. 视频服务对 `wan2.7` 的 `storedImageUrl` 混存了不同类型的 URL

`video/service.ts:230` 将 `[imageUrl, lastFrameUrl, drivingAudioUrl, firstClipUrl]` 全部 filter(Boolean) 后存为一个 JSON 数组。客户端需要用 `isAudioUrl`/`isVideoUrl` 正则来区分类型。如果 URL 本身恰好匹配这些正则（比如一个叫 `video.mp3` 的图片 URL），会误判。

**解决**: 实际上这个风险很低（图片 URL 不会以 `.mp3` 或 `.mp4` 结尾），而且当前的 `isAudioUrl` 检查的是 URL 路径后缀。**不需要改**，但如果未来出 bug 可以考虑存 `{ type, url }[]`。

### 44. `getUsageStats()` 在两个模块中都遍历全表

`video/service.ts:324` 和 `image/service.ts:346` 各自 `db.select().from(tasks).all()` 全量加载。如果两个都被调用（目前只有 video 的被调用），会有两次全表扫描。

**解决**: 合并为一个 `getUsageStats()` 函数，放在共享位置或 pricing 模块。用 SQL 聚合替代 JS 遍历：
```sql
SELECT COUNT(*) as task_count, SUM(cost) as total_cost FROM tasks WHERE status='SUCCEEDED' AND cost IS NOT NULL
```

---

## 🔵 边界情况 & 潜在问题

### 45. 乐观卡片的 `id: -1` 和 `requestId: null` 不在 `Task` 接口中

通过 `as Task` 强转绕过了类型检查。如果未来 `Task` 接口添加了 `id` 必填字段，这里会编译报错但语义不明。

**解决**: 要么在 `Task` 接口中声明 `id?: number`（因为服务端响应包含 id），要么从乐观对象中去掉多余字段。

### 46. `qwen-image-edit` 不支持 `prompt_extend` 但表单可能发送

`QwenImageEditForm` 在 `limited` 时设置 `promptExtend: undefined`，正确。但服务端 `callDashScopeSync` 在未设置时默认 `prompt_extend: true`（image/service.ts 第 112-113 行）。`qwen-image-edit` 不支持此参数，API 会忽略它。无害但不够精确。

**解决**: 服务端加判断：如果是 `qwen-image-edit` 模型，不设置 `prompt_extend`。

### 47. 图片下载文件扩展名硬编码 `.png`

`storage.ts` 的 `downloadImage` 和 `getVideoSrc` 都硬编码 `.png`。DashScope 当前总是返回 PNG，但如果未来模型返回 JPEG/WebP，文件名和实际内容不匹配。

**解决**: `downloadImage` 从响应头或 URL 路径推断扩展名。短期的简单方案：保持 `.png`（浏览器 `<img>` 不关心扩展名）。

### 48. `Wan27I2vForm` 提交成功后重置了所有模式的状态

`handleSubmit` 的末尾（lines 193-200）无条件重置 `imageUrl`、`lastFrameUrl`、`drivingAudioUrl`、`firstClipUrl`。这意味着在「首帧生视频」模式下提交后，即使用户下次想用同样的图片，也需要重新上传。

**解决**: 这是合理的行为（提交后清空表单是标准 UX），不需要改。但可以考虑保留首帧图片（只清空 prompt）。

---

## ⚪ 已知但本轮确认无需改动

以下问题在前两轮审查中已列出，本轮重新验证后确认代码是正确的：

| 问题 | 验证结果 |
|------|----------|
| `getRefImages` 对非 JSON 字符串的处理 | ✅ `JSON.parse` 对纯 URL 字符串会抛异常，catch 正确回退 |
| `qwen-image-2.0-pro` 的 t2i/i2i 双用 | ✅ `edit` 变量正确判断是否包含图片，DB `inputImageUrl` 正确存 null |
| DB `model` 默认值 `happyhorse-1.0-t2v` | ✅ 所有代码路径都显式设置 model，默认值永远不会生效 |
| `Wan27I2vForm` 模式切换时数据泄漏 | ✅ `handleSubmit` 按分支赋值，不会泄漏其他模式的字段 |
