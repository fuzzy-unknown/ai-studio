import type { GenerateFormData } from './components/GenerateForm/types'
import type { Task, UsageStats } from './types'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { GenerateForm } from './components/GenerateForm'
import { TaskList } from './components/TaskList'
import { useTaskWatcher } from './hooks/useTaskWatcher'
import { getGenerateEndpoint, getTaskCategory, isImageTaskLike } from './modelRegistry'

const IN_PROGRESS = new Set(['PENDING', 'RUNNING'])
const PAGE_SIZE = 50

function buildInputMediaPreview(data: GenerateFormData): string | null {
  const category = getTaskCategory({ model: data.model })
  const media = [
    data.imageUrl ? { type: 'first_frame', url: data.imageUrl } : null,
    data.lastFrameUrl ? { type: 'last_frame', url: data.lastFrameUrl } : null,
    data.drivingAudioUrl ? { type: 'driving_audio', url: data.drivingAudioUrl } : null,
    data.firstClipUrl ? { type: 'first_clip', url: data.firstClipUrl } : null,
    ...(data.imageUrls ?? []).map(url => ({
      type: category === 'image' ? 'input_image' : 'reference_image',
      url,
    })),
  ].filter(Boolean)

  return media.length > 0 ? JSON.stringify(media) : null
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [taskFilter, setTaskFilter] = useState<'all' | 'video' | 'image'>('all')
  const [retryData, setRetryData] = useState<Partial<GenerateFormData> | null>(null)
  const [hasMoreTasks, setHasMoreTasks] = useState(false)

  const tasksEndpoint = useCallback((offset: number) => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
    })
    if (taskFilter !== 'all')
      params.set('type', taskFilter)
    return `/api/tasks?${params.toString()}`
  }, [taskFilter])

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(tasksEndpoint(0))
      if (res.ok) {
        const rows = await res.json() as Task[]
        setTasks(rows)
        setHasMoreTasks(rows.length === PAGE_SIZE)
      }
    }
    catch {}
  }, [tasksEndpoint])

  const loadMoreTasks = useCallback(async () => {
    try {
      const res = await fetch(tasksEndpoint(tasks.length))
      if (res.ok) {
        const rows = await res.json() as Task[]
        setTasks(prev => [...prev, ...rows])
        setHasMoreTasks(rows.length === PAGE_SIZE)
      }
    }
    catch {}
  }, [tasks.length, tasksEndpoint])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/usage/stats')
      setStats(await res.json() as UsageStats)
    }
    catch {}
  }, [])

  const refreshTasksAndStats = useCallback(() => {
    fetchTasks()
    fetchStats()
  }, [fetchTasks, fetchStats])

  useEffect(() => {
    fetchTasks()
    fetchStats()
  }, [fetchTasks, fetchStats])

  // 只监控真实任务（排除 temp- 前缀的乐观更新卡片）
  const watchingIds = useMemo(
    () => tasks.filter(t => IN_PROGRESS.has(t.status) && !t.taskId.startsWith('temp-')).map(t => t.taskId),
    [tasks],
  )

  // 构建 taskId → model 映射，供 SSE 选择正确端点
  const taskModels = useMemo(
    () => new Map(tasks.map(t => [t.taskId, t.model ?? ''])),
    [tasks],
  )

  useTaskWatcher(watchingIds, useCallback((taskId: string, event: any) => {
    setTasks(prev => prev.map(t =>
      t.taskId === taskId
        ? { ...t, status: event.status, videoUrl: event.video_url ?? t.videoUrl, errorMessage: event.error ?? t.errorMessage }
        : t,
    ))
    if (['SUCCEEDED', 'FAILED', 'UNKNOWN', 'CANCELED', 'ERROR'].includes(event.status)) {
      fetchTasks()
      fetchStats()
    }
  }, [fetchTasks, fetchStats]), taskModels)

  const handleGenerate = async (data: GenerateFormData) => {
    setLoading(true)

    // 立即在列表顶部插入一个临时任务卡片，给用户即时反馈
    const optimisticId = `temp-${Date.now()}`
    const category = getTaskCategory({ model: data.model })
    const optimisticTask = {
      id: -1,
      taskId: optimisticId,
      type: category,
      model: data.model,
      prompt: data.prompt,
      status: 'PENDING',
      resolution: data.resolution || null,
      ratio: data.ratio || null,
      duration: data.duration || null,
      inputVideoUrl: data.videoUrl || null,
      inputImageUrl: buildInputMediaPreview(data),
      videoUrl: null,
      localPath: null,
      usage: null,
      cost: null,
      errorMessage: null,
      createdAt: new Date().toISOString().replace('T', ' ').split('.')[0],
      updatedAt: null,
      size: data.size || null,
      negativePrompt: data.negativePrompt || null,
      n: data.n || null,
      promptExtend: data.promptExtend ? 1 : 0,
      requestId: null,
    } as Task

    if (taskFilter === 'all' || taskFilter === category)
      setTasks(prev => [optimisticTask, ...prev])

    try {
      const endpoint = getGenerateEndpoint(data.model)
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
              个任务
              {stats.totalDuration > 0 && (
                <>
                  {' '}
                  ·
                  {' '}
                  {stats.totalDuration}
                  s
                </>
              )}
              {' '}
              ·
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
          <GenerateForm onSubmit={handleGenerate} loading={loading} retryData={retryData} onRetryConsumed={() => setRetryData(null)} />
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
          <TaskList
            tasks={tasks}
            hasMore={hasMoreTasks}
            onLoadMore={loadMoreTasks}
            onRefresh={refreshTasksAndStats}
            onRetry={(task) => {
              const isImage = isImageTaskLike(task)
              setRetryData({
                model: task.model || undefined,
                prompt: task.prompt,
                resolution: task.resolution || (isImage ? task.size : undefined) || '',
                size: isImage ? (task.size ?? undefined) : undefined,
                ratio: task.ratio || undefined,
                duration: task.duration || undefined,
                negativePrompt: task.negativePrompt || undefined,
              })
              // 切换到对应的 category tab
              setTaskFilter(isImage ? 'image' : 'video')
            }}
          />
        </section>
      </div>
    </div>
  )
}
