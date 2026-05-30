import { useEffect, useRef } from 'react'

interface TaskEvent {
  status: string
  video_url?: string | null
  error?: string | null
}

const TERMINAL = new Set(['SUCCEEDED', 'FAILED', 'UNKNOWN', 'CANCELED', 'DONE', 'ERROR'])
const POLL_INTERVAL = 2000
const MAX_RETRIES = 3

export function useTaskWatcher(
  taskIds: string[],
  onUpdate: (taskId: string, event: TaskEvent) => void,
  /** 保留接口兼容，不再使用 */
  _taskModels?: Map<string, string>,
) {
  // 每个 task 的上一次 status，用于去重
  const lastStatusRef = useRef<Map<string, string>>(new Map())
  const retryCountRef = useRef<Map<string, number>>(new Map())
  const retryTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const pollTimerRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map())
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  // 用排序后的 JSON 字符串做值比较，避免数组引用变化导致 effect 重跑
  const prevKeyRef = useRef('')

  useEffect(() => {
    const key = [...taskIds].sort().join(',')
    if (key === prevKeyRef.current)
      return
    prevKeyRef.current = key

    const lastStatus = lastStatusRef.current
    const retries = retryCountRef.current
    const retryTimers = retryTimerRef.current
    const pollTimers = pollTimerRef.current
    const activeIds = new Set(taskIds)

    const clearRetryTimer = (id: string) => {
      const timer = retryTimers.get(id)
      if (timer) {
        clearTimeout(timer)
        retryTimers.delete(id)
      }
    }

    const stopPolling = (id: string) => {
      const timer = pollTimers.get(id)
      if (timer) {
        clearInterval(timer)
        pollTimers.delete(id)
      }
      lastStatus.delete(id)
      retries.delete(id)
      clearRetryTimer(id)
    }

    const pollTask = async (id: string) => {
      try {
        const res = await fetch(`/api/tasks/${id}`)
        if (!res.ok)
          throw new Error(`HTTP ${res.status}`)

        const task = await res.json() as any
        const newStatus = task.status as string
        const prevStatus = lastStatus.get(id)

        // 状态变化时才触发回调
        if (newStatus !== prevStatus) {
          lastStatus.set(id, newStatus)
          onUpdateRef.current(id, {
            status: newStatus,
            video_url: task.videoUrl || null,
            error: task.errorMessage || null,
          })
        }

        // 终态停止轮询
        if (TERMINAL.has(newStatus)) {
          stopPolling(id)
        }

        // 成功一次就重置重试计数
        retries.set(id, 0)
      }
      catch {
        const retryCount = retries.get(id) ?? 0
        if (retryCount < MAX_RETRIES) {
          retries.set(id, retryCount + 1)
        }
        else {
          // 超过重试次数，停止轮询
          stopPolling(id)
        }
      }
    }

    const startPolling = (id: string) => {
      // 立即查一次
      pollTask(id)
      // 然后每 2 秒轮询
      const timer = setInterval(pollTask, POLL_INTERVAL, id)
      pollTimers.set(id, timer)
    }

    // 停止不再需要的轮询
    for (const id of pollTimers.keys()) {
      if (!activeIds.has(id))
        stopPolling(id)
    }

    // 为新的 taskId 启动轮询
    for (const id of taskIds) {
      if (pollTimers.has(id))
        continue

      retries.set(id, 0)
      clearRetryTimer(id)
      startPolling(id)
    }
  }, [taskIds])

  // 组件卸载时清理所有轮询
  useEffect(() => {
    const pollTimers = pollTimerRef.current
    const retryTimers = retryTimerRef.current
    const lastStatus = lastStatusRef.current
    const retries = retryCountRef.current
    return () => {
      for (const timer of pollTimers.values())
        clearInterval(timer)
      pollTimers.clear()
      for (const timer of retryTimers.values())
        clearTimeout(timer)
      retryTimers.clear()
      lastStatus.clear()
      retries.clear()
    }
  }, [])
}
