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

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/video/tasks')
      setTasks(await res.json() as Task[])
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
  }, [fetchTasks, fetchStats]))

  const handleGenerate = async (data: { prompt: string, model: string, imageUrl?: string, imageUrls?: string[], videoUrl?: string, resolution: string, ratio?: string, duration?: number, watermark?: boolean, audioSetting?: string, seed?: number }) => {
    setLoading(true)
    try {
      const res = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (result.task_id) {
        await fetchTasks()
        fetchStats()
      }
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
          <p>HappyHorse 视频生成</p>
          {stats && stats.taskCount > 0 && (
            <span className="app-stats">
              已生成
              {' '}
              {stats.taskCount}
              {' '}
              个视频 ·
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
          <h2 className="section-title">生成记录</h2>
          <TaskList tasks={tasks} />
        </section>
      </div>
    </div>
  )
}
