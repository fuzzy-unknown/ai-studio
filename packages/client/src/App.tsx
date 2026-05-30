import type { Task, UsageStats } from './types'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { GenerateForm } from './components/GenerateForm'
import { TaskList } from './components/TaskList'
import { useTaskWatcher } from './hooks/useTaskWatcher'

const IN_PROGRESS = new Set(['PENDING', 'RUNNING'])

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [taskFilter, setTaskFilter] = useState<'all' | 'video' | 'image'>('all')

  const fetchTasks = useCallback(async () => {
    try {
      // 使用 image 模块的统一端点获取所有任务（视频 + 图片混合展示）
      const res = await fetch('/api/image/tasks')
      if (res.ok) {
        setTasks(await res.json() as Task[])
        return
      }
      // 降级到 video 端点
      const fallback = await fetch('/api/video/tasks')
      setTasks(await fallback.json() as Task[])
    }
    catch {}
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/video/usage/stats')
      setStats(await res.json() as UsageStats)
    }
    catch {}
  }, [])

  useEffect(() => {
    fetchTasks()
    fetchStats()
  }, [fetchTasks, fetchStats])

  const watchingIds = useMemo(
    () => tasks.filter(t => IN_PROGRESS.has(t.status)).map(t => t.taskId),
    [tasks],
  )

  // 构建 taskId → model 映射，供 SSE 选择正确端点
  const taskModels = useMemo(
    () => new Map(tasks.map(t => [t.taskId, t.model ?? ''])),
    [tasks],
  )

  // 按 tab 筛选任务
  const filteredTasks = useMemo(() => {
    if (taskFilter === 'all')
      return tasks
    return tasks.filter(t =>
      taskFilter === 'image'
        ? t.model?.startsWith('qwen-image')
        : !t.model?.startsWith('qwen-image'),
    )
  }, [tasks, taskFilter])

  useTaskWatcher(watchingIds, useCallback((taskId: string, event: any) => {
    setTasks(prev => prev.map(t =>
      t.taskId === taskId
        ? { ...t, status: event.status, videoUrl: event.video_url ?? t.videoUrl, errorMessage: event.error ?? t.errorMessage }
        : t,
    ))
    if (['SUCCEEDED', 'FAILED', 'UNKNOWN'].includes(event.status)) {
      fetchTasks()
      fetchStats()
    }
  }, [fetchTasks, fetchStats]), taskModels)

  const handleGenerate = async (data: { prompt: string, model: string, imageUrl?: string, imageUrls?: string[], videoUrl?: string, resolution: string, ratio?: string, duration?: number, watermark?: boolean, audioSetting?: string, seed?: number, size?: string, negativePrompt?: string, n?: number, promptExtend?: boolean, lastFrameUrl?: string, drivingAudioUrl?: string, firstClipUrl?: string }) => {
    setLoading(true)

    // 立即在列表顶部插入一个临时任务卡片，给用户即时反馈
    const optimisticId = `temp-${Date.now()}`
    const isImageModel = data.model.startsWith('qwen-image')
    setTasks(prev => [{
      id: -1,
      taskId: optimisticId,
      model: data.model,
      prompt: data.prompt,
      status: 'PENDING',
      resolution: data.resolution || null,
      ratio: data.ratio || null,
      duration: data.duration || null,
      inputVideoUrl: data.videoUrl || null,
      inputImageUrl: data.imageUrl || (data.imageUrls ? JSON.stringify(data.imageUrls) : null),
      videoUrl: null,
      localPath: null,
      usage: null,
      cost: null,
      errorMessage: null,
      createdAt: new Date().toLocaleString(),
      updatedAt: null,
      size: data.size || null,
      negativePrompt: data.negativePrompt || null,
      n: data.n || null,
      promptExtend: data.promptExtend ? 1 : 0,
      requestId: null,
    } as Task, ...prev])

    try {
      const endpoint = isImageModel ? '/api/image/generate' : '/api/video/generate'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      // 移除临时卡片，刷新真实数据
      setTasks(prev => prev.filter(t => t.taskId !== optimisticId))
      if (result.task_id) {
        await fetchTasks()
        fetchStats()
      }
    }
    catch {
      // 请求失败也移除临时卡片
      setTasks(prev => prev.filter(t => t.taskId !== optimisticId))
    }
    finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>AI Studio</h1>
        <div className="app-header-row">
          <p>AI 视频 & 图片生成</p>
          {stats && stats.taskCount > 0 && (
            <span className="app-stats">
              已生成
              {' '}
              {stats.taskCount}
              {' '}
              个任务 ·
              {' '}
              {stats.totalDuration}
              s ·
              {' '}
              {stats.totalCost}
              {' '}
              元
            </span>
          )}
        </div>
      </header>

      <div className="app-body">
        <section className="app-left">
          <GenerateForm onSubmit={handleGenerate} loading={loading} />
        </section>
        <section className="app-right">
          <div className="section-header">
            <h2 className="section-title">生成记录</h2>
            <div className="filter-tabs">
              {([
                { value: 'all' as const, label: '全部' },
                { value: 'video' as const, label: '视频' },
                { value: 'image' as const, label: '图片' },
              ]).map(f => (
                <button
                  type="button"
                  key={f.value}
                  className={`filter-tab ${taskFilter === f.value ? 'active' : ''}`}
                  onClick={() => setTaskFilter(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <TaskList tasks={filteredTasks} />
        </section>
      </div>
    </div>
  )
}
