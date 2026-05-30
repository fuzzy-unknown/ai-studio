import { useEffect, useRef } from 'react'

interface TaskEvent {
  status: string
  video_url?: string | null
  error?: string | null
}

const TERMINAL = new Set(['SUCCEEDED', 'FAILED', 'UNKNOWN', 'CANCELED', 'DONE', 'ERROR'])
const MAX_RETRIES = 3

export function useTaskWatcher(
  taskIds: string[],
  onUpdate: (taskId: string, event: TaskEvent) => void,
  /** taskId → model 映射，用于选择 SSE 端点 */
  taskModels?: Map<string, string>,
) {
  const connectionsRef = useRef<Map<string, EventSource>>(new Map())
  const retryCountRef = useRef<Map<string, number>>(new Map())
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  // 用排序后的 JSON 字符串做值比较，避免数组引用变化导致 effect 重跑
  const prevKeyRef = useRef('')

  useEffect(() => {
    const key = [...taskIds].sort().join(',')
    if (key === prevKeyRef.current)
      return
    prevKeyRef.current = key

    const current = connectionsRef.current
    const retries = retryCountRef.current
    const activeIds = new Set(taskIds)

    // 关闭不再需要的 SSE
    for (const [id, es] of current) {
      if (!activeIds.has(id)) {
        es.close()
        current.delete(id)
        retries.delete(id)
      }
    }

    // 为新的 taskId 建立 SSE（统一端点）
    for (const id of taskIds) {
      if (current.has(id))
        continue

      const endpoint = `/api/tasks/${id}/events`
      const es = new EventSource(endpoint)
      current.set(id, es)
      retries.set(id, 0)

      es.onmessage = (e) => {
        const data = JSON.parse(e.data) as TaskEvent
        onUpdateRef.current(id, data)
        if (TERMINAL.has(data.status)) {
          es.close()
          current.delete(id)
          retries.delete(id)
        }
      }

      es.onerror = () => {
        const retryCount = retries.get(id) ?? 0
        es.close()
        current.delete(id)

        if (retryCount < MAX_RETRIES) {
          // 指数退避重连：1s, 2s, 4s
          retries.set(id, retryCount + 1)
          const delay = Math.pow(2, retryCount) * 1000
          setTimeout(() => {
            if (!current.has(id) && activeIds.has(id)) {
              const newEs = new EventSource(endpoint)
              current.set(id, newEs)
              newEs.onmessage = es.onmessage
              newEs.onerror = es.onerror
            }
          }, delay)
        }
        else {
          // 超过重试次数，兜底：直接从服务端拉最新状态
          retries.delete(id)
          fetch(`/api/tasks/${id}`)
            .then(r => r.json())
            .then((task: any) => {
              onUpdateRef.current(id, {
                status: task.status,
                video_url: task.videoUrl || null,
                error: task.errorMessage || null,
              })
            })
            .catch(() => {})
        }
      }
    }
  }, [taskIds, taskModels])

  // 组件卸载时清理所有连接
  useEffect(() => {
    const current = connectionsRef.current
    return () => {
      for (const es of current.values())
        es.close()
      current.clear()
      retryCountRef.current.clear()
    }
  }, [])
}
