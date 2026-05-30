import { useEffect, useRef } from 'react'

interface TaskEvent {
  status: string
  video_url?: string | null
  error?: string | null
}

const TERMINAL = new Set(['SUCCEEDED', 'FAILED', 'UNKNOWN', 'CANCELED', 'DONE', 'ERROR'])

export function useTaskWatcher(
  taskIds: string[],
  onUpdate: (taskId: string, event: TaskEvent) => void,
  /** taskId → model 映射，用于选择 SSE 端点 */
  taskModels?: Map<string, string>,
) {
  const connectionsRef = useRef<Map<string, EventSource>>(new Map())
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
    const activeIds = new Set(taskIds)

    // 关闭不再需要的 SSE
    for (const [id, es] of current) {
      if (!activeIds.has(id)) {
        es.close()
        current.delete(id)
      }
    }

    // 为新的 taskId 建立 SSE
    for (const id of taskIds) {
      if (current.has(id))
        continue

      const model = taskModels?.get(id)
      const isImage = model?.startsWith('qwen-image')
      const endpoint = isImage
        ? `/api/image/tasks/${id}/events`
        : `/api/video/tasks/${id}/events`

      const es = new EventSource(endpoint)
      current.set(id, es)

      es.onmessage = (e) => {
        const data = JSON.parse(e.data) as TaskEvent
        onUpdateRef.current(id, data)
        if (TERMINAL.has(data.status)) {
          es.close()
          current.delete(id)
        }
      }

      es.onerror = () => {
        es.close()
        current.delete(id)
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
    }
  }, [])
}
